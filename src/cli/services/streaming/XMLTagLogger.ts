/**
 * LLM Content Logger - logs all raw content from LLM for debugging
 * Creates timestamped log files to track complete conversation
 */

import fs from "fs/promises"
import path from "path"

export class LLMContentLogger {
	private logFilePath: string
	private isEnabled: boolean
	private isFirstChunk: boolean = true

	constructor(enabled: boolean = true, logDir?: string) {
		this.isEnabled = enabled

		// Create timestamped log file name
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, -5)
		const fileName = `raw-llm-${timestamp}.log`

		// Use logs directory (same as LoggerConfigManager) or provided logDir or fallback to cwd
		const baseDir = logDir || process.env.LOGS_PATH || "./logs"
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

			// Write header
			const header = `=== LLM Content Log - ${new Date().toISOString()} ===\n`
			await fs.appendFile(this.logFilePath, header)
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
		if (!this.isEnabled) return

		try {
			await fs.appendFile(this.logFilePath, content)
		} catch (error) {
			console.error(`[LLMContentLogger] Failed to write to log: ${error}`)
		}
	}

	/**
	 * Close the log file
	 */
	async close(): Promise<void> {
		// No-op since we're using appendFile which doesn't require explicit closing
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
		// Use logs directory by default for global instance
		const logsDir = process.env.LOGS_PATH || "./logs"
		globalLLMContentLogger = new LLMContentLogger(true, logsDir)
	}
	return globalLLMContentLogger
}

/**
 * Initialize the global LLM content logger
 * Creates a new logger instance with a fresh timestamp for each interaction
 */
export async function initializeGlobalLLMContentLogger(): Promise<void> {
	// Close existing logger if it exists
	if (globalLLMContentLogger) {
		await globalLLMContentLogger.close()
		globalLLMContentLogger = null
	}

	// Create a new logger instance with fresh timestamp
	const logsDir = process.env.LOGS_PATH || "./logs"
	globalLLMContentLogger = new LLMContentLogger(true, logsDir)
	await globalLLMContentLogger.initialize()
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
