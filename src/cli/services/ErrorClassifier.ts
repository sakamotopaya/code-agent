/**
 * Error classification service
 */

import { ErrorCategory, ErrorSeverity, ClassifiedError, ErrorContext } from "../types/error-types"
import { CLIError, FileSystemError, NetworkError, ConfigurationError } from "../errors"

export class ErrorClassifier {
	/**
	 * Categorize an error based on its type and characteristics
	 */
	categorizeError(error: Error): ErrorCategory {
		if (error instanceof FileSystemError) {
			return ErrorCategory.FILE_SYSTEM
		}

		if (error instanceof NetworkError) {
			return ErrorCategory.NETWORK
		}

		if (error instanceof ConfigurationError) {
			return ErrorCategory.CONFIGURATION
		}

		if (error instanceof CLIError) {
			return error.category
		}

		// Classify based on error message patterns
		return this.classifyByMessage(error)
	}

	/**
	 * Determine error severity
	 */
	determineSeverity(error: Error, context: ErrorContext): ErrorSeverity {
		if (error instanceof CLIError) {
			return error.severity
		}

		// Default severity classification
		if (this.isCriticalError(error, context)) {
			return ErrorSeverity.CRITICAL
		}

		if (this.isHighSeverityError(error, context)) {
			return ErrorSeverity.HIGH
		}

		if (this.isMediumSeverityError(error, context)) {
			return ErrorSeverity.MEDIUM
		}

		return ErrorSeverity.LOW
	}

	/**
	 * Check if error is recoverable
	 */
	isRecoverable(error: Error, context: ErrorContext): boolean {
		if (error instanceof CLIError) {
			return error.isRecoverable
		}

		// Network errors are generally recoverable
		if (
			error.message.includes("ECONNREFUSED") ||
			error.message.includes("ENOTFOUND") ||
			error.message.includes("timeout")
		) {
			return true
		}

		// File system errors are often recoverable
		if (error.message.includes("ENOENT") || error.message.includes("EACCES") || error.message.includes("ENOSPC")) {
			return true
		}

		// System errors are typically not recoverable
		if (error.message.includes("ENOMEM") || error.message.includes("EFAULT")) {
			return false
		}

		return true // Default to recoverable
	}

	/**
	 * Get suggested actions for an error
	 */
	getSuggestedActions(error: Error, context: ErrorContext): string[] {
		if (error instanceof CLIError) {
			return error.getSuggestedActions()
		}

		const category = this.categorizeError(error)
		return this.getDefaultSuggestionsForCategory(category, error)
	}

	/**
	 * Get documentation links for an error
	 */
	getDocumentationLinks(error: Error): string[] {
		if (error instanceof CLIError) {
			return error.getDocumentationLinks()
		}

		const category = this.categorizeError(error)
		return this.getDefaultDocumentationForCategory(category)
	}

	/**
	 * Create a classified error object
	 */
	classifyError(error: Error, context: ErrorContext): ClassifiedError {
		return {
			originalError: error,
			category: this.categorizeError(error),
			severity: this.determineSeverity(error, context),
			isRecoverable: this.isRecoverable(error, context),
			suggestedActions: this.getSuggestedActions(error, context),
			relatedDocumentation: this.getDocumentationLinks(error),
		}
	}

	private classifyByMessage(error: Error): ErrorCategory {
		const message = error.message.toLowerCase()

		if (
			message.includes("enoent") ||
			message.includes("eacces") ||
			message.includes("enospc") ||
			message.includes("file") ||
			message.includes("directory")
		) {
			return ErrorCategory.FILE_SYSTEM
		}

		if (
			message.includes("econnrefused") ||
			message.includes("enotfound") ||
			message.includes("timeout") ||
			message.includes("network") ||
			message.includes("connection")
		) {
			return ErrorCategory.NETWORK
		}

		if (
			message.includes("config") ||
			message.includes("setting") ||
			message.includes("invalid") ||
			message.includes("missing")
		) {
			return ErrorCategory.CONFIGURATION
		}

		if (
			message.includes("auth") ||
			message.includes("login") ||
			message.includes("credential") ||
			message.includes("token")
		) {
			return ErrorCategory.AUTHENTICATION
		}

		if (message.includes("permission") || message.includes("forbidden") || message.includes("unauthorized")) {
			return ErrorCategory.PERMISSION
		}

		return ErrorCategory.INTERNAL
	}

	private isCriticalError(error: Error, context: ErrorContext): boolean {
		const message = error.message.toLowerCase()

		return (
			message.includes("enomem") ||
			message.includes("efault") ||
			message.includes("critical") ||
			error.name === "OutOfMemoryError" ||
			error.name === "SystemError"
		)
	}

	private isHighSeverityError(error: Error, context: ErrorContext): boolean {
		const message = error.message.toLowerCase()

		return (
			message.includes("enospc") ||
			message.includes("eacces") ||
			message.includes("config") ||
			error.name === "SyntaxError" ||
			error.name === "TypeError"
		)
	}

	private isMediumSeverityError(error: Error, context: ErrorContext): boolean {
		const message = error.message.toLowerCase()

		return message.includes("econnrefused") || message.includes("timeout") || message.includes("enoent")
	}

	private getDefaultSuggestionsForCategory(category: ErrorCategory, error: Error): string[] {
		switch (category) {
			case ErrorCategory.FILE_SYSTEM:
				return ["Check file permissions", "Verify file path exists", "Ensure sufficient disk space"]

			case ErrorCategory.NETWORK:
				return ["Check internet connection", "Verify endpoint is accessible", "Check firewall settings"]

			case ErrorCategory.CONFIGURATION:
				return [
					"Check configuration file syntax",
					"Verify required settings are present",
					"Reset to default configuration",
				]

			case ErrorCategory.AUTHENTICATION:
				return [
					"Check authentication credentials",
					"Verify tokens are not expired",
					"Re-authenticate if necessary",
				]

			case ErrorCategory.PERMISSION:
				return ["Check user permissions", "Run with appropriate privileges", "Verify access rights"]

			default:
				return ["Check error message for details", "Consult documentation", "Contact support if issue persists"]
		}
	}

	private getDefaultDocumentationForCategory(category: ErrorCategory): string[] {
		switch (category) {
			case ErrorCategory.FILE_SYSTEM:
				return ["https://nodejs.org/api/fs.html"]

			case ErrorCategory.NETWORK:
				return ["https://nodejs.org/api/http.html"]

			case ErrorCategory.CONFIGURATION:
				return ["https://docs.npmjs.com/cli/v8/configuring-npm"]

			default:
				return ["https://nodejs.org/api/errors.html"]
		}
	}
}
