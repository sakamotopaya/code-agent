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
import { SSEEvent, SSE_EVENTS } from "./types"
import { getCLILogger } from "../../cli/services/CLILogger"
import { MessageBuffer, ProcessedMessage, ContentType } from "./MessageBuffer"

/**
 * SSE Output Adapter that implements IUserInterface to capture Task events
 * and stream them to HTTP clients in real-time via Server-Sent Events
 */
export class SSEOutputAdapter implements IUserInterface {
	private streamManager: StreamManager
	private jobId: string
	private logger = getCLILogger()
	private questionCounter = 0
	private messageBuffer: MessageBuffer
	private verbose: boolean

	constructor(streamManager: StreamManager, jobId: string, verbose: boolean = false) {
		this.streamManager = streamManager
		this.jobId = jobId
		this.verbose = verbose
		this.messageBuffer = new MessageBuffer()
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
	 * Note: In SSE streaming mode, questions are sent to client but no response is expected
	 */
	async askQuestion(question: string, options: QuestionOptions): Promise<string | undefined> {
		const questionId = `q_${this.jobId}_${++this.questionCounter}`

		const event: SSEEvent = {
			type: SSE_EVENTS.QUESTION,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message: question,
			questionId,
			...options,
		}

		this.emitEvent(event)

		// In streaming mode, we can't wait for user response
		// Return default choice or first option
		return options.defaultChoice || options.choices[0]
	}

	/**
	 * Ask the user for confirmation (yes/no)
	 */
	async askConfirmation(message: string, options?: ConfirmationOptions): Promise<boolean> {
		const questionId = `c_${this.jobId}_${++this.questionCounter}`

		const event: SSEEvent = {
			type: SSE_EVENTS.QUESTION,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message,
			questionId,
			choices: [options?.yesText || "Yes", options?.noText || "No"],
			...options,
		}

		this.emitEvent(event)

		// In streaming mode, default to true (proceed)
		return true
	}

	/**
	 * Ask the user for text input
	 */
	async askInput(prompt: string, options?: InputOptions): Promise<string | undefined> {
		const questionId = `i_${this.jobId}_${++this.questionCounter}`

		const event: SSEEvent = {
			type: SSE_EVENTS.QUESTION,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message: prompt,
			questionId,
			...options,
		}

		this.emitEvent(event)

		// Return default value or empty string
		return options?.defaultValue || ""
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
			// In non-verbose mode, use MessageBuffer to filter content
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
			// In non-verbose mode, use MessageBuffer to filter content
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
	async emitStart(message: string = "Task started", task?: string): Promise<void> {
		const event: SSEEvent = {
			type: SSE_EVENTS.START,
			jobId: this.jobId,
			timestamp: new Date().toISOString(),
			message,
			task,
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
	async emitCompletion(message: string = "Task completed", result?: any): Promise<void> {
		if (this.verbose) {
			// In verbose mode, pass through unchanged
			const event: SSEEvent = {
				type: SSE_EVENTS.COMPLETION,
				jobId: this.jobId,
				timestamp: new Date().toISOString(),
				message,
				result,
			}
			this.emitEvent(event)
		} else {
			// In non-verbose mode, use MessageBuffer to filter content
			const processedMessages = this.messageBuffer.processMessage(message)

			for (const processedMessage of processedMessages) {
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
					this.emitEvent(event)
				}
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
	 * Close the SSE stream
	 */
	close(): void {
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
	private allowedContentTypes = new Set<ContentType>(["content", "tool_result"])

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
		this.allowedContentTypes = new Set(["content", "tool_result"])
	}
}
