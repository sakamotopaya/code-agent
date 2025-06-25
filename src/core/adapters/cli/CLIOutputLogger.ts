/**
 * CLI Output Logger - logs all CLI output adapter method calls for debugging
 * Creates timestamped log files to track all output operations
 */

import { promises as fs } from "fs"
import path from "path"

export class CLIOutputLogger {
	private logFilePath: string
	private isEnabled: boolean
	private logStream: fs.FileHandle | null = null
	private initializationPromise: Promise<void> | null = null
	private pendingWrites: string[] = []

	constructor(enabled: boolean = true, logDir?: string) {
		this.isEnabled = enabled

		// Create timestamped log file name
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, -5)
		const fileName = `cli-output-${timestamp}.log`

		// Use provided log directory or default to current working directory
		const baseDir = logDir || process.cwd()
		this.logFilePath = path.join(baseDir, fileName)
	}

	/**
	 * Initialize the log file
	 */
	async initialize(): Promise<void> {
		if (!this.isEnabled) return

		// Prevent multiple concurrent initializations
		if (this.initializationPromise) {
			return this.initializationPromise
		}

		this.initializationPromise = this.doInitialize()
		return this.initializationPromise
	}

	private async doInitialize(): Promise<void> {
		try {
			// Ensure the log directory exists
			const logDir = path.dirname(this.logFilePath)
			await fs.mkdir(logDir, { recursive: true })

			// Open the log file for writing
			this.logStream = await fs.open(this.logFilePath, "a")

			// Write header
			const header = `=== CLI Output Adapter Log - ${new Date().toISOString()} ===\n`
			await this.logStream.write(header)

			// Write any pending writes that occurred before initialization
			for (const pendingWrite of this.pendingWrites) {
				await this.logStream.write(pendingWrite)
			}
			this.pendingWrites = []
		} catch (error) {
			console.error(`[CLIOutputLogger] Failed to initialize log file: ${error}`)
			this.isEnabled = false
		}
	}

	/**
	 * Log a method call with timestamp, method name, and message
	 */
	async logMethodCall(methodName: string, message?: string, additionalData?: any): Promise<void> {
		if (!this.isEnabled) return

		const timestamp = new Date().toISOString()
		const messageText = message ? String(message).substring(0, 500) : "No message" // Limit message length
		const additionalInfo = additionalData
			? ` | Additional: ${JSON.stringify(additionalData).substring(0, 200)}`
			: ""

		const logEntry = `${timestamp} | ${methodName} | ${messageText}${additionalInfo}\n-----\n`

		await this.writeToLog(logEntry)
	}

	/**
	 * Write content to log file
	 */
	private async writeToLog(content: string): Promise<void> {
		if (!this.isEnabled) return

		// If not initialized yet, queue the write
		if (!this.logStream) {
			this.pendingWrites.push(content)
			await this.initialize()
			return
		}

		try {
			await this.logStream.write(content)
		} catch (error) {
			console.error(`[CLIOutputLogger] Failed to write to log: ${error}`)
		}
	}

	/**
	 * Close the log file
	 */
	async close(): Promise<void> {
		// Wait for any pending initialization to complete
		if (this.initializationPromise) {
			await this.initializationPromise
		}

		if (this.logStream) {
			try {
				await this.logStream.close()
				this.logStream = null
			} catch (error) {
				console.error(`[CLIOutputLogger] Failed to close log file: ${error}`)
			}
		}

		// Reset initialization state
		this.initializationPromise = null
		this.pendingWrites = []
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
let globalCLIOutputLogger: CLIOutputLogger | null = null

/**
 * Get or create the global CLI output logger instance
 */
export function getGlobalCLIOutputLogger(): CLIOutputLogger {
	if (!globalCLIOutputLogger) {
		globalCLIOutputLogger = new CLIOutputLogger(true)
	}
	return globalCLIOutputLogger
}

/**
 * Initialize the global CLI output logger
 */
export async function initializeGlobalCLIOutputLogger(): Promise<void> {
	const logger = getGlobalCLIOutputLogger()
	await logger.initialize()
}

/**
 * Close the global CLI output logger
 */
export async function closeGlobalCLIOutputLogger(): Promise<void> {
	if (globalCLIOutputLogger) {
		await globalCLIOutputLogger.close()
		globalCLIOutputLogger = null
	}
}
