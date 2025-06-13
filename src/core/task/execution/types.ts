/**
 * Task execution types and interfaces for shared orchestration
 */

import { Task } from "../Task"

/**
 * Handler interface for task execution events and output
 */
export interface ITaskExecutionHandler {
	/**
	 * Called when task execution starts
	 */
	onTaskStarted(taskId: string): Promise<void>

	/**
	 * Called when task completes successfully
	 */
	onTaskCompleted(taskId: string, result: string, tokenUsage?: any, toolUsage?: any): Promise<void>

	/**
	 * Called when task fails or is aborted
	 */
	onTaskFailed(taskId: string, error: Error): Promise<void>

	/**
	 * Called when task emits messages (for logging/streaming)
	 */
	onTaskMessage(taskId: string, event: any): Promise<void>

	/**
	 * Called for task activity events (mode switches, spawning, etc.)
	 */
	onTaskActivity(taskId: string, eventType: string, data?: any): Promise<void>

	/**
	 * Called when user input is requested
	 */
	onUserInputRequested(taskId: string): Promise<void>

	/**
	 * Called when user input is received
	 */
	onUserInputReceived(taskId: string): Promise<void>

	/**
	 * Get debug logging function
	 */
	logDebug(message: string, ...args: any[]): void
}

/**
 * Options for task execution
 */
export interface TaskExecutionOptions {
	/**
	 * Whether this is an informational query that should use response completion detection
	 */
	isInfoQuery?: boolean

	/**
	 * Timeout for informational queries (default: 30 seconds)
	 */
	infoQueryTimeoutMs?: number

	/**
	 * Emergency timeout for all tasks (default: 60 seconds)
	 */
	emergencyTimeoutMs?: number

	/**
	 * Sliding timeout for regular tasks (default: 10 minutes)
	 */
	slidingTimeoutMs?: number

	/**
	 * Whether to use sliding timeout that resets on activity
	 */
	useSlidingTimeout?: boolean

	/**
	 * Custom task identifier for logging
	 */
	taskIdentifier?: string
}

/**
 * Result of task execution
 */
export interface TaskExecutionResult {
	/**
	 * Whether the task completed successfully
	 */
	success: boolean

	/**
	 * Completion reason or error message
	 */
	reason: string

	/**
	 * Task result if successful
	 */
	result?: string

	/**
	 * Error if failed
	 */
	error?: Error

	/**
	 * Token usage statistics
	 */
	tokenUsage?: any

	/**
	 * Tool usage statistics
	 */
	toolUsage?: any

	/**
	 * Execution duration in milliseconds
	 */
	durationMs?: number
}

/**
 * Task execution mode
 */
export enum TaskExecutionMode {
	/**
	 * Standard task execution with sliding timeout
	 */
	STANDARD = "standard",

	/**
	 * Informational query with response completion detection
	 */
	INFO_QUERY = "info_query",
}

/**
 * Task activity event types
 */
export enum TaskActivityType {
	STARTED = "taskStarted",
	COMPLETED = "taskCompleted",
	ABORTED = "taskAborted",
	PAUSED = "taskPaused",
	UNPAUSED = "taskUnpaused",
	MODE_SWITCHED = "taskModeSwitched",
	SPAWNED = "taskSpawned",
	TOKEN_USAGE_UPDATED = "taskTokenUsageUpdated",
	TOOL_FAILED = "taskToolFailed",
	ASK_RESPONDED = "taskAskResponded",
}
