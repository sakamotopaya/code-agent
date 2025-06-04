/**
 * Tests for CLIError base class
 */

import { CLIError } from "../CLIError"
import { ErrorCategory, ErrorSeverity } from "../../types/error-types"

// Concrete implementation for testing
class TestCLIError extends CLIError {
	readonly category = ErrorCategory.INTERNAL
	readonly severity = ErrorSeverity.MEDIUM
	readonly isRecoverable = true

	getSuggestedActions(): string[] {
		return ["Test action 1", "Test action 2"]
	}

	getDocumentationLinks(): string[] {
		return ["https://test.com/docs"]
	}
}

describe("CLIError", () => {
	const testError = new TestCLIError("Test error message", "TEST_ERROR")

	describe("constructor", () => {
		it("should set basic properties correctly", () => {
			expect(testError.message).toBe("Test error message")
			expect(testError.code).toBe("TEST_ERROR")
			expect(testError.name).toBe("TestCLIError")
		})

		it("should accept optional context and cause", () => {
			const cause = new Error("Original error")
			const context = {
				operationId: "test-op",
				command: "test",
				arguments: [],
				workingDirectory: "/test",
				environment: {},
				timestamp: new Date(),
				stackTrace: [],
				systemInfo: {
					platform: "test",
					nodeVersion: "v16.0.0",
					cliVersion: "1.0.0",
					memoryUsage: process.memoryUsage(),
					uptime: 100,
				},
			}

			const errorWithContext = new TestCLIError("Test error with context", "TEST_CONTEXT_ERROR", context, cause)

			expect(errorWithContext.context).toBe(context)
			expect(errorWithContext.cause).toBe(cause)
		})
	})

	describe("getUserFriendlyMessage", () => {
		it("should return the error message by default", () => {
			expect(testError.getUserFriendlyMessage()).toBe("Test error message")
		})
	})

	describe("getTechnicalDetails", () => {
		it("should return technical details object", () => {
			const details = testError.getTechnicalDetails()

			expect(details).toEqual({
				code: "TEST_ERROR",
				category: ErrorCategory.INTERNAL,
				severity: ErrorSeverity.MEDIUM,
				isRecoverable: true,
				cause: undefined,
				context: undefined,
			})
		})

		it("should include cause message when present", () => {
			const cause = new Error("Root cause")
			const errorWithCause = new TestCLIError("Test error", "TEST_ERROR", undefined, cause)
			const details = errorWithCause.getTechnicalDetails()

			expect(details.cause).toBe("Root cause")
		})
	})

	describe("toJSON", () => {
		it("should return JSON representation", () => {
			const json = testError.toJSON()

			expect(json).toEqual({
				name: "TestCLIError",
				message: "Test error message",
				code: "TEST_ERROR",
				category: ErrorCategory.INTERNAL,
				severity: ErrorSeverity.MEDIUM,
				isRecoverable: true,
				suggestedActions: ["Test action 1", "Test action 2"],
				documentationLinks: ["https://test.com/docs"],
				stack: testError.stack,
				cause: undefined,
				context: undefined,
			})
		})
	})

	describe("abstract methods", () => {
		it("should implement required abstract methods", () => {
			expect(testError.getSuggestedActions()).toEqual(["Test action 1", "Test action 2"])
			expect(testError.getDocumentationLinks()).toEqual(["https://test.com/docs"])
			expect(testError.category).toBe(ErrorCategory.INTERNAL)
			expect(testError.severity).toBe(ErrorSeverity.MEDIUM)
			expect(testError.isRecoverable).toBe(true)
		})
	})

	describe("stack trace", () => {
		it("should maintain proper stack trace", () => {
			expect(testError.stack).toBeDefined()
			expect(testError.stack).toContain("TestCLIError")
		})
	})
})
