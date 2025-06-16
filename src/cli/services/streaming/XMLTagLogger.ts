/**
 * LLM Content Logger - logs all raw content from LLM for debugging
 * Creates timestamped log files to track complete conversation
 */

import { promises as fs } from "fs"
import path from "path"

export class LLMContentLogger {
	private logFilePath: string
	private isEnabled: boolean
	private logStream: fs.FileHandle | null = null
	private isFirstChunk: boolean = true

	constructor(enabled: boolean = true, logDir?: string) {
		this.isEnabled = enabled

		// Create timestamped log file name
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, -5)
		const fileName = `llm-${timestamp}.log`

		// Use provided log directory or default to current working directory
		const baseDir = logDir || process.cwd()
		this.logFilePath = path.join(baseDir, fileName)
	}

	/**
	 * Initialize the log file
	 */
	async initialize(): Promise<void> {
		if (!this.isEnabled) return

		try {
			// Ensure the log directory exists
			const logDir = path.dirname(this.logFilePath)
			await fs.mkdir(logDir, { recursive: true })

			// Open the log file for writing
			this.logStream = await fs.open(this.logFilePath, "a")

			// Write header
			const header = `=== LLM Content Log - ${new Date().toISOString()} ===\n`
			await this.writeToLog(header)
		} catch (error) {
			console.error(`[LLMContentLogger] Failed to initialize log file: ${error}`)
			this.isEnabled = false
		}
	}

	/**
	 * Log content chunk from LLM
	 */
	async logContent(content: string): Promise<void> {
		if (!this.isEnabled || !content) return

		// Add separator (ASCII 149 - bullet character •) between chunks
		const separator = this.isFirstChunk ? "" : "•"
		this.isFirstChunk = false

		await this.writeToLog(`${separator}${content}`)
	}

	/**
	 * Write content to log file
	 */
	private async writeToLog(content: string): Promise<void> {
		if (!this.logStream) {
			await this.initialize()
		}

		if (this.logStream) {
			try {
				await this.logStream.write(content)
			} catch (error) {
				console.error(`[LLMContentLogger] Failed to write to log: ${error}`)
			}
		}
	}

	/**
	 * Close the log file
	 */
	async close(): Promise<void> {
		if (this.logStream) {
			try {
				await this.logStream.close()
				this.logStream = null
			} catch (error) {
				console.error(`[LLMContentLogger] Failed to close log file: ${error}`)
			}
		}
	}

	/**
	 * Get the log file path
	 */
	getLogFilePath(): string {
		return this.logFilePath
	}

	/**
	 * Check if logging is enabled
	 */
	isLoggingEnabled(): boolean {
		return this.isEnabled
	}
}

// Global instance for CLI usage
let globalLLMContentLogger: LLMContentLogger | null = null

/**
 * Get or create the global LLM content logger instance
 */
export function getGlobalLLMContentLogger(): LLMContentLogger {
	if (!globalLLMContentLogger) {
		globalLLMContentLogger = new LLMContentLogger(true)
	}
	return globalLLMContentLogger
}

/**
 * Initialize the global LLM content logger
 */
export async function initializeGlobalLLMContentLogger(): Promise<void> {
	const logger = getGlobalLLMContentLogger()
	await logger.initialize()
}

/**
 * Close the global LLM content logger
 */
export async function closeGlobalLLMContentLogger(): Promise<void> {
	if (globalLLMContentLogger) {
		await globalLLMContentLogger.close()
		globalLLMContentLogger = null
	}
}

// Legacy exports for backward compatibility
export const XMLTagLogger = LLMContentLogger
export const getGlobalXMLTagLogger = getGlobalLLMContentLogger
export const initializeGlobalXMLTagLogger = initializeGlobalLLMContentLogger
export const closeGlobalXMLTagLogger = closeGlobalLLMContentLogger
