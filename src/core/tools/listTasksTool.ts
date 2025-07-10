import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { getStorageBasePath } from "../../utils/storage"
import * as path from "path"
import * as fs from "fs/promises"

/**
 * Task information interface
 */
interface TaskInfo {
	id: string
	createdAt: Date
	lastActivity: Date
	status: "active" | "completed" | "failed" | "abandoned" | "unknown"
	title: string
	mode: {
		current?: string
		name?: string
	}
	tokenUsage: {
		total: number
		cost: number
	}
	messageCount: number
	duration?: number
	workspaceDir?: string
}

/**
 * Implements the list_tasks tool.
 *
 * @param cline - The instance of Task that is executing this tool.
 * @param block - The block of assistant message content that specifies the
 *   parameters for this tool.
 * @param askApproval - A function that asks the user for approval to show a
 *   message.
 * @param handleError - A function that handles an error that occurred while
 *   executing this tool.
 * @param pushToolResult - A function that pushes the result of this tool to the
 *   conversation.
 * @param removeClosingTag - A function that removes a closing tag from a string.
 */
export async function listTasksTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const filter: string | undefined = block.params.filter

	const sharedMessageProps: ClineSayTool = {
		tool: "listTasks",
		path: getReadablePath(cline.cwd, "tasks"),
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			cline.consecutiveMistakeCount = 0

			// Get tasks from storage
			const tasks = await getTasksFromStorage(cline.getGlobalStoragePath())

			// Apply filtering if specified
			const filteredTasks = filter
				? tasks.filter(
						(task) =>
							task.id.toLowerCase().includes(filter.toLowerCase()) ||
							task.title.toLowerCase().includes(filter.toLowerCase()) ||
							task.mode.current?.toLowerCase().includes(filter.toLowerCase()) ||
							task.mode.name?.toLowerCase().includes(filter.toLowerCase()) ||
							task.status.toLowerCase().includes(filter.toLowerCase()),
					)
				: tasks

			const result = formatTasksOutput(filteredTasks, filter)

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: result } satisfies ClineSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(result)
		}
	} catch (error) {
		await handleError("listing tasks", error)
	}
}

/**
 * Get tasks from storage directory
 */
async function getTasksFromStorage(globalStoragePath: string): Promise<TaskInfo[]> {
	try {
		const basePath = await getStorageBasePath(globalStoragePath)
		const tasksDir = path.join(basePath, "tasks")

		// Check if tasks directory exists
		try {
			await fs.access(tasksDir)
		} catch {
			return [] // No tasks directory, return empty array
		}

		const taskDirs = await fs.readdir(tasksDir)
		const tasks: TaskInfo[] = []

		for (const taskId of taskDirs) {
			// Validate UUID format
			if (!isValidUUID(taskId)) {
				continue
			}

			const taskDir = path.join(tasksDir, taskId)
			try {
				const taskInfo = await extractTaskMetadata(taskDir, taskId)
				if (taskInfo) {
					tasks.push(taskInfo)
				}
			} catch (error) {
				console.warn(`Failed to extract metadata for task ${taskId}:`, error)
				// Continue processing other tasks
			}
		}

		// Sort by creation date (newest first)
		tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

		return tasks
	} catch (error) {
		console.error("Failed to get tasks from storage:", error)
		return []
	}
}

/**
 * Validate UUID format
 */
function isValidUUID(str: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
	return uuidRegex.test(str)
}

/**
 * Extract task metadata from task directory
 */
async function extractTaskMetadata(taskDir: string, taskId: string): Promise<TaskInfo | null> {
	const uiMessagesPath = path.join(taskDir, "ui_messages.json")
	const apiHistoryPath = path.join(taskDir, "api_conversation_history.json")

	try {
		// Read both files
		const [uiMessagesData, apiHistoryData] = await Promise.all([
			readJSONFile(uiMessagesPath),
			readJSONFile(apiHistoryPath),
		])

		if (!uiMessagesData || !apiHistoryData) {
			return null
		}

		// Extract basic information
		const createdAt = extractCreationDate(uiMessagesData)
		const lastActivity = extractLastActivity(uiMessagesData, apiHistoryData)
		const title = extractTaskTitle(apiHistoryData)
		const mode = extractModeInfo(apiHistoryData)
		const tokenUsage = calculateTokenUsage(apiHistoryData)
		const messageCount = apiHistoryData.length || 0
		const status = determineTaskStatus(uiMessagesData, apiHistoryData)
		const duration = calculateDuration(createdAt, lastActivity, status)
		const workspaceDir = extractWorkspaceDir(apiHistoryData)

		return {
			id: taskId,
			createdAt,
			lastActivity,
			status,
			title,
			mode,
			tokenUsage,
			messageCount,
			duration,
			workspaceDir,
		}
	} catch (error) {
		console.warn(`Failed to extract metadata for task ${taskId}:`, error)
		return null
	}
}

/**
 * Read JSON file safely
 */
async function readJSONFile(filePath: string): Promise<any[] | null> {
	try {
		const data = await fs.readFile(filePath, "utf-8")
		return JSON.parse(data)
	} catch (error) {
		return null
	}
}

/**
 * Extract creation date from UI messages
 */
function extractCreationDate(uiMessages: any[]): Date {
	if (uiMessages.length > 0 && uiMessages[0].ts) {
		return new Date(uiMessages[0].ts)
	}
	return new Date() // Fallback to current date
}

/**
 * Extract last activity date
 */
function extractLastActivity(uiMessages: any[], apiHistory: any[]): Date {
	const lastUI = uiMessages.length > 0 ? uiMessages[uiMessages.length - 1].ts : 0
	const lastAPI = apiHistory.length > 0 ? apiHistory[apiHistory.length - 1].ts : 0

	const lastTimestamp = Math.max(lastUI, lastAPI)
	return lastTimestamp ? new Date(lastTimestamp) : new Date()
}

/**
 * Extract task title from first user message
 */
function extractTaskTitle(apiHistory: any[]): string {
	// Find first user message
	const firstUserMessage = apiHistory.find((msg) => msg.role === "user")
	if (firstUserMessage && firstUserMessage.content) {
		const content = Array.isArray(firstUserMessage.content)
			? firstUserMessage.content[0]?.text || ""
			: firstUserMessage.content

		// Extract task content, removing environment details
		const taskMatch = content.match(/<task>(.*?)<\/task>/s)
		if (taskMatch) {
			return truncateText(taskMatch[1].trim(), 100)
		}

		return truncateText(content.trim(), 100)
	}
	return "Untitled Task"
}

/**
 * Extract mode information from conversation history
 */
function extractModeInfo(apiHistory: any[]): { current?: string; name?: string } {
	// Look for mode information in environment details (search from most recent)
	for (let i = apiHistory.length - 1; i >= 0; i--) {
		const message = apiHistory[i]
		if (message.content) {
			const content = Array.isArray(message.content)
				? message.content.map((c: any) => c.text).join(" ")
				: message.content

			const modeMatch = content.match(/<slug>(.*?)<\/slug>[\s\S]*?<name>(.*?)<\/name>/)
			if (modeMatch) {
				return {
					current: modeMatch[1],
					name: modeMatch[2],
				}
			}
		}
	}
	return {}
}

/**
 * Calculate token usage and cost from API history
 */
function calculateTokenUsage(apiHistory: any[]): { total: number; cost: number } {
	let totalTokens = 0
	let totalCost = 0

	for (const message of apiHistory) {
		if (message.role === "user" && message.content) {
			const content = Array.isArray(message.content)
				? message.content.map((c: any) => c.text).join(" ")
				: message.content

			// Look for API request metadata
			const requestMatch = content.match(/"tokensIn":(\d+),"tokensOut":(\d+).*?"cost":([\d.]+)/)
			if (requestMatch) {
				const tokensIn = parseInt(requestMatch[1])
				const tokensOut = parseInt(requestMatch[2])
				const cost = parseFloat(requestMatch[3])

				totalTokens += tokensIn + tokensOut
				totalCost += cost
			}
		}
	}

	return {
		total: totalTokens,
		cost: Math.round(totalCost * 100) / 100, // Round to 2 decimal places
	}
}

/**
 * Determine task status based on content analysis
 */
function determineTaskStatus(uiMessages: any[], apiHistory: any[]): TaskInfo["status"] {
	const now = new Date()
	const lastActivity = extractLastActivity(uiMessages, apiHistory)
	const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60)

	// Check for completion indicators
	const allContent = [...uiMessages, ...apiHistory]
		.map((msg) => JSON.stringify(msg))
		.join(" ")
		.toLowerCase()

	if (
		allContent.includes("attempt_completion") ||
		allContent.includes("task completed") ||
		allContent.includes("successfully completed")
	) {
		return "completed"
	}

	if (allContent.includes("error") || allContent.includes("failed") || allContent.includes("exception")) {
		return "failed"
	}

	// Time-based status determination
	if (hoursSinceActivity < 24) {
		return "active"
	} else if (hoursSinceActivity > 168) {
		// 7 days
		return "abandoned"
	}

	return "unknown"
}

/**
 * Calculate task duration if completed
 */
function calculateDuration(createdAt: Date, lastActivity: Date, status: TaskInfo["status"]): number | undefined {
	if (status === "completed" || status === "failed") {
		return lastActivity.getTime() - createdAt.getTime()
	}
	return undefined
}

/**
 * Extract workspace directory from environment details
 */
function extractWorkspaceDir(apiHistory: any[]): string | undefined {
	for (const message of apiHistory) {
		if (message.content) {
			const content = Array.isArray(message.content)
				? message.content.map((c: any) => c.text).join(" ")
				: message.content

			const workspaceMatch = content.match(/Current Workspace Directory \(([^)]+)\)/)
			if (workspaceMatch) {
				return workspaceMatch[1]
			}
		}
	}
	return undefined
}

/**
 * Truncate text to specified length
 */
function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text
	}
	return text.substring(0, maxLength - 3) + "..."
}

/**
 * Format tasks output for display
 */
function formatTasksOutput(tasks: TaskInfo[], filter?: string): string {
	if (tasks.length === 0) {
		const message = filter ? `No tasks found matching filter "${filter}"` : "No tasks found in storage"
		return message
	}

	// Calculate summary statistics
	const statusCounts = tasks.reduce(
		(acc, task) => {
			acc[task.status] = (acc[task.status] || 0) + 1
			return acc
		},
		{} as Record<string, number>,
	)

	let output = "Available Tasks:\n\n"

	// Summary
	const totalTasks = tasks.length
	const statusSummary = Object.entries(statusCounts)
		.map(([status, count]) => `${count} ${status}`)
		.join(", ")

	output += `Total: ${totalTasks} tasks (${statusSummary})\n`

	if (filter) {
		output += `Showing tasks matching filter "${filter}"\n`
	}

	output += "\n"

	// Task details
	for (const task of tasks) {
		output += formatTaskDetails(task)
	}

	return output
}

/**
 * Format individual task details
 */
function formatTaskDetails(task: TaskInfo): string {
	let output = `### Task: ${task.title} (${task.id})\n`

	output += `- **Created**: ${formatDate(task.createdAt)}\n`
	output += `- **Status**: ${capitalizeFirst(task.status)}\n`

	if (task.mode.name && task.mode.current) {
		output += `- **Mode**: ${task.mode.name} (${task.mode.current})\n`
	} else if (task.mode.current) {
		output += `- **Mode**: ${task.mode.current}\n`
	}

	if (task.duration) {
		output += `- **Duration**: ${formatDuration(task.duration)}\n`
	}

	output += `- **Messages**: ${task.messageCount} messages\n`

	if (task.tokenUsage.total > 0) {
		output += `- **Tokens**: ${task.tokenUsage.total.toLocaleString()} tokens`
		if (task.tokenUsage.cost > 0) {
			output += ` ($${task.tokenUsage.cost.toFixed(2)})`
		}
		output += "\n"
	}

	if (task.workspaceDir) {
		output += `- **Workspace**: ${task.workspaceDir}\n`
	}

	output += "\n"
	return output
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
	return date.toLocaleString("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	})
}

/**
 * Format duration in human-readable format
 */
function formatDuration(milliseconds: number): string {
	const seconds = Math.floor(milliseconds / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)
	const days = Math.floor(hours / 24)

	if (days > 0) {
		return `${days} day${days > 1 ? "s" : ""}`
	} else if (hours > 0) {
		return `${hours} hour${hours > 1 ? "s" : ""}`
	} else if (minutes > 0) {
		return `${minutes} minute${minutes > 1 ? "s" : ""}`
	} else {
		return `${seconds} second${seconds > 1 ? "s" : ""}`
	}
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1)
}
