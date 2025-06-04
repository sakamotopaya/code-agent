import * as fs from "fs/promises"
import * as path from "path"
import type { SessionInfo, RetentionPolicy, StorageInfo } from "../types/session-types"
import { SessionStatus } from "../types/session-types"
import { SessionStorage } from "./SessionStorage"

export class SessionCleanup {
	private storage: SessionStorage

	constructor(storage: SessionStorage) {
		this.storage = storage
	}

	async cleanupByAge(maxAgeDays: number): Promise<number> {
		const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
		const sessions = await this.storage.listSessions()

		let deletedCount = 0
		for (const session of sessions) {
			if (session.updatedAt < cutoffDate && session.status !== SessionStatus.ACTIVE) {
				try {
					await this.storage.deleteSession(session.id)
					deletedCount++
				} catch (error) {
					console.warn(`Failed to delete session ${session.id}: ${error}`)
				}
			}
		}

		return deletedCount
	}

	async cleanupByCount(maxCount: number): Promise<number> {
		const sessions = await this.storage.listSessions()

		if (sessions.length <= maxCount) {
			return 0
		}

		// Sort by last updated time, keep the most recent
		const sorted = sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
		const toDelete = sorted.slice(maxCount)

		let deletedCount = 0
		for (const session of toDelete) {
			// Don't delete active sessions
			if (session.status !== SessionStatus.ACTIVE) {
				try {
					await this.storage.deleteSession(session.id)
					deletedCount++
				} catch (error) {
					console.warn(`Failed to delete session ${session.id}: ${error}`)
				}
			}
		}

		return deletedCount
	}

	async cleanupBySize(maxSizeBytes: number): Promise<number> {
		const sessions = await this.storage.listSessions()

		// Sort by size, largest first
		const sessionsWithSize = await Promise.all(
			sessions.map(async (session) => ({
				...session,
				size: await this.storage.getSessionSize(session.id),
			})),
		)

		sessionsWithSize.sort((a, b) => b.size - a.size)

		let totalSize = sessionsWithSize.reduce((sum, session) => sum + session.size, 0)
		let deletedCount = 0

		for (const session of sessionsWithSize) {
			if (totalSize <= maxSizeBytes) {
				break
			}

			// Don't delete active sessions
			if (session.status !== SessionStatus.ACTIVE) {
				try {
					await this.storage.deleteSession(session.id)
					totalSize -= session.size
					deletedCount++
				} catch (error) {
					console.warn(`Failed to delete session ${session.id}: ${error}`)
				}
			}
		}

		return deletedCount
	}

	async cleanupCorrupted(): Promise<number> {
		const sessions = await this.storage.listSessions()
		let deletedCount = 0

		for (const sessionInfo of sessions) {
			try {
				// Try to load the session to check if it's corrupted
				await this.storage.loadSession(sessionInfo.id)
			} catch (error) {
				// Session is corrupted, delete it
				try {
					await this.storage.deleteSession(sessionInfo.id)
					deletedCount++
					console.log(`Deleted corrupted session: ${sessionInfo.id}`)
				} catch (deleteError) {
					console.warn(`Failed to delete corrupted session ${sessionInfo.id}: ${deleteError}`)
				}
			}
		}

		return deletedCount
	}

	async cleanupWithPolicy(policy: RetentionPolicy): Promise<{
		deletedByAge: number
		deletedByCount: number
		totalDeleted: number
	}> {
		const results = {
			deletedByAge: 0,
			deletedByCount: 0,
			totalDeleted: 0,
		}

		// First cleanup by age
		if (policy.maxAge > 0) {
			results.deletedByAge = await this.cleanupByAge(policy.maxAge)
		}

		// Then cleanup by count (after age cleanup)
		if (policy.maxCount > 0) {
			results.deletedByCount = await this.cleanupByCount(policy.maxCount)
		}

		results.totalDeleted = results.deletedByAge + results.deletedByCount

		return results
	}

	async getStorageStatistics(): Promise<StorageInfo & { sessionsByStatus: Record<SessionStatus, number> }> {
		const sessions = await this.storage.listSessions()
		let totalSize = 0

		const sessionsByStatus: Record<SessionStatus, number> = {
			[SessionStatus.ACTIVE]: 0,
			[SessionStatus.COMPLETED]: 0,
			[SessionStatus.ABORTED]: 0,
			[SessionStatus.ARCHIVED]: 0,
		}

		for (const session of sessions) {
			totalSize += await this.storage.getSessionSize(session.id)
			sessionsByStatus[session.status] = (sessionsByStatus[session.status] || 0) + 1
		}

		const dates = sessions.map((s) => s.updatedAt).sort((a, b) => a.getTime() - b.getTime())

		return {
			totalSessions: sessions.length,
			totalSize,
			oldestSession: dates[0],
			newestSession: dates[dates.length - 1],
			sessionsByStatus,
		}
	}

	async archiveOldSessions(maxAgeDays: number): Promise<number> {
		const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
		const sessions = await this.storage.listSessions()

		let archivedCount = 0
		for (const sessionInfo of sessions) {
			if (sessionInfo.updatedAt < cutoffDate && sessionInfo.status === SessionStatus.COMPLETED) {
				try {
					const session = await this.storage.loadSession(sessionInfo.id)
					session.metadata.status = SessionStatus.ARCHIVED
					session.metadata.updatedAt = new Date()
					await this.storage.saveSession(session)
					archivedCount++
				} catch (error) {
					console.warn(`Failed to archive session ${sessionInfo.id}: ${error}`)
				}
			}
		}

		return archivedCount
	}

	async validateAllSessions(): Promise<{
		valid: number
		corrupted: string[]
		warnings: string[]
	}> {
		const sessions = await this.storage.listSessions()
		const result = {
			valid: 0,
			corrupted: [] as string[],
			warnings: [] as string[],
		}

		for (const sessionInfo of sessions) {
			try {
				const session = await this.storage.loadSession(sessionInfo.id)

				// Basic validation
				if (!session.id || !session.name || !session.metadata) {
					result.corrupted.push(sessionInfo.id)
					continue
				}

				// Check for inconsistencies
				if (session.metadata.commandCount !== session.history.messages.length) {
					result.warnings.push(`Session ${sessionInfo.id}: command count mismatch`)
				}

				if (session.history.messages.length > 10000) {
					result.warnings.push(`Session ${sessionInfo.id}: very large message history`)
				}

				result.valid++
			} catch (error) {
				result.corrupted.push(sessionInfo.id)
			}
		}

		return result
	}

	async repairSession(sessionId: string): Promise<boolean> {
		try {
			const session = await this.storage.loadSession(sessionId)

			// Fix common issues
			if (!session.metadata.version) {
				session.metadata.version = "1.0.0"
			}

			if (!session.metadata.createdAt) {
				session.metadata.createdAt = new Date()
			}

			if (!session.metadata.updatedAt) {
				session.metadata.updatedAt = new Date()
			}

			if (!session.metadata.lastAccessedAt) {
				session.metadata.lastAccessedAt = new Date()
			}

			if (!session.metadata.tags) {
				session.metadata.tags = []
			}

			if (session.metadata.commandCount !== session.history.messages.length) {
				session.metadata.commandCount = session.history.messages.length
			}

			if (!session.files) {
				session.files = {
					watchedDirectories: [],
					ignoredPatterns: [".git", "node_modules", ".roo"],
					lastScanTime: new Date(),
					fileChecksums: {},
				}
			}

			// Ensure all message IDs are unique
			const messageIds = new Set()
			for (const message of session.history.messages) {
				if (!message.id || messageIds.has(message.id)) {
					message.id = require("uuid").v4()
				}
				messageIds.add(message.id)

				if (!message.timestamp) {
					message.timestamp = new Date()
				}
			}

			await this.storage.saveSession(session)
			return true
		} catch (error) {
			console.error(`Failed to repair session ${sessionId}: ${error}`)
			return false
		}
	}
}
