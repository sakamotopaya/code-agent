import * as path from "path"
import * as os from "os"
import EventEmitter from "events"
import { HistoryItem, ClineMessage, ProviderSettings, TelemetryEventName } from "@roo-code/types"
import { Mode } from "../../shared/modes"
import { CloudService } from "@roo-code/cloud"
import { ITelemetryService } from "../interfaces/ITelemetryService"
import { IProviderContext } from "../interfaces/IProviderContext"
import { IOutputAdapter } from "../interfaces/IOutputAdapter"
import { Task, TaskOptions } from "../task/Task"
import { McpHub } from "../../services/mcp/McpHub"
import { defaultModeSlug } from "../../shared/modes"
import { ProviderSettingsManager } from "../config/ProviderSettingsManager"
import { UnifiedCustomModesService } from "../../shared/services/UnifiedCustomModesService"
import { ILogger, NoOpLogger } from "../interfaces/ILogger"

export type CoreProviderEvents = {
	taskCreated: [task: Task]
	taskCompleted: [taskId: string]
	stateChanged: [changeType: string, data?: any]
}

/**
 * Core provider class containing all shared business logic
 * Used by all modes (VSCode, CLI, API) to ensure consistent functionality
 */
export class CoreProvider extends EventEmitter<CoreProviderEvents> {
	private taskStack: Task[] = []
	protected mcpHub?: McpHub
	protected providerSettingsManager?: ProviderSettingsManager
	protected customModesManager?: UnifiedCustomModesService
	protected logger: ILogger = new NoOpLogger()

	constructor(
		protected context: IProviderContext,
		protected outputAdapter: IOutputAdapter,
		protected telemetry: ITelemetryService,
	) {
		super()
	}

	// Task Stack Management
	async addTaskToStack(task: Task) {
		this.logger.debug(`[CoreProvider] Adding task ${task.taskId}.${task.instanceId} to stack`)
		this.taskStack.push(task)

		// Ensure state is properly synchronized
		await this.syncState()

		this.emit("taskCreated", task)
	}

	async removeTaskFromStack() {
		if (this.taskStack.length === 0) {
			return
		}

		const task = this.taskStack.pop()
		if (task) {
			this.logger.debug(`[CoreProvider] Removing task ${task.taskId}.${task.instanceId} from stack`)

			try {
				await task.abortTask(true)
			} catch (error) {
				this.logger.error(`[CoreProvider] Error aborting task ${task.taskId}.${task.instanceId}:`, error)
			}
		}

		await this.syncState()
	}

	getCurrentTask(): Task | undefined {
		if (this.taskStack.length === 0) {
			return undefined
		}
		return this.taskStack[this.taskStack.length - 1]
	}

	getTaskStackSize(): number {
		return this.taskStack.length
	}

	getCurrentTaskStack(): string[] {
		return this.taskStack.map((task) => task.taskId)
	}

	// State Management
	async getState() {
		const apiConfiguration = this.context.getGlobalState<ProviderSettings>("apiConfiguration")
		const taskHistory = this.context.getGlobalState<HistoryItem[]>("taskHistory") ?? []
		const customInstructions = this.context.getGlobalState<string>("customInstructions")
		const mode = this.context.getGlobalState<string>("mode") ?? defaultModeSlug

		// Get all the configuration values
		const lastShownAnnouncementId = this.context.getGlobalState<string>("lastShownAnnouncementId")
		const alwaysAllowReadOnly = this.context.getGlobalState<boolean>("alwaysAllowReadOnly") ?? false
		const alwaysAllowReadOnlyOutsideWorkspace =
			this.context.getGlobalState<boolean>("alwaysAllowReadOnlyOutsideWorkspace") ?? false
		const alwaysAllowWrite = this.context.getGlobalState<boolean>("alwaysAllowWrite") ?? false
		const alwaysAllowWriteOutsideWorkspace =
			this.context.getGlobalState<boolean>("alwaysAllowWriteOutsideWorkspace") ?? false
		const alwaysAllowExecute = this.context.getGlobalState<boolean>("alwaysAllowExecute") ?? false
		const alwaysAllowBrowser = this.context.getGlobalState<boolean>("alwaysAllowBrowser") ?? false
		const alwaysAllowMcp = this.context.getGlobalState<boolean>("alwaysAllowMcp") ?? false
		const alwaysAllowModeSwitch = this.context.getGlobalState<boolean>("alwaysAllowModeSwitch") ?? false
		const alwaysAllowSubtasks = this.context.getGlobalState<boolean>("alwaysAllowSubtasks") ?? false
		const allowedMaxRequests = this.context.getGlobalState<number>("allowedMaxRequests") ?? 100
		const autoCondenseContext = this.context.getGlobalState<boolean>("autoCondenseContext") ?? true
		const autoCondenseContextPercent = this.context.getGlobalState<number>("autoCondenseContextPercent") ?? 100
		const diffEnabled = this.context.getGlobalState<boolean>("diffEnabled") ?? false
		const enableCheckpoints = this.context.getGlobalState<boolean>("enableCheckpoints") ?? true
		const soundEnabled = this.context.getGlobalState<boolean>("soundEnabled") ?? false
		const ttsEnabled = this.context.getGlobalState<boolean>("ttsEnabled") ?? false
		const ttsSpeed = this.context.getGlobalState<number>("ttsSpeed") ?? 1
		const soundVolume = this.context.getGlobalState<number>("soundVolume") ?? 0.5
		const fuzzyMatchThreshold = this.context.getGlobalState<number>("fuzzyMatchThreshold") ?? 1.0
		const mcpEnabled = this.context.getGlobalState<boolean>("mcpEnabled") ?? true
		const enableMcpServerCreation = this.context.getGlobalState<boolean>("enableMcpServerCreation") ?? true
		const alwaysApproveResubmit = this.context.getGlobalState<boolean>("alwaysApproveResubmit") ?? false
		const requestDelaySeconds = this.context.getGlobalState<number>("requestDelaySeconds") ?? 0

		return {
			apiConfiguration,
			taskHistory,
			customInstructions,
			mode,
			lastShownAnnouncementId,
			alwaysAllowReadOnly,
			alwaysAllowReadOnlyOutsideWorkspace,
			alwaysAllowWrite,
			alwaysAllowWriteOutsideWorkspace,
			alwaysAllowExecute,
			alwaysAllowBrowser,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			alwaysAllowSubtasks,
			allowedMaxRequests,
			autoCondenseContext,
			autoCondenseContextPercent,
			diffEnabled,
			enableCheckpoints,
			soundEnabled,
			ttsEnabled,
			ttsSpeed,
			soundVolume,
			fuzzyMatchThreshold,
			mcpEnabled,
			enableMcpServerCreation,
			alwaysApproveResubmit,
			requestDelaySeconds,
		}
	}

	async updateGlobalState(key: string, value: any): Promise<void> {
		await this.context.updateGlobalState(key, value)
		await this.syncState()
		this.emit("stateChanged", key, value)
	}

	async syncState(): Promise<void> {
		const state = await this.getState()
		await this.outputAdapter.syncState(state)
	}

	// Task History Management
	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = this.context.getGlobalState<HistoryItem[]>("taskHistory") ?? []

		// Find existing item or add new one
		const existingIndex = history.findIndex((h) => h.id === item.id)
		let updatedHistory: HistoryItem[]

		if (existingIndex !== -1) {
			updatedHistory = [...history]
			updatedHistory[existingIndex] = item
		} else {
			updatedHistory = [item, ...history]
		}

		// Use the output adapter to handle persistence
		return await this.outputAdapter.updateTaskHistory(item)
	}

	// Task Creation
	async createTaskInstance(taskConfig: {
		task?: string
		images?: string[]
		historyItem?: HistoryItem
		parentTask?: Task
		rootTask?: Task
		taskNumber?: number
		options?: Partial<TaskOptions>
	}): Promise<Task> {
		const state = await this.getState()
		const { apiConfiguration, diffEnabled, enableCheckpoints, fuzzyMatchThreshold } = state

		// Ensure apiConfiguration is defined
		if (!apiConfiguration) {
			throw new Error("API configuration is required to create a task. Please configure an API provider first.")
		}

		// Create task with core interfaces
		const task = new Task({
			apiConfiguration,
			enableDiff: taskConfig.options?.enableDiff ?? diffEnabled,
			enableCheckpoints: taskConfig.options?.enableCheckpoints ?? enableCheckpoints,
			fuzzyMatchThreshold: taskConfig.options?.fuzzyMatchThreshold ?? fuzzyMatchThreshold,
			task: taskConfig.task,
			images: taskConfig.images,
			historyItem: taskConfig.historyItem,
			rootTask: taskConfig.rootTask,
			parentTask: taskConfig.parentTask,
			taskNumber: taskConfig.taskNumber ?? this.taskStack.length + 1,
			onCreated: (task) => this.emit("taskCreated", task),
			globalStoragePath: this.context.getGlobalStoragePath(),
			workspacePath: this.context.getWorkspacePath(),
			telemetry: this.telemetry,
			outputAdapter: this.outputAdapter, // Pass the provider's output adapter to prevent duplicate creation
			...taskConfig.options,
		})

		await this.addTaskToStack(task)

		this.logger.debug(
			`[CoreProvider] ${task.parentTask ? "child" : "parent"} task ${task.taskId}.${task.instanceId} created`,
		)

		return task
	}

	// Finish subtask (for task hierarchy)
	async finishSubTask(lastMessage: string) {
		this.logger.debug(`[CoreProvider] Finishing subtask: ${lastMessage}`)
		await this.removeTaskFromStack()
		await this.getCurrentTask()?.resumePausedTask(lastMessage)
	}

	// Cleanup
	async dispose(): Promise<void> {
		// Clear all tasks
		while (this.taskStack.length > 0) {
			await this.removeTaskFromStack()
		}

		// Dispose MCP hub
		if (this.mcpHub) {
			await this.mcpHub.unregisterClient()
			this.mcpHub = undefined
		}

		// Dispose output adapter
		if (this.outputAdapter.dispose) {
			await this.outputAdapter.dispose()
		}

		// Dispose context
		if (this.context.dispose) {
			await this.context.dispose()
		}

		// Remove all listeners
		this.removeAllListeners()
	}

	// Message and communication delegation
	async sendMessage(message: any): Promise<void> {
		await this.outputAdapter.sendMessage(message)
	}

	async sendPartialUpdate(partialMessage: any): Promise<void> {
		await this.outputAdapter.sendPartialUpdate(partialMessage)
	}

	async notifyStateChange(changeType: string, data?: any): Promise<void> {
		await this.outputAdapter.notifyStateChange(changeType, data)
		this.emit("stateChanged", changeType, data)
	}

	// Utility methods
	protected log(message: string, ...args: any[]): void {
		this.logger.debug(`[CoreProvider] ${message}`, ...args)
	}

	/**
	 * Set or update the logger instance
	 */
	setLogger(logger: ILogger): void {
		this.logger = logger
	}

	/**
	 * Get the current logger instance
	 */
	getLogger(): ILogger {
		return this.logger
	}
}
