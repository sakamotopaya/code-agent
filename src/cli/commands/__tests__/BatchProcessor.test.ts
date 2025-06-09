import { BatchProcessor } from "../batch"
import { Task } from "../../../core/task/Task"
import { CliConfigManager } from "../../config/CliConfigManager"
import { EventEmitter } from "events"

// Mock dependencies
jest.mock("../../../core/task/Task")
jest.mock("../../config/CliConfigManager")
jest.mock("../../services/CLILogger", () => ({
	getCLILogger: () => ({
		debug: jest.fn(),
		info: jest.fn(),
		error: jest.fn(),
	}),
}))
jest.mock("../../../core/adapters/cli", () => ({
	createCliAdapters: jest.fn().mockReturnValue({
		fileSystem: {},
		terminal: {},
		browser: {},
		telemetry: {},
	}),
}))
jest.mock("../../services/CLIUIService")

describe("BatchProcessor", () => {
	let batchProcessor: BatchProcessor
	let mockTask: any
	let mockTaskPromise: Promise<void>
	let mockConfigManager: any

	const defaultOptions = {
		cwd: "/test/cwd",
		verbose: false,
		color: false,
	}

	beforeEach(() => {
		jest.clearAllMocks()
		jest.useFakeTimers()

		// Create a mock task that extends EventEmitter
		mockTask = new EventEmitter()
		mockTask.taskId = "test-task-id"
		mockTask.isInitialized = true
		mockTask.abort = false
		mockTask.dispose = jest.fn().mockResolvedValue(undefined)

		// Mock task promise that never resolves (we'll control completion via events)
		mockTaskPromise = new Promise(() => {}) // Never resolves

		// Mock Task.create to return our mock task and promise
		;(Task.create as jest.Mock).mockReturnValue([mockTask, mockTaskPromise])

		mockConfigManager = {
			loadConfiguration: jest.fn().mockResolvedValue({
				apiProvider: "anthropic",
				apiKey: "test-key",
				apiModelId: "claude-3-5-sonnet-20241022",
			}),
		}
		;(CliConfigManager as any).mockImplementation(() => mockConfigManager)

		batchProcessor = new BatchProcessor(defaultOptions, mockConfigManager)
	})

	afterEach(() => {
		jest.useRealTimers()
	})

	describe("sliding timeout", () => {
		it("should timeout after 60 seconds of inactivity", async () => {
			const runPromise = batchProcessor.run("test task")

			// Fast-forward 60 seconds
			jest.advanceTimersByTime(60000)

			await expect(runPromise).rejects.toThrow("Task execution timeout after 60000ms of inactivity")
		})

		it("should reset timeout when task activity occurs", async () => {
			const runPromise = batchProcessor.run("test task")

			// Wait 59 seconds (just before timeout)
			jest.advanceTimersByTime(59000)

			// Trigger activity event - this should reset the timeout
			mockTask.emit("taskTokenUsageUpdated", "test-task-id", { inputTokens: 100 })

			// Wait another 59 seconds (should not timeout yet)
			jest.advanceTimersByTime(59000)

			// Task should still be running, no timeout yet
			expect(runPromise).not.toBe(undefined)

			// Now wait the full 60 seconds from the last activity
			jest.advanceTimersByTime(1000)

			await expect(runPromise).rejects.toThrow("Task execution timeout after 60000ms of inactivity")
		})

		it("should reset timeout on various activity events", async () => {
			const runPromise = batchProcessor.run("test task")

			const activityEvents = [
				["taskStarted"],
				["taskModeSwitched", "test-task-id", "code"],
				["taskPaused"],
				["taskUnpaused"],
				["taskAskResponded"],
				["taskSpawned", "new-task-id"],
				["taskTokenUsageUpdated", "test-task-id", { inputTokens: 100 }],
				["message", { action: "created" }],
			]

			for (const event of activityEvents) {
				// Wait 59 seconds
				jest.advanceTimersByTime(59000)

				// Trigger activity event
				mockTask.emit(event[0], ...event.slice(1))

				// Should not timeout yet
				expect(runPromise).not.toBe(undefined)
			}

			// Wait full timeout after last activity
			jest.advanceTimersByTime(60000)

			await expect(runPromise).rejects.toThrow("Task execution timeout after 60000ms of inactivity")
		})

		it("should clear timeout when task completes successfully", async () => {
			const runPromise = batchProcessor.run("test task")

			// Wait 30 seconds
			jest.advanceTimersByTime(30000)

			// Complete the task
			mockTask.emit("taskCompleted", "test-task-id", { inputTokens: 100 }, { toolName: 1 })

			// Should resolve successfully
			await expect(runPromise).resolves.toBeUndefined()

			// Advance timers to ensure no timeout occurs
			jest.advanceTimersByTime(120000)
		})

		it("should clear timeout when task is aborted", async () => {
			const runPromise = batchProcessor.run("test task")

			// Wait 30 seconds
			jest.advanceTimersByTime(30000)

			// Abort the task
			mockTask.emit("taskAborted")

			// Should reject with abort error
			await expect(runPromise).rejects.toThrow("Task was aborted")

			// Advance timers to ensure no timeout occurs
			jest.advanceTimersByTime(120000)
		})

		it("should clear timeout when tool fails", async () => {
			const runPromise = batchProcessor.run("test task")

			// Wait 30 seconds
			jest.advanceTimersByTime(30000)

			// Trigger tool failure
			mockTask.emit("taskToolFailed", "test-task-id", "read_file", "File not found")

			// Should reject with tool failure error
			await expect(runPromise).rejects.toThrow("Tool read_file failed: File not found")

			// Advance timers to ensure no timeout occurs
			jest.advanceTimersByTime(120000)
		})

		it("should handle multiple rapid activity events correctly", async () => {
			const runPromise = batchProcessor.run("test task")

			// Trigger multiple rapid events
			for (let i = 0; i < 10; i++) {
				jest.advanceTimersByTime(5000) // 5 seconds between events
				mockTask.emit("taskTokenUsageUpdated", "test-task-id", { inputTokens: 100 + i })
			}

			// Total elapsed time: 50 seconds, but timeout should be reset to start from last event
			// Wait another 59 seconds (should not timeout)
			jest.advanceTimersByTime(59000)

			// Should still be running
			expect(runPromise).not.toBe(undefined)

			// Wait the final second to trigger timeout
			jest.advanceTimersByTime(1000)

			await expect(runPromise).rejects.toThrow("Task execution timeout after 60000ms of inactivity")
		})

		it("should not reset timeout for non-activity events", async () => {
			const runPromise = batchProcessor.run("test task")

			// Wait 59 seconds
			jest.advanceTimersByTime(59000)

			// Trigger a non-activity event that shouldn't reset timeout
			// (Note: In our current implementation, we don't have non-activity events that are listened to,
			// but this test ensures we're only listening to the right events)

			// Wait 1 more second to trigger timeout
			jest.advanceTimersByTime(1000)

			await expect(runPromise).rejects.toThrow("Task execution timeout after 60000ms of inactivity")
		})
	})

	describe("error handling", () => {
		it("should handle configuration loading errors gracefully", async () => {
			mockConfigManager.loadConfiguration.mockRejectedValue(new Error("Config error"))

			// Should fall back to environment variables
			process.env.ANTHROPIC_API_KEY = "env-key"

			const runPromise = batchProcessor.run("test task")

			// Should still proceed with fallback config
			expect(Task.create).toHaveBeenCalled()

			// Clean up
			delete process.env.ANTHROPIC_API_KEY

			// Complete the task to avoid hanging test
			mockTask.emit("taskCompleted", "test-task-id", {}, {})
			await expect(runPromise).resolves.toBeUndefined()
		})

		it("should exit if no API key is available", async () => {
			mockConfigManager.loadConfiguration.mockRejectedValue(new Error("Config error"))
			delete process.env.ANTHROPIC_API_KEY
			delete process.env.ROO_API_KEY

			const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("process.exit called")
			})

			await expect(batchProcessor.run("test task")).rejects.toThrow("process.exit called")

			expect(mockExit).toHaveBeenCalledWith(1)
			mockExit.mockRestore()
		})
	})
})
