import { ServerResponse } from "http"
import {
	IUserInterface,
	MessageOptions,
	QuestionOptions,
	ConfirmationOptions,
	InputOptions,
	LogLevel,
	WebviewContent,
	WebviewOptions,
} from "../../core/interfaces/IUserInterface"
import { StreamManager } from "./StreamManager"
import { SSEEvent, SSE_EVENTS, TokenUsage } from "./types"
import { getCLILogger } from "../../cli/services/CLILogger"
import { MessageBuffer, ProcessedMessage, ContentType } from "./MessageBuffer"
import { ApiQuestionManager } from "../questions/ApiQuestionManager"

/**
 * SSE Output Adapter that implements IUserInterface to capture Task events
 * and stream them to HTTP clients in real-time via Server-Sent Events
 */
export class SSEOutputAdapter implements IUserInterface {
	private streamManager: StreamManager
	public readonly jobId: string
	private logger = getCLILogger()
	private questionCounter = 0
	private messageBuffer: MessageBuffer
	private verbose: boolean
	private questionManager: ApiQuestionManager

	constructor(
		streamManager: StreamManager,
		jobId: string,
		verbose: boolean = false,
		questionManager?: ApiQuestionManager,
	) {
		this.streamManager = streamManager
		this.jobId = jobId
		this.verbose = verbose
		this.messageBuffer = new MessageBuffer()
		this.questionManager = questionManager || new ApiQuestionManager()
	}

	/**
	 * Display an informational message to the user
	 */
	async showInformation(message: string, options?: MessageOptions): Promise<void> {
		const event: SSEEvent = {
			type: SSE_EVENTS.INFORMATION,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message,
			...options,
		}

		this.emitEvent(event)
	}

	/**
	 * Display a warning message to the user
	 */
	async showWarning(message: string, options?: MessageOptions): Promise<void> {
		const event: SSEEvent = {
			type: SSE_EVENTS.WARNING,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message,
			...options,
		}

		this.emitEvent(event)
	}

	/**
	 * Display an error message to the user
	 */
	async showError(message: string, options?: MessageOptions): Promise<void> {
		const event: SSEEvent = {
			type: SSE_EVENTS.ERROR,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message,
			error: message,
			...options,
		}

		this.emitEvent(event)
	}

	/**
	 * Ask the user a question and wait for their response
	 * Now supports blocking questions that wait for actual user responses via API
	 */
	async askQuestion(question: string, options: QuestionOptions): Promise<string | undefined> {
		try {
			// Convert choices to suggestions format
			const suggestions = options.choices.map((choice) => ({ answer: choice }))

			// Create blocking question using question manager
			const { questionId, promise } = await this.questionManager.createQuestion(this.jobId, question, suggestions)

			// Emit question event via SSE
			const event: SSEEvent = {
				type: SSE_EVENTS.QUESTION_ASK,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message: question,
				questionId,
				choices: options.choices,
				suggestions,
			}

			this.emitEvent(event)

			// Wait for user response (this blocks task execution)
			const answer = await promise
			return answer
		} catch (error) {
			// If question fails (timeout, cancellation, etc.), fall back to default
			this.logger.warn(`Question failed for job ${this.jobId}: ${error}`)

			// Emit error event
			const errorEvent: SSEEvent = {
				type: SSE_EVENTS.ERROR,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message: `Question failed: ${error}`,
				error: error instanceof Error ? error.message : String(error),
			}
			this.emitEvent(errorEvent)

			return options.defaultChoice || options.choices[0]
		}
	}

	/**
	 * Ask the user for confirmation (yes/no)
	 * Now supports blocking confirmation that waits for actual user responses via API
	 */
	async askConfirmation(message: string, options?: ConfirmationOptions): Promise<boolean> {
		try {
			const yesText = options?.yesText || "Yes"
			const noText = options?.noText || "No"
			const choices = [yesText, noText]
			const suggestions = choices.map((choice) => ({ answer: choice }))

			// Create blocking question using question manager
			const { questionId, promise } = await this.questionManager.createQuestion(this.jobId, message, suggestions)

			// Emit question event via SSE
			const event: SSEEvent = {
				type: SSE_EVENTS.QUESTION_ASK,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message,
				questionId,
				choices,
				suggestions,
			}

			this.emitEvent(event)

			// Wait for user response (this blocks task execution)
			const answer = await promise

			// Convert answer to boolean (case-insensitive check)
			return answer.toLowerCase() === yesText.toLowerCase()
		} catch (error) {
			// If question fails, fall back to default (true - proceed)
			this.logger.warn(`Confirmation failed for job ${this.jobId}: ${error}`)

			// Emit error event
			const errorEvent: SSEEvent = {
				type: SSE_EVENTS.ERROR,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message: `Confirmation failed: ${error}`,
				error: error instanceof Error ? error.message : String(error),
			}
			this.emitEvent(errorEvent)

			return true
		}
	}

	/**
	 * Ask the user for text input
	 * Now supports blocking input that waits for actual user responses via API
	 */
	async askInput(prompt: string, options?: InputOptions): Promise<string | undefined> {
		try {
			// For text input, we don't provide specific choices but can include placeholder as suggestion
			const suggestions = options?.placeholder ? [{ answer: options.placeholder }] : []

			// Create blocking question using question manager
			const { questionId, promise } = await this.questionManager.createQuestion(this.jobId, prompt, suggestions)

			// Emit question event via SSE
			const event: SSEEvent = {
				type: SSE_EVENTS.QUESTION_ASK,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message: prompt,
				questionId,
				suggestions,
			}

			this.emitEvent(event)

			// Wait for user response (this blocks task execution)
			const answer = await promise
			return answer
		} catch (error) {
			// If question fails, fall back to default
			this.logger.warn(`Input failed for job ${this.jobId}: ${error}`)

			// Emit error event
			const errorEvent: SSEEvent = {
				type: SSE_EVENTS.ERROR,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message: `Input failed: ${error}`,
				error: error instanceof Error ? error.message : String(error),
			}
			this.emitEvent(errorEvent)

			return options?.defaultValue || ""
		}
	}

	/**
	 * Display progress information to the user
	 */
	async showProgress(message: string, progress?: number): Promise<void> {
		if (this.verbose) {
			// In verbose mode, pass through unchanged
			const event: SSEEvent = {
				type: SSE_EVENTS.PROGRESS,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message,
				progress,
			}
			this.emitEvent(event)
		} else {
			// Check for MessageBuffer enable flag (disabled by default)
			const enableMessageBuffer = process.env.ENABLE_MESSAGE_BUFFER === "true"

			if (enableMessageBuffer) {
				console.log(`[SSE-PROGRESS] 🔄 MessageBuffer enabled - processing content`)
				// Use MessageBuffer to filter content
				const processedMessages = this.messageBuffer.processMessage(message)

				for (const processedMessage of processedMessages) {
					// Only emit events for content that should be shown to users
					if (this.shouldEmitContentType(processedMessage.contentType)) {
						const event: SSEEvent = {
							type: SSE_EVENTS.PROGRESS,
							jobId: this.jobId,
							timestamp: new Date().toISOString(),
							message: processedMessage.content,
							progress,
							contentType: processedMessage.contentType,
							isComplete: processedMessage.isComplete,
							toolName: processedMessage.toolName,
						}
						this.emitEvent(event)
					}
				}
			} else {
				console.log(`[SSE-PROGRESS] ✅ MessageBuffer disabled (default) - emitting raw content`)
				// Default: emit raw content directly (like VSCode extension)
				const event: SSEEvent = {
					type: SSE_EVENTS.PROGRESS,
					jobId: this.jobId,
					timestamp: new Date().toISOString(),
					message,
					progress,
				}
				this.emitEvent(event)
			}
		}
	}

	/**
	 * Clear any displayed progress
	 */
	async clearProgress(): Promise<void> {
		const event: SSEEvent = {
			type: SSE_EVENTS.PROGRESS,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message: "Progress cleared",
			progress: 0,
		}

		this.emitEvent(event)
	}

	/**
	 * Log a message to the output/console
	 */
	async log(message: string, level: LogLevel = LogLevel.INFO): Promise<void> {
		if (this.verbose) {
			// In verbose mode, pass through unchanged
			const event: SSEEvent = {
				type: SSE_EVENTS.LOG,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message,
				level,
			}
			this.emitEvent(event)
		} else {
			// Check for MessageBuffer enable flag (disabled by default)
			const enableMessageBuffer = process.env.ENABLE_MESSAGE_BUFFER === "true"

			if (enableMessageBuffer) {
				console.log(`[SSE-LOG] 🔄 MessageBuffer enabled - processing content`)
				// Use MessageBuffer to filter content
				const processedMessages = this.messageBuffer.processMessage(message)

				for (const processedMessage of processedMessages) {
					// Only emit events for content that should be shown to users
					if (this.shouldEmitContentType(processedMessage.contentType)) {
						const event: SSEEvent = {
							type: SSE_EVENTS.LOG,
							jobId: this.jobId,
							timestamp: new Date().toISOString(),
							message: processedMessage.content,
							level,
							contentType: processedMessage.contentType,
							isComplete: processedMessage.isComplete,
							toolName: processedMessage.toolName,
						}
						this.emitEvent(event)
					}
				}
			} else {
				console.log(`[SSE-LOG] ✅ MessageBuffer disabled (default) - emitting raw content`)
				// Default: emit raw content directly (like VSCode extension)
				const event: SSEEvent = {
					type: SSE_EVENTS.LOG,
					jobId: this.jobId,
					timestamp: new Date().toISOString(),
					message,
					level,
				}
				this.emitEvent(event)
			}
		}
	}

	/**
	 * Display content in a webview - not applicable in SSE mode
	 */
	async showWebview(content: WebviewContent, options?: WebviewOptions): Promise<void> {
		// Log webview requests but don't try to display them in SSE
		const event: SSEEvent = {
			type: SSE_EVENTS.LOG,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message: `Webview requested: ${options?.title || "Untitled"}`,
			level: LogLevel.INFO,
		}

		this.emitEvent(event)
	}

	/**
	 * Send a message to the webview - not applicable in SSE mode
	 */
	async sendWebviewMessage(message: any): Promise<void> {
		// Log webview message but don't try to send in SSE
		const event: SSEEvent = {
			type: SSE_EVENTS.LOG,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message: `Webview message: ${JSON.stringify(message)}`,
			level: LogLevel.DEBUG,
		}

		this.emitEvent(event)
	}

	/**
	 * Listen for messages from the webview - not applicable in SSE mode
	 */
	onWebviewMessage(callback: (message: any) => void): void {
		// No-op in SSE mode - webviews not supported
		// Could log this if needed for debugging
	}

	/**
	 * SSE-specific methods
	 */

	/**
	 * Emit a start event
	 */
	async emitStart(message: string = "Task started", task?: string, taskId?: string): Promise<void> {
		const event: SSEEvent = {
			type: SSE_EVENTS.START,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message,
			task,
			...(taskId && { taskId }),
		}

		this.emitEvent(event)
	}

	/**
	 * Emit a tool usage event
	 */
	async emitToolUse(toolName: string, result?: any): Promise<void> {
		const event: SSEEvent = {
			type: SSE_EVENTS.TOOL_USE,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			toolName,
			result,
		}

		this.emitEvent(event)
	}

	/**
	 * Emit a completion event
	 */
	async emitCompletion(message: string = "Task completed", result?: any, taskId?: string): Promise<void> {
		const startTime = Date.now()
		console.log(`[SSE-COMPLETION] 🎯 emitCompletion() called at ${new Date().toISOString()}`)
		console.log(
			`[SSE-COMPLETION] 📝 Message content: "${message.substring(0, 200)}${message.length > 200 ? "..." : ""}" (${message.length} chars)`,
		)
		console.log(`[SSE-COMPLETION] 🔧 Verbose mode: ${this.verbose}`)

		if (this.verbose) {
			// In verbose mode, pass through unchanged
			console.log(`[SSE-COMPLETION] 📤 Verbose mode - emitting single event`)
			const event: SSEEvent = {
				type: SSE_EVENTS.COMPLETION,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message,
				result,
				...(taskId && {
					taskId,
					restartCommand: `--task ${taskId}`,
				}),
			}
			console.log(`[SSE-COMPLETION] 📤 About to emit single event with timestamp: ${event.timestamp}`)
			this.emitEvent(event)
		} else {
			// Check for MessageBuffer enable flag (disabled by default)
			const enableMessageBuffer = process.env.ENABLE_MESSAGE_BUFFER === "true"

			if (enableMessageBuffer) {
				console.log(`[SSE-COMPLETION] 🔄 MessageBuffer enabled - processing content`)
				// Use MessageBuffer to filter content
				const bufferStartTime = Date.now()
				const processedMessages = this.messageBuffer.processMessage(message)
				const bufferEndTime = Date.now()

				console.log(`[SSE-COMPLETION] 🔄 MessageBuffer processing took ${bufferEndTime - bufferStartTime}ms`)
				console.log(`[SSE-COMPLETION] 📊 Generated ${processedMessages.length} processed messages`)

				let eventIndex = 0
				for (const processedMessage of processedMessages) {
					const eventStartTime = Date.now()
					console.log(`[SSE-COMPLETION] 📋 Processing message ${eventIndex + 1}/${processedMessages.length}:`)
					console.log(
						`[SSE-COMPLETION] 📋   Content: "${processedMessage.content.substring(0, 100)}${processedMessage.content.length > 100 ? "..." : ""}" (${processedMessage.content.length} chars)`,
					)
					console.log(`[SSE-COMPLETION] 📋   ContentType: ${processedMessage.contentType}`)
					console.log(`[SSE-COMPLETION] 📋   IsComplete: ${processedMessage.isComplete}`)
					console.log(`[SSE-COMPLETION] 📋   ToolName: ${processedMessage.toolName}`)

					// Only emit events for content that should be shown to users
					if (this.shouldEmitContentType(processedMessage.contentType)) {
						const event: SSEEvent = {
							type: SSE_EVENTS.COMPLETION,
							jobId: this.jobId,
							timestamp: new Date().toISOString(),
							message: processedMessage.content,
							result,
							contentType: processedMessage.contentType,
							isComplete: processedMessage.isComplete,
							toolName: processedMessage.toolName,
						}
						console.log(
							`[SSE-COMPLETION] 📤 About to emit event ${eventIndex + 1} with timestamp: ${event.timestamp}`,
						)
						this.emitEvent(event)
						const eventEndTime = Date.now()
						console.log(
							`[SSE-COMPLETION] ✅ Event ${eventIndex + 1} emitted in ${eventEndTime - eventStartTime}ms`,
						)
					} else {
						console.log(
							`[SSE-COMPLETION] ❌ Skipping event ${eventIndex + 1} - content type ${processedMessage.contentType} not allowed`,
						)
					}
					eventIndex++
				}
			} else {
				console.log(`[SSE-COMPLETION] ✅ MessageBuffer disabled (default) - emitting raw content`)
				// Default: emit raw content directly (like VSCode extension)
				const event: SSEEvent = {
					type: SSE_EVENTS.COMPLETION,
					jobId: this.jobId,
					timestamp: new Date().toISOString(),
					message,
					result,
				}
				console.log(`[SSE-COMPLETION] 📤 About to emit single event with timestamp: ${event.timestamp}`)
				this.emitEvent(event)
			}
		}

		const endTime = Date.now()
		console.log(`[SSE-COMPLETION] ✅ emitCompletion() completed in ${endTime - startTime}ms`)

		// ✅ NEW: Schedule stream_end event after completion processing
		console.log(`[SSE-COMPLETION] 🕐 Scheduling stream_end event in 50ms`)
		setTimeout(() => {
			this.emitStreamEnd()
		}, 50)
	}

	/**
	 * Emit token usage information to the client
	 */
	async emitTokenUsage(tokenUsage: any): Promise<void> {
		// Handle missing or invalid data gracefully
		if (!tokenUsage || typeof tokenUsage !== "object") {
			if (this.verbose) {
				console.log(`[SSE-TOKEN-USAGE] ⚠️ No token usage data provided, skipping emission`)
			}
			return
		}

		try {
			// Extract and validate token usage data
			const totalTokensIn = Number(tokenUsage.totalTokensIn) || 0
			const totalTokensOut = Number(tokenUsage.totalTokensOut) || 0
			const totalCost = tokenUsage.totalCost ? Number(tokenUsage.totalCost) : undefined
			const contextTokens = tokenUsage.contextTokens ? Number(tokenUsage.contextTokens) : undefined
			const totalCacheReads = tokenUsage.totalCacheReads ? Number(tokenUsage.totalCacheReads) : undefined
			const totalCacheWrites = tokenUsage.totalCacheWrites ? Number(tokenUsage.totalCacheWrites) : undefined

			// Generate human-readable message
			let message = `Token usage: ${totalTokensIn.toLocaleString()} in, ${totalTokensOut.toLocaleString()} out`
			if (totalCost !== undefined) {
				message += `, $${totalCost.toFixed(4)}`
			}

			// Create structured token usage object
			const structuredTokenUsage: TokenUsage = {
				totalTokensIn,
				totalTokensOut,
				...(totalCacheReads !== undefined && { totalCacheReads }),
				...(totalCacheWrites !== undefined && { totalCacheWrites }),
				...(totalCost !== undefined && { totalCost }),
				...(contextTokens !== undefined && { contextTokens }),
			}

			// Create and emit SSE event
			const event: SSEEvent = {
				type: SSE_EVENTS.TOKEN_USAGE,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message,
				tokenUsage: structuredTokenUsage,
			}

			if (this.verbose) {
				console.log(`[SSE-TOKEN-USAGE] 📊 Emitting token usage for job ${this.jobId}:`, {
					totalTokensIn,
					totalTokensOut,
					totalCost,
					contextTokens,
					cacheReads: totalCacheReads,
					cacheWrites: totalCacheWrites,
				})
			}

			this.emitEvent(event)
		} catch (error) {
			// Log error but don't throw - token usage is supplementary information
			this.logger.warn(`Failed to emit token usage for job ${this.jobId}: ${error}`)
			if (this.verbose) {
				console.log(`[SSE-TOKEN-USAGE] ❌ Error emitting token usage:`, error)
			}
		}
	}

	/**
	 * Emit an error event
	 */
	async emitError(error: string | Error): Promise<void> {
		const errorMessage = error instanceof Error ? error.message : error
		const event: SSEEvent = {
			type: SSE_EVENTS.ERROR,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			error: errorMessage,
			message: `Error: ${errorMessage}`,
		}

		this.emitEvent(event)

		// ✅ NEW: Schedule stream_end event after error to ensure stream closure
		console.log(`[SSE-ERROR] 🕐 Scheduling stream_end event after error in 50ms`)
		setTimeout(() => {
			this.emitStreamEnd()
		}, 50)
	}

	/**
	 * Core event emission method
	 */
	private emitEvent(event: SSEEvent): void {
		// Enhanced logging with source tracking and content preview
		const contentPreview = event.message
			? event.message.length > 100
				? event.message.substring(0, 100) + "..."
				: event.message
			: "no message"

		console.log(`[SSE] Emitting ${event.type} for job ${this.jobId}:`, {
			eventType: event.type,
			contentPreview,
			contentLength: event.message?.length || 0,
			hasProgress: event.progress !== undefined,
			timestamp: event.timestamp,
			source: "userInterface",
		})

		const success = this.streamManager.sendEvent(this.jobId, event)
		if (!success) {
			this.logger.warn(`Failed to emit event ${event.type} for job ${this.jobId}`)
			console.log(`[SSE] ❌ Failed to send ${event.type} for job ${this.jobId}`)
			console.log(`[SSE] Available streams:`, this.streamManager.getActiveStreamIds())
			console.log(`[SSE] Stream manager active status:`, this.streamManager.hasActiveStream(this.jobId))
		} else {
			console.log(
				`[SSE] ✅ Successfully sent ${event.type} for job ${this.jobId} (${event.message?.length || 0} chars)`,
			)
		}
	}

	/**
	 * Check if the stream is still active
	 */
	isActive(): boolean {
		return this.streamManager.hasActiveStream(this.jobId)
	}

	/**
	 * Emit raw content immediately via SSE with proper verbose filtering
	 * Used specifically for immediate LLM response streaming
	 */
	async emitRawChunk(chunk: string): Promise<void> {
		// Bypass MessageBuffer filtering and emit immediately for real-time streaming
		const event: SSEEvent = {
			type: SSE_EVENTS.PROGRESS,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message: chunk,
			contentType: "content", // Assume content type for raw streaming
		}
		this.emitEvent(event)
	}

	/**
	 * Public method to emit SSE events
	 * Used by output adapters to send processed content
	 */
	async emitSSEEvent(event: SSEEvent): Promise<void> {
		this.emitEvent(event)
	}

	/**
	 * Emit stream_end event and schedule stream closure
	 * This ensures all completion events are sent before the stream is closed
	 */
	private async emitStreamEnd(): Promise<void> {
		// Check if stream is still active
		if (!this.isActive()) {
			return
		}

		const endEvent: SSEEvent = {
			type: SSE_EVENTS.STREAM_END,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message: "Stream ending",
		}

		this.emitEvent(endEvent)

		// Close stream immediately after sending the stream_end event
		// This is more reliable than using setTimeout
		this.close()
	}

	/**
	 * Close the SSE stream and cleanup questions
	 */
	close(): void {
		// Cancel any pending questions for this job
		this.questionManager.cancelJobQuestions(this.jobId, "Stream closed").catch((error) => {
			this.logger.warn(`Failed to cancel questions for job ${this.jobId}: ${error}`)
		})

		this.streamManager.closeStream(this.jobId)
	}

	/**
	 * Reset message buffer state (call between tasks)
	 */
	resetMessageBuffer(): void {
		this.messageBuffer.reset()
	}

	/**
	 * Get current message buffer state (for debugging)
	 */
	getMessageBufferState(): string {
		return this.messageBuffer.getBufferedContent()
	}

	/**
	 * Configure which content types should be shown to users
	 * Can be called to customize filtering behavior beyond the default
	 */
	private allowedContentTypes = new Set<ContentType>(["content", "tool_call", "tool_result"])

	/**
	 * Update content filtering configuration
	 */
	setContentTypeFilter(allowedTypes: ContentType[]): void {
		this.allowedContentTypes = new Set(allowedTypes)
	}

	/**
	 * Enhanced shouldEmitContentType that uses configurable filter
	 */
	private shouldEmitContentType(contentType: ContentType): boolean {
		return this.allowedContentTypes.has(contentType)
	}

	/**
	 * Enable showing thinking content (useful for debugging)
	 */
	enableThinkingContent(): void {
		this.allowedContentTypes.add("thinking")
	}

	/**
	 * Enable showing tool call content
	 */
	enableToolCallContent(): void {
		this.allowedContentTypes.add("tool_call")
	}

	/**
	 * Enable showing system content
	 */
	enableSystemContent(): void {
		this.allowedContentTypes.add("system")
	}

	/**
	 * Reset to default content filtering (only content and tool_result)
	 */
	resetContentFilter(): void {
		this.allowedContentTypes = new Set(["content", "tool_call", "tool_result"])
	}

	/**
	 * Emit tool result events for unified tool execution
	 */
	async emitToolResult(result: string): Promise<void> {
		const event: SSEEvent = {
			type: SSE_EVENTS.TOOL_USE,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message: result,
			result,
		}
		this.emitEvent(event)
	}

	/**
	 * Emit tool start events for unified tool execution
	 */
	async emitToolStart(toolName: string, params?: any): Promise<void> {
		const event: SSEEvent = {
			type: SSE_EVENTS.TOOL_USE,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			toolName,
			message: `Starting tool: ${toolName}`,
			result: params,
		}
		this.emitEvent(event)
	}

	/**
	 * Emit tool completion events for unified tool execution
	 */
	async emitToolComplete(toolName: string, success: boolean): Promise<void> {
		const event: SSEEvent = {
			type: SSE_EVENTS.TOOL_USE,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			toolName,
			message: `Tool ${toolName} ${success ? "completed successfully" : "failed"}`,
			result: { success },
		}
		this.emitEvent(event)
	}
}
