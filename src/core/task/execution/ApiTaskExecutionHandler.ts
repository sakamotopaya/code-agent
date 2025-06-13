/**
 * API-specific task execution handler that integrates with SSE streaming
 */

import { ITaskExecutionHandler } from "./types"
import { SSEOutputAdapter } from "../../../api/streaming/SSEOutputAdapter"

export class ApiTaskExecutionHandler implements ITaskExecutionHandler {
	constructor(
		private sseAdapter: SSEOutputAdapter,
		private jobId: string,
		private verbose: boolean = false,
	) {}

	async onTaskStarted(taskId: string): Promise<void> {
		if (this.verbose) {
			console.log(`[ApiTaskExecutionHandler] Task ${taskId} started for job ${this.jobId}`)
		}

		// Emit SSE event for task start
		await this.sseAdapter.showProgress("Task execution started", 0)
	}

	async onTaskCompleted(taskId: string, result: string, tokenUsage?: any, toolUsage?: any): Promise<void> {
		if (this.verbose) {
			console.log(`[ApiTaskExecutionHandler] Task ${taskId} completed for job ${this.jobId}`)
			console.log(`[ApiTaskExecutionHandler] Result:`, result.substring(0, 200) + "...")
			console.log(`[ApiTaskExecutionHandler] Token usage:`, tokenUsage)
			console.log(`[ApiTaskExecutionHandler] Tool usage:`, toolUsage)
		}

		// Emit SSE completion event
		await this.sseAdapter.emitCompletion(result, "Task has been completed successfully")
	}

	async onTaskFailed(taskId: string, error: Error): Promise<void> {
		if (this.verbose) {
			console.error(`[ApiTaskExecutionHandler] Task ${taskId} failed for job ${this.jobId}:`, error.message)
		}

		// Emit SSE error event
		await this.sseAdapter.emitError(error)
	}

	async onTaskMessage(taskId: string, event: any): Promise<void> {
		if (this.verbose) {
			console.log(`[ApiTaskExecutionHandler] Task ${taskId} message:`, event.action, {
				hasText: !!event.message?.text,
				textLength: event.message?.text?.length || 0,
				source: "message_handler",
			})
		}

		// NOTE: Do NOT forward "say" actions - they are already handled by the Task using SSEOutputAdapter as userInterface
		// This was causing duplicate content emission in the SSE stream

		// Only forward specialized events that need custom handling beyond standard userInterface methods
		if (event.action === "ask" && event.message?.text) {
			// Questions might need special SSE handling beyond standard askQuestion
			if (this.verbose) {
				console.log(
					`[ApiTaskExecutionHandler] Forwarding question to SSE:`,
					event.message.text.substring(0, 100),
				)
			}
			await this.sseAdapter.showInformation(`Question: ${event.message.text}`)
		} else if (event.action !== "say" && event.message?.text) {
			// Handle other message types (but NOT "say" to avoid duplication)
			if (this.verbose) {
				console.log(
					`[ApiTaskExecutionHandler] Forwarding ${event.action} to SSE log:`,
					event.message.text.substring(0, 100),
				)
			}
			await this.sseAdapter.log(event.message.text)
		}

		// Log skipped "say" actions for debugging
		if (event.action === "say" && this.verbose) {
			console.log(
				`[ApiTaskExecutionHandler] SKIPPED duplicate "say" forwarding - handled by userInterface directly`,
			)
		}
	}

	async onTaskActivity(taskId: string, eventType: string, data?: any): Promise<void> {
		if (this.verbose) {
			console.log(`[ApiTaskExecutionHandler] Task ${taskId} activity: ${eventType}`, data)
		}

		// Emit SSE progress updates for significant activities
		switch (eventType) {
			case "taskModeSwitched":
				await this.sseAdapter.showProgress(`Switched to ${data?.mode} mode`, undefined)
				break
			case "taskSpawned":
				await this.sseAdapter.showProgress("Spawned subtask", undefined)
				break
			default:
				// Other activities can be logged but don't need SSE events
				break
		}
	}

	async onUserInputRequested(taskId: string): Promise<void> {
		if (this.verbose) {
			console.log(`[ApiTaskExecutionHandler] Task ${taskId} requesting user input for job ${this.jobId}`)
		}

		// The SSE adapter handles user input through the ask/question mechanism
		// No additional action needed here as the SSE infrastructure handles this
	}

	async onUserInputReceived(taskId: string): Promise<void> {
		if (this.verbose) {
			console.log(`[ApiTaskExecutionHandler] Task ${taskId} received user input for job ${this.jobId}`)
		}

		// Emit progress to indicate we're continuing after user input
		await this.sseAdapter.showProgress("Continuing after user response...", undefined)
	}

	logDebug(message: string, ...args: any[]): void {
		if (this.verbose) {
			console.log(`[ApiTaskExecutionHandler] ${message}`, ...args)
		}
	}
}
