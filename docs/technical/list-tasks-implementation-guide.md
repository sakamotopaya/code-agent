# List Tasks Tool - Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the `list_tasks` tool based on the technical specification and product stories. The implementation follows the established pattern of the `list_modes` tool.

## Prerequisites

Before starting implementation, ensure you understand:

- The existing `list_modes` tool pattern in `src/core/tools/listModesTool.ts`
- Task storage structure in `storage/tasks/{uuid}/`
- Tool integration points across the codebase
- TypeScript interfaces and error handling patterns

## Implementation Sequence

### Phase 1: Core Functionality (Story 1)

#### Step 1.1: Create Main Tool File

**File**: `src/core/tools/listTasksTool.ts`

```typescript
import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { getStorageBasePath } from "../../utils/storage"
import * as path from "path"
import * as fs from "fs/promises"

/**
 * Implements the list_tasks tool.
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
			const tasks = await getTasksFromStorage(cline.globalStoragePath)

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
```

#### Step 1.2: Implement Task Discovery

```typescript
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

function isValidUUID(str: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
	return uuidRegex.test(str)
}
```

#### Step 1.3: Implement Metadata Extraction

```typescript
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

async function readJSONFile(filePath: string): Promise<any[] | null> {
	try {
		const data = await fs.readFile(filePath, "utf-8")
		return JSON.parse(data)
	} catch (error) {
		return null
	}
}
```

#### Step 1.4: Implement Helper Functions

```typescript
function extractCreationDate(uiMessages: any[]): Date {
	if (uiMessages.length > 0 && uiMessages[0].ts) {
		return new Date(uiMessages[0].ts)
	}
	return new Date() // Fallback to current date
}

function extractLastActivity(uiMessages: any[], apiHistory: any[]): Date {
	const lastUI = uiMessages.length > 0 ? uiMessages[uiMessages.length - 1].ts : 0
	const lastAPI = apiHistory.length > 0 ? apiHistory[apiHistory.length - 1].ts : 0

	const lastTimestamp = Math.max(lastUI, lastAPI)
	return lastTimestamp ? new Date(lastTimestamp) : new Date()
}

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

function extractModeInfo(apiHistory: any[]): { current?: string; name?: string } {
	// Look for mode information in environment details
	for (let i = apiHistory.length - 1; i >= 0; i--) {
		const message = apiHistory[i]
		if (message.content) {
			const content = Array.isArray(message.content)
				? message.content.map((c) => c.text).join(" ")
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

function calculateTokenUsage(apiHistory: any[]): { total: number; cost: number } {
	let totalTokens = 0
	let totalCost = 0

	for (const message of apiHistory) {
		if (message.role === "user" && message.content) {
			const content = Array.isArray(message.content)
				? message.content.map((c) => c.text).join(" ")
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

function calculateDuration(createdAt: Date, lastActivity: Date, status: TaskInfo["status"]): number | undefined {
	if (status === "completed" || status === "failed") {
		return lastActivity.getTime() - createdAt.getTime()
	}
	return undefined
}

function extractWorkspaceDir(apiHistory: any[]): string | undefined {
	for (const message of apiHistory) {
		if (message.content) {
			const content = Array.isArray(message.content)
				? message.content.map((c) => c.text).join(" ")
				: message.content

			const workspaceMatch = content.match(/Current Workspace Directory \(([^)]+)\)/)
			if (workspaceMatch) {
				return workspaceMatch[1]
			}
		}
	}
	return undefined
}

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text
	}
	return text.substring(0, maxLength - 3) + "..."
}
```

### Phase 2: Tool Integration (Story 2)

#### Step 2.1: Update Tool Definitions

**File**: `src/shared/tools.ts`

Add the interface and update mappings:

```typescript
export interface ListTasksToolUse extends ToolUse {
	name: "list_tasks"
	params: Partial<Pick<Record<ToolParamName, string>, "filter">>
}

// Update toolNamesMap
export const toolNamesMap = {
	// ... existing tools
	list_tasks: "list tasks",
} as const

// Update toolGroups
export const toolGroups = {
	modes: {
		tools: ["switch_mode", "new_task", "list_modes", "list_tasks"],
		alwaysAvailable: true,
	},
	// ... other groups
}

// Update alwaysAvailableTools
export const alwaysAvailableTools = [
	// ... existing tools
	"list_tasks",
] as const
```

#### Step 2.2: Create Tool Description

**File**: `src/core/prompts/tools/list-tasks.ts`

```typescript
import { ToolArgs } from "../../../shared/tools"

export function getListTasksDescription(args: ToolArgs): string {
	return `## list_tasks
Description: Request to list all stored tasks with comprehensive details including metadata, status, and usage statistics. This tool provides information about task history, current status, mode information, and resource usage.

Parameters:
- filter: (optional) Filter text to search within task titles, IDs, modes, or status

Usage:
<list_tasks>
<filter>optional filter text</filter>
</list_tasks>

Examples:

1. List all tasks:
<list_tasks>
</list_tasks>

2. Filter tasks containing "debug":
<list_tasks>
<filter>debug</filter>
</list_tasks>

3. Filter by status:
<list_tasks>
<filter>completed</filter>
</list_tasks>`
}
```

#### Step 2.3: Register Tool Description

**File**: `src/core/prompts/tools/index.ts`

```typescript
import { getListTasksDescription } from "./list-tasks"

export const toolDescriptions: Record<string, (args: ToolArgs) => string> = {
	// ... existing tools
	list_tasks: (args) => getListTasksDescription(args),
}
```

#### Step 2.4: Add Execution Handler

**File**: `src/core/task/Task.ts`

Add to the switch statement in the tool execution section:

```typescript
case "list_tasks": {
    // Import and use the list tasks tool
    const { listTasksTool } = await import("../tools/listTasksTool")
    await listTasksTool(this, toolUse, askApproval, handleError, pushToolResult, removeClosingTag)
    break
}
```

#### Step 2.5: Add Presentation Logic

**File**: `src/core/assistant-message/presentAssistantMessage.ts`

Add to the tool presentation switch:

```typescript
case "list_tasks":
    return `[${block.name}${block.params.filter ? ` filter: ${block.params.filter}` : ""}]`
```

Add to the execution switch:

```typescript
case "list_tasks":
    await listTasksTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
    break
```

#### Step 2.6: Update Streaming Buffer

**File**: `src/api/streaming/MessageBuffer.ts`

Add to the streaming tools array:

```typescript
const streamingTools = new Set([
	// ... existing tools
	"list_tasks",
])
```

### Phase 3: Output Formatting (Story 3)

#### Step 3.1: Implement Output Formatting

Add to `listTasksTool.ts`:

```typescript
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

function capitalizeFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1)
}
```

## Testing Strategy

### Unit Tests

Create `__tests__/listTasksTool.test.ts`:

```typescript
import { extractTaskMetadata, determineTaskStatus, calculateTokenUsage } from "../src/core/tools/listTasksTool"

describe("listTasksTool", () => {
	describe("metadata extraction", () => {
		it("should extract creation date from first message", () => {
			// Test implementation
		})

		it("should determine status correctly", () => {
			// Test implementation
		})

		it("should calculate token usage", () => {
			// Test implementation
		})
	})
})
```

### Integration Tests

Test the complete workflow in different contexts:

- VSCode extension
- CLI mode
- API server

## Deployment Checklist

- [ ] All files created and properly integrated
- [ ] Unit tests written and passing
- [ ] Integration tests completed
- [ ] Manual testing in all contexts
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Performance benchmarks met

## Troubleshooting

### Common Issues

1. **Storage path not found**: Ensure storage directory exists and is accessible
2. **Permission errors**: Check file system permissions
3. **JSON parsing errors**: Handle corrupted files gracefully
4. **Performance issues**: Implement pagination for large task counts

### Debug Tips

- Enable verbose logging to trace execution
- Check file system permissions
- Validate JSON file structure
- Monitor memory usage with large datasets

This implementation guide provides a complete roadmap for building the `list_tasks` tool following established patterns and best practices.
