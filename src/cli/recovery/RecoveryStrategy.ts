/**
 * Base recovery strategy interface and utilities
 */

import { ErrorContext, RecoveryResult } from "../types/error-types"
import { RecoveryStrategy } from "../types/recovery-types"

export abstract class BaseRecoveryStrategy implements RecoveryStrategy {
	abstract canRecover(error: Error, context: ErrorContext): boolean
	abstract recover(error: Error, context: ErrorContext): Promise<RecoveryResult>
	abstract rollback(error: Error, context: ErrorContext): Promise<void>

	/**
	 * Utility method for exponential backoff delay
	 */
	protected async delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	/**
	 * Calculate exponential backoff delay
	 */
	protected calculateBackoffDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
		const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
		// Add jitter to prevent thundering herd
		return delay + Math.random() * delay * 0.1
	}

	/**
	 * Check if error is recoverable based on attempt count
	 */
	protected isRetryable(attempt: number, maxAttempts: number): boolean {
		return attempt <= maxAttempts
	}

	/**
	 * Log recovery attempt
	 */
	protected logRecoveryAttempt(error: Error, attempt: number, context: ErrorContext): void {
		console.debug(`Recovery attempt ${attempt} for error: ${error.message}`, {
			errorType: error.constructor.name,
			operationId: context.operationId,
			attempt,
		})
	}
}
