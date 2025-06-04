/**
 * Tests for ErrorHandlingService
 */

import { ErrorHandlingService } from "../ErrorHandlingService"
import { FileSystemError, NetworkError } from "../../errors"
import { ErrorCategory, ErrorSeverity, ErrorContext } from "../../types/error-types"

// Mock dependencies
jest.mock("../ErrorClassifier")
jest.mock("../RecoveryManager")
jest.mock("../ErrorReporter")

const MockErrorClassifier = require("../ErrorClassifier").ErrorClassifier
const MockRecoveryManager = require("../RecoveryManager").RecoveryManager
const MockErrorReporter = require("../ErrorReporter").ErrorReporter

describe("ErrorHandlingService", () => {
	let errorHandlingService: ErrorHandlingService
	let mockContext: ErrorContext
	let mockClassifier: jest.Mocked<any>
	let mockRecoveryManager: jest.Mocked<any>
	let mockReporter: jest.Mocked<any>

	beforeEach(() => {
		// Setup mocks
		mockClassifier = {
			categorizeError: jest.fn().mockReturnValue(ErrorCategory.INTERNAL),
			classifyError: jest.fn().mockReturnValue({
				originalError: new Error("test"),
				category: ErrorCategory.INTERNAL,
				severity: ErrorSeverity.MEDIUM,
				isRecoverable: true,
				suggestedActions: ["Test suggestion"],
				relatedDocumentation: ["Test doc"],
			}),
			getSuggestedActions: jest.fn().mockReturnValue(["Test suggestion"]),
		}

		mockRecoveryManager = {
			attemptRecovery: jest.fn().mockResolvedValue({ success: false, suggestions: ["Recovery suggestion"] }),
			cleanupResources: jest.fn().mockResolvedValue(undefined),
			getRecoveryStatistics: jest.fn().mockReturnValue({
				totalOperations: 0,
				activeOperations: 0,
				trackedResources: 0,
			}),
		}

		mockReporter = {
			generateReport: jest.fn().mockResolvedValue({
				id: "test-report-123",
				timestamp: new Date(),
				error: {
					originalError: new Error("test"),
					category: ErrorCategory.INTERNAL,
					severity: ErrorSeverity.MEDIUM,
					isRecoverable: true,
					suggestedActions: ["Test suggestion"],
					relatedDocumentation: ["Test doc"],
				},
				context: mockContext,
			}),
			reportError: jest.fn().mockResolvedValue(undefined),
			getErrorStatistics: jest.fn().mockResolvedValue({
				totalErrors: 0,
				errorsByCategory: {},
				errorsBySeverity: {},
				recentErrors: [],
				commonPatterns: [],
				recoverySuccessRate: 0,
			}),
		}

		MockErrorClassifier.mockImplementation(() => mockClassifier)
		MockRecoveryManager.mockImplementation(() => mockRecoveryManager)
		MockErrorReporter.mockImplementation(() => mockReporter)

		errorHandlingService = new ErrorHandlingService()

		mockContext = {
			operationId: "test-op-123",
			command: "test-command",
			arguments: ["--test"],
			workingDirectory: "/test/dir",
			environment: { NODE_ENV: "test" },
			timestamp: new Date(),
			stackTrace: ["line 1", "line 2"],
			systemInfo: {
				platform: "test",
				nodeVersion: "v16.0.0",
				cliVersion: "1.0.0",
				memoryUsage: process.memoryUsage(),
				uptime: 100,
			},
		}

		// Reset console spies
		jest.spyOn(console, "error").mockImplementation()
		jest.spyOn(console, "warn").mockImplementation()
		jest.spyOn(console, "info").mockImplementation()
		jest.spyOn(console, "log").mockImplementation()
		jest.spyOn(console, "debug").mockImplementation()
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	describe("handleError", () => {
		it("should handle a basic error successfully", async () => {
			const error = new Error("Test error")
			const result = await errorHandlingService.handleError(error, mockContext)

			expect(result).toBeDefined()
			expect(result.success).toBeDefined()
			expect(result.recovered).toBeDefined()
			expect(result.suggestions).toBeDefined()
			expect(result.nextActions).toBeDefined()
		})

		it("should handle FileSystemError with recovery attempt", async () => {
			const error = new FileSystemError("File not found", "FS_ERROR", "/test/file.txt", "read")
			const result = await errorHandlingService.handleError(error, mockContext)

			expect(result.suggestions).toContain("Check file permissions")
			expect(result.nextActions).toBeDefined()
		})

		it("should handle NetworkError with recovery attempt", async () => {
			const error = new NetworkError("Connection failed", "NET_ERROR", 500, "https://api.test.com")
			const result = await errorHandlingService.handleError(error, mockContext)

			expect(result.suggestions).toContain("Check internet connection")
			expect(result.nextActions).toBeDefined()
		})

		it("should handle error handling failures gracefully", async () => {
			// Mock the classifier to throw an error
			const mockClassifier = require("../ErrorClassifier").ErrorClassifier
			mockClassifier.prototype.classifyError = jest.fn().mockImplementation(() => {
				throw new Error("Classifier failed")
			})

			const error = new Error("Original error")
			const result = await errorHandlingService.handleError(error, mockContext)

			expect(result.success).toBe(false)
			expect(result.recovered).toBe(false)
			expect(result.suggestions).toContain("Error handling system encountered an issue")
		})
	})

	describe("categorizeError", () => {
		it("should categorize different error types", () => {
			const fsError = new FileSystemError("FS error", "FS_ERROR")
			const netError = new NetworkError("Net error", "NET_ERROR")
			const genericError = new Error("Generic error")

			expect(errorHandlingService.categorizeError(fsError)).toBe(ErrorCategory.FILE_SYSTEM)
			expect(errorHandlingService.categorizeError(netError)).toBe(ErrorCategory.NETWORK)
			expect(errorHandlingService.categorizeError(genericError)).toBeDefined()
		})
	})

	describe("formatError", () => {
		const error = new Error("Test formatting error")

		it("should format error as plain text", () => {
			const formatted = errorHandlingService.formatError(error, "plain" as any)
			expect(formatted).toContain("Error: Test formatting error")
		})

		it("should format error as JSON", () => {
			const formatted = errorHandlingService.formatError(error, "json" as any)
			const parsed = JSON.parse(formatted)
			expect(parsed.name).toBe("Error")
			expect(parsed.message).toBe("Test formatting error")
			expect(parsed.timestamp).toBeDefined()
		})

		it("should format error in structured format", () => {
			const formatted = errorHandlingService.formatError(error, "structured" as any)
			expect(formatted).toContain("┌─ Error Details")
			expect(formatted).toContain("│ Name: Error")
			expect(formatted).toContain("│ Message: Test formatting error")
		})

		it("should format error in user-friendly format", () => {
			const formatted = errorHandlingService.formatError(error, "user_friendly" as any)
			expect(formatted).toContain("❌ Something went wrong")
			expect(formatted).toContain("💡 Suggestions:")
		})

		it("should include stack trace in debug mode", () => {
			errorHandlingService.enableDebugMode(true)
			const formatted = errorHandlingService.formatError(error, "plain" as any)
			expect(formatted).toContain("Stack trace:")
		})
	})

	describe("logError", () => {
		it("should log errors at appropriate levels", async () => {
			const fsError = new FileSystemError("FS error", "FS_ERROR")
			const netError = new NetworkError("Net error", "NET_ERROR")
			const genericError = new Error("Generic error")

			await errorHandlingService.logError(fsError, mockContext)
			await errorHandlingService.logError(netError, mockContext)
			await errorHandlingService.logError(genericError, mockContext)

			// Console should have been called
			expect(console.warn).toHaveBeenCalled()
			expect(console.info).toHaveBeenCalled()
		})

		it("should include debug information when debug mode is enabled", async () => {
			errorHandlingService.enableDebugMode(true)
			const error = new Error("Debug test error")

			await errorHandlingService.logError(error, mockContext)

			// Should have logged with debug information
			expect(console.info).toHaveBeenCalledWith(
				expect.stringContaining("Error: Debug test error"),
				expect.any(Object),
			)
		})
	})

	describe("debugMode", () => {
		it("should enable and disable debug mode", () => {
			expect(errorHandlingService.getHandlingStatistics().debugModeEnabled).toBe(false)

			errorHandlingService.enableDebugMode(true)
			expect(errorHandlingService.getHandlingStatistics().debugModeEnabled).toBe(true)

			errorHandlingService.enableDebugMode(false)
			expect(errorHandlingService.getHandlingStatistics().debugModeEnabled).toBe(false)
		})
	})

	describe("captureDebugInfo", () => {
		it("should capture debug information", () => {
			const error = new Error("Debug info test")
			const debugInfo = errorHandlingService.captureDebugInfo(error)

			expect(debugInfo.context).toBeDefined()
			expect(debugInfo.performanceMetrics).toBeDefined()
			expect(debugInfo.performanceMetrics.memoryUsage).toBeDefined()
			expect(debugInfo.memorySnapshot).toBeDefined()
			expect(debugInfo.networkLogs).toEqual([])
			expect(debugInfo.fileSystemOperations).toEqual([])
		})
	})

	describe("generateErrorReport", () => {
		it("should generate error report", async () => {
			const error = new Error("Report test error")
			const report = await errorHandlingService.generateErrorReport(error, mockContext)

			expect(report.id).toBeDefined()
			expect(report.timestamp).toBeDefined()
			expect(report.error).toBeDefined()
			expect(report.context).toBe(mockContext)
		})

		it("should include debug info when debug mode is enabled", async () => {
			errorHandlingService.enableDebugMode(true)
			const error = new Error("Debug report test")
			const report = await errorHandlingService.generateErrorReport(error, mockContext)

			expect(report.debugInfo).toBeDefined()
		})

		it("should create basic context when none provided", async () => {
			const error = new Error("No context test")
			const report = await errorHandlingService.generateErrorReport(error)

			expect(report.context).toBeDefined()
			expect(report.context.operationId).toBeDefined()
			expect(report.context.command).toBeDefined()
		})
	})

	describe("getHandlingStatistics", () => {
		it("should return handling statistics", async () => {
			// Handle a few errors to increment count
			await errorHandlingService.handleError(new Error("Test 1"), mockContext)
			await errorHandlingService.handleError(new Error("Test 2"), mockContext)

			const stats = errorHandlingService.getHandlingStatistics()

			expect(stats.totalErrors).toBe(2)
			expect(stats.debugModeEnabled).toBe(false)
			expect(stats.recoveryManagerStats).toBeDefined()
		})
	})

	describe("setupGlobalHandlers", () => {
		let originalListeners: Record<string, ((...args: any[]) => void)[]>

		beforeEach(() => {
			// Store original listeners
			originalListeners = {
				uncaughtException: process.listeners("uncaughtException"),
				unhandledRejection: process.listeners("unhandledRejection"),
				warning: process.listeners("warning"),
				SIGINT: process.listeners("SIGINT"),
				SIGTERM: process.listeners("SIGTERM"),
			}

			// Remove existing listeners
			process.removeAllListeners("uncaughtException")
			process.removeAllListeners("unhandledRejection")
			process.removeAllListeners("warning")
			process.removeAllListeners("SIGINT")
			process.removeAllListeners("SIGTERM")
		})

		afterEach(() => {
			// Restore original listeners
			process.removeAllListeners("uncaughtException")
			process.removeAllListeners("unhandledRejection")
			process.removeAllListeners("warning")
			process.removeAllListeners("SIGINT")
			process.removeAllListeners("SIGTERM")

			// Add back original listeners
			Object.entries(originalListeners).forEach(([event, listeners]) => {
				listeners.forEach((listener) => process.on(event as any, listener as (...args: any[]) => void))
			})
		})

		it("should setup global error handlers", () => {
			errorHandlingService.setupGlobalHandlers()

			expect(process.listenerCount("uncaughtException")).toBe(1)
			expect(process.listenerCount("unhandledRejection")).toBe(1)
			expect(process.listenerCount("warning")).toBe(1)
			expect(process.listenerCount("SIGINT")).toBe(1)
			expect(process.listenerCount("SIGTERM")).toBe(1)
		})

		it("should handle warnings in debug mode", () => {
			errorHandlingService.enableDebugMode(true)
			errorHandlingService.setupGlobalHandlers()

			// Emit a warning
			process.emit("warning", new Error("Test warning") as any)

			expect(console.warn).toHaveBeenCalledWith("Process warning:", expect.any(Error))
		})
	})
})
