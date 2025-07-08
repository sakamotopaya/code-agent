/**
 * Tests for TimeoutValidator security measures
 * Ensures protection against resource exhaustion attacks
 */

import { TimeoutValidator, ValidationError } from "../TimeoutValidator"

describe("TimeoutValidator", () => {
	describe("validateSlidingTimeout", () => {
		it("should accept valid timeout values", () => {
			expect(TimeoutValidator.validateSlidingTimeout(1000, "test")).toBe(1000) // 1 second
			expect(TimeoutValidator.validateSlidingTimeout(1800000, "test")).toBe(1800000) // 30 minutes
			expect(TimeoutValidator.validateSlidingTimeout(86400000, "test")).toBe(86400000) // 24 hours
		})

		it("should use default when value is null or undefined", () => {
			expect(TimeoutValidator.validateSlidingTimeout(null, "test")).toBe(1800000) // 30 minutes default
			expect(TimeoutValidator.validateSlidingTimeout(undefined, "test")).toBe(1800000)
		})

		it("should reject values below minimum (security protection)", () => {
			expect(() => TimeoutValidator.validateSlidingTimeout(999, "test")).toThrow(ValidationError)
			expect(() => TimeoutValidator.validateSlidingTimeout(0, "test")).toThrow(ValidationError)
			expect(() => TimeoutValidator.validateSlidingTimeout(-1000, "test")).toThrow(ValidationError)
		})

		it("should reject values above maximum (security protection)", () => {
			expect(() => TimeoutValidator.validateSlidingTimeout(86400001, "test")).toThrow(ValidationError)
			expect(() => TimeoutValidator.validateSlidingTimeout(Number.MAX_SAFE_INTEGER, "test")).toThrow(
				ValidationError,
			)
		})

		it("should handle string values correctly", () => {
			expect(TimeoutValidator.validateSlidingTimeout("30000", "test")).toBe(30000)
			expect(() => TimeoutValidator.validateSlidingTimeout("invalid", "test")).toThrow(ValidationError)
		})

		it("should handle edge cases", () => {
			expect(() => TimeoutValidator.validateSlidingTimeout(Infinity, "test")).toThrow(ValidationError)
			expect(() => TimeoutValidator.validateSlidingTimeout(-Infinity, "test")).toThrow(ValidationError)
			expect(() => TimeoutValidator.validateSlidingTimeout(NaN, "test")).toThrow(ValidationError)
		})

		it("should floor decimal values", () => {
			expect(TimeoutValidator.validateSlidingTimeout(30000.7, "test")).toBe(30000)
		})
	})

	describe("validateInfoQueryTimeout", () => {
		it("should accept valid timeout values", () => {
			expect(TimeoutValidator.validateInfoQueryTimeout(1000, "test")).toBe(1000) // 1 second
			expect(TimeoutValidator.validateInfoQueryTimeout(30000, "test")).toBe(30000) // 30 seconds
			expect(TimeoutValidator.validateInfoQueryTimeout(300000, "test")).toBe(300000) // 5 minutes
		})

		it("should use default when value is null or undefined", () => {
			expect(TimeoutValidator.validateInfoQueryTimeout(null, "test")).toBe(30000) // 30 seconds default
			expect(TimeoutValidator.validateInfoQueryTimeout(undefined, "test")).toBe(30000)
		})

		it("should reject values below minimum (security protection)", () => {
			expect(() => TimeoutValidator.validateInfoQueryTimeout(999, "test")).toThrow(ValidationError)
			expect(() => TimeoutValidator.validateInfoQueryTimeout(0, "test")).toThrow(ValidationError)
		})

		it("should reject values above maximum (security protection)", () => {
			expect(() => TimeoutValidator.validateInfoQueryTimeout(300001, "test")).toThrow(ValidationError)
			expect(() => TimeoutValidator.validateInfoQueryTimeout(Number.MAX_SAFE_INTEGER, "test")).toThrow(
				ValidationError,
			)
		})
	})

	describe("validateEnvironmentTimeout", () => {
		it("should validate sliding timeout environment variables", () => {
			expect(TimeoutValidator.validateEnvironmentTimeout("30000", "TEST_VAR", "sliding")).toBe(30000)
			expect(TimeoutValidator.validateEnvironmentTimeout(undefined, "TEST_VAR", "sliding")).toBe(1800000)
		})

		it("should validate info timeout environment variables", () => {
			expect(TimeoutValidator.validateEnvironmentTimeout("30000", "TEST_VAR", "info")).toBe(30000)
			expect(TimeoutValidator.validateEnvironmentTimeout(undefined, "TEST_VAR", "info")).toBe(30000)
		})

		it("should reject invalid environment variable values", () => {
			expect(() => TimeoutValidator.validateEnvironmentTimeout("invalid", "TEST_VAR", "sliding")).toThrow(
				ValidationError,
			)
			expect(() => TimeoutValidator.validateEnvironmentTimeout("999999999999", "TEST_VAR", "sliding")).toThrow(
				ValidationError,
			)
		})
	})

	describe("getTimeoutBounds", () => {
		it("should return correct bounds for validation", () => {
			const bounds = TimeoutValidator.getTimeoutBounds()

			expect(bounds.sliding.min).toBe(1000)
			expect(bounds.sliding.max).toBe(86400000)
			expect(bounds.sliding.default).toBe(1800000)

			expect(bounds.infoQuery.min).toBe(1000)
			expect(bounds.infoQuery.max).toBe(300000)
			expect(bounds.infoQuery.default).toBe(30000)
		})
	})

	describe("Security Tests", () => {
		it("should prevent resource exhaustion attacks with extremely large values", () => {
			const maliciousValues = [
				Number.MAX_SAFE_INTEGER,
				9007199254740991, // Max safe integer
				86400001, // Just over 24 hours
				999999999999, // Very large number
			]

			maliciousValues.forEach((value) => {
				expect(() => TimeoutValidator.validateSlidingTimeout(value, "security_test")).toThrow(ValidationError)
				expect(() => TimeoutValidator.validateInfoQueryTimeout(value, "security_test")).toThrow(ValidationError)
			})
		})

		it("should prevent DoS attacks with negative or zero values", () => {
			const invalidValues = [-1, -1000, -Number.MAX_SAFE_INTEGER, 0]

			invalidValues.forEach((value) => {
				expect(() => TimeoutValidator.validateSlidingTimeout(value, "security_test")).toThrow(ValidationError)
				expect(() => TimeoutValidator.validateInfoQueryTimeout(value, "security_test")).toThrow(ValidationError)
			})
		})

		it("should handle type confusion attacks", () => {
			const maliciousInputs = [
				{}, // Object
				[], // Array
				'{"evil": "payload"}', // JSON string
				'<script>alert("xss")</script>', // XSS attempt
				"../../../etc/passwd", // Path traversal attempt
			]

			maliciousInputs.forEach((input) => {
				expect(() => TimeoutValidator.validateSlidingTimeout(input, "security_test")).toThrow(ValidationError)
				expect(() => TimeoutValidator.validateInfoQueryTimeout(input, "security_test")).toThrow(ValidationError)
			})
		})
	})

	describe("Error Messages", () => {
		it("should provide clear error messages for validation failures", () => {
			try {
				TimeoutValidator.validateSlidingTimeout(999, "test")
			} catch (error) {
				expect(error).toBeInstanceOf(ValidationError)
				expect((error as ValidationError).message).toContain("must be at least 1000ms")
			}

			try {
				TimeoutValidator.validateSlidingTimeout(86400001, "test")
			} catch (error) {
				expect(error).toBeInstanceOf(ValidationError)
				expect((error as ValidationError).message).toContain("cannot exceed 86400000ms")
			}
		})
	})

	describe("Performance Tests", () => {
		it("should validate timeouts efficiently", () => {
			const start = performance.now()

			// Validate 1000 timeout values
			for (let i = 0; i < 1000; i++) {
				TimeoutValidator.validateSlidingTimeout(30000, "performance_test")
			}

			const duration = performance.now() - start
			expect(duration).toBeLessThan(100) // Should take less than 100ms for 1000 validations
		})
	})
})
