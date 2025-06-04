/**
 * Network error recovery strategy
 */

import { ErrorContext, RecoveryResult } from "../types/error-types"
import { NetworkError, ConnectionTimeoutError, RateLimitError } from "../errors/NetworkError"
import { BaseRecoveryStrategy } from "./RecoveryStrategy"

export class NetworkRecoveryStrategy extends BaseRecoveryStrategy {
	private readonly maxAttempts: number = 3
	private readonly baseDelay: number = 1000

	constructor(maxAttempts?: number, baseDelay?: number) {
		super()
		if (maxAttempts) this.maxAttempts = maxAttempts
		if (baseDelay) this.baseDelay = baseDelay
	}

	canRecover(error: Error, context: ErrorContext): boolean {
		if (!(error instanceof NetworkError)) {
			return false
		}

		// Don't retry for certain status codes
		if (error.statusCode === 404 || error.statusCode === 401 || error.statusCode === 403) {
			return false
		}

		// Can recover from timeout, rate limit, and server errors
		return (
			error instanceof ConnectionTimeoutError ||
			error instanceof RateLimitError ||
			(error.statusCode && error.statusCode >= 500) ||
			!error.statusCode
		) // Network connectivity issues
	}

	async recover(error: NetworkError, context: ErrorContext): Promise<RecoveryResult> {
		this.logRecoveryAttempt(error, 1, context)

		// Special handling for rate limit errors
		if (error instanceof RateLimitError && error.retryAfter) {
			await this.delay(error.retryAfter * 1000)
			return { success: true, attempt: 1 }
		}

		// Exponential backoff retry for other network errors
		for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
			if (attempt > 1) {
				const delay = this.calculateBackoffDelay(attempt, this.baseDelay)
				await this.delay(delay)
				this.logRecoveryAttempt(error, attempt, context)
			}

			try {
				// This would be where the original operation is retried
				// For now, we'll simulate recovery success based on error type
				const recovered = await this.simulateRecovery(error, attempt)

				if (recovered) {
					return {
						success: true,
						attempt,
						suggestions: this.getRecoverySuccessSuggestions(error),
					}
				}
			} catch (retryError) {
				if (attempt === this.maxAttempts) {
					return {
						success: false,
						finalError: retryError instanceof Error ? retryError : new Error(String(retryError)),
						suggestions: this.getRecoveryFailureSuggestions(error),
					}
				}
			}
		}

		return {
			success: false,
			suggestions: this.getRecoveryFailureSuggestions(error),
		}
	}

	async rollback(error: NetworkError, context: ErrorContext): Promise<void> {
		// Network operations typically don't need rollback
		// but we might want to clean up connections, cancel requests, etc.
		console.debug("Network recovery rollback completed", {
			errorType: error.constructor.name,
			operationId: context.operationId,
		})
	}

	private async simulateRecovery(error: NetworkError, attempt: number): Promise<boolean> {
		// Simulate recovery logic - in real implementation this would retry the actual operation
		if (error instanceof ConnectionTimeoutError) {
			// Timeout errors have a moderate chance of recovery
			return Math.random() > 0.4
		}

		if (error.statusCode && error.statusCode >= 500) {
			// Server errors have a good chance of recovery after a delay
			return Math.random() > 0.3
		}

		// Generic network errors
		return Math.random() > 0.5
	}

	private getRecoverySuccessSuggestions(error: NetworkError): string[] {
		return [
			"Network connectivity restored",
			"Consider implementing circuit breaker pattern for better resilience",
			"Monitor network stability",
		]
	}

	private getRecoveryFailureSuggestions(error: NetworkError): string[] {
		const suggestions = [
			"Check network connectivity",
			"Verify endpoint availability",
			"Consider offline mode if supported",
		]

		if (error.endpoint) {
			suggestions.push(`Manually verify endpoint: ${error.endpoint}`)
		}

		if (error.statusCode && error.statusCode >= 500) {
			suggestions.push("Server appears to be down - contact support")
		}

		return suggestions
	}
}
