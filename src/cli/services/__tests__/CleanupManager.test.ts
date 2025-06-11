import { CleanupManager } from "../CleanupManager"
import { getCLILogger } from "../CLILogger"

// Mock the logger
jest.mock("../CLILogger")
const mockLogger = {
	debug: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	info: jest.fn(),
}
;(getCLILogger as jest.Mock).mockReturnValue(mockLogger)

describe("CleanupManager", () => {
	let cleanupManager: CleanupManager

	beforeEach(() => {
		// Reset the singleton instance before each test
		CleanupManager.reset()
		cleanupManager = CleanupManager.getInstance()
		jest.clearAllMocks()

		// Reset process.exitCode
		delete process.exitCode

		// Mock process.exit to prevent actual process termination during tests
		const originalExit = process.exit
		process.exit = jest.fn() as any

		// Restore process.exit after tests
		afterEach(() => {
			process.exit = originalExit
		})
	})

	afterEach(() => {
		CleanupManager.reset()
	})

	describe("getInstance", () => {
		it("should return the same instance (singleton)", () => {
			const instance1 = CleanupManager.getInstance()
			const instance2 = CleanupManager.getInstance()

			expect(instance1).toBe(instance2)
		})
	})

	describe("registerCleanupTask", () => {
		it("should register cleanup tasks", () => {
			const task1 = jest.fn().mockResolvedValue(undefined)
			const task2 = jest.fn().mockResolvedValue(undefined)

			cleanupManager.registerCleanupTask(task1)
			cleanupManager.registerCleanupTask(task2)

			expect(cleanupManager.getCleanupTaskCount()).toBe(2)
		})

		it("should not register tasks when manager is disposed", () => {
			// Force dispose the manager
			cleanupManager["isDisposed"] = true

			const task = jest.fn().mockResolvedValue(undefined)
			cleanupManager.registerCleanupTask(task)

			expect(cleanupManager.getCleanupTaskCount()).toBe(0)
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"[CleanupManager] Cannot register cleanup task - manager is disposed",
			)
		})
	})

	describe("clearCleanupTasks", () => {
		it("should clear all registered tasks", () => {
			const task1 = jest.fn().mockResolvedValue(undefined)
			const task2 = jest.fn().mockResolvedValue(undefined)

			cleanupManager.registerCleanupTask(task1)
			cleanupManager.registerCleanupTask(task2)

			expect(cleanupManager.getCleanupTaskCount()).toBe(2)

			cleanupManager.clearCleanupTasks()

			expect(cleanupManager.getCleanupTaskCount()).toBe(0)
		})
	})

	describe("performShutdown", () => {
		it("should execute all cleanup tasks successfully", async () => {
			const task1 = jest.fn().mockResolvedValue(undefined)
			const task2 = jest.fn().mockResolvedValue(undefined)

			cleanupManager.registerCleanupTask(task1)
			cleanupManager.registerCleanupTask(task2)

			await cleanupManager.performShutdown()

			expect(task1).toHaveBeenCalled()
			expect(task2).toHaveBeenCalled()
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining("Starting graceful shutdown with 2 cleanup tasks"),
			)
			expect(mockLogger.debug).toHaveBeenCalledWith("[CleanupManager] Graceful shutdown completed successfully")
		})

		it("should handle failing cleanup tasks gracefully", async () => {
			const successTask = jest.fn().mockResolvedValue(undefined)
			const failingTask = jest.fn().mockRejectedValue(new Error("Cleanup failed"))

			cleanupManager.registerCleanupTask(successTask)
			cleanupManager.registerCleanupTask(failingTask)

			await cleanupManager.performShutdown()

			expect(successTask).toHaveBeenCalled()
			expect(failingTask).toHaveBeenCalled()
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Cleanup task 2 failed:"),
				expect.any(Error),
			)
		})

		it("should timeout and force exit if cleanup takes too long", async () => {
			const slowTask = jest.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5000)))

			cleanupManager.registerCleanupTask(slowTask)

			// Use a very short timeout to trigger timeout behavior
			await cleanupManager.performShutdown(100)

			expect(slowTask).toHaveBeenCalled()
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Cleanup timeout or error"),
				expect.any(Error),
			)
		})

		it("should not run if shutdown is already in progress", async () => {
			const task = jest.fn().mockResolvedValue(undefined)
			cleanupManager.registerCleanupTask(task)

			// Start first shutdown
			const firstShutdown = cleanupManager.performShutdown()

			// Try to start second shutdown
			const secondShutdown = cleanupManager.performShutdown()

			await Promise.all([firstShutdown, secondShutdown])

			// Task should only be called once
			expect(task).toHaveBeenCalledTimes(1)
			expect(mockLogger.debug).toHaveBeenCalledWith("[CleanupManager] Shutdown already in progress")
		})

		it("should not run if manager is already disposed", async () => {
			cleanupManager["isDisposed"] = true

			await cleanupManager.performShutdown()

			expect(mockLogger.debug).toHaveBeenCalledWith("[CleanupManager] Manager already disposed")
		})

		it("should set process.exitCode to 0 on successful shutdown", async () => {
			const task = jest.fn().mockResolvedValue(undefined)
			cleanupManager.registerCleanupTask(task)

			await cleanupManager.performShutdown()

			// Give setImmediate time to execute
			await new Promise((resolve) => setImmediate(resolve))

			expect(process.exitCode).toBe(0)
		})
	})

	describe("emergencyShutdown", () => {
		it("should force immediate shutdown", async () => {
			const task1 = jest.fn().mockResolvedValue(undefined)
			const task2 = jest.fn().mockResolvedValue(undefined)

			cleanupManager.registerCleanupTask(task1)
			cleanupManager.registerCleanupTask(task2)

			await cleanupManager.emergencyShutdown()

			expect(task1).toHaveBeenCalled()
			expect(task2).toHaveBeenCalled()
			expect(mockLogger.warn).toHaveBeenCalledWith("[CleanupManager] Emergency shutdown initiated")
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("should handle cleanup failures during emergency shutdown", async () => {
			const failingTask = jest.fn().mockRejectedValue(new Error("Emergency cleanup failed"))

			cleanupManager.registerCleanupTask(failingTask)

			await cleanupManager.emergencyShutdown()

			expect(failingTask).toHaveBeenCalled()
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Emergency cleanup failed:"),
				expect.any(Error),
			)
			expect(process.exit).toHaveBeenCalledWith(1)
		})

		it("should timeout quickly during emergency shutdown", async () => {
			const slowTask = jest.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5000)))

			cleanupManager.registerCleanupTask(slowTask)

			const startTime = Date.now()
			await cleanupManager.emergencyShutdown()
			const duration = Date.now() - startTime

			// Should complete quickly (within 3 seconds, allowing for test overhead)
			expect(duration).toBeLessThan(3000)
			expect(process.exit).toHaveBeenCalledWith(1)
		})
	})

	describe("state management", () => {
		it("should track shutdown progress correctly", () => {
			expect(cleanupManager.isShutdownInProgress()).toBe(false)

			// Start shutdown (don't await)
			cleanupManager.performShutdown()

			expect(cleanupManager.isShutdownInProgress()).toBe(true)
		})

		it("should track disposal state correctly", () => {
			expect(cleanupManager.getIsDisposed()).toBe(false)

			cleanupManager["isDisposed"] = true

			expect(cleanupManager.getIsDisposed()).toBe(true)
		})

		it("should track cleanup task count correctly", () => {
			expect(cleanupManager.getCleanupTaskCount()).toBe(0)

			cleanupManager.registerCleanupTask(jest.fn())
			expect(cleanupManager.getCleanupTaskCount()).toBe(1)

			cleanupManager.registerCleanupTask(jest.fn())
			expect(cleanupManager.getCleanupTaskCount()).toBe(2)

			cleanupManager.clearCleanupTasks()
			expect(cleanupManager.getCleanupTaskCount()).toBe(0)
		})
	})

	describe("real-world integration scenarios", () => {
		it("should handle MCP service cleanup", async () => {
			const mcpCleanupTask = jest.fn().mockResolvedValue(undefined)
			const memoryCleanupTask = jest.fn().mockResolvedValue(undefined)

			cleanupManager.registerCleanupTask(mcpCleanupTask)
			cleanupManager.registerCleanupTask(memoryCleanupTask)

			await cleanupManager.performShutdown()

			expect(mcpCleanupTask).toHaveBeenCalled()
			expect(memoryCleanupTask).toHaveBeenCalled()
			expect(mockLogger.debug).toHaveBeenCalledWith("[CleanupManager] Graceful shutdown completed successfully")
		})

		it("should handle mixed success and failure scenarios", async () => {
			const successfulMcpCleanup = jest.fn().mockResolvedValue(undefined)
			const failingMemoryCleanup = jest.fn().mockRejectedValue(new Error("Memory cleanup failed"))
			const successfulPerformanceCleanup = jest.fn().mockResolvedValue(undefined)

			cleanupManager.registerCleanupTask(successfulMcpCleanup)
			cleanupManager.registerCleanupTask(failingMemoryCleanup)
			cleanupManager.registerCleanupTask(successfulPerformanceCleanup)

			await cleanupManager.performShutdown()

			expect(successfulMcpCleanup).toHaveBeenCalled()
			expect(failingMemoryCleanup).toHaveBeenCalled()
			expect(successfulPerformanceCleanup).toHaveBeenCalled()

			// Should log the failure but continue
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Cleanup task 2 failed:"),
				expect.any(Error),
			)

			// Should still complete successfully overall
			expect(mockLogger.debug).toHaveBeenCalledWith("[CleanupManager] Graceful shutdown completed successfully")
		})
	})
})
