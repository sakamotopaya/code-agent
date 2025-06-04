/**
 * Error reporting and analytics service
 */

import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"
import {
	ErrorReport,
	AnonymizedErrorReport,
	ClassifiedError,
	ErrorContext,
	ErrorStatistics,
	SystemInfo,
} from "../types/error-types"

export class ErrorReporter {
	private reportStorage: string
	private maxStoredReports: number = 100
	private reportingEnabled: boolean = true

	constructor(storageDir?: string) {
		this.reportStorage = storageDir || path.join(process.cwd(), ".cli-error-reports")
		this.ensureStorageDirectory()
	}

	/**
	 * Report an error with user consent
	 */
	async reportError(error: Error, userConsent: boolean, context?: ErrorContext): Promise<void> {
		if (!userConsent || !this.reportingEnabled) {
			return
		}

		try {
			const report = await this.generateReport(error, context)

			// Store locally for debugging
			await this.storeLocalReport(report)

			// Send to analytics service (anonymized)
			const anonymizedReport = this.anonymizeReport(report)
			await this.sendToAnalytics(anonymizedReport)

			console.debug(`Error report generated: ${report.id}`)
		} catch (reportingError) {
			console.warn("Failed to report error:", reportingError)
		}
	}

	/**
	 * Generate a comprehensive error report
	 */
	async generateReport(error: Error, context?: ErrorContext): Promise<ErrorReport> {
		const id = this.generateReportId()
		const timestamp = new Date()

		// Create basic context if not provided
		const errorContext = context || this.createBasicContext(error)

		// Classify the error
		const classifiedError: ClassifiedError = {
			originalError: error,
			category: (error as any).category || "internal",
			severity: (error as any).severity || "medium",
			isRecoverable: (error as any).isRecoverable ?? true,
			suggestedActions: (error as any).getSuggestedActions?.() || ["Check error details"],
			relatedDocumentation: (error as any).getDocumentationLinks?.() || [],
		}

		const report: ErrorReport = {
			id,
			timestamp,
			error: classifiedError,
			context: errorContext,
		}

		return report
	}

	/**
	 * Anonymize error report for safe transmission
	 */
	private anonymizeReport(report: ErrorReport): AnonymizedErrorReport {
		return {
			id: report.id,
			timestamp: report.timestamp,
			error: {
				category: report.error.category,
				severity: report.error.severity,
				isRecoverable: report.error.isRecoverable,
				suggestedActions: report.error.suggestedActions,
				relatedDocumentation: report.error.relatedDocumentation,
				originalError: {
					name: report.error.originalError.name,
					message: this.sanitizeErrorMessage(report.error.originalError.message),
					stack: this.sanitizeStackTrace(report.error.originalError.stack),
				},
			},
			context: {
				operationId: report.context.operationId,
				command: report.context.command,
				arguments: this.sanitizeArguments(report.context.arguments),
				workingDirectory: this.hashPath(report.context.workingDirectory),
				environment: this.sanitizeEnvironment(report.context.environment),
				timestamp: report.context.timestamp,
				stackTrace: report.context.stackTrace,
				systemInfo: report.context.systemInfo,
			},
			debugInfo: report.debugInfo,
		}
	}

	/**
	 * Store error report locally
	 */
	private async storeLocalReport(report: ErrorReport): Promise<void> {
		try {
			const filename = `error-${report.id}.json`
			const filepath = path.join(this.reportStorage, filename)

			await fs.promises.writeFile(filepath, JSON.stringify(report, null, 2))

			// Clean up old reports if we exceed the limit
			await this.cleanupOldReports()
		} catch (error) {
			console.warn("Failed to store error report locally:", error)
		}
	}

	/**
	 * Send anonymized report to analytics service
	 */
	private async sendToAnalytics(report: AnonymizedErrorReport): Promise<void> {
		// In a real implementation, this would send to an analytics service
		// For now, we'll just log it
		console.debug("Analytics report would be sent:", {
			id: report.id,
			category: report.error.category,
			severity: report.error.severity,
			command: report.context.command,
		})
	}

	/**
	 * Get error statistics from stored reports
	 */
	async getErrorStatistics(): Promise<ErrorStatistics> {
		try {
			const reports = await this.loadStoredReports()

			const totalErrors = reports.length
			const errorsByCategory: Record<string, number> = {}
			const errorsBySeverity: Record<string, number> = {}
			let recoveredErrors = 0

			reports.forEach((report) => {
				const category = report.error.category
				const severity = report.error.severity

				errorsByCategory[category] = (errorsByCategory[category] || 0) + 1
				errorsBySeverity[severity] = (errorsBySeverity[severity] || 0) + 1

				if (report.resolution) {
					recoveredErrors++
				}
			})

			// Get recent errors (last 10)
			const recentErrors = reports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10)

			// Extract common patterns
			const commonPatterns = this.extractCommonPatterns(reports)

			const recoverySuccessRate = totalErrors > 0 ? (recoveredErrors / totalErrors) * 100 : 0

			return {
				totalErrors,
				errorsByCategory: errorsByCategory as any,
				errorsBySeverity: errorsBySeverity as any,
				recentErrors,
				commonPatterns,
				recoverySuccessRate,
			}
		} catch (error) {
			console.warn("Failed to get error statistics:", error)
			return {
				totalErrors: 0,
				errorsByCategory: {} as any,
				errorsBySeverity: {} as any,
				recentErrors: [],
				commonPatterns: [],
				recoverySuccessRate: 0,
			}
		}
	}

	/**
	 * Load stored error reports
	 */
	private async loadStoredReports(): Promise<ErrorReport[]> {
		try {
			const files = await fs.promises.readdir(this.reportStorage)
			const reportFiles = files.filter((f) => f.startsWith("error-") && f.endsWith(".json"))

			const reports: ErrorReport[] = []

			for (const file of reportFiles) {
				try {
					const filepath = path.join(this.reportStorage, file)
					const content = await fs.promises.readFile(filepath, "utf-8")
					const report = JSON.parse(content)
					report.timestamp = new Date(report.timestamp) // Convert back to Date
					reports.push(report)
				} catch (error) {
					console.warn(`Failed to load report ${file}:`, error)
				}
			}

			return reports
		} catch (error) {
			console.warn("Failed to load stored reports:", error)
			return []
		}
	}

	/**
	 * Extract common error patterns
	 */
	private extractCommonPatterns(reports: ErrorReport[]): string[] {
		const patterns: Map<string, number> = new Map()

		reports.forEach((report) => {
			const errorName = report.error.originalError.name
			const category = report.error.category
			const command = report.context.command

			const pattern = `${errorName}:${category}:${command}`
			patterns.set(pattern, (patterns.get(pattern) || 0) + 1)
		})

		// Return top 5 most common patterns
		return Array.from(patterns.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([pattern, count]) => `${pattern} (${count} occurrences)`)
	}

	/**
	 * Generate unique report ID
	 */
	private generateReportId(): string {
		return crypto.randomBytes(16).toString("hex")
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
			operationId: crypto.randomBytes(8).toString("hex"),
			command: process.argv[1] || "unknown",
			arguments: process.argv.slice(2),
			workingDirectory: process.cwd(),
			environment,
			timestamp: new Date(),
			stackTrace: error.stack?.split("\n") || [],
			systemInfo: this.getSystemInfo(),
		}
	}

	/**
	 * Get system information
	 */
	private getSystemInfo(): SystemInfo {
		return {
			platform: process.platform,
			nodeVersion: process.version,
			cliVersion: "1.0.0", // Would get from package.json
			memoryUsage: process.memoryUsage(),
			uptime: process.uptime(),
		}
	}

	/**
	 * Sanitize error message to remove sensitive information
	 */
	private sanitizeErrorMessage(message: string): string {
		// Remove potential file paths, tokens, passwords, etc.
		return message
			.replace(/\/[^\s]+/g, "[PATH]") // File paths
			.replace(/token[s]?[:\s=]+[a-zA-Z0-9+/=]+/gi, "token=[REDACTED]") // Tokens
			.replace(/password[s]?[:\s=]+[^\s]+/gi, "password=[REDACTED]") // Passwords
			.replace(/key[s]?[:\s=]+[a-zA-Z0-9+/=]+/gi, "key=[REDACTED]") // API keys
	}

	/**
	 * Sanitize stack trace
	 */
	private sanitizeStackTrace(stack?: string): string {
		if (!stack) return ""

		return stack
			.split("\n")
			.map((line) => line.replace(/\/[^\s]+/g, "[PATH]"))
			.join("\n")
	}

	/**
	 * Sanitize command arguments
	 */
	private sanitizeArguments(args: string[]): string[] {
		return args.map((arg) => {
			// Redact potential sensitive arguments
			if (arg.includes("token") || arg.includes("password") || arg.includes("key")) {
				return "[REDACTED]"
			}
			// Redact file paths
			if (arg.startsWith("/") || arg.includes("\\")) {
				return "[PATH]"
			}
			return arg
		})
	}

	/**
	 * Sanitize environment variables
	 */
	private sanitizeEnvironment(env: Record<string, string>): Record<string, string> {
		const sensitiveKeys = ["token", "password", "key", "secret", "auth"]
		const sanitized: Record<string, string> = {}

		Object.entries(env).forEach(([key, value]) => {
			const keyLower = key.toLowerCase()
			if (sensitiveKeys.some((sensitive) => keyLower.includes(sensitive))) {
				sanitized[key] = "[REDACTED]"
			} else {
				sanitized[key] = value
			}
		})

		return sanitized
	}

	/**
	 * Hash file path for anonymization
	 */
	private hashPath(path: string): string {
		return crypto.createHash("sha256").update(path).digest("hex").substring(0, 16)
	}

	/**
	 * Ensure storage directory exists
	 */
	private ensureStorageDirectory(): void {
		try {
			if (!fs.existsSync(this.reportStorage)) {
				fs.mkdirSync(this.reportStorage, { recursive: true })
			}
		} catch (error) {
			console.warn("Failed to create error report storage directory:", error)
		}
	}

	/**
	 * Clean up old reports to maintain storage limit
	 */
	private async cleanupOldReports(): Promise<void> {
		try {
			const files = await fs.promises.readdir(this.reportStorage)
			const reportFiles = files
				.filter((f) => f.startsWith("error-") && f.endsWith(".json"))
				.map((f) => ({
					name: f,
					path: path.join(this.reportStorage, f),
					stat: fs.statSync(path.join(this.reportStorage, f)),
				}))
				.sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime())

			// Remove files beyond the limit
			if (reportFiles.length > this.maxStoredReports) {
				const filesToRemove = reportFiles.slice(this.maxStoredReports)

				for (const file of filesToRemove) {
					await fs.promises.unlink(file.path)
				}

				console.debug(`Cleaned up ${filesToRemove.length} old error reports`)
			}
		} catch (error) {
			console.warn("Failed to cleanup old reports:", error)
		}
	}

	/**
	 * Enable/disable error reporting
	 */
	setReportingEnabled(enabled: boolean): void {
		this.reportingEnabled = enabled
	}

	/**
	 * Check if reporting is enabled
	 */
	isReportingEnabled(): boolean {
		return this.reportingEnabled
	}
}
