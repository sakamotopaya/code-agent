import { NonInteractiveModeService } from "../NonInteractiveModeService"
import { BatchConfig, ErrorHandlingStrategy, OutputFormat } from "../../types/batch-types"
import { NonInteractiveOptions } from "../../types/automation-types"
import * as fs from "fs/promises"

// Mock dependencies
jest.mock("../BatchProcessor")
jest.mock("../AutomationLogger")
jest.mock("../parsers/BatchFileParser")

describe("NonInteractiveModeService", () => {
	let service: NonInteractiveModeService
	let mockOptions: NonInteractiveOptions

	beforeEach(() => {
		mockOptions = {
			yes: true,
			verbose: true,
			timeout: 60000,
		}
		service = new NonInteractiveModeService(mockOptions)
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with default options", () => {
			const defaultService = new NonInteractiveModeService()
			expect(defaultService).toBeInstanceOf(NonInteractiveModeService)
		})

		it("should initialize with provided options", () => {
			expect(service).toBeInstanceOf(NonInteractiveModeService)
		})
	})

	describe("setNonInteractiveMode", () => {
		it("should enable non-interactive mode", () => {
			service.setNonInteractiveMode(true)
			// Should not throw
		})

		it("should disable non-interactive mode", () => {
			service.setNonInteractiveMode(false)
			// Should not throw
		})
	})

	describe("configureDefaults", () => {
		it("should update defaults", () => {
			const newDefaults = {
				confirmations: false,
				fileOverwrite: true,
				createDirectories: false,
				timeout: 120000,
				retryCount: 5,
			}

			service.configureDefaults(newDefaults)
			// Should not throw
		})
	})

	describe("setErrorHandling", () => {
		it("should set error handling strategy", () => {
			service.setErrorHandling(ErrorHandlingStrategy.CONTINUE_ON_ERROR)
			// Should not throw
		})
	})

	describe("executeBatch", () => {
		it("should execute a valid batch configuration", async () => {
			const mockBatchConfig: BatchConfig = {
				commands: [
					{
						id: "test1",
						command: "echo",
						args: ["hello"],
					},
				],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: {
					confirmations: false,
					fileOverwrite: false,
					createDirectories: true,
					timeout: 30000,
					retryCount: 3,
				},
				errorHandling: ErrorHandlingStrategy.FAIL_FAST,
			}

			// Mock the batch processor's executeBatch method
			const mockExecuteBatch = jest.fn().mockResolvedValue({
				success: true,
				totalCommands: 1,
				successfulCommands: 1,
				failedCommands: 0,
				skippedCommands: 0,
				duration: 1000,
				startTime: new Date(),
				endTime: new Date(),
				results: [],
				summary: {
					totalTime: 1000,
					averageCommandTime: 1000,
					errors: [],
				},
			})

			// Replace the batch processor's method
			;(service as any).batchProcessor.executeBatch = mockExecuteBatch

			const result = await service.executeBatch(mockBatchConfig)
			expect(result.success).toBe(true)
			expect(mockExecuteBatch).toHaveBeenCalledWith(mockBatchConfig)
		})

		it("should handle batch execution errors", async () => {
			const mockBatchConfig: BatchConfig = {
				commands: [],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: {
					confirmations: false,
					fileOverwrite: false,
					createDirectories: true,
					timeout: 30000,
					retryCount: 3,
				},
				errorHandling: ErrorHandlingStrategy.FAIL_FAST,
			}

			// Mock the batch processor to throw an error
			const mockExecuteBatch = jest.fn().mockRejectedValue(new Error("Batch execution failed"))
			;(service as any).batchProcessor.executeBatch = mockExecuteBatch

			await expect(service.executeBatch(mockBatchConfig)).rejects.toThrow("Batch execution failed")
		})
	})

	describe("executeFromFile", () => {
		it("should execute commands from a valid file", async () => {
			const filePath = "test-batch.json"
			const mockBatchConfig: BatchConfig = {
				commands: [
					{
						id: "test1",
						command: "echo",
						args: ["hello"],
					},
				],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: {
					confirmations: false,
					fileOverwrite: false,
					createDirectories: true,
					timeout: 30000,
					retryCount: 3,
				},
				errorHandling: ErrorHandlingStrategy.FAIL_FAST,
			}

			// Mock file access and parser
			jest.spyOn(fs, "access").mockResolvedValue(undefined)
			const mockParseFile = jest.fn().mockResolvedValue(mockBatchConfig)
			;(service as any).fileParser.parseFile = mockParseFile

			const mockExecuteBatch = jest.fn().mockResolvedValue({
				success: true,
				totalCommands: 1,
				successfulCommands: 1,
				failedCommands: 0,
				skippedCommands: 0,
				duration: 1000,
				startTime: new Date(),
				endTime: new Date(),
				results: [],
				summary: {
					totalTime: 1000,
					averageCommandTime: 1000,
					errors: [],
				},
			})
			;(service as any).batchProcessor.executeBatch = mockExecuteBatch

			const result = await service.executeFromFile(filePath)
			expect(result.success).toBe(true)
			expect(mockParseFile).toHaveBeenCalledWith(filePath)
		})

		it("should throw error for non-existent file", async () => {
			const filePath = "non-existent.json"

			// Mock file access to throw error
			jest.spyOn(fs, "access").mockRejectedValue(new Error("File not found"))

			await expect(service.executeFromFile(filePath)).rejects.toThrow("Batch file not found")
		})
	})

	describe("executeFromStdin", () => {
		it("should execute commands from stdin JSON input", async () => {
			const jsonInput = JSON.stringify({
				version: "1.0",
				commands: [{ id: "test1", command: "echo", args: ["hello"] }],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: "text",
				},
				defaults: {
					confirmations: false,
					fileOverwrite: false,
					createDirectories: true,
					timeout: 30000,
					retryCount: 3,
				},
			})

			// Mock stdin reading
			const mockReadStdin = jest.fn().mockResolvedValue(jsonInput)
			;(service as any).readStdin = mockReadStdin

			const mockParseJSON = jest.fn().mockReturnValue({
				commands: [{ id: "test1", command: "echo", args: ["hello"] }],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: {
					confirmations: false,
					fileOverwrite: false,
					createDirectories: true,
					timeout: 30000,
					retryCount: 3,
				},
				errorHandling: ErrorHandlingStrategy.FAIL_FAST,
			})
			;(service as any).fileParser.parseJSON = mockParseJSON

			const mockExecuteBatch = jest.fn().mockResolvedValue({
				success: true,
				totalCommands: 1,
				successfulCommands: 1,
				failedCommands: 0,
				skippedCommands: 0,
				duration: 1000,
				startTime: new Date(),
				endTime: new Date(),
				results: [],
				summary: { totalTime: 1000, averageCommandTime: 1000, errors: [] },
			})
			;(service as any).batchProcessor.executeBatch = mockExecuteBatch

			const result = await service.executeFromStdin()
			expect(result.success).toBe(true)
		})

		it("should execute commands from stdin text input", async () => {
			const textInput = "echo hello\nnpm test"

			// Mock stdin reading
			const mockReadStdin = jest.fn().mockResolvedValue(textInput)
			;(service as any).readStdin = mockReadStdin

			const mockParseText = jest.fn().mockReturnValue({
				commands: [
					{ id: "cmd_1", command: "echo", args: ["hello"] },
					{ id: "cmd_2", command: "npm", args: ["test"] },
				],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: {
					confirmations: false,
					fileOverwrite: false,
					createDirectories: true,
					timeout: 30000,
					retryCount: 3,
				},
				errorHandling: ErrorHandlingStrategy.FAIL_FAST,
			})
			;(service as any).fileParser.parseText = mockParseText

			const mockExecuteBatch = jest.fn().mockResolvedValue({
				success: true,
				totalCommands: 2,
				successfulCommands: 2,
				failedCommands: 0,
				skippedCommands: 0,
				duration: 2000,
				startTime: new Date(),
				endTime: new Date(),
				results: [],
				summary: { totalTime: 2000, averageCommandTime: 1000, errors: [] },
			})
			;(service as any).batchProcessor.executeBatch = mockExecuteBatch

			const result = await service.executeFromStdin()
			expect(result.success).toBe(true)
		})

		it("should throw error for empty stdin input", async () => {
			// Mock stdin reading to return empty string
			const mockReadStdin = jest.fn().mockResolvedValue("")
			;(service as any).readStdin = mockReadStdin

			await expect(service.executeFromStdin()).rejects.toThrow("No input received from stdin")
		})
	})

	describe("getExecutionStatus", () => {
		it("should return default status when no execution is running", () => {
			const status = service.getExecutionStatus()
			expect(status.isRunning).toBe(false)
			expect(status.completedCommands).toBe(0)
			expect(status.totalCommands).toBe(0)
			expect(status.progress).toBe(0)
		})
	})

	describe("getMetrics", () => {
		it("should return default metrics when no execution is running", () => {
			const metrics = service.getMetrics()
			expect(metrics.totalExecutionTime).toBe(0)
			expect(metrics.averageCommandTime).toBe(0)
			expect(metrics.successRate).toBe(0)
			expect(metrics.failureRate).toBe(0)
			expect(metrics.concurrencyLevel).toBe(1)
		})
	})
})
