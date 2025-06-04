/**
 * Base CLI error class with comprehensive error handling features
 */

import { ErrorCategory, ErrorSeverity, ErrorContext } from "../types/error-types"

export abstract class CLIError extends Error {
	abstract readonly category: ErrorCategory
	abstract readonly severity: ErrorSeverity
	abstract readonly isRecoverable: boolean

	constructor(
		message: string,
		public readonly code: string,
		public readonly context?: ErrorContext,
		public override readonly cause?: Error,
	) {
		super(message)
		this.name = this.constructor.name

		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor)
		}
	}

	abstract getSuggestedActions(): string[]
	abstract getDocumentationLinks(): string[]

	/**
	 * Get user-friendly error message
	 */
	getUserFriendlyMessage(): string {
		return this.message
	}

	/**
	 * Get technical details for debugging
	 */
	getTechnicalDetails(): Record<string, any> {
		return {
			code: this.code,
			category: this.category,
			severity: this.severity,
			isRecoverable: this.isRecoverable,
			cause: this.cause?.message,
			context: this.context,
		}
	}

	/**
	 * Convert error to JSON representation
	 */
	toJSON(): Record<string, any> {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			category: this.category,
			severity: this.severity,
			isRecoverable: this.isRecoverable,
			suggestedActions: this.getSuggestedActions(),
			documentationLinks: this.getDocumentationLinks(),
			stack: this.stack,
			cause: this.cause?.message,
			context: this.context,
		}
	}
}
