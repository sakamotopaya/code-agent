import { TaskExecutionOrchestrator } from "../TaskExecutionOrchestrator"
import { Task } from "../../Task"
import { ITaskExecutionHandler } from "../types"

// Mock the Task class
jest.mock("../../Task")

describe("TaskExecutionOrchestrator Cancellation", () => {
	let orchestrator: TaskExecutionOrchestrator
	let mockTask: jest.Mocked<Task>
	let mockHandler: jest.Mocked<ITaskExecutionHandler>

	beforeEach(() => {
		orchestrator = new TaskExecutionOrchestrator()

		// Create mock task
		mockTask = {
			abortTask: jest.fn().mockResolvedValue(undefined),
			taskId: "test-task-id",
			on: jest.fn(),
			emit: jest.fn(),
		} as any

		// Create mock handler
		mockHandler = {
			logDebug: jest.fn(),
			onTaskStarted: jest.fn().mockResolvedValue(undefined),
			onTaskCompleted: jest.fn().mockResolvedValue(undefined),
			onTaskFailed: jest.fn().mockResolvedValue(undefined),
			onTaskMessage: jest.fn().mockResolvedValue(undefined),
			onTaskActivity: jest.fn().mockResolvedValue(undefined),
		} as any
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe("cancelExecution", () => {
		it("should cancel running execution", async () => {
			const taskId = "test-task-123"

			// Start a mock execution by adding to active executions
			const mockPromise = new Promise<void>(() => {}) // Never resolves
			const executionPromise = orchestrator.executeTask(mockTask, mockPromise, mockHandler, {
				taskIdentifier: taskId,
			})

			// Wait a bit to ensure execution starts
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Verify execution is active
			expect(orchestrator.canCancelExecution(taskId)).toBe(true)
			expect(orchestrator.getExecutionStatus(taskId)).toBe("running")

			// Cancel the execution
			const result = await orchestrator.cancelExecution(taskId, "Test cancellation")

			// Verify cancellation was successful
			expect(result).toBe(true)

			// Verify task.abortTask was called
			expect(mockTask.abortTask).toHaveBeenCalled()

			// Verify handler.onTaskFailed was called
			expect(mockHandler.onTaskFailed).toHaveBeenCalledWith(
				taskId,
				expect.objectContaining({
					message: "Test cancellation",
				}),
			)

			// Verify execution is no longer active
			expect(orchestrator.canCancelExecution(taskId)).toBe(false)
			expect(orchestrator.getExecutionStatus(taskId)).toBe("not-found")
		})

		it("should return false when trying to cancel non-existent execution", async () => {
			const result = await orchestrator.cancelExecution("non-existent-task")
			expect(result).toBe(false)
		})

		it("should handle task without abortTask method", async () => {
			const taskId = "test-task-456"

			// Create task without abortTask method
			const taskWithoutAbort = {
				taskId,
				on: jest.fn(),
				emit: jest.fn(),
			} as any

			// Start a mock execution
			const mockPromise = new Promise<void>(() => {}) // Never resolves
			const executionPromise = orchestrator.executeTask(taskWithoutAbort, mockPromise, mockHandler, {
				taskIdentifier: taskId,
			})

			// Wait a bit to ensure execution starts
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Cancel the execution
			const result = await orchestrator.cancelExecution(taskId, "Test cancellation")

			// Should still succeed even without abortTask method
			expect(result).toBe(true)

			// Verify handler.onTaskFailed was called
			expect(mockHandler.onTaskFailed).toHaveBeenCalledWith(
				taskId,
				expect.objectContaining({
					message: "Test cancellation",
				}),
			)
		})

		it("should clean up timers on cancellation", async () => {
			const taskId = "test-task-789"

			// Start a mock execution
			const mockPromise = new Promise<void>(() => {}) // Never resolves
			const executionPromise = orchestrator.executeTask(mockTask, mockPromise, mockHandler, {
				taskIdentifier: taskId,
				isInfoQuery: false, // Use standard task to test sliding timeout
			})

			// Wait a bit to ensure execution starts and timers are set
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Cancel the execution
			const result = await orchestrator.cancelExecution(taskId, "Test cancellation")

			// Verify cancellation was successful
			expect(result).toBe(true)

			// The timers should be cleaned up (we can't directly test this,
			// but the cancellation should complete without hanging)
		})

		it("should handle cancellation errors gracefully", async () => {
			const taskId = "test-task-error"

			// Mock task.abortTask to throw error
			mockTask.abortTask.mockRejectedValue(new Error("Abort failed"))

			// Start a mock execution
			const mockPromise = new Promise<void>(() => {}) // Never resolves
			const executionPromise = orchestrator.executeTask(mockTask, mockPromise, mockHandler, {
				taskIdentifier: taskId,
			})

			// Wait a bit to ensure execution starts
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Cancel the execution - should not throw
			const result = await orchestrator.cancelExecution(taskId, "Test cancellation")

			// Should return false due to error, but still clean up
			expect(result).toBe(false)

			// Verify execution is cleaned up despite error
			expect(orchestrator.canCancelExecution(taskId)).toBe(false)
		})
	})

	describe("utility methods", () => {
		it("should track active executions correctly", async () => {
			const taskId1 = "task-1"
			const taskId2 = "task-2"

			// Initially no active executions
			expect(orchestrator.getActiveExecutionCount()).toBe(0)
			expect(orchestrator.getActiveExecutionIds()).toEqual([])

			// Start first execution
			const mockPromise1 = new Promise<void>(() => {})
			orchestrator.executeTask(mockTask, mockPromise1, mockHandler, {
				taskIdentifier: taskId1,
			})

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should have one active execution
			expect(orchestrator.getActiveExecutionCount()).toBe(1)
			expect(orchestrator.getActiveExecutionIds()).toContain(taskId1)
			expect(orchestrator.canCancelExecution(taskId1)).toBe(true)
			expect(orchestrator.getExecutionStatus(taskId1)).toBe("running")

			// Start second execution
			const mockTask2 = { ...mockTask, taskId: taskId2 } as any
			const mockPromise2 = new Promise<void>(() => {})
			orchestrator.executeTask(mockTask2, mockPromise2, mockHandler, {
				taskIdentifier: taskId2,
			})

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should have two active executions
			expect(orchestrator.getActiveExecutionCount()).toBe(2)
			expect(orchestrator.getActiveExecutionIds()).toContain(taskId1)
			expect(orchestrator.getActiveExecutionIds()).toContain(taskId2)

			// Cancel first execution
			await orchestrator.cancelExecution(taskId1)

			// Should have one active execution
			expect(orchestrator.getActiveExecutionCount()).toBe(1)
			expect(orchestrator.getActiveExecutionIds()).toEqual([taskId2])
			expect(orchestrator.canCancelExecution(taskId1)).toBe(false)
			expect(orchestrator.canCancelExecution(taskId2)).toBe(true)
		})

		it("should return correct execution status", async () => {
			const taskId = "status-test-task"

			// Non-existent task
			expect(orchestrator.getExecutionStatus("non-existent")).toBe("not-found")

			// Start execution
			const mockPromise = new Promise<void>(() => {})
			orchestrator.executeTask(mockTask, mockPromise, mockHandler, {
				taskIdentifier: taskId,
			})

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should be running
			expect(orchestrator.getExecutionStatus(taskId)).toBe("running")

			// Cancel execution
			await orchestrator.cancelExecution(taskId)

			// Should be not-found after cancellation
			expect(orchestrator.getExecutionStatus(taskId)).toBe("not-found")
		})
	})
})
