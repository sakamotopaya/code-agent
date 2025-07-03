/**
 * Task repository interface for managing background tasks
 */

import { IRepository, QueryOptions } from "./IRepository"
import { Task, TaskType, TaskStatus, TaskProgress, TaskResult, CreateTaskRequest } from "../types/entities"

export interface TaskQueryOptions extends QueryOptions {
	workspaceId?: string
	conversationId?: string
	type?: TaskType
	status?: TaskStatus
	dateRange?: {
		start: Date
		end: Date
	}
}

export interface TaskExecutionOptions {
	timeout?: number
	retryCount?: number
	priority?: number
	dependencies?: string[]
}

export interface ITaskRepository extends IRepository<Task> {
	/**
	 * Get tasks by workspace
	 */
	getTasksByWorkspace(workspaceId: string, options?: TaskQueryOptions): Promise<Task[]>

	/**
	 * Get tasks by conversation
	 */
	getTasksByConversation(conversationId: string, options?: TaskQueryOptions): Promise<Task[]>

	/**
	 * Get tasks by type
	 */
	getTasksByType(type: TaskType, workspaceId?: string): Promise<Task[]>

	/**
	 * Get tasks by status
	 */
	getTasksByStatus(status: TaskStatus, workspaceId?: string): Promise<Task[]>

	/**
	 * Get active tasks (pending or running)
	 */
	getActiveTasks(workspaceId?: string): Promise<Task[]>

	/**
	 * Get completed tasks
	 */
	getCompletedTasks(workspaceId?: string, limit?: number): Promise<Task[]>

	/**
	 * Get failed tasks
	 */
	getFailedTasks(workspaceId?: string, limit?: number): Promise<Task[]>

	/**
	 * Start task execution
	 */
	startTask(id: string, options?: TaskExecutionOptions): Promise<void>

	/**
	 * Update task progress
	 */
	updateProgress(id: string, progress: TaskProgress): Promise<void>

	/**
	 * Complete task with result
	 */
	completeTask(id: string, result: TaskResult): Promise<void>

	/**
	 * Fail task with error
	 */
	failTask(id: string, error: string): Promise<void>

	/**
	 * Cancel task
	 */
	cancelTask(id: string): Promise<void>

	/**
	 * Resume cancelled or failed task
	 */
	resumeTask(id: string): Promise<void>

	/**
	 * Get task execution history
	 */
	getTaskHistory(id: string): Promise<TaskHistoryEntry[]>

	/**
	 * Add task execution log entry
	 */
	addTaskLog(id: string, entry: TaskLogEntry): Promise<void>

	/**
	 * Get task logs
	 */
	getTaskLogs(id: string, options?: TaskLogQueryOptions): Promise<TaskLogEntry[]>

	/**
	 * Clean up old completed tasks
	 */
	cleanupCompletedTasks(olderThan: Date, workspaceId?: string): Promise<number>

	/**
	 * Get task dependencies
	 */
	getTaskDependencies(id: string): Promise<Task[]>

	/**
	 * Get dependent tasks
	 */
	getDependentTasks(id: string): Promise<Task[]>

	/**
	 * Add task dependency
	 */
	addTaskDependency(taskId: string, dependencyId: string): Promise<void>

	/**
	 * Remove task dependency
	 */
	removeTaskDependency(taskId: string, dependencyId: string): Promise<void>

	/**
	 * Get task queue for workspace
	 */
	getTaskQueue(workspaceId: string): Promise<Task[]>

	/**
	 * Get next task to execute
	 */
	getNextTask(workspaceId?: string): Promise<Task | null>

	/**
	 * Get task statistics
	 */
	getTaskStats(workspaceId?: string, dateRange?: DateRange): Promise<TaskStats>

	/**
	 * Schedule task for future execution
	 */
	scheduleTask(task: CreateTaskRequest, scheduledFor: Date): Promise<Task>

	/**
	 * Get scheduled tasks
	 */
	getScheduledTasks(workspaceId?: string): Promise<Task[]>

	/**
	 * Search tasks
	 */
	searchTasks(query: string, workspaceId?: string): Promise<Task[]>

	/**
	 * Export task data
	 */
	exportTasks(workspaceId: string, options?: TaskExportOptions): Promise<any>

	/**
	 * Import task data
	 */
	importTasks(workspaceId: string, data: any): Promise<Task[]>
}

export interface TaskHistoryEntry {
	timestamp: Date
	action: TaskAction
	data?: any
	userId?: string
}

export type TaskAction =
	| "created"
	| "started"
	| "paused"
	| "resumed"
	| "progress_updated"
	| "completed"
	| "failed"
	| "cancelled"

export interface TaskLogEntry {
	timestamp: Date
	level: LogLevel
	message: string
	data?: any
	source?: string
}

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface TaskLogQueryOptions {
	level?: LogLevel
	since?: Date
	limit?: number
	source?: string
}

export interface TaskStats {
	totalTasks: number
	completedTasks: number
	failedTasks: number
	activeTasks: number
	averageExecutionTime: number
	successRate: number
	tasksByType: Record<TaskType, number>
	tasksByStatus: Record<TaskStatus, number>
	busyDays: Record<string, number>
}

export interface DateRange {
	start: Date
	end: Date
}

export interface TaskExportOptions {
	includeCompleted?: boolean
	includeFailed?: boolean
	includeLogs?: boolean
	dateRange?: DateRange
	format?: "json" | "csv"
}
