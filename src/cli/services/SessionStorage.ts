import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import * as zlib from "zlib"
import * as crypto from "crypto"
import { promisify } from "util"
import type { Session, SessionInfo, SessionFile, SessionFilter, SessionStatus } from "../types/session-types"
import { SESSION_FORMAT_VERSION } from "../types/session-types"
import type { ISessionStorage, StorageConfig, ValidationResult } from "../types/storage-types"
import { DEFAULT_STORAGE_CONFIG } from "../types/storage-types"

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

export class SessionStorage implements ISessionStorage {
	private config: StorageConfig
	private sessionDir: string

	constructor(config: Partial<StorageConfig> = {}) {
		this.config = { ...DEFAULT_STORAGE_CONFIG, ...config }
		this.sessionDir = this.expandPath(this.config.sessionDirectory)
	}

	async initialize(): Promise<void> {
		// Ensure session directory exists
		await fs.mkdir(this.sessionDir, { recursive: true, mode: this.config.filePermissions })

		// Create metadata file if it doesn't exist
		const metadataPath = path.join(this.sessionDir, "metadata.json")
		try {
			await fs.access(metadataPath)
		} catch {
			const metadata = {
				version: SESSION_FORMAT_VERSION,
				created: new Date().toISOString(),
				sessions: {},
			}
			await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
		}
	}

	async saveSession(session: Session): Promise<void> {
		await this.initialize()

		const sanitizedSession = this.sanitizeSession(session)
		const sessionFile: SessionFile = {
			version: SESSION_FORMAT_VERSION,
			session: sanitizedSession,
			checksum: this.calculateChecksum(sanitizedSession),
			compressed: this.config.compressionLevel > 0,
		}

		const filePath = this.getSessionFilePath(session.id)
		let data = JSON.stringify(sessionFile, null, 2)

		if (sessionFile.compressed) {
			const compressed = await gzip(data, { level: this.config.compressionLevel })
			await fs.writeFile(filePath, compressed, { mode: this.config.filePermissions })
		} else {
			await fs.writeFile(filePath, data, { mode: this.config.filePermissions })
		}

		// Update metadata
		await this.updateMetadata(session)
	}

	async loadSession(sessionId: string, updateLastAccessed: boolean = true): Promise<Session> {
		const filePath = this.getSessionFilePath(sessionId)

		try {
			const fileData = await fs.readFile(filePath)
			let data: string

			// Try to decompress first
			try {
				data = await gunzip(fileData).then((buf) => buf.toString())
			} catch {
				// If decompression fails, assume it's uncompressed
				data = fileData.toString()
			}

			const sessionFile: SessionFile = JSON.parse(data)

			// Validate checksum
			if (!this.validateChecksum(sessionFile)) {
				throw new Error("Session file checksum validation failed")
			}

			// Update last accessed time if requested
			if (updateLastAccessed) {
				sessionFile.session.metadata.lastAccessedAt = new Date()
				await this.saveSession(sessionFile.session)
			}

			return this.deserializeSession(sessionFile.session)
		} catch (error) {
			throw new Error(
				`Failed to load session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	async deleteSession(sessionId: string): Promise<void> {
		const filePath = this.getSessionFilePath(sessionId)

		try {
			await fs.unlink(filePath)
			await this.removeFromMetadata(sessionId)
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw new Error(
					`Failed to delete session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
	}

	async listSessions(filter?: SessionFilter): Promise<SessionInfo[]> {
		await this.initialize()

		try {
			const files = await fs.readdir(this.sessionDir)
			const sessionFiles = files.filter((file) => file.startsWith("session-") && file.endsWith(".json"))

			const sessions: SessionInfo[] = []

			for (const file of sessionFiles) {
				try {
					const sessionId = this.extractSessionIdFromFilename(file)
					const filePath = path.join(this.sessionDir, file)

					// Get file stats for size
					const stats = await fs.stat(filePath)

					// Read file content directly without full loadSession
					const fileData = await fs.readFile(filePath)
					let data: string

					// Handle decompression if needed
					try {
						data = await gunzip(fileData).then((buf) => buf.toString())
					} catch {
						// If decompression fails, assume it's uncompressed
						data = fileData.toString()
					}

					const sessionFile: SessionFile = JSON.parse(data)
					const session = sessionFile.session

					// Create SessionInfo without full deserialization
					const sessionInfo: SessionInfo = {
						id: session.id,
						name: session.name,
						description: session.description,
						createdAt: new Date(session.metadata.createdAt),
						updatedAt: new Date(session.metadata.updatedAt),
						lastAccessedAt: new Date(session.metadata.lastAccessedAt),
						tags: session.metadata.tags,
						status: session.metadata.status,
						size: stats.size,
						messageCount: session.history.messages.length,
						duration: session.metadata.duration,
					}

					if (this.matchesFilter(sessionInfo, filter)) {
						sessions.push(sessionInfo)
					}
				} catch (error) {
					// Skip corrupted sessions
					console.warn(`Skipping corrupted session file: ${file}`)
				}
			}

			// Apply sorting and pagination
			sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

			if (filter?.offset || filter?.limit) {
				const start = filter.offset || 0
				const end = filter.limit ? start + filter.limit : undefined
				return sessions.slice(start, end)
			}

			return sessions
		} catch (error) {
			throw new Error(`Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	async exists(sessionId: string): Promise<boolean> {
		const filePath = this.getSessionFilePath(sessionId)
		try {
			await fs.access(filePath)
			return true
		} catch {
			return false
		}
	}

	async getSessionSize(sessionId: string): Promise<number> {
		const filePath = this.getSessionFilePath(sessionId)
		try {
			const stats = await fs.stat(filePath)
			return stats.size
		} catch {
			return 0
		}
	}

	async compress(data: string): Promise<Buffer> {
		return gzip(data, { level: this.config.compressionLevel })
	}

	async decompress(data: Buffer): Promise<string> {
		const decompressed = await gunzip(data)
		return decompressed.toString()
	}

	calculateChecksum(data: any): string {
		const hash = crypto.createHash("sha256")
		hash.update(JSON.stringify(data))
		return hash.digest("hex")
	}

	validateChecksum(sessionFile: SessionFile): boolean {
		const expectedChecksum = this.calculateChecksum(sessionFile.session)
		return expectedChecksum === sessionFile.checksum
	}

	private expandPath(filePath: string): string {
		if (filePath.startsWith("~/")) {
			return path.join(os.homedir(), filePath.slice(2))
		}
		return path.resolve(filePath)
	}

	private getSessionFilePath(sessionId: string): string {
		return path.join(this.sessionDir, `session-${sessionId}.json`)
	}

	private extractSessionIdFromFilename(filename: string): string {
		const match = filename.match(/^session-(.+)\.json$/)
		if (!match) {
			throw new Error(`Invalid session filename: ${filename}`)
		}
		return match[1]
	}

	private sanitizeSession(session: Session): Session {
		// Use structuredClone to properly preserve Date objects and other types
		const sanitized = structuredClone(session)

		// Remove any potentially sensitive information from config if it exists
		if (sanitized.config && typeof sanitized.config === "object") {
			const configAny = sanitized.config as any
			// Defensively remove common sensitive fields that might exist
			delete configAny.apiKey
			delete configAny.encryptionKey
			delete configAny.password
			delete configAny.token
			delete configAny.secret
		}

		// Remove large cache data that can be regenerated
		sanitized.tools = sanitized.tools.map((tool: any) => ({
			...tool,
			cache: {}, // Clear cache data
		}))

		return sanitized
	}

	private deserializeSession(session: Session): Session {
		// Convert date strings back to Date objects
		const deserialized = structuredClone(session)

		deserialized.metadata.createdAt = new Date(deserialized.metadata.createdAt)
		deserialized.metadata.updatedAt = new Date(deserialized.metadata.updatedAt)
		deserialized.metadata.lastAccessedAt = new Date(deserialized.metadata.lastAccessedAt)

		if (deserialized.history?.messages) {
			deserialized.history.messages = deserialized.history.messages.map((msg: any) => ({
				...msg,
				timestamp: new Date(msg.timestamp),
			}))
		}

		if (deserialized.history?.checkpoints) {
			deserialized.history.checkpoints = deserialized.history.checkpoints.map((checkpoint: any) => ({
				...checkpoint,
				timestamp: new Date(checkpoint.timestamp),
			}))
		}

		if (deserialized.tools) {
			deserialized.tools = deserialized.tools.map((tool: any) => ({
				...tool,
				lastUsed: new Date(tool.lastUsed),
				results:
					tool.results?.map((result: any) => ({
						...result,
						timestamp: new Date(result.timestamp),
					})) || [],
			}))
		}

		if (deserialized.files?.lastScanTime) {
			deserialized.files.lastScanTime = new Date(deserialized.files.lastScanTime)
		}

		return deserialized
	}

	private async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
		try {
			const filePath = this.getSessionFilePath(sessionId)
			const stats = await fs.stat(filePath)

			// Read file content directly without triggering loadSession side effects
			const fileData = await fs.readFile(filePath)
			let data: string

			// Handle decompression if needed
			try {
				data = await gunzip(fileData).then((buf) => buf.toString())
			} catch {
				// If decompression fails, assume it's uncompressed
				data = fileData.toString()
			}

			const sessionFile: SessionFile = JSON.parse(data)
			const session = sessionFile.session

			return {
				id: session.id,
				name: session.name,
				description: session.description,
				createdAt: new Date(session.metadata.createdAt),
				updatedAt: new Date(session.metadata.updatedAt),
				lastAccessedAt: new Date(session.metadata.lastAccessedAt),
				tags: session.metadata.tags,
				status: session.metadata.status,
				size: stats.size,
				messageCount: session.history?.messages?.length || 0,
				duration: session.metadata.duration,
			}
		} catch {
			return null
		}
	}

	private matchesFilter(sessionInfo: SessionInfo, filter?: SessionFilter): boolean {
		if (!filter) return true

		if (filter.status && sessionInfo.status !== filter.status) {
			return false
		}

		if (filter.tags && filter.tags.length > 0) {
			const hasMatchingTag = filter.tags.some((tag) => sessionInfo.tags.includes(tag))
			if (!hasMatchingTag) {
				return false
			}
		}

		if (filter.createdAfter && sessionInfo.createdAt < filter.createdAfter) {
			return false
		}

		if (filter.createdBefore && sessionInfo.createdAt > filter.createdBefore) {
			return false
		}

		if (filter.namePattern) {
			const regex = new RegExp(filter.namePattern, "i")
			if (!regex.test(sessionInfo.name)) {
				return false
			}
		}

		return true
	}

	private async updateMetadata(session: Session): Promise<void> {
		const metadataPath = path.join(this.sessionDir, "metadata.json")

		try {
			const metadataContent = await fs.readFile(metadataPath, "utf-8")
			const metadata = JSON.parse(metadataContent)

			// Ensure sessions object exists
			if (!metadata.sessions) {
				metadata.sessions = {}
			}

			metadata.sessions[session.id] = {
				name: session.name,
				updatedAt: session.metadata.updatedAt.toISOString(),
				status: session.metadata.status,
				tags: session.metadata.tags,
			}

			await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
		} catch (error) {
			// If metadata update fails, log but don't fail the save operation
			console.warn(`Failed to update session metadata: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	private async removeFromMetadata(sessionId: string): Promise<void> {
		const metadataPath = path.join(this.sessionDir, "metadata.json")

		try {
			const metadataContent = await fs.readFile(metadataPath, "utf-8")
			const metadata = JSON.parse(metadataContent)

			// Ensure sessions object exists before trying to delete from it
			if (metadata.sessions) {
				delete metadata.sessions[sessionId]
			}

			await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
		} catch (error) {
			// If metadata update fails, log but don't fail the delete operation
			console.warn(
				`Failed to remove session from metadata: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}
}
