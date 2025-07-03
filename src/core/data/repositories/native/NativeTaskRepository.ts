/**
 * Native task repository implementation using existing storage services
 */

import {
	ITaskRepository,
	TaskQueryOptions,
	TaskExecutionOptions,
	TaskHistoryEntry,
	TaskAction,
	TaskLogEntry,
	LogLevel,
	TaskLogQueryOptions,
	TaskStats,
	DateRange,
	TaskExportOptions,
} from "../../interfaces/ITaskRepository"
import { QueryOptions } from "../../interfaces/IRepository"
import { Task, TaskType, TaskStatus, TaskProgress, TaskResult, CreateTaskRequest } from "../../types/entities"
import { NativeServicesConfig } from "../../RepositoryFactory"
import { IStorageService } from "../../../interfaces/IStorageService"
import * as crypto from "crypto"

export class NativeTaskRepository implements ITaskRepository {
	private storageService: IStorageService
	private readonly TASKS_KEY = "tasks"
	private readonly TASK_HISTORY_KEY = "taskHistory"
	private readonly TASK_LOGS_KEY = "taskLogs"

	constructor(services: NativeServicesConfig) {
		this.storageService = services.storageService
	}

	async initialize(): Promise<void> {
		// Initialize storage if needed
	}

	async dispose(): Promise<void> {
		// Cleanup if needed
	}

	private generateId(): string {
		return crypto.randomUUID()
	}

	private async getTasks(): Promise<Record<string, Task>> {
		return (await this.storageService.getGlobalState<Record<string, Task>>(this.TASKS_KEY)) || {}
	}

	private async saveTasks(tasks: Record<string, Task>): Promise<void> {
		await this.storageService.setGlobalState(this.TASKS_KEY, tasks)
	}

	private async getAllTaskHistory(): Promise<Record<string, TaskHistoryEntry[]>> {
		return (
			(await this.storageService.getGlobalState<Record<string, TaskHistoryEntry[]>>(this.TASK_HISTORY_KEY)) || {}
		)
	}

	private async saveTaskHistory(history: Record<string, TaskHistoryEntry[]>): Promise<void> {
		await this.storageService.setGlobalState(this.TASK_HISTORY_KEY, history)
	}

	private async getAllTaskLogs(): Promise<Record<string, TaskLogEntry[]>> {
		return (await this.storageService.getGlobalState<Record<string, TaskLogEntry[]>>(this.TASK_LOGS_KEY)) || {}
	}

	private async saveTaskLogs(logs: Record<string, TaskLogEntry[]>): Promise<void> {
		await this.storageService.setGlobalState(this.TASK_LOGS_KEY, logs)
	}

	async get(id: string): Promise<Task | null> {
		const tasks = await this.getTasks()
		return tasks[id] || null
	}

	async create(
		entity: Omit<Task, "id" | "createdAt" | "updatedAt" | "status" | "progress" | "result">,
	): Promise<Task> {
		const now = new Date()
		const task: Task = {
			...entity,
			id: this.generateId(),
			status: "pending",
			progress: {
				percentage: 0,
			},
			metadata: entity.metadata || {},
			createdAt: now,
			updatedAt: now,
		}

		const tasks = await this.getTasks()
		tasks[task.id] = task
		await this.saveTasks(tasks)

		// Add creation entry to history
		await this.addHistoryEntry(task.id, "created", task)

		return task
	}

	async update(id: string, updates: Partial<Task>): Promise<Task> {
		const tasks = await this.getTasks()
		const existing = tasks[id]
		if (!existing) {
			throw new Error(`Task with id ${id} not found`)
		}

		const updated: Task = {
			...existing,
			...updates,
			id, // Ensure ID doesn't change
			updatedAt: new Date(),
		}

		tasks[id] = updated
		await this.saveTasks(tasks)

		return updated
	}

	async delete(id: string): Promise<void> {
		const tasks = await this.getTasks()
		if (!tasks[id]) {
			throw new Error(`Task with id ${id} not found`)
		}

		delete tasks[id]
		await this.saveTasks(tasks)

		// Clean up history and logs
		const history = await this.getAllTaskHistory()
		delete history[id]
		await this.saveTaskHistory(history)

		const logs = await this.getAllTaskLogs()
		delete logs[id]
		await this.saveTaskLogs(logs)
	}

	async list(options?: QueryOptions): Promise<Task[]> {
		const tasks = await this.getTasks()
		let result = Object.values(tasks)

		// Apply filters
		if (options?.filters) {
			result = result.filter((task) => {
				return Object.entries(options.filters!).every(([key, value]) => {
					if (key === "dateRange" && value) {
						const range = value as { start: Date; end: Date }
						return task.createdAt >= range.start && task.createdAt <= range.end
					}
					return (task as any)[key] === value
				})
			})
		}

		// Apply sorting
		if (options?.sortBy) {
			const { sortBy, sortOrder = "asc" } = options
			result.sort((a, b) => {
				const aVal = (a as any)[sortBy]
				const bVal = (b as any)[sortBy]
				const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
				return sortOrder === "desc" ? -comparison : comparison
			})
		}

		// Apply pagination
		if (options?.limit || options?.offset) {
			const offset = options.offset || 0
			const limit = options.limit || result.length
			result = result.slice(offset, offset + limit)
		}

		return result
	}

	async exists(id: string): Promise<boolean> {
		const tasks = await this.getTasks()
		return id in tasks
	}

	async getMany(ids: string[]): Promise<(Task | null)[]> {
		const tasks = await this.getTasks()
		return ids.map((id) => tasks[id] || null)
	}

	async createMany(
		entities: Omit<Task, "id" | "createdAt" | "updatedAt" | "status" | "progress" | "result">[],
	): Promise<Task[]> {
		const now = new Date()
		const newTasks = entities.map((entity) => ({
			...entity,
			id: this.generateId(),
			status: "pending" as TaskStatus,
			progress: { percentage: 0 },
			metadata: entity.metadata || {},
			createdAt: now,
			updatedAt: now,
		}))

		const tasks = await this.getTasks()
		newTasks.forEach((task) => {
			tasks[task.id] = task
		})
		await this.saveTasks(tasks)

		// Add creation entries to history
		for (const task of newTasks) {
			await this.addHistoryEntry(task.id, "created", task)
		}

		return newTasks
	}

	async updateMany(updates: Array<{ id: string; data: Partial<Task> }>): Promise<Task[]> {
		const tasks = await this.getTasks()
		const updated: Task[] = []

		for (const { id, data } of updates) {
			const existing = tasks[id]
			if (existing) {
				const updatedTask = {
					...existing,
					...data,
					id,
					updatedAt: new Date(),
				}
				tasks[id] = updatedTask
				updated.push(updatedTask)
			}
		}

		await this.saveTasks(tasks)
		return updated
	}

	async deleteMany(ids: string[]): Promise<void> {
		const tasks = await this.getTasks()
		const history = await this.getAllTaskHistory()
		const logs = await this.getAllTaskLogs()

		ids.forEach((id) => {
			if (tasks[id]) {
				delete tasks[id]
				delete history[id]
				delete logs[id]
			}
		})

		await this.saveTasks(tasks)
		await this.saveTaskHistory(history)
		await this.saveTaskLogs(logs)
	}

	async count(options?: QueryOptions): Promise<number> {
		const tasks = await this.list(options)
		return tasks.length
	}

	async getTasksByWorkspace(workspaceId: string, options?: TaskQueryOptions): Promise<Task[]> {
		return await this.list({
			...options,
			filters: { ...options?.filters, workspaceId },
		})
	}

	async getTasksByConversation(conversationId: string, options?: TaskQueryOptions): Promise<Task[]> {
		return await this.list({
			...options,
			filters: { ...options?.filters, conversationId },
		})
	}

	async getTasksByType(type: TaskType, workspaceId?: string): Promise<Task[]> {
		const filters: any = { type }
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}
		return await this.list({ filters })
	}

	async getTasksByStatus(status: TaskStatus, workspaceId?: string): Promise<Task[]> {
		const filters: any = { status }
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}
		return await this.list({ filters })
	}

	async getActiveTasks(workspaceId?: string): Promise<Task[]> {
		const filters: any = {}
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}

		const tasks = await this.list({ filters })
		return tasks.filter((task) => task.status === "pending" || task.status === "running")
	}

	async getCompletedTasks(workspaceId?: string, limit?: number): Promise<Task[]> {
		const filters: any = { status: "completed" }
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}

		return await this.list({
			filters,
			limit,
			sortBy: "updatedAt",
			sortOrder: "desc",
		})
	}

	async getFailedTasks(workspaceId?: string, limit?: number): Promise<Task[]> {
		const filters: any = { status: "failed" }
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}

		return await this.list({
			filters,
			limit,
			sortBy: "updatedAt",
			sortOrder: "desc",
		})
	}

	async startTask(id: string, options?: TaskExecutionOptions): Promise<void> {
		const task = await this.get(id)
		if (!task) {
			throw new Error(`Task with id ${id} not found`)
		}

		await this.update(id, {
			status: "running",
			metadata: {
				...task.metadata,
				startedAt: new Date(),
				executionOptions: options,
			},
		})

		await this.addHistoryEntry(id, "started", options)
	}

	async updateProgress(id: string, progress: TaskProgress): Promise<void> {
		await this.update(id, { progress })
		await this.addHistoryEntry(id, "progress_updated", progress)
	}

	async completeTask(id: string, result: TaskResult): Promise<void> {
		const task = await this.get(id)
		if (!task) {
			throw new Error(`Task with id ${id} not found`)
		}

		const now = new Date()
		const startedAt = task.metadata.startedAt ? new Date(task.metadata.startedAt) : task.createdAt
		const duration = now.getTime() - startedAt.getTime()

		await this.update(id, {
			status: "completed",
			result,
			progress: { percentage: 100 },
			metadata: {
				...task.metadata,
				completedAt: now,
				duration,
			},
		})

		await this.addHistoryEntry(id, "completed", result)
	}

	async failTask(id: string, error: string): Promise<void> {
		const task = await this.get(id)
		if (!task) {
			throw new Error(`Task with id ${id} not found`)
		}

		const now = new Date()
		const startedAt = task.metadata.startedAt ? new Date(task.metadata.startedAt) : task.createdAt
		const duration = now.getTime() - startedAt.getTime()

		await this.update(id, {
			status: "failed",
			error,
			metadata: {
				...task.metadata,
				failedAt: now,
				duration,
			},
		})

		await this.addHistoryEntry(id, "failed", { error })
	}

	async cancelTask(id: string): Promise<void> {
		await this.update(id, { status: "cancelled" })
		await this.addHistoryEntry(id, "cancelled")
	}

	async resumeTask(id: string): Promise<void> {
		await this.update(id, { status: "pending" })
		await this.addHistoryEntry(id, "resumed")
	}

	private async addHistoryEntry(taskId: string, action: TaskAction, data?: any): Promise<void> {
		const history = await this.getAllTaskHistory()
		if (!history[taskId]) {
			history[taskId] = []
		}

		history[taskId].push({
			timestamp: new Date(),
			action,
			data,
		})

		await this.saveTaskHistory(history)
	}

	async getTaskHistory(id: string): Promise<TaskHistoryEntry[]> {
		const history = await this.getAllTaskHistory()
		return history[id] || []
	}

	async addTaskLog(id: string, entry: TaskLogEntry): Promise<void> {
		const logs = await this.getAllTaskLogs()
		if (!logs[id]) {
			logs[id] = []
		}

		logs[id].push(entry)
		await this.saveTaskLogs(logs)
	}

	async getTaskLogs(id: string, options?: TaskLogQueryOptions): Promise<TaskLogEntry[]> {
		const logs = await this.getAllTaskLogs()
		let taskLogs: TaskLogEntry[] = logs[id] || []

		// Apply filters
		if (options?.level) {
			taskLogs = taskLogs.filter((log: TaskLogEntry) => log.level === options.level)
		}
		if (options?.since) {
			taskLogs = taskLogs.filter((log: TaskLogEntry) => log.timestamp >= options.since!)
		}
		if (options?.source) {
			taskLogs = taskLogs.filter((log: TaskLogEntry) => log.source === options.source)
		}

		// Apply limit
		if (options?.limit) {
			taskLogs = taskLogs.slice(-options.limit)
		}

		return taskLogs
	}

	async cleanupCompletedTasks(olderThan: Date, workspaceId?: string): Promise<number> {
		const filters: any = { status: "completed" }
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}

		const tasks = await this.list({ filters })
		const toDelete = tasks.filter((task) => task.updatedAt < olderThan)

		await this.deleteMany(toDelete.map((task) => task.id))
		return toDelete.length
	}

	async getTaskDependencies(id: string): Promise<Task[]> {
		// Mock implementation - would need proper dependency tracking
		return []
	}

	async getDependentTasks(id: string): Promise<Task[]> {
		// Mock implementation - would need proper dependency tracking
		return []
	}

	async addTaskDependency(taskId: string, dependencyId: string): Promise<void> {
		// Mock implementation - would need proper dependency tracking
		const task = await this.get(taskId)
		if (!task) {
			throw new Error(`Task with id ${taskId} not found`)
		}

		const dependencies = task.metadata.dependencies || []
		if (!dependencies.includes(dependencyId)) {
			dependencies.push(dependencyId)
			await this.update(taskId, {
				metadata: {
					...task.metadata,
					dependencies,
				},
			})
		}
	}

	async removeTaskDependency(taskId: string, dependencyId: string): Promise<void> {
		const task = await this.get(taskId)
		if (!task) {
			throw new Error(`Task with id ${taskId} not found`)
		}

		const dependencies = task.metadata.dependencies || []
		const index = dependencies.indexOf(dependencyId)
		if (index > -1) {
			dependencies.splice(index, 1)
			await this.update(taskId, {
				metadata: {
					...task.metadata,
					dependencies,
				},
			})
		}
	}

	async getTaskQueue(workspaceId: string): Promise<Task[]> {
		return await this.getTasksByStatus("pending", workspaceId)
	}

	async getNextTask(workspaceId?: string): Promise<Task | null> {
		const pendingTasks = await this.getTasksByStatus("pending", workspaceId)

		// Sort by priority (if available) and creation date
		pendingTasks.sort((a, b) => {
			const aPriority = a.metadata.priority || 0
			const bPriority = b.metadata.priority || 0
			if (aPriority !== bPriority) {
				return bPriority - aPriority // Higher priority first
			}
			return a.createdAt.getTime() - b.createdAt.getTime() // Older first
		})

		return pendingTasks[0] || null
	}

	async getTaskStats(workspaceId?: string, dateRange?: DateRange): Promise<TaskStats> {
		const filters: any = {}
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}
		if (dateRange) {
			filters.dateRange = dateRange
		}

		const tasks = await this.list({ filters })

		const totalTasks = tasks.length
		const completedTasks = tasks.filter((t) => t.status === "completed").length
		const failedTasks = tasks.filter((t) => t.status === "failed").length
		const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "running").length

		const completedTasksWithDuration = tasks.filter((t) => t.status === "completed" && t.metadata.duration)
		const averageExecutionTime =
			completedTasksWithDuration.length > 0
				? completedTasksWithDuration.reduce((sum, t) => sum + (t.metadata.duration || 0), 0) /
					completedTasksWithDuration.length
				: 0

		const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

		const tasksByType = tasks.reduce(
			(acc, task) => {
				acc[task.type] = (acc[task.type] || 0) + 1
				return acc
			},
			{} as Record<TaskType, number>,
		)

		const tasksByStatus = tasks.reduce(
			(acc, task) => {
				acc[task.status] = (acc[task.status] || 0) + 1
				return acc
			},
			{} as Record<TaskStatus, number>,
		)

		const busyDays = tasks.reduce(
			(acc, task) => {
				const day = task.createdAt.toISOString().split("T")[0]
				acc[day] = (acc[day] || 0) + 1
				return acc
			},
			{} as Record<string, number>,
		)

		return {
			totalTasks,
			completedTasks,
			failedTasks,
			activeTasks,
			averageExecutionTime,
			successRate,
			tasksByType,
			tasksByStatus,
			busyDays,
		}
	}

	async scheduleTask(task: CreateTaskRequest, scheduledFor: Date): Promise<Task> {
		return await this.create({
			...task,
			metadata: {
				...task.metadata,
				scheduledFor: scheduledFor.toISOString(),
			},
		})
	}

	async getScheduledTasks(workspaceId?: string): Promise<Task[]> {
		const filters: any = { status: "pending" }
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}

		const tasks = await this.list({ filters })
		return tasks.filter((task) => task.metadata.scheduledFor)
	}

	async searchTasks(query: string, workspaceId?: string): Promise<Task[]> {
		const filters: any = {}
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}

		const tasks = await this.list({ filters })
		const lowerQuery = query.toLowerCase()

		return tasks.filter(
			(task) =>
				task.name.toLowerCase().includes(lowerQuery) ||
				task.description?.toLowerCase().includes(lowerQuery) ||
				task.type.toLowerCase().includes(lowerQuery),
		)
	}

	async exportTasks(workspaceId: string, options?: TaskExportOptions): Promise<any> {
		const filters: any = { workspaceId }

		if (options?.dateRange) {
			filters.dateRange = options.dateRange
		}

		let tasks = await this.list({ filters })

		if (!options?.includeCompleted) {
			tasks = tasks.filter((t) => t.status !== "completed")
		}
		if (!options?.includeFailed) {
			tasks = tasks.filter((t) => t.status !== "failed")
		}

		const exportData: any = {
			tasks,
			exportedAt: new Date().toISOString(),
			workspaceId,
		}

		if (options?.includeLogs) {
			const logs = await this.getAllTaskLogs()
			exportData.logs = Object.fromEntries(tasks.map((task) => [task.id, logs[task.id] || []]))
		}

		return exportData
	}

	async importTasks(workspaceId: string, data: any): Promise<Task[]> {
		const tasksToImport = data.tasks || []
		return await this.createMany(
			tasksToImport.map((task: any) => ({
				...task,
				workspaceId,
				id: undefined,
				status: undefined,
				progress: undefined,
				result: undefined,
				createdAt: undefined,
				updatedAt: undefined,
			})),
		)
	}
}
