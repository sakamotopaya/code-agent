/**
 * Main error handling service that coordinates all error handling functionality
 */

import {
	ErrorContext,
	ErrorResult,
	ErrorFormat,
	ErrorCategory,
	ErrorStatistics,
	DebugInfo,
	ErrorReport,
	IErrorHandlingService,
} from "../types/error-types"
import { RecoveryResult } from "../types/recovery-types"
import { ErrorClassifier } from "./ErrorClassifier"
import { RecoveryManager } from "./RecoveryManager"
import { ErrorReporter } from "./ErrorReporter"

export class ErrorHandlingService implements IErrorHandlingService {
	private classifier: ErrorClassifier
	private recoveryManager: RecoveryManager
	private reporter: ErrorReporter
	private debugMode: boolean = false
	private errorCount: number = 0

	constructor() {
		this.classifier = new ErrorClassifier()
		this.recoveryManager = new RecoveryManager()
		this.reporter = new ErrorReporter()
	}

	/**
	 * Main error handling entry point
	 */
	async handleError(error: Error, context: ErrorContext): Promise<ErrorResult> {
		this.errorCount++

		try {
			// Log the error
			await this.logError(error, context)

			// Classify the error
			const classifiedError = this.classifier.classifyError(error, context)

			// Attempt recovery if the error is recoverable
			let recovered = false
			let recoveryResult: RecoveryResult | undefined

			if (classifiedError.isRecoverable) {
				recoveryResult = await this.attemptRecovery(error, context)
				recovered = recoveryResult.success
			}

			// Generate error report
			const errorReport = await this.generateErrorReport(error, context)

			// Format suggestions and next actions
			const suggestions = classifiedError.suggestedActions
			const nextActions = this.getNextActions(classifiedError, recovered, recoveryResult)

			return {
				success: recovered,
				recovered,
				errorReport,
				suggestions,
				nextActions,
			}
		} catch (handlingError) {
			console.error("Error handling failed:", handlingError)

			return {
				success: false,
				recovered: false,
				suggestions: [
					"Error handling system encountered an issue",
					"Please report this to support",
					"Try restarting the application",
				],
			}
		}
	}

	/**
	 * Categorize an error
	 */
	categorizeError(error: Error): ErrorCategory {
		return this.classifier.categorizeError(error)
	}

	/**
	 * Format error for display
	 */
	formatError(error: Error, format: ErrorFormat): string {
		switch (format) {
			case ErrorFormat.PLAIN:
				return this.formatPlainError(error)

			case ErrorFormat.JSON:
				return this.formatJsonError(error)

			case ErrorFormat.STRUCTURED:
				return this.formatStructuredError(error)

			case ErrorFormat.USER_FRIENDLY:
				return this.formatUserFriendlyError(error)

			default:
				return this.formatPlainError(error)
		}
	}

	/**
	 * Attempt error recovery
	 */
	async attemptRecovery(error: Error, context: ErrorContext): Promise<RecoveryResult> {
		return this.recoveryManager.attemptRecovery(error, context)
	}

	/**
	 * Rollback an operation
	 */
	async rollbackOperation(operationId: string): Promise<void> {
		return this.recoveryManager.rollbackOperation(operationId)
	}

	/**
	 * Clean up resources
	 */
	async cleanupResources(context: ErrorContext): Promise<void> {
		return this.recoveryManager.cleanupResources(context)
	}

	/**
	 * Log an error
	 */
	async logError(error: Error, context: ErrorContext): Promise<void> {
		const level = this.getLogLevel(error)
		const message = `${error.name}: ${error.message}`

		const logData = {
			error: {
				name: error.name,
				message: error.message,
				stack: this.debugMode ? error.stack : undefined,
			},
			context: {
				operationId: context.operationId,
				command: context.command,
				timestamp: context.timestamp.toISOString(),
			},
		}

		switch (level) {
			case "error":
				console.error(message, this.debugMode ? logData : "")
				break
			case "warn":
				console.warn(message, this.debugMode ? logData : "")
				break
			case "info":
				console.info(message, this.debugMode ? logData : "")
				break
			default:
				console.log(message, this.debugMode ? logData : "")
		}
	}

	/**
	 * Report an error (with user consent)
	 */
	async reportError(error: Error, userConsent: boolean): Promise<void> {
		return this.reporter.reportError(error, userConsent)
	}

	/**
	 * Get error statistics
	 */
	async getErrorStatistics(): Promise<ErrorStatistics> {
		return this.reporter.getErrorStatistics()
	}

	/**
	 * Enable/disable debug mode
	 */
	enableDebugMode(enabled: boolean): void {
		this.debugMode = enabled
		console.debug(`Debug mode ${enabled ? "enabled" : "disabled"}`)
	}

	/**
	 * Capture debug information
	 */
	captureDebugInfo(error: Error): DebugInfo {
		const context = this.createDebugContext(error)

		return {
			context,
			performanceMetrics: {
				executionTime: 0, // Would be measured from operation start
				memoryUsage: process.memoryUsage(),
				cpuUsage: process.cpuUsage(),
			},
			networkLogs: [], // Would be populated by network interceptors
			fileSystemOperations: [], // Would be populated by fs interceptors
			memorySnapshot: {
				timestamp: new Date(),
				heapUsed: process.memoryUsage().heapUsed,
				heapTotal: process.memoryUsage().heapTotal,
				external: process.memoryUsage().external,
				arrayBuffers: process.memoryUsage().arrayBuffers,
			},
		}
	}

	/**
	 * Generate comprehensive error report
	 */
	async generateErrorReport(error: Error, context?: ErrorContext): Promise<ErrorReport> {
		const errorContext = context || this.createBasicContext(error)
		const debugInfo = this.debugMode ? this.captureDebugInfo(error) : undefined

		const report = await this.reporter.generateReport(error, errorContext)
		return {
			...report,
			debugInfo,
		}
	}

	/**
	 * Get current error handling statistics
	 */
	getHandlingStatistics(): {
		totalErrors: number
		debugModeEnabled: boolean
		recoveryManagerStats: any
	} {
		return {
			totalErrors: this.errorCount,
			debugModeEnabled: this.debugMode,
			recoveryManagerStats: this.recoveryManager.getRecoveryStatistics(),
		}
	}

	/**
	 * Setup global error handlers
	 */
	setupGlobalHandlers(): void {
		// Handle uncaught exceptions
		process.on("uncaughtException", async (error: Error) => {
			const context = this.createEmergencyContext("uncaught-exception")
			await this.handleError(error, context)

			// Log critical error and exit
			console.error("CRITICAL: Uncaught exception:", error)
			await this.recoveryManager.emergencyCleanup()
			process.exit(1)
		})

		// Handle unhandled promise rejections
		process.on("unhandledRejection", async (reason: any) => {
			const error = reason instanceof Error ? reason : new Error(String(reason))
			const context = this.createEmergencyContext("unhandled-rejection")
			await this.handleError(error, context)

			console.error("CRITICAL: Unhandled promise rejection:", error)
		})

		// Handle process warnings
		process.on("warning", (warning) => {
			if (this.debugMode) {
				console.warn("Process warning:", warning)
			}
		})

		// Handle SIGINT (Ctrl+C) for graceful shutdown
		process.on("SIGINT", async () => {
			console.log("\nReceived SIGINT, performing graceful shutdown...")
			await this.recoveryManager.emergencyCleanup()
			process.exit(0)
		})

		// Handle SIGTERM for graceful shutdown
		process.on("SIGTERM", async () => {
			console.log("Received SIGTERM, performing graceful shutdown...")
			await this.recoveryManager.emergencyCleanup()
			process.exit(0)
		})
	}

	/**
	 * Format error as plain text
	 */
	private formatPlainError(error: Error): string {
		let output = `Error: ${error.message}`

		if (this.debugMode && error.stack) {
			output += `\n\nStack trace:\n${error.stack}`
		}

		return output
	}

	/**
	 * Format error as JSON
	 */
	private formatJsonError(error: Error): string {
		const errorData = {
			name: error.name,
			message: error.message,
			stack: this.debugMode ? error.stack : undefined,
			timestamp: new Date().toISOString(),
		}

		return JSON.stringify(errorData, null, 2)
	}

	/**
	 * Format error in structured format
	 */
	private formatStructuredError(error: Error): string {
		const lines = [
			`┌─ Error Details`,
			`│ Name: ${error.name}`,
			`│ Message: ${error.message}`,
			`│ Timestamp: ${new Date().toISOString()}`,
		]

		if (this.debugMode && error.stack) {
			lines.push(`│ Stack trace:`)
			error.stack.split("\n").forEach((line) => {
				lines.push(`│   ${line}`)
			})
		}

		lines.push(`└─`)

		return lines.join("\n")
	}

	/**
	 * Format error in user-friendly format
	 */
	private formatUserFriendlyError(error: Error): string {
		const classifiedError = this.classifier.categorizeError(error)
		const suggestions = this.classifier.getSuggestedActions(error, this.createBasicContext(error))

		let output = `❌ Something went wrong: ${error.message}\n`

		output += `\n💡 Suggestions:\n`
		suggestions.forEach((suggestion, index) => {
			output += `   ${index + 1}. ${suggestion}\n`
		})

		if (classifiedError === ErrorCategory.NETWORK) {
			output += `\n🌐 This appears to be a network-related issue.`
		} else if (classifiedError === ErrorCategory.FILE_SYSTEM) {
			output += `\n📁 This appears to be a file system issue.`
		}

		return output
	}

	/**
	 * Get appropriate log level for error
	 */
	private getLogLevel(error: Error): string {
		const classified = this.classifier.categorizeError(error)

		switch (classified) {
			case ErrorCategory.SYSTEM:
				return "error"
			case ErrorCategory.CONFIGURATION:
				return "error"
			case ErrorCategory.AUTHENTICATION:
				return "warn"
			case ErrorCategory.NETWORK:
				return "warn"
			case ErrorCategory.FILE_SYSTEM:
				return "warn"
			default:
				return "info"
		}
	}

	/**
	 * Get next actions based on error and recovery result
	 */
	private getNextActions(classifiedError: any, recovered: boolean, recoveryResult?: RecoveryResult): string[] {
		const actions: string[] = []

		if (recovered) {
			actions.push("Operation recovered successfully")
			actions.push("Monitor for recurring issues")
		} else {
			actions.push("Manual intervention required")

			if (recoveryResult?.suggestions) {
				actions.push(...recoveryResult.suggestions)
			}

			if (classifiedError.isRecoverable) {
				actions.push("Retry the operation")
			} else {
				actions.push("Contact support for assistance")
			}
		}

		return actions
	}

	/**
	 * Create basic error context
	 */
	private createBasicContext(error: Error): ErrorContext {
		// Filter out undefined environment variables
		const environment: Record<string, string> = {}
		Object.entries(process.env).forEach(([key, value]) => {
			if (value !== undefined) {
				environment[key] = value
			}
		})

		return {
			operationId: `op-${Date.now()}`,
			command: process.argv[1] || "unknown",
			arguments: process.argv.slice(2),
			workingDirectory: process.cwd(),
			environment,
			timestamp: new Date(),
			stackTrace: error.stack?.split("\n") || [],
			systemInfo: {
				platform: process.platform,
				nodeVersion: process.version,
				cliVersion: "1.0.0",
				memoryUsage: process.memoryUsage(),
				uptime: process.uptime(),
			},
		}
	}

	/**
	 * Create debug context for error
	 */
	private createDebugContext(error: Error): ErrorContext {
		return this.createBasicContext(error)
	}

	/**
	 * Create emergency context for critical errors
	 */
	private createEmergencyContext(type: string): ErrorContext {
		return {
			operationId: `emergency-${type}-${Date.now()}`,
			command: "emergency",
			arguments: [type],
			workingDirectory: process.cwd(),
			environment: {},
			timestamp: new Date(),
			stackTrace: [],
			systemInfo: {
				platform: process.platform,
				nodeVersion: process.version,
				cliVersion: "1.0.0",
				memoryUsage: process.memoryUsage(),
				uptime: process.uptime(),
			},
		}
	}
}
