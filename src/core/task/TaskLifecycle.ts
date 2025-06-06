import { Anthropic } from "@anthropic-ai/sdk"
import { ClineAsk, ClineMessage, HistoryItem } from "@roo-code/types"
import { findLastIndex } from "../../shared/array"
import { ClineApiReqCancelReason, ClineApiReqInfo } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { findToolName } from "../../integrations/misc/export-markdown"
import { ApiMessage } from "../task-persistence/apiMessages"
import { TaskMessaging } from "./TaskMessaging"

/**
 * Handles task lifecycle operations like start, resume, abort
 */
export class TaskLifecycle {
	constructor(
		private taskId: string,
		private instanceId: string,
		private messaging: TaskMessaging,
		private onTaskStarted?: () => void,
		private onTaskAborted?: () => void,
		private onTaskUnpaused?: () => void,
	) {}

	async startTask(
		task?: string,
		images?: string[],
		initiateTaskLoop?: (userContent: Anthropic.Messages.ContentBlockParam[]) => Promise<void>,
	): Promise<void> {
		console.log(`[TaskLifecycle] Starting task ${this.taskId}.${this.instanceId}`)
		console.log(`[TaskLifecycle] Task description: ${task}`)
		console.log(`[TaskLifecycle] Images: ${images?.length || 0}`)
		console.log(`[TaskLifecycle] Has initiateTaskLoop: ${!!initiateTaskLoop}`)

		// Clear conversation history for new task
		this.messaging.setMessages([])
		this.messaging.setApiHistory([])

		console.log(`[TaskLifecycle] Cleared conversation history`)

		await this.messaging.say("text", task, images)

		console.log(`[TaskLifecycle] Said initial message`)

		let imageBlocks: Anthropic.ImageBlockParam[] = formatResponse.imageBlocks(images)

		console.log(`[subtasks] task ${this.taskId}.${this.instanceId} starting`)

		this.onTaskStarted?.()
		console.log(`[TaskLifecycle] Called onTaskStarted callback`)

		if (initiateTaskLoop) {
			console.log(`[TaskLifecycle] Calling initiateTaskLoop...`)
			try {
				await initiateTaskLoop([
					{
						type: "text",
						text: `<task>\n${task}\n</task>`,
					},
					...imageBlocks,
				])
				console.log(`[TaskLifecycle] initiateTaskLoop completed successfully`)
			} catch (error) {
				console.error(`[TaskLifecycle] Error in initiateTaskLoop:`, error)
				throw error
			}
		} else {
			console.log(`[TaskLifecycle] No initiateTaskLoop provided`)
		}
	}

	async resumePausedTask(lastMessage: string): Promise<void> {
		this.onTaskUnpaused?.()

		try {
			await this.messaging.say("subtask_result", lastMessage)

			await this.messaging.addToApiConversationHistory({
				role: "user",
				content: [{ type: "text", text: `[new_task completed] Result: ${lastMessage}` }],
			})
		} catch (error) {
			console.error(`Error failed to add reply from subtask into conversation of parent task, error: ${error}`)
			throw error
		}
	}

	async resumeTaskFromHistory(
		initiateTaskLoop?: (userContent: Anthropic.Messages.ContentBlockParam[]) => Promise<void>,
	): Promise<void> {
		const modifiedClineMessages = await this.messaging.getSavedClineMessages()

		// Remove any resume messages that may have been added before
		const lastRelevantMessageIndex = findLastIndex(
			modifiedClineMessages,
			(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
		)

		if (lastRelevantMessageIndex !== -1) {
			modifiedClineMessages.splice(lastRelevantMessageIndex + 1)
		}

		// Check if the last api_req_started has a cost value
		const lastApiReqStartedIndex = findLastIndex(
			modifiedClineMessages,
			(m) => m.type === "say" && m.say === "api_req_started",
		)

		if (lastApiReqStartedIndex !== -1) {
			const lastApiReqStarted = modifiedClineMessages[lastApiReqStartedIndex]
			const { cost, cancelReason }: ClineApiReqInfo = JSON.parse(lastApiReqStarted.text || "{}")
			if (cost === undefined && cancelReason === undefined) {
				modifiedClineMessages.splice(lastApiReqStartedIndex, 1)
			}
		}

		await this.messaging.overwriteClineMessages(modifiedClineMessages)
		this.messaging.setMessages(await this.messaging.getSavedClineMessages())

		// Load API conversation history
		this.messaging.setApiHistory(await this.messaging.getSavedApiConversationHistory())

		const lastClineMessage = this.messaging.messages
			.slice()
			.reverse()
			.find((m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"))

		let askType: ClineAsk
		if (lastClineMessage?.ask === "completion_result") {
			askType = "resume_completed_task"
		} else {
			askType = "resume_task"
		}

		const { response, text, images } = await this.messaging.ask(askType)
		let responseText: string | undefined
		let responseImages: string[] | undefined
		if (response === "messageResponse") {
			await this.messaging.say("user_feedback", text, images)
			responseText = text
			responseImages = images
		}

		// Process API conversation history for resumption
		let existingApiConversationHistory: ApiMessage[] = await this.messaging.getSavedApiConversationHistory()

		// Convert tool use blocks to text blocks for v2.0 compatibility
		const conversationWithoutToolBlocks = existingApiConversationHistory.map((message) => {
			if (Array.isArray(message.content)) {
				const newContent = message.content.map((block) => {
					if (block.type === "tool_use") {
						const inputAsXml = Object.entries(block.input as Record<string, string>)
							.map(([key, value]) => `<${key}>\n${value}\n</${key}>`)
							.join("\n")
						return {
							type: "text",
							text: `<${block.name}>\n${inputAsXml}\n</${block.name}>`,
						} as Anthropic.Messages.TextBlockParam
					} else if (block.type === "tool_result") {
						const contentAsTextBlocks = Array.isArray(block.content)
							? block.content.filter((item) => item.type === "text")
							: [{ type: "text", text: block.content }]
						const textContent = contentAsTextBlocks.map((item) => item.text).join("\n\n")
						const toolName = findToolName(block.tool_use_id, existingApiConversationHistory)
						return {
							type: "text",
							text: `[${toolName} Result]\n\n${textContent}`,
						} as Anthropic.Messages.TextBlockParam
					}
					return block
				})
				return { ...message, content: newContent }
			}
			return message
		})
		existingApiConversationHistory = conversationWithoutToolBlocks

		// Handle incomplete tool responses
		let modifiedOldUserContent: Anthropic.Messages.ContentBlockParam[]
		let modifiedApiConversationHistory: ApiMessage[]

		if (existingApiConversationHistory.length > 0) {
			const lastMessage = existingApiConversationHistory[existingApiConversationHistory.length - 1]

			if (lastMessage.role === "assistant") {
				const content = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]
				const hasToolUse = content.some((block) => block.type === "tool_use")

				if (hasToolUse) {
					const toolUseBlocks = content.filter(
						(block) => block.type === "tool_use",
					) as Anthropic.Messages.ToolUseBlock[]
					const toolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => ({
						type: "tool_result",
						tool_use_id: block.id,
						content: "Task was interrupted before this tool call could be completed.",
					}))
					modifiedApiConversationHistory = [...existingApiConversationHistory]
					modifiedOldUserContent = [...toolResponses]
				} else {
					modifiedApiConversationHistory = [...existingApiConversationHistory]
					modifiedOldUserContent = []
				}
			} else if (lastMessage.role === "user") {
				const previousAssistantMessage: ApiMessage | undefined =
					existingApiConversationHistory[existingApiConversationHistory.length - 2]

				const existingUserContent: Anthropic.Messages.ContentBlockParam[] = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]

				if (previousAssistantMessage && previousAssistantMessage.role === "assistant") {
					const assistantContent = Array.isArray(previousAssistantMessage.content)
						? previousAssistantMessage.content
						: [{ type: "text", text: previousAssistantMessage.content }]

					const toolUseBlocks = assistantContent.filter(
						(block) => block.type === "tool_use",
					) as Anthropic.Messages.ToolUseBlock[]

					if (toolUseBlocks.length > 0) {
						const existingToolResults = existingUserContent.filter(
							(block) => block.type === "tool_result",
						) as Anthropic.ToolResultBlockParam[]

						const missingToolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks
							.filter(
								(toolUse) => !existingToolResults.some((result) => result.tool_use_id === toolUse.id),
							)
							.map((toolUse) => ({
								type: "tool_result",
								tool_use_id: toolUse.id,
								content: "Task was interrupted before this tool call could be completed.",
							}))

						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
						modifiedOldUserContent = [...existingUserContent, ...missingToolResponses]
					} else {
						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
						modifiedOldUserContent = [...existingUserContent]
					}
				} else {
					modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
					modifiedOldUserContent = [...existingUserContent]
				}
			} else {
				throw new Error("Unexpected: Last message is not a user or assistant message")
			}
		} else {
			throw new Error("Unexpected: No existing API conversation history")
		}

		let newUserContent: Anthropic.Messages.ContentBlockParam[] = [...modifiedOldUserContent]

		// Calculate time ago text
		const agoText = this.calculateAgoText(lastClineMessage?.ts)

		// Remove previous task resumption messages
		const lastTaskResumptionIndex = newUserContent.findIndex(
			(x) => x.type === "text" && x.text.startsWith("[TASK RESUMPTION]"),
		)
		if (lastTaskResumptionIndex !== -1) {
			newUserContent.splice(lastTaskResumptionIndex, newUserContent.length - lastTaskResumptionIndex)
		}

		const wasRecent = lastClineMessage?.ts && Date.now() - lastClineMessage.ts < 30_000

		newUserContent.push({
			type: "text",
			text:
				`[TASK RESUMPTION] This task was interrupted ${agoText}. It may or may not be complete, so please reassess the task context. Be aware that the project state may have changed since then. If the task has not been completed, retry the last step before interruption and proceed with completing the task.\n\nNote: If you previously attempted a tool use that the user did not provide a result for, you should assume the tool use was not successful and assess whether you should retry. If the last tool was a browser_action, the browser has been closed and you must launch a new browser if needed.${
					wasRecent
						? "\n\nIMPORTANT: If the last tool use was a write_to_file that was interrupted, the file was reverted back to its original state before the interrupted edit, and you do NOT need to re-read the file as you already have its up-to-date contents."
						: ""
				}` +
				(responseText
					? `\n\nNew instructions for task continuation:\n<user_message>\n${responseText}\n</user_message>`
					: ""),
		})

		if (responseImages && responseImages.length > 0) {
			newUserContent.push(...formatResponse.imageBlocks(responseImages))
		}

		await this.messaging.overwriteApiConversationHistory(modifiedApiConversationHistory)

		console.log(`[subtasks] task ${this.taskId}.${this.instanceId} resuming from history item`)

		if (initiateTaskLoop) {
			await initiateTaskLoop(newUserContent)
		}
	}

	private calculateAgoText(timestamp?: number): string {
		const now = Date.now()
		const diff = now - (timestamp ?? now)
		const minutes = Math.floor(diff / 60000)
		const hours = Math.floor(minutes / 60)
		const days = Math.floor(hours / 24)

		if (days > 0) {
			return `${days} day${days > 1 ? "s" : ""} ago`
		}
		if (hours > 0) {
			return `${hours} hour${hours > 1 ? "s" : ""} ago`
		}
		if (minutes > 0) {
			return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
		}
		return "just now"
	}

	async abortTask(): Promise<void> {
		console.log(`[subtasks] aborting task ${this.taskId}.${this.instanceId}`)
		this.onTaskAborted?.()
	}
}
