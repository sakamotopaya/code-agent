import { NonInteractiveLogging, LogLevel, LogFormat, LogDestination } from "../types/automation-types"
import * as fs from "fs/promises"
import * as path from "path"

export class AutomationLogger {
	private config: NonInteractiveLogging
	private logFile?: string

	constructor(config: Partial<NonInteractiveLogging> = {}) {
		this.config = {
			level: config.level || LogLevel.INFO,
			format: config.format || LogFormat.TEXT,
			destination: config.destination || LogDestination.CONSOLE,
			includeTimestamps: config.includeTimestamps !== false,
			includeMetrics: config.includeMetrics || false,
			structuredOutput: config.structuredOutput || false,
		}

		if (this.config.destination === LogDestination.FILE || this.config.destination === LogDestination.BOTH) {
			this.logFile = this.generateLogFileName()
		}
	}

	private generateLogFileName(): string {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
		return path.join(process.cwd(), "logs", `roo-cli-${timestamp}.log`)
	}

	private shouldLog(level: LogLevel): boolean {
		const levels: Record<LogLevel, number> = {
			[LogLevel.TRACE]: 0,
			[LogLevel.DEBUG]: 1,
			[LogLevel.INFO]: 2,
			[LogLevel.WARN]: 3,
			[LogLevel.ERROR]: 4,
		}

		return levels[level] >= levels[this.config.level]
	}

	private formatMessage(level: LogLevel, message: string, data?: any): string {
		const timestamp = this.config.includeTimestamps ? new Date().toISOString() : ""

		switch (this.config.format) {
			case LogFormat.JSON: {
				return JSON.stringify({
					timestamp,
					level,
					message,
					data: data || undefined,
				})
			}

			case LogFormat.CSV: {
				return [
					timestamp,
					level,
					`"${message.replace(/"/g, '""')}"`,
					data ? `"${JSON.stringify(data).replace(/"/g, '""')}"` : "",
				]
					.filter(Boolean)
					.join(",")
			}

			case LogFormat.TEXT:
			default: {
				const parts = []
				if (timestamp) parts.push(`[${timestamp}]`)
				parts.push(`[${level.toUpperCase()}]`)
				parts.push(message)
				if (data) parts.push(JSON.stringify(data, null, 2))
				return parts.join(" ")
			}
		}
	}

	private async writeToFile(message: string): Promise<void> {
		if (!this.logFile) return

		try {
			// Ensure log directory exists
			const logDir = path.dirname(this.logFile)
			await fs.mkdir(logDir, { recursive: true })

			// Append to log file
			await fs.appendFile(this.logFile, message + "\n")
		} catch (error) {
			// Fall back to console if file writing fails
			console.error("Failed to write to log file:", error)
			console.log(message)
		}
	}

	private async log(level: LogLevel, message: string, data?: any): Promise<void> {
		if (!this.shouldLog(level)) return

		const formattedMessage = this.formatMessage(level, message, data)

		// Write to console
		if (this.config.destination === LogDestination.CONSOLE || this.config.destination === LogDestination.BOTH) {
			if (level === LogLevel.ERROR) {
				console.error(formattedMessage)
			} else if (level === LogLevel.WARN) {
				console.warn(formattedMessage)
			} else {
				console.log(formattedMessage)
			}
		}

		// Write to file
		if (this.config.destination === LogDestination.FILE || this.config.destination === LogDestination.BOTH) {
			await this.writeToFile(formattedMessage)
		}
	}

	async trace(message: string, data?: any): Promise<void> {
		await this.log(LogLevel.TRACE, message, data)
	}

	async debug(message: string, data?: any): Promise<void> {
		await this.log(LogLevel.DEBUG, message, data)
	}

	async info(message: string, data?: any): Promise<void> {
		await this.log(LogLevel.INFO, message, data)
	}

	async warn(message: string, data?: any): Promise<void> {
		await this.log(LogLevel.WARN, message, data)
	}

	async error(message: string, error?: any): Promise<void> {
		let errorData = error

		if (error instanceof Error) {
			errorData = {
				name: error.name,
				message: error.message,
				stack: error.stack,
			}
		}

		await this.log(LogLevel.ERROR, message, errorData)
	}

	async logMetrics(metrics: Record<string, any>): Promise<void> {
		if (!this.config.includeMetrics) return

		await this.log(LogLevel.INFO, "Execution Metrics", {
			timestamp: new Date().toISOString(),
			...metrics,
		})
	}

	async logProgress(progress: {
		completed: number
		total: number
		progress: number
		currentCommand?: string
	}): Promise<void> {
		const message = `Progress: ${progress.completed}/${progress.total} (${progress.progress.toFixed(1)}%)`
		const data = progress.currentCommand ? { currentCommand: progress.currentCommand } : undefined

		await this.log(LogLevel.INFO, message, data)
	}

	async logCommandStart(commandId: string, command: string): Promise<void> {
		await this.log(LogLevel.DEBUG, `Starting command: ${commandId}`, { command })
	}

	async logCommandComplete(commandId: string, success: boolean, duration: number): Promise<void> {
		const status = success ? "SUCCESS" : "FAILED"
		await this.log(LogLevel.INFO, `Command ${commandId} completed: ${status}`, {
			duration: `${duration}ms`,
		})
	}

	async logBatchSummary(summary: {
		totalCommands: number
		successful: number
		failed: number
		skipped: number
		totalTime: number
	}): Promise<void> {
		await this.log(LogLevel.INFO, "Batch Execution Summary", summary)
	}

	getLogFile(): string | undefined {
		return this.logFile
	}

	updateConfig(config: Partial<NonInteractiveLogging>): void {
		this.config = { ...this.config, ...config }
	}
}
