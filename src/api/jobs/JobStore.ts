import { Job, JobFilter, JobStats, JobUpdate, JOB_STATUS } from "./types"
import { getCLILogger } from "../../cli/services/CLILogger"

/**
 * In-memory job persistence store
 * Handles CRUD operations for job tracking
 */
export class JobStore {
	private jobs = new Map<string, Job>()
	private logger = getCLILogger()

	/**
	 * Store a new job
	 */
	create(job: Job): void {
		this.jobs.set(job.id, { ...job })
		this.logger.debug(`Stored job ${job.id} with status ${job.status}`)
	}

	/**
	 * Get a job by ID
	 */
	get(jobId: string): Job | null {
		const job = this.jobs.get(jobId)
		return job ? { ...job } : null
	}

	/**
	 * Update a job with partial data
	 */
	update(jobId: string, updates: JobUpdate): Job | null {
		const job = this.jobs.get(jobId)
		if (!job) {
			this.logger.warn(`Attempted to update non-existent job ${jobId}`)
			return null
		}

		const updatedJob: Job = {
			...job,
			...updates,
			metadata: {
				...job.metadata,
				...updates.metadata,
			},
		}

		// Update completion timestamp if status changed to completed/failed/cancelled
		if (updates.status && ["completed", "failed", "cancelled"].includes(updates.status)) {
			updatedJob.completedAt = new Date()

			// Calculate duration if we have start time
			if (job.startedAt) {
				updatedJob.metadata.duration = updatedJob.completedAt.getTime() - job.startedAt.getTime()
			}
		}

		// Update start timestamp if status changed to running
		if (updates.status === "running" && !job.startedAt) {
			updatedJob.startedAt = new Date()
		}

		this.jobs.set(jobId, updatedJob)
		this.logger.debug(`Updated job ${jobId}: ${JSON.stringify(updates)}`)

		return { ...updatedJob }
	}

	/**
	 * Delete a job
	 */
	delete(jobId: string): boolean {
		const deleted = this.jobs.delete(jobId)
		if (deleted) {
			this.logger.debug(`Deleted job ${jobId}`)
		} else {
			this.logger.warn(`Attempted to delete non-existent job ${jobId}`)
		}
		return deleted
	}

	/**
	 * Check if a job exists
	 */
	exists(jobId: string): boolean {
		return this.jobs.has(jobId)
	}

	/**
	 * List jobs with optional filtering
	 */
	list(filter?: JobFilter): Job[] {
		let jobs = Array.from(this.jobs.values())

		if (filter) {
			// Filter by status
			if (filter.status) {
				const statusFilter = Array.isArray(filter.status) ? filter.status : [filter.status]
				jobs = jobs.filter((job) => statusFilter.includes(job.status))
			}

			// Filter by creation date range
			if (filter.createdAfter) {
				jobs = jobs.filter((job) => job.createdAt >= filter.createdAfter!)
			}
			if (filter.createdBefore) {
				jobs = jobs.filter((job) => job.createdAt <= filter.createdBefore!)
			}

			// Sort by creation date (newest first)
			jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

			// Apply pagination
			if (filter.offset !== undefined) {
				jobs = jobs.slice(filter.offset)
			}
			if (filter.limit !== undefined) {
				jobs = jobs.slice(0, filter.limit)
			}
		} else {
			// Default sort by creation date (newest first)
			jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
		}

		// Return copies to prevent external mutation
		return jobs.map((job) => ({ ...job }))
	}

	/**
	 * Get job statistics
	 */
	getStats(): JobStats {
		const jobs = Array.from(this.jobs.values())

		const stats: JobStats = {
			total: jobs.length,
			queued: 0,
			running: 0,
			completed: 0,
			failed: 0,
			cancelled: 0,
		}

		for (const job of jobs) {
			switch (job.status) {
				case JOB_STATUS.QUEUED:
					stats.queued++
					break
				case JOB_STATUS.RUNNING:
					stats.running++
					break
				case JOB_STATUS.COMPLETED:
					stats.completed++
					break
				case JOB_STATUS.FAILED:
					stats.failed++
					break
				case JOB_STATUS.CANCELLED:
					stats.cancelled++
					break
			}
		}

		return stats
	}

	/**
	 * Get jobs by status
	 */
	getByStatus(status: Job["status"]): Job[] {
		return this.list({ status })
	}

	/**
	 * Get running jobs
	 */
	getRunningJobs(): Job[] {
		return this.getByStatus(JOB_STATUS.RUNNING)
	}

	/**
	 * Get queued jobs
	 */
	getQueuedJobs(): Job[] {
		return this.getByStatus(JOB_STATUS.QUEUED)
	}

	/**
	 * Clear completed/failed/cancelled jobs older than specified time
	 */
	cleanup(olderThan: Date): number {
		const jobsToDelete: string[] = []

		for (const [id, job] of this.jobs) {
			if (["completed", "failed", "cancelled"].includes(job.status) && job.createdAt < olderThan) {
				jobsToDelete.push(id)
			}
		}

		for (const id of jobsToDelete) {
			this.jobs.delete(id)
		}

		if (jobsToDelete.length > 0) {
			this.logger.info(`Cleaned up ${jobsToDelete.length} old jobs`)
		}

		return jobsToDelete.length
	}

	/**
	 * Clear all jobs (for testing/reset)
	 */
	clear(): void {
		const count = this.jobs.size
		this.jobs.clear()
		this.logger.info(`Cleared all ${count} jobs from store`)
	}

	/**
	 * Get store size
	 */
	size(): number {
		return this.jobs.size
	}

	/**
	 * Export all jobs (for backup/debugging)
	 */
	export(): Job[] {
		return Array.from(this.jobs.values()).map((job) => ({ ...job }))
	}

	/**
	 * Import jobs (for restore/testing)
	 */
	import(jobs: Job[]): void {
		this.jobs.clear()
		for (const job of jobs) {
			this.jobs.set(job.id, { ...job })
		}
		this.logger.info(`Imported ${jobs.length} jobs`)
	}
}
