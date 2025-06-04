import { BatchProcessor } from "../BatchProcessor"
import { BatchConfig, BatchCommand, ErrorHandlingStrategy, OutputFormat } from "../../types/batch-types"
import { AutomationContext } from "../../types/automation-types"

// Mock CommandExecutor
jest.mock("../CommandExecutor")

describe("BatchProcessor", () => {
	let processor: BatchProcessor
	let mockContext: AutomationContext

	beforeEach(() => {
		mockContext = {
			isInteractive: false,
			defaults: {
				confirmations: false,
				fileOverwrite: false,
				createDirectories: true,
				timeout: 30000,
				retryCount: 3,
			},
			timeout: 30000,
			retryCount: 3,
			continueOnError: false,
			dryRun: false,
		}
		processor = new BatchProcessor(mockContext)
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe("executeBatch", () => {
		it("should execute batch commands sequentially", async () => {
			const mockConfig: BatchConfig = {
				commands: [
					{ id: "cmd1", command: "echo", args: ["hello"] },
					{ id: "cmd2", command: "echo", args: ["world"] },
				],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: mockContext.defaults,
				errorHandling: ErrorHandlingStrategy.FAIL_FAST,
			}

			// Mock the executor's execute method
			const mockExecute = jest
				.fn()
				.mockResolvedValueOnce({
					id: "cmd1",
					command: "echo hello",
					success: true,
					exitCode: 0,
					duration: 100,
					startTime: new Date(),
					endTime: new Date(),
				})
				.mockResolvedValueOnce({
					id: "cmd2",
					command: "echo world",
					success: true,
					exitCode: 0,
					duration: 150,
					startTime: new Date(),
					endTime: new Date(),
				})

			;(processor as any).executor.execute = mockExecute

			const result = await processor.executeBatch(mockConfig)

			expect(result.success).toBe(true)
			expect(result.totalCommands).toBe(2)
			expect(result.successfulCommands).toBe(2)
			expect(result.failedCommands).toBe(0)
			expect(mockExecute).toHaveBeenCalledTimes(2)
		})

		it("should execute batch commands in parallel", async () => {
			const mockConfig: BatchConfig = {
				commands: [
					{ id: "cmd1", command: "echo", args: ["hello"] },
					{ id: "cmd2", command: "echo", args: ["world"] },
				],
				settings: {
					parallel: true,
					maxConcurrency: 2,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: mockContext.defaults,
				errorHandling: ErrorHandlingStrategy.FAIL_FAST,
			}

			// Mock the executor's execute method
			const mockExecute = jest.fn().mockResolvedValue({
				id: "cmd1",
				command: "echo hello",
				success: true,
				exitCode: 0,
				duration: 100,
				startTime: new Date(),
				endTime: new Date(),
			})

			;(processor as any).executor.execute = mockExecute

			const result = await processor.executeBatch(mockConfig)

			expect(result.success).toBe(true)
			expect(result.totalCommands).toBe(2)
			expect(mockExecute).toHaveBeenCalledTimes(2)
		})

		it("should handle command failures with fail-fast", async () => {
			const mockConfig: BatchConfig = {
				commands: [
					{ id: "cmd1", command: "echo", args: ["hello"] },
					{ id: "cmd2", command: "false", args: [] }, // This will fail
				],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: mockContext.defaults,
				errorHandling: ErrorHandlingStrategy.FAIL_FAST,
			}

			const mockExecute = jest
				.fn()
				.mockResolvedValueOnce({
					id: "cmd1",
					command: "echo hello",
					success: true,
					exitCode: 0,
					duration: 100,
					startTime: new Date(),
					endTime: new Date(),
				})
				.mockResolvedValueOnce({
					id: "cmd2",
					command: "false",
					success: false,
					exitCode: 1,
					duration: 50,
					startTime: new Date(),
					endTime: new Date(),
				})

			;(processor as any).executor.execute = mockExecute

			const result = await processor.executeBatch(mockConfig)

			expect(result.success).toBe(false)
			expect(result.successfulCommands).toBe(1)
			expect(result.failedCommands).toBe(1)
		})

		it("should continue on error when configured", async () => {
			const mockConfig: BatchConfig = {
				commands: [
					{ id: "cmd1", command: "false", args: [] }, // This will fail
					{ id: "cmd2", command: "echo", args: ["world"] },
				],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: true,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: mockContext.defaults,
				errorHandling: ErrorHandlingStrategy.CONTINUE_ON_ERROR,
			}

			const mockExecute = jest
				.fn()
				.mockResolvedValueOnce({
					id: "cmd1",
					command: "false",
					success: false,
					exitCode: 1,
					duration: 50,
					startTime: new Date(),
					endTime: new Date(),
				})
				.mockResolvedValueOnce({
					id: "cmd2",
					command: "echo world",
					success: true,
					exitCode: 0,
					duration: 100,
					startTime: new Date(),
					endTime: new Date(),
				})

			;(processor as any).executor.execute = mockExecute

			const result = await processor.executeBatch(mockConfig)

			expect(result.success).toBe(false) // Overall failed due to one failure
			expect(result.successfulCommands).toBe(1)
			expect(result.failedCommands).toBe(1)
			expect(mockExecute).toHaveBeenCalledTimes(2) // Both commands executed
		})

		it("should handle command dependencies", async () => {
			const mockConfig: BatchConfig = {
				commands: [
					{ id: "setup", command: "echo", args: ["setup"] },
					{ id: "main", command: "echo", args: ["main"], dependsOn: ["setup"] },
					{ id: "cleanup", command: "echo", args: ["cleanup"], dependsOn: ["main"] },
				],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: mockContext.defaults,
				errorHandling: ErrorHandlingStrategy.FAIL_FAST,
			}

			const mockExecute = jest.fn().mockResolvedValue({
				id: "test",
				command: "echo test",
				success: true,
				exitCode: 0,
				duration: 100,
				startTime: new Date(),
				endTime: new Date(),
			})

			;(processor as any).executor.execute = mockExecute

			const result = await processor.executeBatch(mockConfig)

			expect(result.success).toBe(true)
			expect(mockExecute).toHaveBeenCalledTimes(3)
		})

		it("should skip commands when dependencies fail", async () => {
			const mockConfig: BatchConfig = {
				commands: [
					{ id: "setup", command: "false", args: [] }, // This will fail
					{ id: "main", command: "echo", args: ["main"], dependsOn: ["setup"] },
				],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: true,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: mockContext.defaults,
				errorHandling: ErrorHandlingStrategy.CONTINUE_ON_ERROR,
			}

			const mockExecute = jest.fn().mockResolvedValueOnce({
				id: "setup",
				command: "false",
				success: false,
				exitCode: 1,
				duration: 50,
				startTime: new Date(),
				endTime: new Date(),
			})

			;(processor as any).executor.execute = mockExecute

			const result = await processor.executeBatch(mockConfig)

			expect(result.failedCommands).toBe(1)
			expect(result.skippedCommands).toBe(1)
			expect(mockExecute).toHaveBeenCalledTimes(1) // Only setup command executed
		})

		it("should emit events during execution", async () => {
			const mockConfig: BatchConfig = {
				commands: [{ id: "cmd1", command: "echo", args: ["hello"] }],
				settings: {
					parallel: false,
					maxConcurrency: 1,
					continueOnError: false,
					verbose: false,
					dryRun: false,
					outputFormat: OutputFormat.TEXT,
				},
				defaults: mockContext.defaults,
				errorHandling: ErrorHandlingStrategy.FAIL_FAST,
			}

			const mockExecute = jest.fn().mockResolvedValue({
				id: "cmd1",
				command: "echo hello",
				success: true,
				exitCode: 0,
				duration: 100,
				startTime: new Date(),
				endTime: new Date(),
			})

			;(processor as any).executor.execute = mockExecute

			const eventSpy = jest.fn()
			processor.on("batchStarted", eventSpy)
			processor.on("commandStarted", eventSpy)
			processor.on("commandCompleted", eventSpy)
			processor.on("batchProgress", eventSpy)
			processor.on("batchCompleted", eventSpy)

			await processor.executeBatch(mockConfig)

			expect(eventSpy).toHaveBeenCalledTimes(5)
		})
	})
})
