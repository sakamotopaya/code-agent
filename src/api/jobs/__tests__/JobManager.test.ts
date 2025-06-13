import { JobManager } from "../JobManager"
import { JobStore } from "../JobStore"
import { Job, JOB_STATUS } from "../types"
import { Task } from "../../../core/task/Task"

// Mock the logger
jest.mock("../../../cli/services/CLILogger", () => ({
	getCLILogger: () => ({
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	}),
}))

// Mock the Task class
jest.mock("../../../core/task/Task", () => ({
	Task: jest.fn().mockImplementation(() => ({
		execute: jest.fn().mockResolvedValue("Task completed"),
	})),
}))

describe("JobManager", () => {
	let jobManager: JobManager
	let jobStore: JobStore

	beforeEach(() => {
		jobStore = new JobStore()
		jobManager = new JobManager(jobStore)
	})

	afterEach(() => {
		// Clean up any active jobs
		jobManager.shutdown()
	})

	describe("createJob", () => {
		it("should create a new job with generated ID", () => {
			const task = "Test task"
			const job = jobManager.createJob(task)

			expect(job.id).toMatch(/^job_[a-z0-9]+_[a-f0-9]{8}$/)
			expect(job.task).toBe(task)
			expect(job.status).toBe(JOB_STATUS.QUEUED)
			expect(job.createdAt).toBeInstanceOf(Date)
			expect(job.metadata.mode).toBe("code")
		})

		it("should create job with custom options", () => {
			const task = "Test task"
			const options = {
				mode: "debug",
				clientInfo: {
					userAgent: "test-agent",
					ip: "127.0.0.1",
				},
			}

			const job = jobManager.createJob(task, options)

			expect(job.metadata.mode).toBe("debug")
			expect(job.metadata.clientInfo).toEqual(options.clientInfo)
		})

		it("should store the created job", () => {
			const task = "Test task"
			const job = jobManager.createJob(task)

			const storedJob = jobManager.getJob(job.id)
			expect(storedJob).toEqual(job)
		})
	})

	describe("getJob", () => {
		it("should return job by ID", () => {
			const task = "Test task"
			const job = jobManager.createJob(task)

			const retrieved = jobManager.getJob(job.id)
			expect(retrieved).toEqual(job)
		})

		it("should return null for non-existent job", () => {
			const retrieved = jobManager.getJob("non-existent-id")
			expect(retrieved).toBeNull()
		})
	})

	describe("startJob", () => {
		let mockTask: jest.Mocked<Task>

		beforeEach(() => {
			mockTask = new Task({
				apiConfiguration: {} as any,
				task: "test",
			} as any) as jest.Mocked<Task>
		})

		it("should start a queued job", async () => {
			const job = jobManager.createJob("Test task")

			await jobManager.startJob(job.id, mockTask)

			const updatedJob = jobManager.getJob(job.id)
			expect(updatedJob?.status).toBe(JOB_STATUS.RUNNING)
			expect(updatedJob?.startedAt).toBeInstanceOf(Date)
		})

		it("should throw error for non-existent job", async () => {
			await expect(jobManager.startJob("non-existent", mockTask)).rejects.toThrow("Job non-existent not found")
		})

		it("should throw error for non-queued job", async () => {
			const job = jobManager.createJob("Test task")
			jobStore.update(job.id, { status: JOB_STATUS.RUNNING })

			await expect(jobManager.startJob(job.id, mockTask)).rejects.toThrow(
				"Job " + job.id + " is not in queued status",
			)
		})

		it("should track active jobs", async () => {
			const job = jobManager.createJob("Test task")

			await jobManager.startJob(job.id, mockTask)

			expect(jobManager.isJobActive(job.id)).toBe(true)
			expect(jobManager.getActiveJobCount()).toBe(1)
		})
	})

	describe("cancelJob", () => {
		it("should cancel a queued job", () => {
			const job = jobManager.createJob("Test task")

			const result = jobManager.cancelJob(job.id)

			expect(result).toBe(true)
			const updatedJob = jobManager.getJob(job.id)
			expect(updatedJob?.status).toBe(JOB_STATUS.CANCELLED)
			expect(updatedJob?.error).toBe("Job cancelled by user")
		})

		it("should cancel a running job", async () => {
			const job = jobManager.createJob("Test task")
			const mockTask = new Task({
				apiConfiguration: {} as any,
				task: "test",
			} as any) as jest.Mocked<Task>

			await jobManager.startJob(job.id, mockTask)
			const result = jobManager.cancelJob(job.id, "Test cancellation")

			expect(result).toBe(true)
			const updatedJob = jobManager.getJob(job.id)
			expect(updatedJob?.status).toBe(JOB_STATUS.CANCELLED)
			expect(updatedJob?.error).toBe("Test cancellation")
			expect(jobManager.isJobActive(job.id)).toBe(false)
		})

		it("should not cancel completed job", () => {
			const job = jobManager.createJob("Test task")
			jobStore.update(job.id, { status: JOB_STATUS.COMPLETED })

			const result = jobManager.cancelJob(job.id)

			expect(result).toBe(false)
		})

		it("should return false for non-existent job", () => {
			const result = jobManager.cancelJob("non-existent")
			expect(result).toBe(false)
		})
	})

	describe("listJobs", () => {
		beforeEach(() => {
			// Create test jobs
			jobManager.createJob("Task 1")
			jobManager.createJob("Task 2")
			jobManager.createJob("Task 3")
		})

		it("should list all jobs", () => {
			const jobs = jobManager.listJobs()
			expect(jobs).toHaveLength(3)
		})

		it("should filter jobs by status", () => {
			const jobs = jobManager.listJobs({ status: JOB_STATUS.QUEUED })
			expect(jobs).toHaveLength(3)
			expect(jobs.every((job) => job.status === JOB_STATUS.QUEUED)).toBe(true)
		})

		it("should apply limit", () => {
			const jobs = jobManager.listJobs({ limit: 2 })
			expect(jobs).toHaveLength(2)
		})
	})

	describe("getStats", () => {
		it("should return correct statistics", () => {
			// Create jobs with different statuses
			const job1 = jobManager.createJob("Task 1")
			const job2 = jobManager.createJob("Task 2")
			const job3 = jobManager.createJob("Task 3")

			jobStore.update(job2.id, { status: JOB_STATUS.COMPLETED })
			jobStore.update(job3.id, { status: JOB_STATUS.FAILED })

			const stats = jobManager.getStats()

			expect(stats.total).toBe(3)
			expect(stats.queued).toBe(1)
			expect(stats.running).toBe(0)
			expect(stats.completed).toBe(1)
			expect(stats.failed).toBe(1)
			expect(stats.cancelled).toBe(0)
		})
	})

	describe("getRunningJobs", () => {
		it("should return only running jobs", () => {
			const job1 = jobManager.createJob("Task 1")
			const job2 = jobManager.createJob("Task 2")

			jobStore.update(job1.id, { status: JOB_STATUS.RUNNING })
			jobStore.update(job2.id, { status: JOB_STATUS.COMPLETED })

			const runningJobs = jobManager.getRunningJobs()

			expect(runningJobs).toHaveLength(1)
			expect(runningJobs[0].id).toBe(job1.id)
			expect(runningJobs[0].status).toBe(JOB_STATUS.RUNNING)
		})
	})

	describe("getQueuedJobs", () => {
		it("should return only queued jobs", () => {
			const job1 = jobManager.createJob("Task 1")
			const job2 = jobManager.createJob("Task 2")

			jobStore.update(job1.id, { status: JOB_STATUS.RUNNING })

			const queuedJobs = jobManager.getQueuedJobs()

			expect(queuedJobs).toHaveLength(1)
			expect(queuedJobs[0].id).toBe(job2.id)
			expect(queuedJobs[0].status).toBe(JOB_STATUS.QUEUED)
		})
	})

	describe("cleanup", () => {
		it("should remove old completed jobs", () => {
			const job1 = jobManager.createJob("Task 1")
			const job2 = jobManager.createJob("Task 2")

			// Mark as completed and set old completion date
			const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000) // 48 hours ago
			jobStore.update(job1.id, {
				status: JOB_STATUS.COMPLETED,
				completedAt: oldDate,
			})

			// Update creation date to old date for cleanup
			const storedJob = jobStore.get(job1.id)
			if (storedJob) {
				storedJob.createdAt = oldDate
				jobStore.create(storedJob)
			}

			const cleanedCount = jobManager.cleanup()

			expect(cleanedCount).toBe(1)
			expect(jobManager.getJob(job1.id)).toBeNull()
			expect(jobManager.getJob(job2.id)).not.toBeNull()
		})
	})

	describe("shutdown", () => {
		it("should cancel all active jobs and cleanup", async () => {
			const job1 = jobManager.createJob("Task 1")
			const job2 = jobManager.createJob("Task 2")
			const mockTask = new Task({
				apiConfiguration: {} as any,
				task: "test",
			} as any) as jest.Mocked<Task>

			await jobManager.startJob(job1.id, mockTask)
			await jobManager.startJob(job2.id, mockTask)

			expect(jobManager.getActiveJobCount()).toBe(2)

			await jobManager.shutdown()

			expect(jobManager.getActiveJobCount()).toBe(0)

			// Check that jobs were cancelled
			const updatedJob1 = jobManager.getJob(job1.id)
			const updatedJob2 = jobManager.getJob(job2.id)

			expect(updatedJob1?.status).toBe(JOB_STATUS.CANCELLED)
			expect(updatedJob2?.status).toBe(JOB_STATUS.CANCELLED)
		})
	})

	describe("ID generation", () => {
		it("should generate unique job IDs", () => {
			const job1 = jobManager.createJob("Task 1")
			const job2 = jobManager.createJob("Task 2")
			const job3 = jobManager.createJob("Task 3")

			expect(job1.id).not.toBe(job2.id)
			expect(job2.id).not.toBe(job3.id)
			expect(job1.id).not.toBe(job3.id)

			// Check format
			expect(job1.id).toMatch(/^job_[a-z0-9]+_[a-f0-9]{8}$/)
			expect(job2.id).toMatch(/^job_[a-z0-9]+_[a-f0-9]{8}$/)
			expect(job3.id).toMatch(/^job_[a-z0-9]+_[a-f0-9]{8}$/)
		})
	})

	describe("job lifecycle", () => {
		it("should properly track job lifecycle timestamps", async () => {
			const job = jobManager.createJob("Test task")
			const mockTask = new Task({
				apiConfiguration: {} as any,
				task: "test",
			} as any) as jest.Mocked<Task>

			// Initially only has creation time
			expect(job.createdAt).toBeInstanceOf(Date)
			expect(job.startedAt).toBeUndefined()
			expect(job.completedAt).toBeUndefined()

			// After starting, should have start time
			await jobManager.startJob(job.id, mockTask)
			const runningJob = jobManager.getJob(job.id)
			expect(runningJob?.startedAt).toBeInstanceOf(Date)
			expect(runningJob?.completedAt).toBeUndefined()

			// After completion, should have completion time
			jobStore.update(job.id, {
				status: JOB_STATUS.COMPLETED,
				completedAt: new Date(),
			})
			const completedJob = jobManager.getJob(job.id)
			expect(completedJob?.completedAt).toBeInstanceOf(Date)
		})
	})
})
