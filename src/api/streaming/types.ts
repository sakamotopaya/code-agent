import { ServerResponse } from "http"
import { ContentType } from "./MessageBuffer"

/**
 * SSE event type definitions for Task execution streaming
 */

export interface SSEEvent {
	type: "start" | "progress" | "tool_use" | "completion" | "error" | "log" | "question" | "warning" | "information"
	jobId: string
	timestamp: string
	// Flatten all properties to top level for client compatibility
	message?: string
	task?: string
	step?: number
	total?: number
	toolName?: string
	result?: any
	error?: string
	level?: string
	progress?: number
	questionId?: string
	choices?: string[]
	// New fields for content type classification
	contentType?: ContentType
	isComplete?: boolean
}

export interface SSEStream {
	jobId: string
	response: ServerResponse
	isActive: boolean
	lastActivity: Date
}

export interface StreamOptions {
	keepAliveInterval?: number
	connectionTimeout?: number
	maxConcurrentStreams?: number
}

export interface JobStatus {
	id: string
	status: "queued" | "running" | "completed" | "failed" | "cancelled"
	createdAt: Date
	startedAt?: Date
	completedAt?: Date
	lastActivity: Date
}

export const SSE_EVENTS = {
	START: "start",
	PROGRESS: "progress",
	TOOL_USE: "tool_use",
	COMPLETION: "completion",
	ERROR: "error",
	LOG: "log",
	QUESTION: "question",
	WARNING: "warning",
	INFORMATION: "information",
} as const

export type SSEEventType = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS]
