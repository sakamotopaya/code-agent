import * as fs from "fs/promises"
import * as path from "path"
import { fileExistsAtPath } from "../../utils/fs"
import { getGlobalStoragePath } from "../paths"
import { HistoryEntry, ReplHistoryOptions, HistoryStats, HistoryFileFormat } from "./types/repl-history-types"

const HISTORY_FILE_VERSION = "1.0"
const DEFAULT_MAX_HISTORY_SIZE = 100
const AUTOSAVE_DEBOUNCE_MS = 1000

/**
 * Shared REPL history service for persistent command history management
 * Supports both CLI and API client REPLs with unified storage and features
 */
export class ReplHistoryService {
	private historyFile: string
	private maxHistorySize: number
	private history: HistoryEntry[] = []
	private isDirty: boolean = false
	private saveTimeout?: NodeJS.Timeout
	private context: string
	private deduplication: boolean
	private autoSave: boolean
	private initialized: boolean = false

	constructor(options: ReplHistoryOptions = {}) {
		const storageDir = options.storageDir || getGlobalStoragePath()
		const historyFileName = options.historyFile || `${options.context || "default"}-repl-history.json`

		this.historyFile = path.join(storageDir, historyFileName)
		this.maxHistorySize = options.maxHistorySize || DEFAULT_MAX_HISTORY_SIZE
		this.context = options.context || "unknown"
		this.deduplication = options.deduplication !== false
		this.autoSave = options.autoSave !== false
	}

	/**
	 * Initialize the history service and load existing history
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return
		}

		try {
			await this.ensureStorageDirectory()
			await this.loadHistory()
			this.initialized = true
		} catch (error) {
			console.warn(`Failed to initialize REPL history: ${error instanceof Error ? error.message : String(error)}`)
			// Continue with empty history - graceful degradation
			this.history = []
			this.initialized = true
		}
	}

	/**
	 * Load history from persistent storage
	 */
	async loadHistory(): Promise<HistoryEntry[]> {
		return this.safeFileOperation(
			async () => {
				if (!(await fileExistsAtPath(this.historyFile))) {
					return []
				}

				const data = await fs.readFile(this.historyFile, "utf8")
				const parsed: HistoryFileFormat = JSON.parse(data)

				// Validate file format
				if (!this.validateHistoryFormat(parsed)) {
					console.warn("Invalid history file format, creating backup and starting fresh")
					await this.createBackup()
					return []
				}

				// Convert timestamp strings back to Date objects
				const entries = parsed.entries.map((entry) => ({
					...entry,
					timestamp: new Date(entry.timestamp),
				}))

				// Ensure entries are in reverse chronological order (newest first)
				entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

				this.history = entries
				return entries
			},
			[],
			"Could not load history",
		)
	}

	/**
	 * Save history to persistent storage
	 */
	async saveHistory(): Promise<void> {
		if (!this.isDirty && this.initialized) {
			return
		}

		return this.safeFileOperation(
			async () => {
				await this.ensureStorageDirectory()

				const historyData: HistoryFileFormat = {
					version: HISTORY_FILE_VERSION,
					context: this.context,
					maxSize: this.maxHistorySize,
					created:
						this.history.length > 0
							? this.history[this.history.length - 1].timestamp.toISOString()
							: new Date().toISOString(),
					lastModified: new Date().toISOString(),
					entries: this.history,
				}

				await fs.writeFile(this.historyFile, JSON.stringify(historyData, null, 2), "utf8")
				this.isDirty = false
			},
			undefined,
			"Could not save history",
		)
	}

	/**
	 * Add a new entry to the history
	 */
	async addEntry(command: string, metadata: Partial<HistoryEntry> = {}): Promise<void> {
		if (!command.trim()) {
			return
		}

		// Ensure service is initialized
		if (!this.initialized) {
			await this.initialize()
		}

		const entry: HistoryEntry = {
			command: command.trim(),
			timestamp: metadata.timestamp || new Date(),
			context: metadata.context || (this.context as "cli" | "api-client"),
			executionTime: metadata.executionTime,
			success: metadata.success,
		}

		// Skip if deduplication is enabled and this is the same as the last command
		if (this.deduplication && this.history.length > 0) {
			const lastEntry = this.history[0] // Most recent is first
			if (lastEntry.command === entry.command) {
				return
			}
		}

		// Add to beginning (reverse chronological order)
		this.history.unshift(entry)

		// Prune if necessary
		this.pruneHistory()

		this.isDirty = true

		// Auto-save if enabled
		if (this.autoSave) {
			this.debouncedSave()
		}
	}

	/**
	 * Get history entries (most recent first)
	 */
	getHistory(limit?: number): HistoryEntry[] {
		const entries = limit ? this.history.slice(0, limit) : this.history
		return entries.map((entry) => ({ ...entry })) // Return copies to prevent mutation
	}

	/**
	 * Clear all history
	 */
	async clearHistory(): Promise<void> {
		this.history = []
		this.isDirty = true

		if (this.autoSave) {
			await this.saveHistory()
		}
	}

	/**
	 * Search history for entries matching a pattern
	 */
	searchHistory(pattern: string | RegExp): HistoryEntry[] {
		const regex = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern

		return this.history.filter((entry) => regex.test(entry.command)).map((entry) => ({ ...entry })) // Return copies
	}

	/**
	 * Get history statistics
	 */
	getStatistics(): HistoryStats {
		if (this.history.length === 0) {
			return {
				totalEntries: 0,
				uniqueCommands: 0,
				mostUsedCommands: [],
				averageCommandLength: 0,
			}
		}

		// Count command frequency
		const commandCounts = new Map<string, number>()
		let totalLength = 0

		for (const entry of this.history) {
			const count = commandCounts.get(entry.command) || 0
			commandCounts.set(entry.command, count + 1)
			totalLength += entry.command.length
		}

		// Sort by frequency
		const mostUsedCommands = Array.from(commandCounts.entries())
			.map(([command, count]) => ({ command, count }))
			.sort((a, b) => b.count - a.count)

		// Get date range
		const timestamps = this.history.map((entry) => entry.timestamp.getTime())
		const oldestEntry = new Date(Math.min(...timestamps))
		const newestEntry = new Date(Math.max(...timestamps))

		return {
			totalEntries: this.history.length,
			uniqueCommands: commandCounts.size,
			mostUsedCommands,
			averageCommandLength: totalLength / this.history.length,
			oldestEntry,
			newestEntry,
		}
	}

	/**
	 * Force save current history
	 */
	async flush(): Promise<void> {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout)
			this.saveTimeout = undefined
		}
		await this.saveHistory()
	}

	/**
	 * Get the history file path
	 */
	getHistoryFilePath(): string {
		return this.historyFile
	}

	/**
	 * Check if the service has unsaved changes
	 */
	isDirtyState(): boolean {
		return this.isDirty
	}

	// Private methods

	/**
	 * Prune history to maintain maximum size
	 */
	private pruneHistory(): void {
		if (this.history.length > this.maxHistorySize) {
			this.history = this.history.slice(0, this.maxHistorySize)
			this.isDirty = true
		}
	}

	/**
	 * Debounced save to reduce file I/O
	 */
	private debouncedSave(): void {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout)
		}

		this.saveTimeout = setTimeout(async () => {
			try {
				await this.saveHistory()
			} catch (error) {
				console.warn(`Failed to auto-save history: ${error instanceof Error ? error.message : String(error)}`)
			}
		}, AUTOSAVE_DEBOUNCE_MS)
	}

	/**
	 * Ensure the storage directory exists
	 */
	private async ensureStorageDirectory(): Promise<void> {
		const dir = path.dirname(this.historyFile)
		await fs.mkdir(dir, { recursive: true })
	}

	/**
	 * Validate the history file format
	 */
	private validateHistoryFormat(data: any): data is HistoryFileFormat {
		return (
			data &&
			typeof data === "object" &&
			typeof data.version === "string" &&
			typeof data.context === "string" &&
			typeof data.maxSize === "number" &&
			Array.isArray(data.entries) &&
			data.entries.every(
				(entry: any) =>
					entry &&
					typeof entry.command === "string" &&
					(typeof entry.timestamp === "string" || entry.timestamp instanceof Date) &&
					typeof entry.context === "string",
			)
		)
	}

	/**
	 * Create a backup of the current history file
	 */
	private async createBackup(): Promise<void> {
		try {
			if (await fileExistsAtPath(this.historyFile)) {
				const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
				const backupDir = path.join(path.dirname(this.historyFile), "backups")
				await fs.mkdir(backupDir, { recursive: true })

				const backupFile = path.join(backupDir, `repl-history-backup-${timestamp}.json`)
				await fs.copyFile(this.historyFile, backupFile)
			}
		} catch (error) {
			console.warn(`Failed to create history backup: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Safe wrapper for file operations with error handling
	 */
	private async safeFileOperation<T>(operation: () => Promise<T>, fallback: T, errorMessage: string): Promise<T> {
		try {
			return await operation()
		} catch (error) {
			console.warn(`${errorMessage}: ${error instanceof Error ? error.message : String(error)}`)
			return fallback
		}
	}
}
