/**
 * Shared task execution orchestrator that provides unified task lifecycle management
 * for both CLI and API contexts. Extracted from CLI BatchProcessor logic.
 */

import { Task } from "../Task"
import {
	ITaskExecutionHandler,
	TaskExecutionOptions,
	TaskExecutionResult,
	TaskExecutionMode,
	TaskActivityType,
} from "./types"

export class TaskExecutionOrchestrator {
	private activeExecutions = new Map<string, TaskExecutionState>()

	/**
	 * Execute a task with comprehensive lifecycle management
	 */
	async executeTask(
		task: Task,
		taskPromise: Promise<void>,
		handler: ITaskExecutionHandler,
		options: TaskExecutionOptions = {},
	): Promise<TaskExecutionResult> {
		const startTime = Date.now()
		const taskId = options.taskIdentifier || task.taskId || "unknown"
		const isInfoQuery = options.isInfoQuery || false

		handler.logDebug(
			`[TaskExecutionOrchestrator] Starting execution for task ${taskId}, isInfoQuery: ${isInfoQuery}`,
		)

		// Create execution state
		const state: TaskExecutionState = {
			taskId,
			task,
			handler,
			options,
			startTime,
			isInfoQuery,
			isCompleted: false,
			isWaitingForUserInput: false,
			lastActivityTime: Date.now(),
			responseBuffer: "",
			lastResponseTime: Date.now(),
			timers: new Set(),
		}

		this.activeExecutions.set(taskId, state)

		try {
			await handler.onTaskStarted(taskId)

			if (isInfoQuery) {
				return await this.executeInfoQuery(state, taskPromise)
			} else {
				return await this.executeStandardTask(state, taskPromise)
			}
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error))
			await handler.onTaskFailed(taskId, err)
			return {
				success: false,
				reason: "Execution failed",
				error: err,
				durationMs: Date.now() - startTime,
			}
		} finally {
			this.cleanup(state)
			this.activeExecutions.delete(taskId)
		}
	}

	/**
	 * Execute informational query with response completion detection
	 */
	private async executeInfoQuery(
		state: TaskExecutionState,
		taskPromise: Promise<void>,
	): Promise<TaskExecutionResult> {
		const { handler, options, taskId, task } = state

		return new Promise((resolve, reject) => {
			const completeOnce = async (reason: string, result?: string) => {
				if (state.isCompleted) return
				state.isCompleted = true

				handler.logDebug(`[TaskExecutionOrchestrator] Info query completing: ${reason}`)
				this.clearAllTimers(state)

				try {
					await this.disposeTask(task)
					await handler.onTaskCompleted(taskId, result || reason)
					resolve({
						success: true,
						reason,
						result: result || reason,
						durationMs: Date.now() - state.startTime,
					})
				} catch (error) {
					const err = error instanceof Error ? error : new Error(String(error))
					await handler.onTaskFailed(taskId, err)
					reject(err)
				}
			}

			const rejectOnce = async (error: Error) => {
				if (state.isCompleted) return
				state.isCompleted = true

				handler.logDebug(`[TaskExecutionOrchestrator] Info query rejecting: ${error.message}`)
				this.clearAllTimers(state)

				try {
					await this.disposeTask(task)
					await handler.onTaskFailed(taskId, error)
					reject(error)
				} catch (cleanupError) {
					handler.logDebug(`[TaskExecutionOrchestrator] Error during cleanup:`, cleanupError)
					reject(error)
				}
			}

			// Set up response completion detection
			this.setupResponseCompletionDetection(state, completeOnce)

			// Set up standard event handlers
			this.setupStandardEventHandlers(state, completeOnce, rejectOnce)

			// Handle task promise
			taskPromise.catch((error) => {
				handler.logDebug(`[TaskExecutionOrchestrator] Task promise rejected:`, error)
				if (!state.isCompleted) {
					rejectOnce(error instanceof Error ? error : new Error(String(error)))
				}
			})

			// Info query timeout
			const infoTimeout = options.infoQueryTimeoutMs || 30000
			const timeoutId = setTimeout(() => {
				if (!state.isCompleted) {
					completeOnce(`Information query timeout (${infoTimeout / 1000}s)`)
				}
			}, infoTimeout)
			state.timers.add(timeoutId)

			// Emergency timeout
			const emergencyTimeout = options.emergencyTimeoutMs || 60000
			const emergencyTimeoutId = setTimeout(() => {
				if (!state.isCompleted) {
					rejectOnce(new Error(`Emergency timeout after ${emergencyTimeout / 1000} seconds`))
				}
			}, emergencyTimeout)
			state.timers.add(emergencyTimeoutId)
		})
	}

	/**
	 * Execute standard task with sliding timeout
	 */
	private async executeStandardTask(
		state: TaskExecutionState,
		taskPromise: Promise<void>,
	): Promise<TaskExecutionResult> {
		const { handler, options, taskId, task } = state

		return new Promise((resolve, reject) => {
			const timeoutMs = options.slidingTimeoutMs || 600000 // 10 minutes default

			const resetTimeout = () => {
				state.lastActivityTime = Date.now()
				this.clearTimeoutTimers(state)

				if (state.isWaitingForUserInput) {
					handler.logDebug("[TaskExecutionOrchestrator] Not setting new timeout - waiting for user input")
					return
				}

				const timeoutId = setTimeout(() => {
					const timeSinceLastActivity = Date.now() - state.lastActivityTime
					handler.logDebug(
						`[TaskExecutionOrchestrator] Checking timeout: ${timeSinceLastActivity}ms since last activity, waiting for input: ${state.isWaitingForUserInput}`,
					)

					if (state.isWaitingForUserInput) {
						handler.logDebug(
							"[TaskExecutionOrchestrator] Timeout fired but waiting for user input - extending timeout",
						)
						resetTimeout()
						return
					}

					handler.logDebug(
						`[TaskExecutionOrchestrator] Task execution timeout after ${timeoutMs}ms of inactivity`,
					)
					reject(new Error(`Task execution timeout after ${timeoutMs}ms of inactivity`))
				}, timeoutMs)

				state.timers.add(timeoutId)
				handler.logDebug(
					`[TaskExecutionOrchestrator] Timeout reset - task has ${timeoutMs / 1000} seconds of inactivity before timeout`,
				)
			}

			const pauseTimeout = () => {
				this.clearTimeoutTimers(state)
				handler.logDebug("[TaskExecutionOrchestrator] Timeout paused - waiting for user input")
				state.isWaitingForUserInput = true
			}

			const resumeTimeout = () => {
				handler.logDebug("[TaskExecutionOrchestrator] Resuming timeout after user input")
				state.isWaitingForUserInput = false
				this.clearTimeoutTimers(state)

				const timeoutId = setTimeout(() => {
					handler.logDebug(
						`[TaskExecutionOrchestrator] Task execution timeout after ${timeoutMs}ms of inactivity`,
					)
					reject(new Error(`Task execution timeout after ${timeoutMs}ms of inactivity`))
				}, timeoutMs)

				state.timers.add(timeoutId)
				handler.logDebug(
					`[TaskExecutionOrchestrator] Timeout RESET after user response - task has ${timeoutMs}ms of inactivity before timeout`,
				)
			}

			// Start initial timeout
			resetTimeout()

			// Intercept task.ask to manage timeout
			this.interceptTaskAsk(task, handler, pauseTimeout)

			// Set up event handlers
			this.setupSlidingTimeoutEventHandlers(state, resolve, reject, resetTimeout, pauseTimeout, resumeTimeout)

			// Handle task promise
			taskPromise.catch((error) => {
				handler.logDebug(`[TaskExecutionOrchestrator] Task promise rejected:`, error)
				this.clearAllTimers(state)
				reject(error instanceof Error ? error : new Error(String(error)))
			})
		})
	}

	/**
	 * Setup response completion detection for info queries
	 */
	private setupResponseCompletionDetection(
		state: TaskExecutionState,
		complete: (reason: string, result?: string) => void,
	): void {
		const { task, handler } = state
		let completionTimer: NodeJS.Timeout | null = null

		const cleanupCompletionTimer = () => {
			if (completionTimer) {
				clearTimeout(completionTimer)
				completionTimer = null
				handler.logDebug("[TaskExecutionOrchestrator] Response completion timer cleared")
			}
		}

		const safeComplete = (reason: string, result?: string) => {
			if (state.isCompleted) return
			cleanupCompletionTimer()
			complete(reason, result)
		}

		task.on("message", (event: any) => {
			if (state.isCompleted) return

			handler.logDebug(
				`[TaskExecutionOrchestrator] Task message event received:`,
				event?.action,
				event?.message?.text?.substring(0, 100),
			)

			// Forward all message events to the handler for SSE streaming
			handler.onTaskMessage(state.taskId, event).catch((error) => {
				handler.logDebug(`[TaskExecutionOrchestrator] Error forwarding message to handler:`, error)
			})

			if (event.action === "response" || event.action === "say") {
				const content = event.message?.text || event.content || ""
				state.responseBuffer += content
				state.lastResponseTime = Date.now()

				handler.logDebug(
					`[TaskExecutionOrchestrator] Response content captured: ${content.substring(0, 100)}...`,
				)

				// Clear existing timer
				cleanupCompletionTimer()

				// Check for immediate completion indicators
				if (this.detectResponseCompletion(state.responseBuffer)) {
					handler.logDebug("[TaskExecutionOrchestrator] Response completion detected immediately")
					completionTimer = setTimeout(() => {
						safeComplete("Response completion detected", state.responseBuffer)
					}, 1000) // 1 second delay to ensure response is complete
				} else {
					// Set timer for response completion by timeout
					completionTimer = setTimeout(() => {
						const timeSinceLastResponse = Date.now() - state.lastResponseTime
						if (timeSinceLastResponse >= 2000 && state.responseBuffer.length > 50) {
							handler.logDebug(
								"[TaskExecutionOrchestrator] Response completion by timeout and content length",
							)
							safeComplete("Response timeout completion", state.responseBuffer)
						}
					}, 3000) // 3 seconds of no new content
				}
			}
		})

		// Clean up timer when task completes via other means
		task.on("taskCompleted", () => {
			handler.logDebug("[TaskExecutionOrchestrator] Task completed, cleaning up response completion timer")
			cleanupCompletionTimer()
		})

		task.on("taskAborted", () => {
			handler.logDebug("[TaskExecutionOrchestrator] Task aborted, cleaning up response completion timer")
			cleanupCompletionTimer()
		})
	}

	/**
	 * Setup standard event handlers for task lifecycle
	 */
	private setupStandardEventHandlers(
		state: TaskExecutionState,
		complete: (reason: string, result?: string) => void,
		reject: (error: Error) => void,
	): void {
		const { task, handler, taskId } = state

		task.on("taskCompleted", (tid: string, tokenUsage: any, toolUsage: any) => {
			handler.logDebug(`[TaskExecutionOrchestrator] Standard task completed: ${tid}`)
			complete("Standard task completion")
		})

		task.on("taskAborted", () => {
			handler.logDebug("[TaskExecutionOrchestrator] Task was aborted")
			reject(new Error("Task was aborted"))
		})

		task.on("taskToolFailed", (tid: string, tool: string, error: string) => {
			handler.logDebug(`[TaskExecutionOrchestrator] Tool ${tool} failed: ${error}`)
			reject(new Error(`Tool ${tool} failed: ${error}`))
		})

		// Activity tracking
		task.on("taskStarted", () => {
			handler.logDebug("[TaskExecutionOrchestrator] Task started")
		})

		task.on("taskModeSwitched", (tid: string, mode: string) => {
			handler.logDebug(`[TaskExecutionOrchestrator] Task mode switched to: ${mode}`)
		})

		// This is the key event that carries task output
		task.on("message", (event: { action: "created" | "updated"; message: any }) => {
			handler.logDebug(`[TaskExecutionOrchestrator] Task message event:`, event.action, event.message?.type)

			// Forward all message events to handler for SSE streaming
			handler
				.onTaskMessage(taskId, {
					action: event.message?.type || event.action,
					message: event.message,
				})
				.catch((error) => {
					handler.logDebug(`[TaskExecutionOrchestrator] Error forwarding message:`, error)
				})
		})
	}

	/**
	 * Setup event handlers for sliding timeout tasks
	 */
	private setupSlidingTimeoutEventHandlers(
		state: TaskExecutionState,
		resolve: (result: TaskExecutionResult) => void,
		reject: (error: Error) => void,
		resetTimeout: () => void,
		pauseTimeout: () => void,
		resumeTimeout: () => void,
	): void {
		const { task, handler, taskId } = state

		// Detect questions via message events
		task.on("message", (messageEvent: any) => {
			handler.logDebug(`[TaskExecutionOrchestrator] Message event: ${messageEvent.action}`)

			// Check for any indication this is a question
			const message = messageEvent.message
			const isQuestion =
				message &&
				(message.ask ||
					message.type === "ask" ||
					(message.text &&
						(message.text.includes("ask_followup_question") ||
							message.text.includes("<question>") ||
							message.text.includes("?") ||
							message.text.includes("choose") ||
							message.text.includes("select"))))

			if (isQuestion) {
				handler.logDebug("[TaskExecutionOrchestrator] *** QUESTION DETECTED - pausing timeout ***")
				pauseTimeout()
			} else {
				// Regular message activity should reset timeout only if not waiting for input
				handler.logDebug("[TaskExecutionOrchestrator] Regular message activity")
				resetTimeout()
			}

			// Forward to handler
			handler.onTaskMessage(taskId, messageEvent).catch((err) => {
				handler.logDebug("[TaskExecutionOrchestrator] Error forwarding message:", err)
			})
		})

		// Task completion
		task.on("taskCompleted", async (tid: string, tokenUsage: any, toolUsage: any) => {
			handler.logDebug(`[TaskExecutionOrchestrator] Task completed: ${tid}`)
			this.clearAllTimers(state)

			try {
				await this.disposeTask(task)
				await handler.onTaskCompleted(taskId, "Task completed successfully", tokenUsage, toolUsage)
				resolve({
					success: true,
					reason: "Standard task completion",
					result: "Task completed successfully",
					tokenUsage,
					toolUsage,
					durationMs: Date.now() - state.startTime,
				})
			} catch (error) {
				handler.logDebug("[TaskExecutionOrchestrator] Error during cleanup:", error)
				resolve({
					success: true,
					reason: "Task completed with cleanup error",
					result: "Task completed successfully",
					tokenUsage,
					toolUsage,
					durationMs: Date.now() - state.startTime,
				})
			}
		})

		task.on("taskAborted", async () => {
			handler.logDebug("[TaskExecutionOrchestrator] Task was aborted")
			this.clearAllTimers(state)

			try {
				await this.disposeTask(task)
			} catch (error) {
				handler.logDebug("[TaskExecutionOrchestrator] Error during cleanup:", error)
			}

			const error = new Error("Task was aborted")
			await handler.onTaskFailed(taskId, error)
			reject(error)
		})

		// Activity events that reset timeout
		task.on("taskStarted", () => {
			handler.logDebug(`[TaskExecutionOrchestrator] taskStarted`)
			resetTimeout()
			handler.onTaskActivity(taskId, "taskStarted").catch((err) => {
				handler.logDebug(`[TaskExecutionOrchestrator] Error forwarding taskStarted:`, err)
			})
		})

		task.on("taskModeSwitched", (tid: string, mode: string) => {
			handler.logDebug(`[TaskExecutionOrchestrator] taskModeSwitched: ${mode}`)
			resetTimeout()
			handler.onTaskActivity(taskId, "taskModeSwitched", { mode }).catch((err) => {
				handler.logDebug(`[TaskExecutionOrchestrator] Error forwarding taskModeSwitched:`, err)
			})
		})

		task.on("taskPaused", () => {
			handler.logDebug(`[TaskExecutionOrchestrator] taskPaused`)
			resetTimeout()
			handler.onTaskActivity(taskId, "taskPaused").catch((err) => {
				handler.logDebug(`[TaskExecutionOrchestrator] Error forwarding taskPaused:`, err)
			})
		})

		task.on("taskUnpaused", () => {
			handler.logDebug(`[TaskExecutionOrchestrator] taskUnpaused`)
			resetTimeout()
			handler.onTaskActivity(taskId, "taskUnpaused").catch((err) => {
				handler.logDebug(`[TaskExecutionOrchestrator] Error forwarding taskUnpaused:`, err)
			})
		})

		task.on("taskSpawned", (tid: string) => {
			handler.logDebug(`[TaskExecutionOrchestrator] taskSpawned: ${tid}`)
			resetTimeout()
			handler.onTaskActivity(taskId, "taskSpawned", { spawnedTaskId: tid }).catch((err) => {
				handler.logDebug(`[TaskExecutionOrchestrator] Error forwarding taskSpawned:`, err)
			})
		})

		task.on("taskTokenUsageUpdated", (tid: string, tokenUsage: any) => {
			handler.logDebug(`[TaskExecutionOrchestrator] taskTokenUsageUpdated: ${tid}`)
			resetTimeout()
			handler.onTaskActivity(taskId, "taskTokenUsageUpdated", { tokenUsage }).catch((err) => {
				handler.logDebug(`[TaskExecutionOrchestrator] Error forwarding taskTokenUsageUpdated:`, err)
			})
		})

		// User input events
		task.on("taskAskResponded", () => {
			handler.logDebug("[TaskExecutionOrchestrator] *** CRITICAL: User answered question - resuming timeout ***")
			resumeTimeout()
			handler.onUserInputReceived(taskId).catch((err) => {
				handler.logDebug("[TaskExecutionOrchestrator] Error forwarding user input received:", err)
			})
		})

		// Tool failures
		task.on("taskToolFailed", (tid: string, tool: string, error: string) => {
			handler.logDebug(`[TaskExecutionOrchestrator] Tool ${tool} failed: ${error}`)
			this.clearAllTimers(state)
			const err = new Error(`Tool ${tool} failed: ${error}`)
			handler.onTaskFailed(taskId, err).catch((handlerErr) => {
				handler.logDebug("[TaskExecutionOrchestrator] Error forwarding tool failure:", handlerErr)
			})
			reject(err)
		})
	}

	/**
	 * Intercept task.ask to manage timeout during user input
	 */
	private interceptTaskAsk(task: Task, handler: ITaskExecutionHandler, pauseTimeout: () => void): void {
		const originalAsk = task.ask.bind(task)
		task.ask = async (type: any, text?: string, partial?: boolean, progressStatus?: any) => {
			handler.logDebug("[TaskExecutionOrchestrator] Question asked via task.ask() - pausing timeout")
			pauseTimeout()
			try {
				const result = await originalAsk(type, text, partial, progressStatus)
				return result
			} finally {
				// Don't resume here - wait for taskAskResponded event
			}
		}
	}

	/**
	 * Detect if response content indicates completion
	 */
	private detectResponseCompletion(responseBuffer: string): boolean {
		// Look for completion indicators in the response
		const completionIndicators = [
			"</attempt_completion>",
			"task is complete",
			"completed successfully",
			"I have completed",
			"The task has been completed",
			"execution complete",
		]

		const lowerBuffer = responseBuffer.toLowerCase()
		return completionIndicators.some((indicator) => lowerBuffer.includes(indicator.toLowerCase()))
	}

	/**
	 * Clear timeout-related timers
	 */
	private clearTimeoutTimers(state: TaskExecutionState): void {
		// Clear only timeout timers, keep completion timers
		state.timers.forEach((timer) => {
			clearTimeout(timer)
		})
		state.timers.clear()
	}

	/**
	 * Clear all timers
	 */
	private clearAllTimers(state: TaskExecutionState): void {
		state.timers.forEach((timer) => {
			clearTimeout(timer)
		})
		state.timers.clear()
	}

	/**
	 * Properly dispose of task resources
	 */
	private async disposeTask(task: Task): Promise<void> {
		try {
			if (typeof task.dispose === "function") {
				await task.dispose()
			}
		} catch (error) {
			// Log but don't throw - disposal errors shouldn't fail the execution
		}
	}

	/**
	 * Cleanup execution state
	 */
	private cleanup(state: TaskExecutionState): void {
		this.clearAllTimers(state)
		state.isCompleted = true
	}

	/**
	 * Get active execution count
	 */
	getActiveExecutionCount(): number {
		return this.activeExecutions.size
	}

	/**
	 * Cancel a specific execution
	 */
	async cancelExecution(taskId: string, reason: string = "Cancelled"): Promise<boolean> {
		const state = this.activeExecutions.get(taskId)
		if (!state) {
			return false
		}

		state.handler.logDebug(`[TaskExecutionOrchestrator] Cancelling execution ${taskId}: ${reason}`)

		try {
			// Abort the task if possible
			if (typeof state.task.abortTask === "function") {
				await state.task.abortTask()
			}

			// Clean up
			this.cleanup(state)
			this.activeExecutions.delete(taskId)

			await state.handler.onTaskFailed(taskId, new Error(reason))
			return true
		} catch (error) {
			state.handler.logDebug(`[TaskExecutionOrchestrator] Error cancelling execution:`, error)
			return false
		}
	}
}

/**
 * Internal execution state
 */
interface TaskExecutionState {
	taskId: string
	task: Task
	handler: ITaskExecutionHandler
	options: TaskExecutionOptions
	startTime: number
	isInfoQuery: boolean
	isCompleted: boolean
	isWaitingForUserInput: boolean
	lastActivityTime: number
	responseBuffer: string
	lastResponseTime: number
	timers: Set<NodeJS.Timeout>
}
