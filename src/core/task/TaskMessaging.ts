import { Anthropic } from "@anthropic-ai/sdk"
import {
	ClineMessage,
	ClineAsk,
	ClineSay,
	ToolProgressStatus,
	ContextCondense,
	TelemetryEventName,
} from "@roo-code/types"
import { ClineAskResponse } from "../../shared/WebviewMessage"
import { ClineProvider } from "../webview/ClineProvider"
import { readTaskMessages, saveTaskMessages, taskMetadata } from "../task-persistence"
import { ApiMessage } from "../task-persistence/apiMessages"
import { readApiMessages, saveApiMessages } from "../task-persistence"
import { CloudService } from "@roo-code/cloud"
import pWaitFor from "p-wait-for"

/**
 * Handles all messaging functionality for the Task class
 */
export class TaskMessaging {
	private clineMessages: ClineMessage[] = []
	private apiConversationHistory: ApiMessage[] = []
	private askResponse?: ClineAskResponse
	private askResponseText?: string
	private askResponseImages?: string[]
	public lastMessageTs?: number

	constructor(
		private taskId: string,
		private instanceId: string,
		private taskNumber: number,
		private globalStoragePath: string,
		private workspacePath: string,
		private providerRef?: WeakRef<ClineProvider>,
	) {}

	// API Messages
	async getSavedApiConversationHistory(): Promise<ApiMessage[]> {
		return readApiMessages({ taskId: this.taskId, globalStoragePath: this.globalStoragePath })
	}

	async addToApiConversationHistory(message: Anthropic.MessageParam) {
		const messageWithTs = { ...message, ts: Date.now() }
		this.apiConversationHistory.push(messageWithTs)
		await this.saveApiConversationHistory()
	}

	async overwriteApiConversationHistory(newHistory: ApiMessage[]) {
		this.apiConversationHistory = newHistory
		await this.saveApiConversationHistory()
	}

	private async saveApiConversationHistory() {
		try {
			await saveApiMessages({
				messages: this.apiConversationHistory,
				taskId: this.taskId,
				globalStoragePath: this.globalStoragePath,
			})
		} catch (error) {
			console.error("Failed to save API conversation history:", error)
		}
	}

	// Cline Messages
	async getSavedClineMessages(): Promise<ClineMessage[]> {
		return readTaskMessages({ taskId: this.taskId, globalStoragePath: this.globalStoragePath })
	}

	async addToClineMessages(
		message: ClineMessage,
		onMessage?: (action: "created" | "updated", message: ClineMessage) => void,
	) {
		this.clineMessages.push(message)
		const provider = this.providerRef?.deref()
		await provider?.postStateToWebview()
		onMessage?.("created", message)
		await this.saveClineMessages()

		const shouldCaptureMessage = message.partial !== true && CloudService.isEnabled()

		if (shouldCaptureMessage) {
			CloudService.instance.captureEvent({
				event: TelemetryEventName.TASK_MESSAGE,
				properties: { taskId: this.taskId, message },
			})
		}
	}

	async overwriteClineMessages(newMessages: ClineMessage[]) {
		this.clineMessages = newMessages
		await this.saveClineMessages()
	}

	async updateClineMessage(
		partialMessage: ClineMessage,
		onMessage?: (action: "created" | "updated", message: ClineMessage) => void,
	) {
		const provider = this.providerRef?.deref()
		await provider?.postMessageToWebview({ type: "partialMessage", partialMessage })
		onMessage?.("updated", partialMessage)

		const shouldCaptureMessage = partialMessage.partial !== true && CloudService.isEnabled()

		if (shouldCaptureMessage) {
			CloudService.instance.captureEvent({
				event: TelemetryEventName.TASK_MESSAGE,
				properties: { taskId: this.taskId, message: partialMessage },
			})
		}
	}

	private async saveClineMessages() {
		try {
			await saveTaskMessages({
				messages: this.clineMessages,
				taskId: this.taskId,
				globalStoragePath: this.globalStoragePath,
			})

			const { historyItem, tokenUsage } = await taskMetadata({
				messages: this.clineMessages,
				taskId: this.taskId,
				taskNumber: this.taskNumber,
				globalStoragePath: this.globalStoragePath,
				workspace: this.workspacePath,
			})

			// Emit token usage update
			// onTokenUsageUpdate?.(this.taskId, tokenUsage)

			await this.providerRef?.deref()?.updateTaskHistory(historyItem)
		} catch (error) {
			console.error("Failed to save Roo messages:", error)
		}
	}

	async ask(
		type: ClineAsk,
		text?: string,
		partial?: boolean,
		progressStatus?: ToolProgressStatus,
		abort?: boolean,
		onMessage?: (action: "created" | "updated", message: ClineMessage) => void,
	): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
		if (abort) {
			throw new Error(`[RooCode#ask] task ${this.taskId}.${this.instanceId} aborted`)
		}

		let askTs: number

		if (partial !== undefined) {
			const lastMessage = this.clineMessages.at(-1)

			const isUpdatingPreviousPartial =
				lastMessage && lastMessage.partial && lastMessage.type === "ask" && lastMessage.ask === type

			if (partial) {
				if (isUpdatingPreviousPartial) {
					lastMessage.text = text
					lastMessage.partial = partial
					lastMessage.progressStatus = progressStatus
					this.updateClineMessage(lastMessage, onMessage)
					throw new Error("Current ask promise was ignored (#1)")
				} else {
					askTs = Date.now()
					this.lastMessageTs = askTs
					await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text, partial }, onMessage)
					throw new Error("Current ask promise was ignored (#2)")
				}
			} else {
				if (isUpdatingPreviousPartial) {
					this.askResponse = undefined
					this.askResponseText = undefined
					this.askResponseImages = undefined

					askTs = lastMessage.ts
					this.lastMessageTs = askTs
					lastMessage.text = text
					lastMessage.partial = false
					lastMessage.progressStatus = progressStatus
					await this.saveClineMessages()
					this.updateClineMessage(lastMessage, onMessage)
				} else {
					this.askResponse = undefined
					this.askResponseText = undefined
					this.askResponseImages = undefined
					askTs = Date.now()
					this.lastMessageTs = askTs
					await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text }, onMessage)
				}
			}
		} else {
			this.askResponse = undefined
			this.askResponseText = undefined
			this.askResponseImages = undefined
			askTs = Date.now()
			this.lastMessageTs = askTs
			await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text }, onMessage)
		}

		await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 })

		if (this.lastMessageTs !== askTs) {
			throw new Error("Current ask promise was ignored")
		}

		const result = { response: this.askResponse!, text: this.askResponseText, images: this.askResponseImages }
		this.askResponse = undefined
		this.askResponseText = undefined
		this.askResponseImages = undefined
		return result
	}

	async say(
		type: ClineSay,
		text?: string,
		images?: string[],
		partial?: boolean,
		checkpoint?: Record<string, unknown>,
		progressStatus?: ToolProgressStatus,
		options: { isNonInteractive?: boolean } = {},
		contextCondense?: ContextCondense,
		abort?: boolean,
		onMessage?: (action: "created" | "updated", message: ClineMessage) => void,
	): Promise<undefined> {
		if (abort) {
			throw new Error(`[RooCode#say] task ${this.taskId}.${this.instanceId} aborted`)
		}

		if (partial !== undefined) {
			const lastMessage = this.clineMessages.at(-1)

			const isUpdatingPreviousPartial =
				lastMessage && lastMessage.partial && lastMessage.type === "say" && lastMessage.say === type

			if (partial) {
				if (isUpdatingPreviousPartial) {
					lastMessage.text = text
					lastMessage.images = images
					lastMessage.partial = partial
					lastMessage.progressStatus = progressStatus
					this.updateClineMessage(lastMessage, onMessage)
				} else {
					const sayTs = Date.now()

					if (!options.isNonInteractive) {
						this.lastMessageTs = sayTs
					}

					await this.addToClineMessages(
						{
							ts: sayTs,
							type: "say",
							say: type,
							text,
							images,
							partial,
							contextCondense,
						},
						onMessage,
					)
				}
			} else {
				if (isUpdatingPreviousPartial) {
					if (!options.isNonInteractive) {
						this.lastMessageTs = lastMessage.ts
					}

					lastMessage.text = text
					lastMessage.images = images
					lastMessage.partial = false
					lastMessage.progressStatus = progressStatus

					await this.saveClineMessages()
					this.updateClineMessage(lastMessage, onMessage)
				} else {
					const sayTs = Date.now()

					if (!options.isNonInteractive) {
						this.lastMessageTs = sayTs
					}

					await this.addToClineMessages(
						{ ts: sayTs, type: "say", say: type, text, images, contextCondense },
						onMessage,
					)
				}
			}
		} else {
			const sayTs = Date.now()

			if (!options.isNonInteractive) {
				this.lastMessageTs = sayTs
			}

			await this.addToClineMessages(
				{
					ts: sayTs,
					type: "say",
					say: type,
					text,
					images,
					checkpoint,
					contextCondense,
				},
				onMessage,
			)
		}
	}

	handleWebviewAskResponse(askResponse: ClineAskResponse, text?: string, images?: string[]) {
		this.askResponse = askResponse
		this.askResponseText = text
		this.askResponseImages = images
	}

	// Getters and Setters
	get messages() {
		return this.clineMessages
	}

	set messages(value: ClineMessage[]) {
		this.clineMessages = value
	}

	get apiHistory() {
		return this.apiConversationHistory
	}

	set apiHistory(value: ApiMessage[]) {
		this.apiConversationHistory = value
	}

	setMessages(messages: ClineMessage[]) {
		this.clineMessages = messages
	}

	setApiHistory(history: ApiMessage[]) {
		this.apiConversationHistory = history
	}
}
