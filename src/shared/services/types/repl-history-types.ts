/**
 * Type definitions for REPL history management
 */

export interface HistoryEntry {
	command: string
	timestamp: Date
	context: "cli" | "api-client"
	executionTime?: number
	success?: boolean
}

export interface ReplHistoryOptions {
	historyFile?: string
	maxHistorySize?: number
	storageDir?: string
	deduplication?: boolean
	autoSave?: boolean
	context?: "cli" | "api-client"
}

export interface HistoryStats {
	totalEntries: number
	uniqueCommands: number
	mostUsedCommands: Array<{ command: string; count: number }>
	averageCommandLength: number
	oldestEntry?: Date
	newestEntry?: Date
}

export interface HistoryFileFormat {
	version: string
	context: string
	maxSize: number
	created: string
	lastModified: string
	entries: HistoryEntry[]
}

export interface ReplHistoryConfig {
	historyEnabled: boolean
	historyMaxSize: number
	historyFile: string
	historyDeduplication: boolean
	autoSave: boolean
}
