/**
 * API-specific task execution handler that integrates with SSE streaming
 */

import { ITaskExecutionHandler } from "./types"
import { SSEOutputAdapter } from "../../../api/streaming/SSEOutputAdapter"

export class ApiTaskExecutionHandler implements ITaskExecutionHandler {
	private completionEmitted: boolean = false

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
		// NEW: Always log what we receive
		console.log(`[ApiTaskExecutionHandler] 🔍 onTaskCompleted called:`)
		console.log(`[ApiTaskExecutionHandler] 🔍 - taskId: ${taskId}`)
		console.log(`[ApiTaskExecutionHandler] 🔍 - tokenUsage type: ${typeof tokenUsage}`)
		console.log(`[ApiTaskExecutionHandler] 🔍 - tokenUsage defined: ${tokenUsage !== undefined}`)
		if (tokenUsage) {
			console.log(`[ApiTaskExecutionHandler] 🔍 - tokenUsage value:`, JSON.stringify(tokenUsage, null, 2))
		}

		if (this.verbose) {
			console.log(`[ApiTaskExecutionHandler] Task ${taskId} completed for job ${this.jobId}`)
			console.log(`[ApiTaskExecutionHandler] Result:`, result.substring(0, 200) + "...")
			console.log(`[ApiTaskExecutionHandler] Token usage:`, tokenUsage)
			console.log(`[ApiTaskExecutionHandler] Tool usage:`, toolUsage)
		}

		// ✅ ALWAYS emit token usage information if available, even for duplicate completions
		if (tokenUsage) {
			console.log(
				`[ApiTaskExecutionHandler] 🔍 About to emit token usage for task ${taskId}:`,
				JSON.stringify(tokenUsage, null, 2),
			)
			try {
				console.log(`[ApiTaskExecutionHandler] 📡 Calling sseAdapter.emitTokenUsage()`)
				await this.sseAdapter.emitTokenUsage(tokenUsage)
				console.log(`[ApiTaskExecutionHandler] ✅ Token usage emitted for task ${taskId}`)
			} catch (error) {
				// Log warning but don't fail task completion
				console.error(`[ApiTaskExecutionHandler] ❌ Failed to emit token usage for task ${taskId}:`, error)
			}
		} else {
			console.log(
				`[ApiTaskExecutionHandler] ⚠️ No token usage data available for task ${taskId} - tokenUsage is ${typeof tokenUsage}`,
			)
		}

		// ✅ Prevent duplicate completion processing (but not token usage emission)
		if (this.completionEmitted) {
			if (this.verbose) {
				console.log(
					`[ApiTaskExecutionHandler] ⚠️ Task ${taskId} completion already processed, skipping duplicate completion event`,
				)
			}
			return
		}

		this.completionEmitted = true

		// Stream completion result in real-time rather than sending as one large block
		if (typeof result === "string" && result.length > 100) {
			// For large completion results, stream them chunk by chunk for better UX
			await this.streamCompletionResult(result)
		} else {
			// For small results, emit normally
			await this.sseAdapter.emitCompletion(result, "Task has been completed successfully")
		}
	}

	/**
	 * Stream large completion results in chunks for better real-time experience
	 */
	private async streamCompletionResult(result: string): Promise<void> {
		console.log(`[COMPLETION-STREAMING] 🚀 Streaming completion result in chunks (${result.length} chars)`)

		// Split result into reasonable chunks (similar to how LLM normally streams)
		const chunkSize = 50 // Similar to typical LLM chunk sizes
		const chunks: string[] = []

		for (let i = 0; i < result.length; i += chunkSize) {
			chunks.push(result.slice(i, i + chunkSize))
		}

		console.log(`[COMPLETION-STREAMING] 📊 Split into ${chunks.length} chunks`)

		// Stream each chunk with a small delay to simulate real-time streaming
		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i]
			console.log(
				`[COMPLETION-STREAMING] 📤 Streaming chunk ${i + 1}/${chunks.length}: "${chunk.substring(0, 30)}${chunk.length > 30 ? "..." : ""}"`,
			)

			// Use emitRawChunk for immediate streaming (bypasses MessageBuffer buffering)
			try {
				if (typeof (this.sseAdapter as any).emitRawChunk === "function") {
					await (this.sseAdapter as any).emitRawChunk(chunk)
				} else {
					// Fallback to regular progress if emitRawChunk is not available
					await this.sseAdapter.showProgress(chunk)
				}
			} catch (error) {
				// Fallback to regular progress if there's any error
				await this.sseAdapter.showProgress(chunk)
			}

			// Small delay between chunks to prevent all chunks from being sent in the same event loop tick
			if (i < chunks.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 25)) // 25ms delay
			}
		}

		// Send final completion event
		await this.sseAdapter.emitCompletion("Task completed successfully", "Task has been completed successfully")
		console.log(`[COMPLETION-STREAMING] ✅ Completion result streaming finished`)
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
			case "taskTokenUsageUpdated":
				// ✅ NEW: Emit token usage immediately when updated during execution
				if (data?.tokenUsage) {
					try {
						await this.sseAdapter.emitTokenUsage(data.tokenUsage)
						if (this.verbose) {
							console.log(
								`[ApiTaskExecutionHandler] ✅ Token usage emitted during execution for task ${taskId}`,
							)
						}
					} catch (error) {
						// Log warning but don't fail task execution
						console.warn(
							`[ApiTaskExecutionHandler] ⚠️ Failed to emit token usage during execution for task ${taskId}:`,
							error,
						)
					}
				} else if (this.verbose) {
					console.log(
						`[ApiTaskExecutionHandler] ⚠️ No token usage data in taskTokenUsageUpdated event for task ${taskId}`,
					)
				}
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
