import { v4 as uuidv4 } from "uuid"
import * as fs from "fs/promises"
import * as path from "path"
import { EventEmitter } from "events"
import type {
	Session,
	SessionInfo,
	SessionFilter,
	RetentionPolicy,
	StorageInfo,
	ISessionManager,
	SessionEvents,
	SessionConfig,
	SessionState,
	ConversationHistory,
	SessionMetadata,
	ContextInfo,
} from "../types/session-types"
import { SessionStatus, DEFAULT_SESSION_CONFIG, SESSION_FORMAT_VERSION, ExportFormat } from "../types/session-types"
import { SessionStorage } from "./SessionStorage"
import { SessionSerializer } from "./SessionSerializer"
import type { StorageConfig } from "../types/storage-types"

export class SessionManager extends EventEmitter implements ISessionManager {
	private storage: SessionStorage
	private serializer: SessionSerializer
	private activeSession: Session | null = null
	private autoSaveTimer: NodeJS.Timeout | null = null
	private config: SessionConfig

	constructor(storageConfig?: Partial<StorageConfig>, sessionConfig?: Partial<SessionConfig>) {
		super()
		this.storage = new SessionStorage(storageConfig)
		this.serializer = new SessionSerializer()
		this.config = { ...DEFAULT_SESSION_CONFIG, ...sessionConfig }
	}

	async initialize(): Promise<void> {
		await this.storage.initialize()

		// Set up auto-save if enabled
		if (this.config.autoSave && this.config.autoSaveInterval > 0) {
			this.setupAutoSave()
		}
	}

	async createSession(name?: string, description?: string): Promise<Session> {
		const sessionId = uuidv4()
		const now = new Date()

		const session: Session = {
			id: sessionId,
			name: name || `Session ${now.toISOString().split("T")[0]}`,
			description,
			metadata: {
				createdAt: now,
				updatedAt: now,
				lastAccessedAt: now,
				version: SESSION_FORMAT_VERSION,
				tags: [],
				duration: 0,
				commandCount: 0,
				status: SessionStatus.ACTIVE,
			},
			state: {
				workingDirectory: process.cwd(),
				environment: this.sanitizeEnvironment(process.env),
				activeProcesses: [],
				openFiles: [],
				watchedFiles: [],
				mcpConnections: [],
			},
			history: {
				messages: [],
				context: this.createContextInfo(),
				checkpoints: [],
			},
			tools: [],
			files: {
				watchedDirectories: [],
				ignoredPatterns: [".git", "node_modules", ".roo", "*.log"],
				lastScanTime: now,
				fileChecksums: {},
			},
			config: { ...this.config },
		}

		await this.storage.saveSession(session)
		this.activeSession = session
		this.emit("sessionCreated", session)

		return session
	}

	async saveSession(sessionId: string): Promise<void> {
		let session: Session

		if (this.activeSession && this.activeSession.id === sessionId) {
			session = this.activeSession
		} else {
			session = await this.storage.loadSession(sessionId)
		}

		// Update metadata
		session.metadata.updatedAt = new Date()

		await this.storage.saveSession(session)
		this.emit("sessionSaved", sessionId)
	}

	async loadSession(sessionId: string): Promise<Session> {
		const session = await this.storage.loadSession(sessionId)
		this.activeSession = session
		this.emit("sessionLoaded", session)

		// Restart auto-save for the loaded session
		if (this.config.autoSave) {
			this.setupAutoSave()
		}

		return session
	}

	async deleteSession(sessionId: string): Promise<void> {
		await this.storage.deleteSession(sessionId)

		if (this.activeSession && this.activeSession.id === sessionId) {
			this.activeSession = null
			this.stopAutoSave()
		}

		this.emit("sessionDeleted", sessionId)
	}

	async listSessions(filter?: SessionFilter): Promise<SessionInfo[]> {
		return this.storage.listSessions(filter)
	}

	async findSessions(query: string): Promise<SessionInfo[]> {
		const allSessions = await this.storage.listSessions()

		return allSessions.filter((session) => {
			const searchText = `${session.name} ${session.description || ""} ${session.tags.join(" ")}`.toLowerCase()
			return searchText.includes(query.toLowerCase())
		})
	}

	getActiveSession(): Session | null {
		return this.activeSession
	}

	async exportSession(sessionId: string, format: ExportFormat): Promise<string> {
		const session = await this.storage.loadSession(sessionId)

		switch (format) {
			case ExportFormat.JSON:
				return JSON.stringify(session, null, 2)

			case ExportFormat.YAML:
				// Simple YAML conversion (in production, use a proper YAML library)
				return this.convertToYaml(session)

			case ExportFormat.MARKDOWN:
				return this.convertToMarkdown(session)

			case ExportFormat.ARCHIVE:
				// Create a compressed archive with session data and related files
				return this.createArchive(session)

			default:
				throw new Error(`Unsupported export format: ${format}`)
		}
	}

	async importSession(filePath: string): Promise<Session> {
		const data = await fs.readFile(filePath, "utf-8")
		const session = await this.serializer.deserialize(data)

		// Generate new ID to avoid conflicts
		session.id = uuidv4()
		session.metadata.createdAt = new Date()
		session.metadata.updatedAt = new Date()

		await this.storage.saveSession(session)
		return session
	}

	async archiveSession(sessionId: string): Promise<void> {
		const session = await this.storage.loadSession(sessionId)
		session.metadata.status = SessionStatus.ARCHIVED
		session.metadata.updatedAt = new Date()

		await this.storage.saveSession(session)
		this.emit("sessionArchived", sessionId)
	}

	async cleanupOldSessions(retentionPolicy: RetentionPolicy): Promise<number> {
		const allSessions = await this.storage.listSessions()
		const cutoffDate = new Date(Date.now() - retentionPolicy.maxAge * 24 * 60 * 60 * 1000)

		let deletedCount = 0
		const sessionsToDelete: SessionInfo[] = []

		// Apply retention policy
		for (const session of allSessions) {
			// Skip if session has protected tags
			if (retentionPolicy.keepTagged.some((tag) => session.tags.includes(tag))) {
				continue
			}

			// Skip archived sessions if configured
			if (retentionPolicy.keepArchived && session.status === SessionStatus.ARCHIVED) {
				continue
			}

			// Check age
			if (session.updatedAt < cutoffDate) {
				sessionsToDelete.push(session)
			}
		}

		// Apply count limit
		if (allSessions.length > retentionPolicy.maxCount) {
			const sorted = allSessions.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
			const excess = sorted.slice(0, allSessions.length - retentionPolicy.maxCount)

			for (const session of excess) {
				if (!sessionsToDelete.find((s) => s.id === session.id)) {
					sessionsToDelete.push(session)
				}
			}
		}

		// Delete sessions
		for (const session of sessionsToDelete) {
			try {
				await this.storage.deleteSession(session.id)
				deletedCount++
			} catch (error) {
				console.warn(`Failed to delete session ${session.id}: ${error}`)
			}
		}

		this.emit("cleanupCompleted", deletedCount)
		return deletedCount
	}

	async getStorageUsage(): Promise<StorageInfo> {
		const sessions = await this.storage.listSessions()
		let totalSize = 0

		for (const session of sessions) {
			totalSize += await this.storage.getSessionSize(session.id)
		}

		const dates = sessions.map((s) => s.updatedAt).sort((a, b) => a.getTime() - b.getTime())

		return {
			totalSessions: sessions.length,
			totalSize,
			oldestSession: dates[0],
			newestSession: dates[dates.length - 1],
		}
	}

	// Session state management methods
	async updateSessionState(updates: Partial<SessionState>): Promise<void> {
		if (!this.activeSession) {
			throw new Error("No active session")
		}

		this.activeSession.state = { ...this.activeSession.state, ...updates }
		this.activeSession.metadata.updatedAt = new Date()

		if (this.config.autoSave) {
			await this.saveSession(this.activeSession.id)
		}
	}

	async addMessage(content: string, role: "user" | "assistant" | "system", metadata?: any): Promise<void> {
		if (!this.activeSession) {
			throw new Error("No active session")
		}

		const message = {
			id: uuidv4(),
			timestamp: new Date(),
			role,
			content,
			metadata,
		}

		this.activeSession.history.messages.push(message)
		this.activeSession.metadata.commandCount++
		this.activeSession.metadata.updatedAt = new Date()

		// Trim history if it exceeds max length
		if (this.activeSession.history.messages.length > this.activeSession.config.maxHistoryLength) {
			this.activeSession.history.messages = this.activeSession.history.messages.slice(
				-this.activeSession.config.maxHistoryLength,
			)
		}

		if (this.config.autoSave) {
			await this.saveSession(this.activeSession.id)
		}
	}

	async createCheckpoint(description: string): Promise<void> {
		if (!this.activeSession) {
			throw new Error("No active session")
		}

		const checkpoint = {
			id: uuidv4(),
			timestamp: new Date(),
			description,
			messageIndex: this.activeSession.history.messages.length,
			state: { ...this.activeSession.state },
		}

		this.activeSession.history.checkpoints.push(checkpoint)
		await this.saveSession(this.activeSession.id)
	}

	private setupAutoSave(): void {
		this.stopAutoSave()

		if (this.activeSession && this.config.autoSave) {
			this.autoSaveTimer = setInterval(
				async () => {
					if (this.activeSession) {
						try {
							await this.saveSession(this.activeSession.id)
							this.emit("autoSaveTriggered", this.activeSession.id)
						} catch (error) {
							console.error("Auto-save failed:", error)
						}
					}
				},
				this.config.autoSaveInterval * 60 * 1000,
			)
		}
	}

	private stopAutoSave(): void {
		if (this.autoSaveTimer) {
			clearInterval(this.autoSaveTimer)
			this.autoSaveTimer = null
		}
	}

	private sanitizeEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
		const sanitized: Record<string, string> = {}
		const sensitiveKeys = ["API_KEY", "SECRET", "PASSWORD", "TOKEN", "PRIVATE_KEY", "AUTH"]

		for (const [key, value] of Object.entries(env)) {
			if (value && !sensitiveKeys.some((sensitive) => key.toUpperCase().includes(sensitive))) {
				sanitized[key] = value
			}
		}

		return sanitized
	}

	private createContextInfo(): ContextInfo {
		return {
			workspaceRoot: process.cwd(),
			activeFiles: [],
			environmentVariables: this.sanitizeEnvironment(process.env),
		}
	}

	private convertToYaml(session: Session): string {
		// Simple YAML conversion - in production use a proper YAML library
		const yaml = [
			`id: ${session.id}`,
			`name: "${session.name}"`,
			session.description ? `description: "${session.description}"` : "",
			`status: ${session.metadata.status}`,
			`created: ${session.metadata.createdAt.toISOString()}`,
			`updated: ${session.metadata.updatedAt.toISOString()}`,
			`messages: ${session.history.messages.length}`,
			`working_directory: "${session.state.workingDirectory}"`,
		]
			.filter(Boolean)
			.join("\n")

		return yaml
	}

	private convertToMarkdown(session: Session): string {
		const lines = [
			`# Session: ${session.name}`,
			"",
			session.description ? `${session.description}` : "",
			session.description ? "" : "",
			`**Created:** ${session.metadata.createdAt.toLocaleString()}`,
			`**Updated:** ${session.metadata.updatedAt.toLocaleString()}`,
			`**Status:** ${session.metadata.status}`,
			`**Working Directory:** ${session.state.workingDirectory}`,
			`**Messages:** ${session.history.messages.length}`,
			"",
			"## Conversation History",
			"",
		]

		// Add messages
		for (const message of session.history.messages) {
			lines.push(`### ${message.role} (${message.timestamp.toLocaleString()})`)
			lines.push("")
			lines.push(message.content)
			lines.push("")
		}

		return lines.join("\n")
	}

	private async createArchive(session: Session): Promise<string> {
		// This would create a compressed archive with session data
		// For now, return JSON representation
		return JSON.stringify(session, null, 2)
	}

	destroy(): void {
		this.stopAutoSave()
		this.removeAllListeners()
	}
}
