import { ServerResponse } from "http"
import { ContentType } from "./MessageBuffer"

/**
 * SSE event type definitions for Task execution streaming
 */

export interface TokenUsage {
	totalTokensIn: number
	totalTokensOut: number
	totalCacheWrites?: number
	totalCacheReads?: number
	totalCost?: number
	contextTokens?: number
}

export interface SSEEvent {
	type:
		| "start"
		| "progress"
		| "tool_use"
		| "completion"
		| "stream_end"
		| "error"
		| "log"
		| "question"
		| "warning"
		| "information"
		| "question_ask"
		| "token_usage"
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
	suggestions?: Array<{ answer: string }>
	// New fields for content type classification
	contentType?: ContentType
	isComplete?: boolean
	// Token usage information
	tokenUsage?: TokenUsage
}

export interface SSEStream {
	jobId: string
	response: ServerResponse
	isActive: boolean
	lastActivity: Date
	completionSent?: boolean
	streamEndSent?: boolean
	scheduledClosure?: NodeJS.Timeout
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
	STREAM_END: "stream_end",
	ERROR: "error",
	LOG: "log",
	QUESTION: "question",
	QUESTION_ASK: "question_ask",
	WARNING: "warning",
	INFORMATION: "information",
	TOKEN_USAGE: "token_usage",
} as const

export type SSEEventType = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS]
