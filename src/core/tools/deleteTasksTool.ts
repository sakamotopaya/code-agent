import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { getStorageBasePath } from "../../utils/storage"
import * as path from "path"
import * as fs from "fs/promises"

/**
 * Task information interface (reused from listTasksTool)
 */
export interface TaskInfo {
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
 * Deletion result for individual task
 */
interface DeletionResult {
	taskId: string
	success: boolean
	error?: string
	taskTitle?: string
}

/**
 * Implements the delete_tasks tool.
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
export async function deleteTasksTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const taskIdsParam: string | undefined = block.params.task_ids

	const sharedMessageProps: ClineSayTool = {
		tool: "deleteTasks",
		path: getReadablePath(cline.cwd, "tasks"),
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			cline.consecutiveMistakeCount = 0

			// Parse and validate task IDs
			const taskIds = parseAndValidateTaskIds(taskIdsParam)
			if (taskIds.length === 0) {
				throw new Error("No valid task IDs provided. Please provide an array of valid UUID task identifiers.")
			}

			// Get task metadata for confirmation
			const allTasks = await getTasksFromStorage(cline.getGlobalStoragePath())
			const tasksToDelete = allTasks.filter((task) => taskIds.includes(task.id))

			// Check for non-existent tasks
			const existingTaskIds = tasksToDelete.map((t) => t.id)
			const nonExistentIds = taskIds.filter((id) => !existingTaskIds.includes(id))

			if (nonExistentIds.length > 0) {
				throw new Error(
					`Tasks not found: ${nonExistentIds.join(", ")}. Please verify the task IDs exist using the list_tasks tool.`,
				)
			}

			// Format confirmation message
			const confirmationMessage = formatConfirmationMessage(tasksToDelete)

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: confirmationMessage,
			} satisfies ClineSayTool)

			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				pushToolResult("Task deletion cancelled by user.")
				return
			}

			// Perform deletions
			const results = await deleteTasksFromStorage(taskIds, tasksToDelete, cline.getGlobalStoragePath())

			// Format and return results
			const resultMessage = formatDeletionResults(results)
			pushToolResult(resultMessage)
		}
	} catch (error) {
		await handleError("deleting tasks", error)
	}
}

/**
 * Parse and validate task IDs from parameter
 */
function parseAndValidateTaskIds(taskIdsParam?: string): string[] {
	if (!taskIdsParam) {
		return []
	}

	try {
		const parsed = JSON.parse(taskIdsParam)
		if (!Array.isArray(parsed)) {
			throw new Error("task_ids must be an array of UUID strings")
		}

		const validIds: string[] = []
		const invalidIds: string[] = []

		for (const id of parsed) {
			if (typeof id !== "string") {
				invalidIds.push(String(id))
				continue
			}

			if (!isValidUUID(id)) {
				invalidIds.push(id)
				continue
			}

			// Remove duplicates
			if (!validIds.includes(id)) {
				validIds.push(id)
			}
		}

		if (invalidIds.length > 0) {
			throw new Error(`Invalid task IDs (must be valid UUIDs): ${invalidIds.join(", ")}`)
		}

		return validIds
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error("Invalid JSON format for task_ids parameter")
		}
		throw error
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
 * Get tasks from storage directory (reused logic from listTasksTool)
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

		return tasks
	} catch (error) {
		console.error("Failed to get tasks from storage:", error)
		return []
	}
}

/**
 * Extract task metadata from task directory (simplified version from listTasksTool)
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
 * Truncate text to specified length
 */
function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text
	}
	return text.substring(0, maxLength - 3) + "..."
}

/**
 * Format confirmation message for user
 */
function formatConfirmationMessage(tasks: TaskInfo[]): string {
	let message = "The following tasks will be permanently deleted:\n\n"

	for (const task of tasks) {
		message += `### Task: ${task.title} (${task.id})\n`
		message += `- **Created**: ${formatDate(task.createdAt)}\n`
		message += `- **Status**: ${capitalizeFirst(task.status)}\n`

		if (task.mode.name && task.mode.current) {
			message += `- **Mode**: ${task.mode.name} (${task.mode.current})\n`
		} else if (task.mode.current) {
			message += `- **Mode**: ${task.mode.current}\n`
		}

		message += `- **Messages**: ${task.messageCount} messages\n`

		if (task.tokenUsage.total > 0) {
			message += `- **Tokens**: ${task.tokenUsage.total.toLocaleString()} tokens`
			if (task.tokenUsage.cost > 0) {
				message += ` ($${task.tokenUsage.cost.toFixed(2)})`
			}
			message += "\n"
		}

		message += "\n"
	}

	message += `**Total: ${tasks.length} task${tasks.length > 1 ? "s" : ""} will be deleted**\n`
	message += "⚠️ **This action cannot be undone.**"

	return message
}

/**
 * Delete tasks from storage
 */
async function deleteTasksFromStorage(
	taskIds: string[],
	taskInfos: TaskInfo[],
	globalStoragePath: string,
): Promise<DeletionResult[]> {
	const basePath = await getStorageBasePath(globalStoragePath)
	const tasksDir = path.join(basePath, "tasks")

	const results: DeletionResult[] = []

	// Create a map for quick task info lookup
	const taskInfoMap = new Map(taskInfos.map((task) => [task.id, task]))

	for (const taskId of taskIds) {
		const taskInfo = taskInfoMap.get(taskId)
		const taskTitle = taskInfo?.title || "Unknown Task"

		try {
			const taskDir = path.join(tasksDir, taskId)

			// Verify directory exists
			await fs.access(taskDir)

			// Delete directory recursively
			await fs.rm(taskDir, { recursive: true, force: true })

			// Verify deletion
			try {
				await fs.access(taskDir)
				// If we can still access it, deletion failed
				results.push({
					taskId,
					taskTitle,
					success: false,
					error: "Directory still exists after deletion attempt",
				})
			} catch {
				// Good - directory no longer exists
				results.push({
					taskId,
					taskTitle,
					success: true,
				})
			}
		} catch (error) {
			results.push({
				taskId,
				taskTitle,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
			})
		}
	}

	return results
}

/**
 * Format deletion results for display
 */
function formatDeletionResults(results: DeletionResult[]): string {
	let message = "Task Deletion Results:\n\n"

	const successful = results.filter((r) => r.success)
	const failed = results.filter((r) => !r.success)

	// Show successful deletions
	for (const result of successful) {
		message += `✅ **Successfully deleted**: ${result.taskTitle} (${result.taskId})\n`
	}

	// Show failed deletions
	for (const result of failed) {
		message += `❌ **Failed to delete**: ${result.taskTitle} (${result.taskId})\n`
		if (result.error) {
			message += `   Error: ${result.error}\n`
		}
	}

	message += `\n**Summary**: ${successful.length} task${successful.length !== 1 ? "s" : ""} deleted successfully`
	if (failed.length > 0) {
		message += `, ${failed.length} failed`
	}

	return message
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
 * Capitalize first letter of string
 */
function capitalizeFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1)
}
