import { JobManager } from "../JobManager"
import { JobStore } from "../JobStore"
import { Task } from "../../../core/task/Task"
import { TaskExecutionOrchestrator } from "../../../core/task/execution/TaskExecutionOrchestrator"

// Mock the Task class
jest.mock("../../../core/task/Task")
jest.mock("../../../core/task/execution/TaskExecutionOrchestrator")

describe("JobManager Cancellation", () => {
	let jobManager: JobManager
	let mockTask: jest.Mocked<Task>
	let mockOrchestrator: jest.Mocked<TaskExecutionOrchestrator>
	let jobStore: JobStore

	beforeEach(() => {
		jobStore = new JobStore()
		jobManager = new JobManager(jobStore)

		// Create mock task
		mockTask = {
			abortTask: jest.fn().mockResolvedValue(undefined),
			taskId: "test-task-id",
		} as any

		// Create mock orchestrator
		mockOrchestrator = {
			cancelExecution: jest.fn().mockResolvedValue(true),
		} as any
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe("cancelJob", () => {
		it("should cancel orchestrator execution when job is cancelled", async () => {
			// Create a job
			const job = jobManager.createJob("test task", { mode: "code" })

			// Start the job with orchestrator
			await jobManager.startJob(job.id, mockTask, mockOrchestrator)

			// Cancel the job
			const result = jobManager.cancelJob(job.id, "Test cancellation")

			// Verify cancellation was successful
			expect(result).toBe(true)

			// Verify orchestrator.cancelExecution was called
			expect(mockOrchestrator.cancelExecution).toHaveBeenCalledWith(job.id, "Test cancellation")
		})

		it("should handle cancellation when orchestrator is not available", async () => {
			// Create a job
			const job = jobManager.createJob("test task", { mode: "code" })

			// Start the job without orchestrator
			await jobManager.startJob(job.id, mockTask)

			// Cancel the job
			const result = jobManager.cancelJob(job.id, "Test cancellation")

			// Verify cancellation was successful even without orchestrator
			expect(result).toBe(true)

			// Verify orchestrator.cancelExecution was not called
			expect(mockOrchestrator.cancelExecution).not.toHaveBeenCalled()
		})

		it("should handle orchestrator cancellation errors gracefully", async () => {
			// Create a job
			const job = jobManager.createJob("test task", { mode: "code" })

			// Mock orchestrator to throw error
			mockOrchestrator.cancelExecution.mockRejectedValue(new Error("Orchestrator error"))

			// Start the job with orchestrator
			await jobManager.startJob(job.id, mockTask, mockOrchestrator)

			// Cancel the job - should not throw
			const result = jobManager.cancelJob(job.id, "Test cancellation")

			// Verify cancellation was still successful
			expect(result).toBe(true)

			// Verify orchestrator.cancelExecution was called
			expect(mockOrchestrator.cancelExecution).toHaveBeenCalledWith(job.id, "Test cancellation")
		})

		it("should clean up resources properly on cancellation", async () => {
			// Create a job
			const job = jobManager.createJob("test task", { mode: "code" })

			// Start the job with orchestrator
			await jobManager.startJob(job.id, mockTask, mockOrchestrator)

			// Verify job is active
			expect(jobManager.isJobActive(job.id)).toBe(true)

			// Cancel the job
			jobManager.cancelJob(job.id, "Test cancellation")

			// Verify job is no longer active
			expect(jobManager.isJobActive(job.id)).toBe(false)

			// Verify job status is updated
			const updatedJob = jobManager.getJob(job.id)
			expect(updatedJob?.status).toBe("cancelled")
			expect(updatedJob?.error).toBe("Test cancellation")
		})

		it("should return false when trying to cancel non-existent job", () => {
			const result = jobManager.cancelJob("non-existent-job-id")
			expect(result).toBe(false)
		})

		it("should return false when trying to cancel already completed job", async () => {
			// Create a job
			const job = jobManager.createJob("test task", { mode: "code" })

			// Manually update job status to completed
			jobStore.update(job.id, { status: "completed" as any })

			// Try to cancel completed job
			const result = jobManager.cancelJob(job.id)

			// Should return false
			expect(result).toBe(false)
		})
	})

	describe("startJob with orchestrator", () => {
		it("should store orchestrator reference when provided", async () => {
			// Create a job
			const job = jobManager.createJob("test task", { mode: "code" })

			// Start the job with orchestrator
			await jobManager.startJob(job.id, mockTask, mockOrchestrator)

			// Verify job is active
			expect(jobManager.isJobActive(job.id)).toBe(true)

			// Cancel to verify orchestrator is stored
			jobManager.cancelJob(job.id)
			expect(mockOrchestrator.cancelExecution).toHaveBeenCalled()
		})

		it("should work without orchestrator for backward compatibility", async () => {
			// Create a job
			const job = jobManager.createJob("test task", { mode: "code" })

			// Start the job without orchestrator
			await jobManager.startJob(job.id, mockTask)

			// Verify job is active
			expect(jobManager.isJobActive(job.id)).toBe(true)

			// Should be able to cancel without error
			const result = jobManager.cancelJob(job.id)
			expect(result).toBe(true)
		})
	})
})
