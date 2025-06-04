/**
 * Network related errors
 */

import { ErrorCategory, ErrorSeverity, ErrorContext } from "../types/error-types"
import { CLIError } from "./CLIError"

export class NetworkError extends CLIError {
	readonly category = ErrorCategory.NETWORK
	readonly severity = ErrorSeverity.MEDIUM
	readonly isRecoverable = true

	constructor(
		message: string,
		code: string,
		public readonly statusCode?: number,
		public readonly endpoint?: string,
		public readonly method?: string,
		context?: ErrorContext,
		cause?: Error,
	) {
		super(message, code, context, cause)
	}

	override getSuggestedActions(): string[] {
		const actions = [
			"Check internet connection",
			"Verify API endpoint is accessible",
			"Check authentication credentials",
		]

		if (this.statusCode) {
			switch (this.statusCode) {
				case 401:
					actions.push("Verify authentication token is valid and not expired")
					break
				case 403:
					actions.push("Check if you have permission to access this resource")
					break
				case 404:
					actions.push("Verify the endpoint URL is correct")
					break
				case 429:
					actions.push("Wait before retrying - you may be rate limited")
					break
				case 500:
				case 502:
				case 503:
				case 504:
					actions.push("Server error - try again later")
					break
			}
		}

		if (this.endpoint) {
			actions.push(`Verify endpoint "${this.endpoint}" is correct`)
		}

		return actions
	}

	override getDocumentationLinks(): string[] {
		return ["https://developer.mozilla.org/en-US/docs/Web/HTTP/Status", "https://nodejs.org/api/http.html"]
	}

	override getUserFriendlyMessage(): string {
		if (this.statusCode && this.endpoint) {
			return `Network request failed (${this.statusCode}): ${this.endpoint} - ${this.message}`
		}
		if (this.endpoint) {
			return `Network request to ${this.endpoint} failed: ${this.message}`
		}
		return `Network error: ${this.message}`
	}
}

// Specific network error types
export class ConnectionTimeoutError extends NetworkError {
	constructor(endpoint: string, timeout: number, context?: ErrorContext, cause?: Error) {
		super(
			`Connection to ${endpoint} timed out after ${timeout}ms`,
			"NET_TIMEOUT",
			undefined,
			endpoint,
			undefined,
			context,
			cause,
		)
	}

	override getSuggestedActions(): string[] {
		return [
			"Check internet connection stability",
			"Try increasing timeout value",
			"Verify the server is responding",
			"Check for network connectivity issues",
		]
	}
}

export class DNSResolutionError extends NetworkError {
	constructor(hostname: string, context?: ErrorContext, cause?: Error) {
		super(`Failed to resolve hostname: ${hostname}`, "NET_DNS_FAIL", undefined, hostname, undefined, context, cause)
	}

	override getSuggestedActions(): string[] {
		return [
			"Check internet connection",
			"Verify the hostname is correct",
			"Try using a different DNS server",
			"Check if the domain exists",
		]
	}
}

export class RateLimitError extends NetworkError {
	constructor(
		endpoint: string,
		public readonly retryAfter?: number,
		context?: ErrorContext,
		cause?: Error,
	) {
		super(`Rate limit exceeded for ${endpoint}`, "NET_RATE_LIMIT", 429, endpoint, undefined, context, cause)
	}

	override getSuggestedActions(): string[] {
		const actions = ["Wait before making another request", "Implement exponential backoff", "Check API rate limits"]

		if (this.retryAfter) {
			actions.unshift(`Wait ${this.retryAfter} seconds before retrying`)
		}

		return actions
	}
}

export class AuthenticationError extends NetworkError {
	constructor(endpoint: string, context?: ErrorContext, cause?: Error) {
		super(`Authentication failed for ${endpoint}`, "NET_AUTH_FAIL", 401, endpoint, undefined, context, cause)
	}

	override getSuggestedActions(): string[] {
		return [
			"Check authentication credentials",
			"Verify API key or token is valid",
			"Ensure token has not expired",
			"Check authentication method is correct",
		]
	}
}
