import chalk from "chalk"
import { Command } from "commander"
import { SessionManager } from "../services/SessionManager"
import { SessionCleanup } from "../services/SessionCleanup"
import { SessionStorage } from "../services/SessionStorage"
import type { SessionFilter, RetentionPolicy, SessionInfo } from "../types/session-types"
import { SessionStatus, ExportFormat } from "../types/session-types"

export class SessionCommands {
	private sessionManager: SessionManager
	private sessionCleanup: SessionCleanup

	constructor() {
		const storage = new SessionStorage()
		this.sessionManager = new SessionManager()
		this.sessionCleanup = new SessionCleanup(storage)
	}

	async initialize(): Promise<void> {
		await this.sessionManager.initialize()
	}

	registerCommands(program: Command): void {
		const sessionCommand = program.command("session").description("Session management commands")

		// List sessions
		sessionCommand
			.command("list")
			.alias("ls")
			.description("List all sessions")
			.option("-s, --status <status>", "Filter by status (active, completed, aborted, archived)")
			.option("-t, --tags <tags>", "Filter by tags (comma-separated)")
			.option("-l, --limit <number>", "Limit number of results", parseInt)
			.option("-o, --offset <number>", "Offset for pagination", parseInt)
			.option("--format <format>", "Output format (table, json, yaml)", "table")
			.option("--pattern <pattern>", "Name pattern to match")
			.action(async (options) => {
				await this.listSessions(options)
			})

		// Save current session
		sessionCommand
			.command("save")
			.description("Save current session")
			.argument("[name]", "Session name")
			.option("-d, --description <desc>", "Session description")
			.option("-t, --tags <tags>", "Session tags (comma-separated)")
			.action(async (name, options) => {
				await this.saveCurrentSession(name, options)
			})

		// Load session
		sessionCommand
			.command("load")
			.description("Load a session")
			.argument("<id>", "Session ID")
			.action(async (sessionId) => {
				await this.loadSession(sessionId)
			})

		// Delete session
		sessionCommand
			.command("delete")
			.alias("rm")
			.description("Delete a session")
			.argument("<id>", "Session ID")
			.option("-f, --force", "Force deletion without confirmation")
			.action(async (sessionId, options) => {
				await this.deleteSession(sessionId, options)
			})

		// Export session
		sessionCommand
			.command("export")
			.description("Export a session")
			.argument("<id>", "Session ID")
			.option("-f, --format <format>", "Export format (json, yaml, markdown, archive)", "json")
			.option("-o, --output <file>", "Output file path")
			.action(async (sessionId, options) => {
				await this.exportSession(sessionId, options)
			})

		// Import session
		sessionCommand
			.command("import")
			.description("Import a session")
			.argument("<file>", "Session file path")
			.action(async (filePath) => {
				await this.importSession(filePath)
			})

		// Archive session
		sessionCommand
			.command("archive")
			.description("Archive a session")
			.argument("<id>", "Session ID")
			.action(async (sessionId) => {
				await this.archiveSession(sessionId)
			})

		// Cleanup sessions
		sessionCommand
			.command("cleanup")
			.description("Cleanup old sessions")
			.option("--max-age <days>", "Maximum age in days", parseInt, 30)
			.option("--max-count <number>", "Maximum number of sessions", parseInt, 100)
			.option("--max-size <mb>", "Maximum total size in MB", parseInt, 1000)
			.option("--dry-run", "Show what would be deleted without actually deleting")
			.option("--corrupted", "Clean up corrupted sessions only")
			.action(async (options) => {
				await this.cleanupSessions(options)
			})

		// Show session info
		sessionCommand
			.command("info")
			.description("Show detailed session information")
			.argument("<id>", "Session ID")
			.action(async (sessionId) => {
				await this.showSessionInfo(sessionId)
			})

		// Session statistics
		sessionCommand
			.command("stats")
			.description("Show session storage statistics")
			.action(async () => {
				await this.showStats()
			})

		// Validate sessions
		sessionCommand
			.command("validate")
			.description("Validate all sessions")
			.option("--repair", "Attempt to repair corrupted sessions")
			.action(async (options) => {
				await this.validateSessions(options)
			})

		// Create new session
		sessionCommand
			.command("create")
			.description("Create a new session")
			.argument("[name]", "Session name")
			.option("-d, --description <desc>", "Session description")
			.option("-t, --tags <tags>", "Session tags (comma-separated)")
			.action(async (name, options) => {
				await this.createSession(name, options)
			})
	}

	private async listSessions(options: any): Promise<void> {
		try {
			const filter: SessionFilter = {}

			if (options.status) {
				if (!Object.values(SessionStatus).includes(options.status)) {
					console.error(chalk.red(`Invalid status: ${options.status}`))
					return
				}
				filter.status = options.status as SessionStatus
			}

			if (options.tags) {
				filter.tags = options.tags.split(",").map((tag: string) => tag.trim())
			}

			if (options.limit) {
				filter.limit = options.limit
			}

			if (options.offset) {
				filter.offset = options.offset
			}

			if (options.pattern) {
				filter.namePattern = options.pattern
			}

			const sessions = await this.sessionManager.listSessions(filter)

			if (sessions.length === 0) {
				console.log(chalk.gray("No sessions found"))
				return
			}

			if (options.format === "json") {
				console.log(JSON.stringify(sessions, null, 2))
			} else if (options.format === "yaml") {
				this.printSessionsAsYaml(sessions)
			} else {
				this.printSessionsAsTable(sessions)
			}
		} catch (error) {
			console.error(chalk.red("Failed to list sessions:"), error)
		}
	}

	private async saveCurrentSession(name?: string, options: any = {}): Promise<void> {
		try {
			const activeSession = this.sessionManager.getActiveSession()

			if (!activeSession) {
				console.log(chalk.yellow("No active session to save"))
				return
			}

			if (name) {
				activeSession.name = name
			}

			if (options.description) {
				activeSession.description = options.description
			}

			if (options.tags) {
				activeSession.metadata.tags = options.tags.split(",").map((tag: string) => tag.trim())
			}

			await this.sessionManager.saveSession(activeSession.id)
			console.log(chalk.green(`✓ Session saved: ${activeSession.name} (${activeSession.id})`))
		} catch (error) {
			console.error(chalk.red("Failed to save session:"), error)
		}
	}

	private async loadSession(sessionId: string): Promise<void> {
		try {
			const session = await this.sessionManager.loadSession(sessionId)
			console.log(chalk.green(`✓ Session loaded: ${session.name}`))
			console.log(chalk.gray(`Working directory: ${session.state.workingDirectory}`))
			console.log(chalk.gray(`Messages: ${session.history.messages.length}`))
		} catch (error) {
			console.error(chalk.red("Failed to load session:"), error)
		}
	}

	private async deleteSession(sessionId: string, options: any): Promise<void> {
		try {
			if (!options.force) {
				// In a real implementation, you'd want to add readline confirmation
				console.log(chalk.yellow("Use --force to confirm deletion"))
				return
			}

			await this.sessionManager.deleteSession(sessionId)
			console.log(chalk.green(`✓ Session deleted: ${sessionId}`))
		} catch (error) {
			console.error(chalk.red("Failed to delete session:"), error)
		}
	}

	private async exportSession(sessionId: string, options: any): Promise<void> {
		try {
			const format = this.parseExportFormat(options.format)
			const exported = await this.sessionManager.exportSession(sessionId, format)

			if (options.output) {
				const fs = require("fs/promises")
				await fs.writeFile(options.output, exported)
				console.log(chalk.green(`✓ Session exported to: ${options.output}`))
			} else {
				console.log(exported)
			}
		} catch (error) {
			console.error(chalk.red("Failed to export session:"), error)
		}
	}

	private async importSession(filePath: string): Promise<void> {
		try {
			const session = await this.sessionManager.importSession(filePath)
			console.log(chalk.green(`✓ Session imported: ${session.name} (${session.id})`))
		} catch (error) {
			console.error(chalk.red("Failed to import session:"), error)
		}
	}

	private async archiveSession(sessionId: string): Promise<void> {
		try {
			await this.sessionManager.archiveSession(sessionId)
			console.log(chalk.green(`✓ Session archived: ${sessionId}`))
		} catch (error) {
			console.error(chalk.red("Failed to archive session:"), error)
		}
	}

	private async cleanupSessions(options: any): Promise<void> {
		try {
			if (options.corrupted) {
				const deleted = await this.sessionCleanup.cleanupCorrupted()
				console.log(chalk.green(`✓ Cleaned up ${deleted} corrupted sessions`))
				return
			}

			const retentionPolicy: RetentionPolicy = {
				maxAge: options.maxAge,
				maxCount: options.maxCount,
				keepArchived: true,
				keepTagged: ["important", "favorite"],
			}

			if (options.dryRun) {
				console.log(chalk.yellow("Dry run mode - no sessions will be deleted"))
				// Implement dry run logic
				return
			}

			const result = await this.sessionCleanup.cleanupWithPolicy(retentionPolicy)
			console.log(chalk.green(`✓ Cleanup completed:`))
			console.log(`  - Deleted by age: ${result.deletedByAge}`)
			console.log(`  - Deleted by count: ${result.deletedByCount}`)
			console.log(`  - Total deleted: ${result.totalDeleted}`)
		} catch (error) {
			console.error(chalk.red("Failed to cleanup sessions:"), error)
		}
	}

	private async showSessionInfo(sessionId: string): Promise<void> {
		try {
			const sessions = await this.sessionManager.listSessions()
			const sessionInfo = sessions.find((s) => s.id === sessionId)

			if (!sessionInfo) {
				console.error(chalk.red(`Session not found: ${sessionId}`))
				return
			}

			console.log(chalk.cyan.bold("Session Information:"))
			console.log(`  ID: ${sessionInfo.id}`)
			console.log(`  Name: ${sessionInfo.name}`)
			if (sessionInfo.description) {
				console.log(`  Description: ${sessionInfo.description}`)
			}
			console.log(`  Status: ${sessionInfo.status}`)
			console.log(`  Created: ${sessionInfo.createdAt.toLocaleString()}`)
			console.log(`  Updated: ${sessionInfo.updatedAt.toLocaleString()}`)
			console.log(`  Last Accessed: ${sessionInfo.lastAccessedAt.toLocaleString()}`)
			console.log(`  Messages: ${sessionInfo.messageCount}`)
			console.log(`  Duration: ${Math.round(sessionInfo.duration / 1000)}s`)
			console.log(`  Size: ${this.formatBytes(sessionInfo.size)}`)
			if (sessionInfo.tags.length > 0) {
				console.log(`  Tags: ${sessionInfo.tags.join(", ")}`)
			}
		} catch (error) {
			console.error(chalk.red("Failed to show session info:"), error)
		}
	}

	private async showStats(): Promise<void> {
		try {
			const stats = await this.sessionCleanup.getStorageStatistics()

			console.log(chalk.cyan.bold("Session Storage Statistics:"))
			console.log(`  Total Sessions: ${stats.totalSessions}`)
			console.log(`  Total Size: ${this.formatBytes(stats.totalSize)}`)
			console.log(`  Oldest Session: ${stats.oldestSession?.toLocaleString() || "N/A"}`)
			console.log(`  Newest Session: ${stats.newestSession?.toLocaleString() || "N/A"}`)
			console.log()
			console.log(chalk.cyan.bold("Sessions by Status:"))
			for (const [status, count] of Object.entries(stats.sessionsByStatus)) {
				console.log(`  ${status}: ${count}`)
			}
		} catch (error) {
			console.error(chalk.red("Failed to show stats:"), error)
		}
	}

	private async validateSessions(options: any): Promise<void> {
		try {
			const result = await this.sessionCleanup.validateAllSessions()

			console.log(chalk.cyan.bold("Session Validation Results:"))
			console.log(`  Valid sessions: ${chalk.green(result.valid)}`)
			console.log(`  Corrupted sessions: ${chalk.red(result.corrupted.length)}`)
			console.log(`  Warnings: ${chalk.yellow(result.warnings.length)}`)

			if (result.corrupted.length > 0) {
				console.log()
				console.log(chalk.red.bold("Corrupted Sessions:"))
				for (const sessionId of result.corrupted) {
					console.log(`  - ${sessionId}`)
				}

				if (options.repair) {
					console.log()
					console.log(chalk.blue("Attempting to repair corrupted sessions..."))
					let repaired = 0
					for (const sessionId of result.corrupted) {
						if (await this.sessionCleanup.repairSession(sessionId)) {
							console.log(chalk.green(`  ✓ Repaired: ${sessionId}`))
							repaired++
						} else {
							console.log(chalk.red(`  ✗ Failed to repair: ${sessionId}`))
						}
					}
					console.log(chalk.green(`✓ Repaired ${repaired} of ${result.corrupted.length} sessions`))
				}
			}

			if (result.warnings.length > 0) {
				console.log()
				console.log(chalk.yellow.bold("Warnings:"))
				for (const warning of result.warnings) {
					console.log(`  - ${warning}`)
				}
			}
		} catch (error) {
			console.error(chalk.red("Failed to validate sessions:"), error)
		}
	}

	private async createSession(name?: string, options: any = {}): Promise<void> {
		try {
			const session = await this.sessionManager.createSession(name, options.description)

			if (options.tags) {
				session.metadata.tags = options.tags.split(",").map((tag: string) => tag.trim())
				await this.sessionManager.saveSession(session.id)
			}

			console.log(chalk.green(`✓ Session created: ${session.name} (${session.id})`))
		} catch (error) {
			console.error(chalk.red("Failed to create session:"), error)
		}
	}

	private printSessionsAsTable(sessions: SessionInfo[]): void {
		console.log(chalk.cyan.bold("Sessions:"))
		console.log()

		const headers = ["ID", "Name", "Status", "Messages", "Updated", "Size"]
		const columnWidths = [8, 25, 10, 8, 20, 10]

		// Print headers
		const headerRow = headers.map((header, i) => header.padEnd(columnWidths[i])).join(" ")
		console.log(chalk.gray(headerRow))
		console.log(chalk.gray("-".repeat(headerRow.length)))

		// Print sessions
		for (const session of sessions) {
			const row = [
				session.id.substring(0, 8),
				session.name.length > 24 ? session.name.substring(0, 21) + "..." : session.name,
				session.status,
				session.messageCount.toString(),
				session.updatedAt.toLocaleDateString(),
				this.formatBytes(session.size),
			]

			const formattedRow = row.map((cell, i) => cell.padEnd(columnWidths[i])).join(" ")

			const color = session.status === SessionStatus.ACTIVE ? chalk.green : chalk.white
			console.log(color(formattedRow))
		}
	}

	private printSessionsAsYaml(sessions: SessionInfo[]): void {
		console.log("sessions:")
		for (const session of sessions) {
			console.log(`  - id: ${session.id}`)
			console.log(`    name: "${session.name}"`)
			console.log(`    status: ${session.status}`)
			console.log(`    messages: ${session.messageCount}`)
			console.log(`    updated: ${session.updatedAt.toISOString()}`)
			console.log(`    size: ${session.size}`)
			if (session.tags.length > 0) {
				console.log(`    tags: [${session.tags.join(", ")}]`)
			}
		}
	}

	private parseExportFormat(format: string): ExportFormat {
		const normalizedFormat = format.toLowerCase()
		switch (normalizedFormat) {
			case "json":
				return ExportFormat.JSON
			case "yaml":
			case "yml":
				return ExportFormat.YAML
			case "markdown":
			case "md":
				return ExportFormat.MARKDOWN
			case "archive":
			case "tar":
				return ExportFormat.ARCHIVE
			default:
				throw new Error(`Unsupported export format: ${format}`)
		}
	}

	private formatBytes(bytes: number): string {
		if (bytes === 0) return "0 B"
		const k = 1024
		const sizes = ["B", "KB", "MB", "GB"]
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
	}
}
