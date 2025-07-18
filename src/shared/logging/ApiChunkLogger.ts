/**
 * API Chunk Logger - logs raw HTTP response chunks for debugging
 * Creates timestamped log files to track complete API streaming interactions
 */

import fs from "fs/promises"
import path from "path"
import { getGlobalStoragePath } from "../paths"
import { ApiChunkLogContext, ApiChunkLoggerOptions } from "./types"

export class ApiChunkLogger {
	private logFilePath: string
	private isEnabled: boolean
	private isFirstChunk: boolean = true
	private context: ApiChunkLogContext | null = null
	private sequenceNumber: number = 0

	constructor(enabled: boolean = true, logDir?: string) {
		this.isEnabled = enabled

		// Create timestamped log file name
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, -5)
		const fileName = `raw-api-chunks-${timestamp}.log`

		// Use provided logDir, or global storage path + logs, or fallback to cwd
		let baseDir: string
		if (logDir) {
			baseDir = logDir
		} else {
			try {
				baseDir = path.join(getGlobalStoragePath(), "logs")
				console.log(`[ApiChunkLogger] Using global storage path: ${baseDir}`)
			} catch (error) {
				console.warn("Failed to get global storage path, using current directory")
				baseDir = path.join(process.cwd(), "logs")
				console.log(`[ApiChunkLogger] Using fallback path: ${baseDir}`)
			}
		}

		this.logFilePath = path.join(baseDir, fileName)
	}

	/**
	 * Initialize the log file with request context
	 */
	async initialize(context: ApiChunkLogContext): Promise<void> {
		if (!this.isEnabled) return

		this.context = context

		try {
			// Ensure the log directory exists
			const logDir = path.dirname(this.logFilePath)
			console.log(`[ApiChunkLogger] Creating log directory: ${logDir}`)
			console.log(`[ApiChunkLogger] Log file will be: ${this.logFilePath}`)
			await fs.mkdir(logDir, { recursive: true })

			// Write header with context information
			const header = [
				`=== API Chunk Log - ${context.timestamp} ===`,
				`Host: ${context.host}:${context.port}`,
				`Endpoint: ${context.endpoint}`,
				...(context.taskId ? [`Task ID: ${context.taskId}`] : []),
				...(context.requestId ? [`Request ID: ${context.requestId}`] : []),
				...(context.requestMetadata ? [`Request Metadata: ${JSON.stringify(context.requestMetadata)}`] : []),
				"===",
				"", // Empty line before content
			].join("\n")

			await fs.appendFile(this.logFilePath, header)
		} catch (error) {
			console.error(`[ApiChunkLogger] Failed to initialize log file: ${error}`)
			this.isEnabled = false
		}
	}

	/**
	 * Log a raw HTTP response chunk
	 */
	async logChunk(chunk: string): Promise<void> {
		if (!this.isEnabled || !chunk) return

		this.sequenceNumber++

		// Add separator (bullet character •) between chunks, but not before the first chunk
		const separator = this.isFirstChunk ? "" : "•"
		this.isFirstChunk = false

		const content = `${separator}${chunk}`

		await this.writeToLog(content)
	}

	/**
	 * Update context information (e.g., when task ID becomes available)
	 */
	updateContext(updates: Partial<ApiChunkLogContext>): void {
		if (this.context) {
			this.context = { ...this.context, ...updates }
		}
	}

	/**
	 * Write content to log file
	 */
	private async writeToLog(content: string): Promise<void> {
		if (!this.isEnabled) return

		try {
			await fs.appendFile(this.logFilePath, content)
		} catch (error) {
			console.error(`[ApiChunkLogger] Failed to write to log: ${error}`)
		}
	}

	/**
	 * Close the log file and finalize logging
	 */
	async close(): Promise<void> {
		if (!this.isEnabled) return

		try {
			// Write closing marker
			const footer = `\n\n=== End of API Chunk Log - ${new Date().toISOString()} ===\n`
			await fs.appendFile(this.logFilePath, footer)
		} catch (error) {
			console.error(`[ApiChunkLogger] Failed to write log footer: ${error}`)
		}

		// Reset state for potential reuse
		this.isFirstChunk = true
		this.sequenceNumber = 0
		this.context = null
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

	/**
	 * Get current context
	 */
	getContext(): ApiChunkLogContext | null {
		return this.context
	}

	/**
	 * Get current sequence number
	 */
	getSequenceNumber(): number {
		return this.sequenceNumber
	}
}

// Global instance for API client usage
let globalApiChunkLogger: ApiChunkLogger | null = null

/**
 * Get or create the global API chunk logger instance
 */
export function getGlobalApiChunkLogger(): ApiChunkLogger {
	if (!globalApiChunkLogger) {
		// Use logs directory by default for global instance
		try {
			const logsDir = path.join(getGlobalStoragePath(), "logs")
			globalApiChunkLogger = new ApiChunkLogger(true, logsDir)
		} catch (error) {
			console.warn("Failed to get global storage path, using current directory")
			globalApiChunkLogger = new ApiChunkLogger(true, path.join(process.cwd(), "logs"))
		}
	}
	return globalApiChunkLogger
}

/**
 * Initialize the global API chunk logger
 * Creates a new logger instance with a fresh timestamp for each interaction
 */
export async function initializeGlobalApiChunkLogger(context: ApiChunkLogContext): Promise<void> {
	// Close existing logger if it exists
	if (globalApiChunkLogger) {
		await globalApiChunkLogger.close()
		globalApiChunkLogger = null
	}

	// Create a new logger instance with fresh timestamp
	try {
		const logsDir = path.join(getGlobalStoragePath(), "logs")
		globalApiChunkLogger = new ApiChunkLogger(true, logsDir)
	} catch (error) {
		console.warn("Failed to get global storage path, using current directory")
		globalApiChunkLogger = new ApiChunkLogger(true, path.join(process.cwd(), "logs"))
	}

	await globalApiChunkLogger.initialize(context)
}

/**
 * Close the global API chunk logger
 */
export async function closeGlobalApiChunkLogger(): Promise<void> {
	if (globalApiChunkLogger) {
		await globalApiChunkLogger.close()
		globalApiChunkLogger = null
	}
}
