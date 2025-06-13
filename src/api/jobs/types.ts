/**
 * Job management type definitions for API task execution tracking
 */

export interface Job {
	id: string
	task: string
	status: "queued" | "running" | "completed" | "failed" | "cancelled"
	createdAt: Date
	startedAt?: Date
	completedAt?: Date
	result?: string
	error?: string
	metadata: {
		tokenUsage?: number
		duration?: number
		toolsUsed?: string[]
		mode?: string
		clientInfo?: {
			userAgent?: string
			ip?: string
		}
	}
}

export interface JobOptions {
	mode?: string
	timeout?: number
	priority?: "low" | "normal" | "high"
	clientInfo?: {
		userAgent?: string
		ip?: string
	}
}

export interface JobStats {
	total: number
	queued: number
	running: number
	completed: number
	failed: number
	cancelled: number
}

export interface JobFilter {
	status?: Job["status"] | Job["status"][]
	createdAfter?: Date
	createdBefore?: Date
	limit?: number
	offset?: number
}

export interface JobUpdate {
	status?: Job["status"]
	startedAt?: Date
	completedAt?: Date
	result?: string
	error?: string
	metadata?: Partial<Job["metadata"]>
}

export const JOB_STATUS = {
	QUEUED: "queued",
	RUNNING: "running",
	COMPLETED: "completed",
	FAILED: "failed",
	CANCELLED: "cancelled",
} as const

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS]

export const JOB_PRIORITY = {
	LOW: "low",
	NORMAL: "normal",
	HIGH: "high",
} as const

export type JobPriority = (typeof JOB_PRIORITY)[keyof typeof JOB_PRIORITY]
