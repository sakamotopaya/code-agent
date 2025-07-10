import * as path from "path"
import * as fs from "fs/promises"
import { HistoryItem } from "@roo-code/types"
import { GlobalFileNames } from "../globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"
import { fileExistsAtPath } from "../../utils/fs"
import { ApiMessage } from "../../core/task-persistence/apiMessages"
import { ClineMessage } from "@roo-code/types"

export interface TaskData {
	historyItem: HistoryItem
	apiConversationHistory: ApiMessage[]
	uiMessages: ClineMessage[]
	taskDir: string
	originContext: "extension" | "cli" | "api"
	mode: string
	workspace?: string
}

export class UnifiedTaskService {
	constructor(private globalStoragePath: string) {}

	async findTask(taskId: string): Promise<TaskData | null> {
		try {
			const taskDir = await getTaskDirectoryPath(this.globalStoragePath, taskId)
			return await this.loadTaskFromDirectory(taskDir, taskId)
		} catch (error) {
			console.error(`Failed to find task ${taskId}:`, error)
			return null
		}
	}

	async listAllTasks(): Promise<HistoryItem[]> {
		try {
			const tasksDir = path.join(this.globalStoragePath, "tasks")
			const taskDirs = await fs.readdir(tasksDir)

			const tasks: HistoryItem[] = []
			for (const taskId of taskDirs) {
				const taskData = await this.findTask(taskId)
				if (taskData) {
					tasks.push(taskData.historyItem)
				}
			}

			return tasks.sort((a, b) => b.ts - a.ts) // Sort by timestamp, newest first
		} catch (error) {
			console.error("Failed to list tasks:", error)
			return []
		}
	}

	private async loadTaskFromDirectory(taskDir: string, taskId: string): Promise<TaskData | null> {
		try {
			const apiHistoryPath = path.join(taskDir, GlobalFileNames.apiConversationHistory)
			const uiMessagesPath = path.join(taskDir, GlobalFileNames.uiMessages)

			if (!(await fileExistsAtPath(apiHistoryPath)) || !(await fileExistsAtPath(uiMessagesPath))) {
				return null
			}

			const [apiConversationHistory, uiMessages] = await Promise.all([
				fs.readFile(apiHistoryPath, "utf8").then(JSON.parse),
				fs.readFile(uiMessagesPath, "utf8").then(JSON.parse),
			])

			// Create HistoryItem from stored data
			const historyItem = await this.createHistoryItemFromStorage(taskId, apiConversationHistory, uiMessages)

			// Detect origin context and mode
			const originContext = this.detectOriginContext(uiMessages)
			const mode = this.extractMode(uiMessages) || "code"
			const workspace = this.extractWorkspace(uiMessages)

			return {
				historyItem,
				apiConversationHistory,
				uiMessages,
				taskDir,
				originContext,
				mode,
				workspace,
			}
		} catch (error) {
			console.error(`Failed to load task from directory ${taskDir}:`, error)
			return null
		}
	}

	private async createHistoryItemFromStorage(
		taskId: string,
		apiHistory: ApiMessage[],
		uiMessages: ClineMessage[],
	): Promise<HistoryItem> {
		// Extract task information from messages
		const task = this.extractTaskFromMessages(apiHistory, uiMessages)
		const { tokensIn, tokensOut, totalCost } = this.calculateTokenUsage(apiHistory, uiMessages)
		const timestamp = uiMessages[0]?.ts || Date.now()

		return {
			id: taskId,
			number: 1, // This could be enhanced to track actual task numbers
			ts: timestamp,
			task,
			tokensIn,
			tokensOut,
			cacheWrites: 0,
			cacheReads: 0,
			totalCost,
			workspace: this.extractWorkspace(uiMessages),
		}
	}

	private extractTaskFromMessages(apiHistory: ApiMessage[], uiMessages: ClineMessage[]): string {
		// Look for the first user message in API history
		const firstUserMessage = apiHistory.find((msg) => msg.role === "user")
		if (firstUserMessage && typeof firstUserMessage.content === "string") {
			return firstUserMessage.content.substring(0, 100) // Truncate for display
		}

		// If API history has complex content structure
		if (firstUserMessage && Array.isArray(firstUserMessage.content)) {
			const textContent = firstUserMessage.content.find((c) => c.type === "text")
			if (textContent && "text" in textContent) {
				return textContent.text.substring(0, 100)
			}
		}

		// Fallback to UI messages
		const taskMessage = uiMessages.find((m) => m.type === "say" && m.say === "text")
		return taskMessage?.text?.substring(0, 100) || "Unknown task"
	}

	private calculateTokenUsage(
		apiHistory: ApiMessage[],
		uiMessages: ClineMessage[],
	): { tokensIn: number; tokensOut: number; totalCost: number } {
		let tokensIn = 0
		let tokensOut = 0
		let totalCost = 0

		// Extract token usage from UI messages (api_req_started messages contain token info)
		for (const message of uiMessages) {
			if (message.type === "say" && message.say === "api_req_started" && message.text) {
				try {
					// Look for token information in the message text
					const requestMatch = message.text.match(/"tokensIn":(\d+),"tokensOut":(\d+).*?"cost":([\d.]+)/)
					if (requestMatch) {
						const messageTokensIn = parseInt(requestMatch[1])
						const messageTokensOut = parseInt(requestMatch[2])
						const messageCost = parseFloat(requestMatch[3])

						tokensIn += messageTokensIn
						tokensOut += messageTokensOut
						totalCost += messageCost
					}
				} catch (error) {
					// Ignore parsing errors and continue
				}
			}
		}

		return { tokensIn, tokensOut, totalCost }
	}

	private detectOriginContext(uiMessages: ClineMessage[]): "extension" | "cli" | "api" {
		// Look for context clues in messages
		const messageText = JSON.stringify(uiMessages)

		if (messageText.includes("vscode") || messageText.includes("webview")) {
			return "extension"
		} else if (messageText.includes("cli") || messageText.includes("terminal")) {
			return "cli"
		} else {
			return "api"
		}
	}

	private extractMode(uiMessages: ClineMessage[]): string | null {
		// Look for mode information in messages
		const modeMessage = uiMessages.find((m) => m.type === "say" && m.say === "text" && m.text?.includes("mode:"))

		if (modeMessage?.text) {
			const modeMatch = modeMessage.text.match(/mode:\s*(\w+)/)
			return modeMatch?.[1] || null
		}

		return null
	}

	private extractWorkspace(uiMessages: ClineMessage[]): string | undefined {
		// Look for workspace information in messages
		const workspaceMessage = uiMessages.find(
			(m) => m.type === "say" && m.say === "text" && m.text?.includes("workspace"),
		)

		if (workspaceMessage?.text) {
			const workspaceMatch = workspaceMessage.text.match(/workspace:\s*(.+)/)
			return workspaceMatch?.[1] || undefined
		}

		return undefined
	}
}
