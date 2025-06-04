import type { Session, SessionMetadata, ConversationMessage, ToolState } from "../types/session-types"
import { SessionStatus } from "../types/session-types"
import type { ISessionSerializer, ValidationResult } from "../types/storage-types"

export class SessionSerializer implements ISessionSerializer {
	async serialize(session: Session): Promise<string> {
		try {
			const serializedSession = this.sanitizeSession(session)
			return JSON.stringify(serializedSession, null, 2)
		} catch (error) {
			throw new Error(`Failed to serialize session: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	async deserialize(data: string): Promise<Session> {
		try {
			const parsed = JSON.parse(data)
			const session = this.deserializeSession(parsed)
			const validation = this.validateSession(session)

			if (!validation.valid) {
				throw new Error(`Session validation failed: ${validation.errors.join(", ")}`)
			}

			return session
		} catch (error) {
			throw new Error(`Failed to deserialize session: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	sanitizeSession(session: Session): Session {
		const sanitized = JSON.parse(JSON.stringify(session))

		// Remove sensitive data
		if (sanitized.config) {
			delete sanitized.config.apiKey
			delete sanitized.config.encryptionKey
		}

		// Remove environment variables that might contain sensitive data
		if (sanitized.state?.environment) {
			const sensitiveKeys = ["API_KEY", "SECRET", "PASSWORD", "TOKEN", "PRIVATE_KEY", "AUTH"]

			Object.keys(sanitized.state.environment).forEach((key) => {
				if (sensitiveKeys.some((sensitive) => key.toUpperCase().includes(sensitive))) {
					delete sanitized.state.environment[key]
				}
			})
		}

		// Clear large cache data
		if (sanitized.tools) {
			sanitized.tools = sanitized.tools.map((tool: ToolState) => ({
				...tool,
				cache: {}, // Clear cache to reduce size
				results: tool.results?.slice(-10) || [], // Keep only last 10 results
			}))
		}

		// Limit conversation history to prevent excessive size
		if (sanitized.history?.messages) {
			const maxMessages = 1000
			if (sanitized.history.messages.length > maxMessages) {
				sanitized.history.messages = sanitized.history.messages.slice(-maxMessages)
			}
		}

		return sanitized
	}

	validateSession(session: Session): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		// Required fields validation
		if (!session.id) {
			errors.push("Session ID is required")
		}

		if (!session.name) {
			errors.push("Session name is required")
		}

		if (!session.metadata) {
			errors.push("Session metadata is required")
		} else {
			if (!session.metadata.createdAt) {
				errors.push("Session creation date is required")
			}

			if (!session.metadata.version) {
				errors.push("Session version is required")
			}

			if (!Object.values(SessionStatus).includes(session.metadata.status)) {
				errors.push(`Invalid session status: ${session.metadata.status}`)
			}
		}

		if (!session.state) {
			errors.push("Session state is required")
		} else {
			if (!session.state.workingDirectory) {
				errors.push("Working directory is required")
			}
		}

		if (!session.history) {
			errors.push("Session history is required")
		}

		if (!session.config) {
			errors.push("Session config is required")
		}

		// Warnings for data integrity
		if (session.history?.messages) {
			const messageCount = session.history.messages.length
			if (messageCount > 1000) {
				warnings.push(`Large number of messages: ${messageCount}`)
			}

			// Validate message structure
			session.history.messages.forEach((msg, index) => {
				if (!msg.id) {
					warnings.push(`Message at index ${index} missing ID`)
				}
				if (!msg.timestamp) {
					warnings.push(`Message at index ${index} missing timestamp`)
				}
				if (!["user", "assistant", "system"].includes(msg.role)) {
					warnings.push(`Message at index ${index} has invalid role: ${msg.role}`)
				}
			})
		}

		if (session.tools) {
			session.tools.forEach((tool, index) => {
				if (!tool.toolName) {
					warnings.push(`Tool at index ${index} missing name`)
				}
				if (!tool.lastUsed) {
					warnings.push(`Tool at index ${index} missing last used timestamp`)
				}
			})
		}

		// Size warnings
		const sessionSize = JSON.stringify(session).length
		if (sessionSize > 50 * 1024 * 1024) {
			// 50MB
			warnings.push(`Session size is very large: ${Math.round(sessionSize / (1024 * 1024))}MB`)
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		}
	}

	private deserializeSession(data: any): Session {
		// Convert date strings back to Date objects
		if (data.metadata) {
			if (data.metadata.createdAt) {
				data.metadata.createdAt = new Date(data.metadata.createdAt)
			}
			if (data.metadata.updatedAt) {
				data.metadata.updatedAt = new Date(data.metadata.updatedAt)
			}
			if (data.metadata.lastAccessedAt) {
				data.metadata.lastAccessedAt = new Date(data.metadata.lastAccessedAt)
			}
		}

		if (data.history?.messages) {
			data.history.messages = data.history.messages.map((msg: any) => ({
				...msg,
				timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
			}))
		}

		if (data.history?.checkpoints) {
			data.history.checkpoints = data.history.checkpoints.map((checkpoint: any) => ({
				...checkpoint,
				timestamp: checkpoint.timestamp ? new Date(checkpoint.timestamp) : new Date(),
			}))
		}

		if (data.tools) {
			data.tools = data.tools.map((tool: any) => ({
				...tool,
				lastUsed: tool.lastUsed ? new Date(tool.lastUsed) : new Date(),
				results:
					tool.results?.map((result: any) => ({
						...result,
						timestamp: result.timestamp ? new Date(result.timestamp) : new Date(),
					})) || [],
			}))
		}

		if (data.files?.lastScanTime) {
			data.files.lastScanTime = new Date(data.files.lastScanTime)
		}

		if (data.state?.activeProcesses) {
			data.state.activeProcesses = data.state.activeProcesses.map((process: any) => ({
				...process,
				startTime: process.startTime ? new Date(process.startTime) : new Date(),
			}))
		}

		if (data.state?.mcpConnections) {
			data.state.mcpConnections = data.state.mcpConnections.map((connection: any) => ({
				...connection,
				lastConnected: connection.lastConnected ? new Date(connection.lastConnected) : undefined,
			}))
		}

		return data as Session
	}
}
