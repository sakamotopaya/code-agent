import crypto from "crypto"
import { Job, JobOptions, JobStats, JobFilter, JOB_STATUS } from "./types"
import { JobStore } from "./JobStore"
import { getCLILogger } from "../../cli/services/CLILogger"
import { Task } from "../../core/task/Task"

/**
 * Core job orchestration and lifecycle management
 */
export class JobManager {
	private store: JobStore
	private logger = getCLILogger()
	private activeJobs = new Map<
		string,
		{
			task: Task
			abortController: AbortController
			orchestrator?: import("../../core/task/execution").TaskExecutionOrchestrator
		}
	>()
	private jobTimeouts = new Map<string, NodeJS.Timeout>()
	private defaultTimeout = 300000 // 5 minutes default timeout

	constructor(store?: JobStore) {
		this.store = store || new JobStore()

		// Cleanup completed jobs every hour
		setInterval(() => this.periodicCleanup(), 3600000)
	}

	/**
	 * Create a new job
	 */
	createJob(task: string, options: JobOptions = {}): Job {
		const id = this.generateJobId()
		const now = new Date()

		const job: Job = {
			id,
			task,
			status: JOB_STATUS.QUEUED,
			createdAt: now,
			metadata: {
				mode: options.mode || "code",
				clientInfo: options.clientInfo,
			},
		}

		this.store.create(job)
		this.logger.info(`Created job ${id} with task: "${task.substring(0, 50)}${task.length > 50 ? "..." : ""}"`)

		return job
	}

	/**
	 * Start a job with a Task instance
	 */
	async startJob(
		jobId: string,
		taskInstance: Task,
		orchestrator?: import("../../core/task/execution").TaskExecutionOrchestrator,
	): Promise<void> {
		const job = this.store.get(jobId)
		if (!job) {
			throw new Error(`Job ${jobId} not found`)
		}

		if (job.status !== JOB_STATUS.QUEUED) {
			throw new Error(`Job ${jobId} is not in queued status (current: ${job.status})`)
		}

		// Update job status to running
		this.store.update(jobId, {
			status: JOB_STATUS.RUNNING,
			startedAt: new Date(),
		})

		// Create abort controller for cancellation
		const abortController = new AbortController()
		this.activeJobs.set(jobId, { task: taskInstance, abortController, orchestrator })

		// Set up timeout
		const timeout = this.getJobTimeout(job)
		if (timeout > 0) {
			const timeoutId = setTimeout(() => {
				this.logger.warn(`Job ${jobId} timed out after ${timeout}ms`)
				this.cancelJob(jobId, "Job timed out")
			}, timeout)
			this.jobTimeouts.set(jobId, timeoutId)
		}

		this.logger.info(`Started job ${jobId}`)

		// Execute task asynchronously
		this.executeTask(jobId, taskInstance, abortController.signal).catch((error) => {
			this.logger.error(`Task execution failed for job ${jobId}:`, error)
			this.handleJobError(jobId, error)
		})
	}

	/**
	 * Get a job by ID
	 */
	getJob(jobId: string): Job | null {
		return this.store.get(jobId)
	}

	/**
	 * Cancel a job
	 */
	cancelJob(jobId: string, reason?: string): boolean {
		const job = this.store.get(jobId)
		if (!job) {
			this.logger.warn(`Attempted to cancel non-existent job ${jobId}`)
			return false
		}

		if (!["queued", "running"].includes(job.status)) {
			this.logger.warn(`Cannot cancel job ${jobId} with status ${job.status}`)
			return false
		}

		// Cancel running task
		const activeJob = this.activeJobs.get(jobId)
		if (activeJob) {
			// Cancel via orchestrator if available
			if (activeJob.orchestrator) {
				activeJob.orchestrator.cancelExecution(jobId, reason || "Job cancelled").catch((error) => {
					this.logger.error(`Error cancelling orchestrator execution for job ${jobId}:`, error)
				})
			}

			activeJob.abortController.abort()
			this.activeJobs.delete(jobId)
		}

		// Clear timeout
		this.clearJobTimeout(jobId)

		// Update job status
		this.store.update(jobId, {
			status: JOB_STATUS.CANCELLED,
			error: reason || "Job cancelled by user",
		})

		this.logger.info(`Cancelled job ${jobId}${reason ? `: ${reason}` : ""}`)
		return true
	}

	/**
	 * List jobs with optional filtering
	 */
	listJobs(filter?: JobFilter): Job[] {
		return this.store.list(filter)
	}

	/**
	 * Get job statistics
	 */
	getStats(): JobStats {
		return this.store.getStats()
	}

	/**
	 * Get running jobs
	 */
	getRunningJobs(): Job[] {
		return this.store.getRunningJobs()
	}

	/**
	 * Get queued jobs
	 */
	getQueuedJobs(): Job[] {
		return this.store.getQueuedJobs()
	}

	/**
	 * Check if a job is active (running)
	 */
	isJobActive(jobId: string): boolean {
		return this.activeJobs.has(jobId)
	}

	/**
	 * Get active job count
	 */
	getActiveJobCount(): number {
		return this.activeJobs.size
	}

	/**
	 * Cleanup completed jobs and resources
	 */
	cleanup(olderThan?: Date): number {
		const cutoffDate = olderThan || new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

		// Cancel any stuck running jobs
		this.cancelStuckJobs()

		// Clean up old jobs from store
		const cleanedCount = this.store.cleanup(cutoffDate)

		this.logger.info(`Cleanup completed: removed ${cleanedCount} old jobs`)
		return cleanedCount
	}

	/**
	 * Shutdown the job manager
	 */
	async shutdown(): Promise<void> {
		this.logger.info("Shutting down job manager...")

		// Cancel all active jobs
		const activeJobIds = Array.from(this.activeJobs.keys())
		for (const jobId of activeJobIds) {
			this.cancelJob(jobId, "Server shutdown")
		}

		// Clear all timeouts
		for (const timeout of this.jobTimeouts.values()) {
			clearTimeout(timeout)
		}
		this.jobTimeouts.clear()

		// Wait a bit for tasks to complete cancellation
		await new Promise((resolve) => setTimeout(resolve, 1000))

		this.logger.info("Job manager shutdown complete")
	}

	/**
	 * Execute a task with proper error handling and completion tracking
	 */
	private async executeTask(jobId: string, task: Task, abortSignal: AbortSignal): Promise<void> {
		try {
			// Monitor abort signal
			if (abortSignal.aborted) {
				throw new Error("Task aborted before execution")
			}

			// The Task is already executing via Task.create() method
			// We just need to wait for it to complete or be cancelled
			// The task execution is handled by the Task instance itself

			this.logger.info(`Task execution started for job ${jobId}`)

			// Note: Task execution is handled externally via Task.create() promise
			// This method is mainly for tracking and cleanup purposes
		} catch (error) {
			if (error instanceof Error && error.message.includes("aborted")) {
				// Task was cancelled, status already updated
				return
			}

			this.handleJobError(jobId, error)
		}
	}

	/**
	 * Handle successful job completion
	 */
	private handleJobCompletion(jobId: string, result: string): void {
		// Clean up active job tracking
		this.activeJobs.delete(jobId)
		this.clearJobTimeout(jobId)

		// Update job status
		this.store.update(jobId, {
			status: JOB_STATUS.COMPLETED,
			result,
		})

		this.logger.info(`Job ${jobId} completed successfully`)
	}

	/**
	 * Handle job error
	 */
	private handleJobError(jobId: string, error: any): void {
		// Clean up active job tracking
		this.activeJobs.delete(jobId)
		this.clearJobTimeout(jobId)

		const errorMessage = error instanceof Error ? error.message : String(error)

		// Update job status
		this.store.update(jobId, {
			status: JOB_STATUS.FAILED,
			error: errorMessage,
		})

		this.logger.error(`Job ${jobId} failed: ${errorMessage}`)
	}

	/**
	 * Generate a unique job ID
	 */
	private generateJobId(): string {
		const timestamp = Date.now().toString(36)
		const random = crypto.randomBytes(4).toString("hex")
		return `job_${timestamp}_${random}`
	}

	/**
	 * Get timeout for a job
	 */
	private getJobTimeout(job: Job): number {
		// TODO: Get timeout from job options or configuration
		return this.defaultTimeout
	}

	/**
	 * Clear job timeout
	 */
	private clearJobTimeout(jobId: string): void {
		const timeout = this.jobTimeouts.get(jobId)
		if (timeout) {
			clearTimeout(timeout)
			this.jobTimeouts.delete(jobId)
		}
	}

	/**
	 * Cancel jobs that have been running too long
	 */
	private cancelStuckJobs(): void {
		const now = new Date()
		const stuckThreshold = 2 * this.defaultTimeout // 2x the default timeout

		const runningJobs = this.store.getRunningJobs()
		for (const job of runningJobs) {
			if (job.startedAt) {
				const runningTime = now.getTime() - job.startedAt.getTime()
				if (runningTime > stuckThreshold) {
					this.logger.warn(`Cancelling stuck job ${job.id} (running for ${runningTime}ms)`)
					this.cancelJob(job.id, "Job stuck - exceeded maximum runtime")
				}
			}
		}
	}

	/**
	 * Periodic cleanup of old jobs
	 */
	private periodicCleanup(): void {
		try {
			this.cleanup()
		} catch (error) {
			this.logger.error("Error during periodic cleanup:", error)
		}
	}
}
