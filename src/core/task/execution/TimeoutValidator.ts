/**
 * Timeout validation and sanitization for security
 * Addresses CodeQL findings for resource exhaustion vulnerabilities
 */

import { logger } from "../../../utils/logging"

export class TimeoutValidator {
	// Security bounds - these are absolute limits to prevent resource exhaustion
	private static readonly SLIDING_TIMEOUT_MIN_MS = 1000 // 1 second
	private static readonly SLIDING_TIMEOUT_MAX_MS = 86400000 // 24 hours
	private static readonly INFO_QUERY_TIMEOUT_MIN_MS = 1000 // 1 second
	private static readonly INFO_QUERY_TIMEOUT_MAX_MS = 300000 // 5 minutes

	// Default values
	private static readonly SLIDING_TIMEOUT_DEFAULT_MS = 1800000 // 30 minutes
	private static readonly INFO_QUERY_TIMEOUT_DEFAULT_MS = 30000 // 30 seconds

	/**
	 * Validate and sanitize sliding timeout value
	 * @param value - User-provided timeout value
	 * @param context - Context for logging (API, CLI, etc.)
	 * @returns Validated timeout value in milliseconds
	 * @throws ValidationError for invalid values
	 */
	static validateSlidingTimeout(value: unknown, context: string = "unknown"): number {
		const sanitized = this.sanitizeTimeoutValue(value, this.SLIDING_TIMEOUT_DEFAULT_MS)

		if (sanitized < this.SLIDING_TIMEOUT_MIN_MS) {
			this.logSecurityViolation("sliding_timeout_too_small", {
				provided: sanitized,
				minimum: this.SLIDING_TIMEOUT_MIN_MS,
				context,
			})
			throw new ValidationError(
				`Sliding timeout must be at least ${this.SLIDING_TIMEOUT_MIN_MS}ms (1 second), got ${sanitized}ms`,
			)
		}

		if (sanitized > this.SLIDING_TIMEOUT_MAX_MS) {
			this.logSecurityViolation("sliding_timeout_too_large", {
				provided: sanitized,
				maximum: this.SLIDING_TIMEOUT_MAX_MS,
				context,
			})
			throw new ValidationError(
				`Sliding timeout cannot exceed ${this.SLIDING_TIMEOUT_MAX_MS}ms (24 hours), got ${sanitized}ms`,
			)
		}

		this.logTimeoutUsage("sliding_timeout_validated", {
			value: sanitized,
			context,
		})

		return sanitized
	}

	/**
	 * Validate and sanitize info query timeout value
	 * @param value - User-provided timeout value
	 * @param context - Context for logging (API, CLI, etc.)
	 * @returns Validated timeout value in milliseconds
	 * @throws ValidationError for invalid values
	 */
	static validateInfoQueryTimeout(value: unknown, context: string = "unknown"): number {
		const sanitized = this.sanitizeTimeoutValue(value, this.INFO_QUERY_TIMEOUT_DEFAULT_MS)

		if (sanitized < this.INFO_QUERY_TIMEOUT_MIN_MS) {
			this.logSecurityViolation("info_timeout_too_small", {
				provided: sanitized,
				minimum: this.INFO_QUERY_TIMEOUT_MIN_MS,
				context,
			})
			throw new ValidationError(
				`Info query timeout must be at least ${this.INFO_QUERY_TIMEOUT_MIN_MS}ms (1 second), got ${sanitized}ms`,
			)
		}

		if (sanitized > this.INFO_QUERY_TIMEOUT_MAX_MS) {
			this.logSecurityViolation("info_timeout_too_large", {
				provided: sanitized,
				maximum: this.INFO_QUERY_TIMEOUT_MAX_MS,
				context,
			})
			throw new ValidationError(
				`Info query timeout cannot exceed ${this.INFO_QUERY_TIMEOUT_MAX_MS}ms (5 minutes), got ${sanitized}ms`,
			)
		}

		this.logTimeoutUsage("info_timeout_validated", {
			value: sanitized,
			context,
		})

		return sanitized
	}

	/**
	 * Validate environment variable timeout values
	 * @param value - Environment variable value
	 * @param name - Environment variable name
	 * @param type - Type of timeout (sliding or info)
	 * @returns Validated timeout value
	 */
	static validateEnvironmentTimeout(value: string | undefined, name: string, type: "sliding" | "info"): number {
		if (!value) {
			return type === "sliding" ? this.SLIDING_TIMEOUT_DEFAULT_MS : this.INFO_QUERY_TIMEOUT_DEFAULT_MS
		}

		try {
			const parsed = parseInt(value, 10)
			if (isNaN(parsed)) {
				throw new ValidationError(`Environment variable ${name} must be a valid number, got: "${value}"`)
			}

			if (type === "sliding") {
				return this.validateSlidingTimeout(parsed, `env_${name}`)
			} else {
				return this.validateInfoQueryTimeout(parsed, `env_${name}`)
			}
		} catch (error) {
			logger.error(`Invalid environment variable ${name}:`, error)
			throw new ValidationError(`Environment variable ${name} validation failed: ${error.message}`)
		}
	}

	/**
	 * Get timeout bounds for external validation (e.g., API schemas)
	 */
	static getTimeoutBounds(): {
		sliding: { min: number; max: number; default: number }
		infoQuery: { min: number; max: number; default: number }
	} {
		return {
			sliding: {
				min: this.SLIDING_TIMEOUT_MIN_MS,
				max: this.SLIDING_TIMEOUT_MAX_MS,
				default: this.SLIDING_TIMEOUT_DEFAULT_MS,
			},
			infoQuery: {
				min: this.INFO_QUERY_TIMEOUT_MIN_MS,
				max: this.INFO_QUERY_TIMEOUT_MAX_MS,
				default: this.INFO_QUERY_TIMEOUT_DEFAULT_MS,
			},
		}
	}

	/**
	 * Sanitize timeout value to number
	 * @param value - Raw timeout value
	 * @param defaultValue - Default to use if value is null/undefined
	 * @returns Sanitized number value
	 */
	private static sanitizeTimeoutValue(value: unknown, defaultValue: number): number {
		if (value === null || value === undefined) {
			return defaultValue
		}

		if (typeof value === "string") {
			const parsed = parseInt(value, 10)
			if (isNaN(parsed)) {
				throw new ValidationError(`Invalid timeout value: "${value}" is not a valid number`)
			}
			return parsed
		}

		if (typeof value === "number") {
			if (!Number.isFinite(value)) {
				throw new ValidationError(`Invalid timeout value: ${value} is not a finite number`)
			}
			if (value < 0) {
				throw new ValidationError(`Invalid timeout value: ${value} cannot be negative`)
			}
			// Floor to remove decimals for timer precision
			return Math.floor(value)
		}

		throw new ValidationError(`Timeout must be a number, got: ${typeof value}`)
	}

	/**
	 * Log security violations for monitoring
	 */
	private static logSecurityViolation(type: string, details: Record<string, any>): void {
		logger.warn("Security violation detected", {
			type,
			timestamp: new Date().toISOString(),
			...details,
		})

		// TODO: In production, this could integrate with:
		// - SIEM systems
		// - Security monitoring platforms
		// - Alerting systems
		// - Rate limiting mechanisms
	}

	/**
	 * Log timeout usage for monitoring
	 */
	private static logTimeoutUsage(type: string, details: Record<string, any>): void {
		logger.debug("Timeout usage", {
			type,
			timestamp: new Date().toISOString(),
			...details,
		})
	}
}

/**
 * Validation error for timeout issues
 */
export class ValidationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "ValidationError"
	}
}
