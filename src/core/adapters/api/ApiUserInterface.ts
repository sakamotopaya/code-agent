import {
	IUserInterface,
	MessageOptions,
	QuestionOptions,
	ConfirmationOptions,
	InputOptions,
	WebviewContent,
	WebviewOptions,
} from "../../interfaces"
import type { LogLevel } from "../../interfaces"

/**
 * Options for API User Interface
 */
export interface ApiUserInterfaceOptions {
	verbose?: boolean
	debug?: boolean
}

/**
 * Message types for API communication
 */
export interface ApiMessage {
	id: string
	type: "information" | "warning" | "error" | "question" | "progress" | "log" | "webview"
	message: string
	timestamp: Date
	level?: LogLevel
	progress?: number
	options?: any
	data?: any
}

/**
 * Event emitter for real-time communication
 */
export type MessageListener = (message: ApiMessage) => void

/**
 * API implementation of the IUserInterface
 * Provides HTTP/SSE-based user interactions for API clients
 */
export class ApiUserInterface implements IUserInterface {
	private options: ApiUserInterfaceOptions
	private messages: ApiMessage[] = []
	private listeners: MessageListener[] = []
	private messageIdCounter = 0
	private currentJobId?: string

	constructor(options: ApiUserInterfaceOptions = {}) {
		this.options = {
			verbose: false,
			debug: false,
			...options,
		}
	}

	/**
	 * Set the current job ID for message association
	 */
	setJobId(jobId: string): void {
		this.currentJobId = jobId
	}

	/**
	 * Get the current job ID
	 */
	getJobId(): string | undefined {
		return this.currentJobId
	}

	/**
	 * Add a message listener for real-time updates
	 */
	addMessageListener(listener: MessageListener): void {
		this.listeners.push(listener)
	}

	/**
	 * Remove a message listener
	 */
	removeMessageListener(listener: MessageListener): void {
		const index = this.listeners.indexOf(listener)
		if (index > -1) {
			this.listeners.splice(index, 1)
		}
	}

	/**
	 * Get all messages for the current or specified job
	 */
	getMessages(jobId?: string): ApiMessage[] {
		const targetJobId = jobId || this.currentJobId
		if (!targetJobId) {
			return this.messages
		}
		// For now, return all messages. In a full implementation,
		// we'd filter by job ID
		return this.messages
	}

	/**
	 * Clear messages for the current or specified job
	 */
	clearMessages(jobId?: string): void {
		const targetJobId = jobId || this.currentJobId
		if (!targetJobId) {
			this.messages = []
		}
		// For now, clear all messages. In a full implementation,
		// we'd filter by job ID
		this.messages = []
	}

	private createMessage(type: ApiMessage["type"], message: string, additionalData?: Partial<ApiMessage>): ApiMessage {
		const apiMessage: ApiMessage = {
			id: `msg_${++this.messageIdCounter}`,
			type,
			message,
			timestamp: new Date(),
			...additionalData,
		}

		this.messages.push(apiMessage)

		// Notify all listeners
		this.listeners.forEach((listener) => {
			try {
				listener(apiMessage)
			} catch (error) {
				if (this.options.debug) {
					console.error("Error in message listener:", error)
				}
			}
		})

		if (this.options.verbose) {
			console.log(`[API UI] ${type.toUpperCase()}: ${message}`)
		}

		return apiMessage
	}

	async showInformation(message: string, options?: MessageOptions): Promise<void> {
		this.createMessage("information", message, { options })
	}

	async showWarning(message: string, options?: MessageOptions): Promise<void> {
		this.createMessage("warning", message, { options })
	}

	async showError(message: string, options?: MessageOptions): Promise<void> {
		this.createMessage("error", message, { options })
	}

	async askQuestion(question: string, options: QuestionOptions): Promise<string | undefined> {
		// In API mode, questions need to be handled asynchronously
		// The client will need to respond via a separate API call
		const message = this.createMessage("question", question, { options })

		// For now, we'll throw an error as questions require interactive handling
		// In a full implementation, this would return a promise that resolves
		// when the client responds via the API
		throw new Error(`Question requires client interaction: ${question} (Message ID: ${message.id})`)
	}

	async askConfirmation(message: string, options?: ConfirmationOptions): Promise<boolean> {
		// Similar to askQuestion, confirmations need async handling
		const apiMessage = this.createMessage("question", message, {
			options: { ...options, type: "confirmation" },
		})

		throw new Error(`Confirmation requires client interaction: ${message} (Message ID: ${apiMessage.id})`)
	}

	async askInput(prompt: string, options?: InputOptions): Promise<string | undefined> {
		// Similar to askQuestion, input prompts need async handling
		const message = this.createMessage("question", prompt, {
			options: { ...options, type: "input" },
		})

		throw new Error(`Input requires client interaction: ${prompt} (Message ID: ${message.id})`)
	}

	async showProgress(message: string, progress?: number): Promise<void> {
		this.createMessage("progress", message, { progress })
	}

	async clearProgress(): Promise<void> {
		// Remove the last progress message or add a "complete" progress message
		this.createMessage("progress", "Progress complete", { progress: 100 })
	}

	async log(message: string, level?: LogLevel): Promise<void> {
		this.createMessage("log", message, { level })
	}

	async showWebview(content: WebviewContent, options?: WebviewOptions): Promise<void> {
		this.createMessage("webview", "Webview content available", {
			data: content,
			options,
		})
	}

	async sendWebviewMessage(message: any): Promise<void> {
		// In API mode, webview messages are handled differently
		// They would typically be sent via SSE or polling
		this.createMessage("log", `Webview message: ${JSON.stringify(message)}`, {
			level: "debug" as LogLevel,
			data: { webviewMessage: message },
		})
	}

	onWebviewMessage(callback: (message: any) => void): void {
		// In API mode, webview message handling would be implemented
		// via HTTP endpoints or WebSocket connections
		if (this.options.debug) {
			this.createMessage("log", "Webview message listener registered", {
				level: "debug" as LogLevel,
			})
		}
	}

	/**
	 * API-specific method to get the last message of a specific type
	 */
	getLastMessage(type?: ApiMessage["type"]): ApiMessage | undefined {
		if (!type) {
			return this.messages[this.messages.length - 1]
		}

		for (let i = this.messages.length - 1; i >= 0; i--) {
			if (this.messages[i].type === type) {
				return this.messages[i]
			}
		}

		return undefined
	}

	/**
	 * API-specific method to get messages by type
	 */
	getMessagesByType(type: ApiMessage["type"]): ApiMessage[] {
		return this.messages.filter((msg) => msg.type === type)
	}

	/**
	 * API-specific method to get messages since a timestamp
	 */
	getMessagesSince(timestamp: Date): ApiMessage[] {
		return this.messages.filter((msg) => msg.timestamp > timestamp)
	}

	/**
	 * API-specific method to get messages by ID
	 */
	getMessageById(id: string): ApiMessage | undefined {
		return this.messages.find((msg) => msg.id === id)
	}
}
