# Delete Tasks Tool - Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the `delete_tasks` tool following the established patterns in the codebase. The implementation should follow the same architecture as the existing `list_tasks` tool.

## Prerequisites

Before starting implementation, ensure you understand:

- The existing `list_tasks` tool implementation
- Tool registration and integration patterns
- File system operations in Node.js
- TypeScript interfaces and error handling patterns
- The project's testing framework

## Implementation Steps

### Step 1: Create Core Tool Implementation

**File**: `src/core/tools/deleteTasksTool.ts`

```typescript
import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { getStorageBasePath } from "../../utils/storage"
import * as path from "path"
import * as fs from "fs/promises"

// Reuse TaskInfo interface from listTasksTool
import { TaskInfo, getTasksFromStorage, extractTaskMetadata } from "./listTasksTool"

/**
 * Deletion result for individual task
 */
interface DeletionResult {
	taskId: string
	success: boolean
	error?: string
}

/**
 * Implements the delete_tasks tool.
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
				throw new Error("No valid task IDs provided")
			}

			// Get task metadata for confirmation
			const allTasks = await getTasksFromStorage(cline.getGlobalStoragePath())
			const tasksToDelete = allTasks.filter((task) => taskIds.includes(task.id))

			// Check for non-existent tasks
			const existingTaskIds = tasksToDelete.map((t) => t.id)
			const nonExistentIds = taskIds.filter((id) => !existingTaskIds.includes(id))

			if (nonExistentIds.length > 0) {
				throw new Error(`Tasks not found: ${nonExistentIds.join(", ")}`)
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
			const results = await deleteTasksFromStorage(taskIds, cline.getGlobalStoragePath())

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
			throw new Error("task_ids must be an array")
		}

		return parsed
			.filter((id): id is string => typeof id === "string")
			.filter((id) => isValidUUID(id))
			.filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates
	} catch (error) {
		throw new Error(`Invalid task_ids parameter: ${error.message}`)
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
 * Format confirmation message for user
 */
function formatConfirmationMessage(tasks: TaskInfo[]): string {
	let message = "The following tasks will be permanently deleted:\n\n"

	for (const task of tasks) {
		message += `### Task: ${task.title} (${task.id})\n`
		message += `- Created: ${formatDate(task.createdAt)}\n`
		message += `- Status: ${capitalizeFirst(task.status)}\n`

		if (task.mode.name && task.mode.current) {
			message += `- Mode: ${task.mode.name} (${task.mode.current})\n`
		}

		message += `- Messages: ${task.messageCount} messages\n\n`
	}

	message += `Total: ${tasks.length} task${tasks.length > 1 ? "s" : ""} will be deleted\n`
	message += "This action cannot be undone."

	return message
}

/**
 * Delete tasks from storage
 */
async function deleteTasksFromStorage(taskIds: string[], globalStoragePath: string): Promise<DeletionResult[]> {
	const basePath = await getStorageBasePath(globalStoragePath)
	const tasksDir = path.join(basePath, "tasks")

	const results: DeletionResult[] = []

	for (const taskId of taskIds) {
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
					success: false,
					error: "Directory still exists after deletion attempt",
				})
			} catch {
				// Good - directory no longer exists
				results.push({
					taskId,
					success: true,
				})
			}
		} catch (error) {
			results.push({
				taskId,
				success: false,
				error: error.message,
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
		message += `✅ Successfully deleted: ${result.taskId}\n`
	}

	// Show failed deletions
	for (const result of failed) {
		message += `❌ Failed to delete: ${result.taskId}\n`
		if (result.error) {
			message += `   Error: ${result.error}\n`
		}
	}

	message += `\nSummary: ${successful.length} task${successful.length !== 1 ? "s" : ""} deleted successfully, ${failed.length} failed`

	return message
}

// Helper functions (reuse from listTasksTool or create shared utilities)
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

function capitalizeFirst(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1)
}
```

### Step 2: Add Tool Type Definitions

**File**: `packages/types/src/tool.ts`

Add `"delete_tasks"` to the toolNames array:

```typescript
export const toolNames = [
	"execute_command",
	"read_file",
	"write_to_file",
	"apply_diff",
	"insert_content",
	"search_and_replace",
	"search_files",
	"list_files",
	"list_code_definition_names",
	"browser_action",
	"use_mcp_tool",
	"access_mcp_resource",
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"new_task",
	"fetch_instructions",
	"codebase_search",
	"list_modes",
	"list_tasks",
	"delete_tasks", // Add this line
] as const
```

### Step 3: Register Tool in Shared Tools

**File**: `src/shared/tools.ts`

Add the tool interface and configuration:

```typescript
// Add to toolParamNames array
export const toolParamNames = [
	// ... existing params
	"task_ids", // Add this line
] as const

// Add tool interface
export interface DeleteTasksToolUse extends ToolUse {
	name: "delete_tasks"
	params: Partial<Pick<Record<ToolParamName, string>, "task_ids">>
}

// Add to TOOL_DISPLAY_NAMES
export const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
	// ... existing tools
	delete_tasks: "delete tasks",
} as const

// Add to modes tool group
export const TOOL_GROUPS: Record<ToolGroup, ToolGroupConfig> = {
	modes: {
		tools: ["switch_mode", "new_task", "list_modes", "list_tasks", "delete_tasks"],
		alwaysAvailable: true,
	},
	// ... other groups remain unchanged
}
```

### Step 4: Create Tool Description

**File**: `src/core/prompts/tools/delete-tasks.ts`

```typescript
import { ToolArgs } from "./types"

export function getDeleteTasksDescription(args: ToolArgs): string {
	return `## delete_tasks
Description: Request to permanently delete specified tasks from storage. This tool removes task directories and all their contents from the file system. The operation requires user confirmation and cannot be undone.

Parameters:
- task_ids: (required) Array of task identifiers (UUIDs) to delete

Usage:
<delete_tasks>
<task_ids>["uuid1", "uuid2", "uuid3"]</task_ids>
</delete_tasks>

Examples:

1. Delete single task:
<delete_tasks>
<task_ids>["a1b2c3d4-e5f6-7890-abcd-ef1234567890"]</task_ids>
</delete_tasks>

2. Delete multiple tasks:
<delete_tasks>
<task_ids>["a1b2c3d4-e5f6-7890-abcd-ef1234567890", "b2c3d4e5-f6g7-8901-bcde-f23456789012"]</task_ids>
</delete_tasks>

Note: This operation permanently deletes tasks and cannot be undone. User confirmation is required before deletion.`
}
```

### Step 5: Register Tool Description

**File**: `src/core/prompts/tools/index.ts`

Add the import and registration:

```typescript
// Add import
import { getDeleteTasksDescription } from "./delete-tasks"

// Add to toolDescriptionMap
const toolDescriptionMap: Record<string, (args: ToolArgs) => string | undefined> = {
	// ... existing tools
	delete_tasks: (args) => getDeleteTasksDescription(args),
}
```

### Step 6: Add Execution Handler

**File**: `src/core/assistant-message/presentAssistantMessage.ts`

Add the import and execution case:

```typescript
// Add import at the top
import { deleteTasksTool } from "../tools/deleteTasksTool"

// Add to toolDescription function (around line 153)
case "delete_tasks":
    return `[${block.name}${block.params.task_ids ? ` tasks: ${JSON.parse(block.params.task_ids || "[]").length}` : ""}]`

// Add to execution switch statement (around line 467)
case "delete_tasks":
    await deleteTasksTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
    break
```

### Step 7: Create Unit Tests

**File**: `__tests__/tools/deleteTasksTool.test.ts`

```typescript
import { deleteTasksTool } from "../../src/core/tools/deleteTasksTool"
import { Task } from "../../src/core/task/Task"
import { ToolUse } from "../../src/shared/tools"
import * as fs from "fs/promises"

// Mock dependencies
jest.mock("fs/promises")
jest.mock("../../src/core/tools/listTasksTool")

describe("deleteTasksTool", () => {
	let mockTask: jest.Mocked<Task>
	let mockAskApproval: jest.MockedFunction<any>
	let mockHandleError: jest.MockedFunction<any>
	let mockPushToolResult: jest.MockedFunction<any>
	let mockRemoveClosingTag: jest.MockedFunction<any>

	beforeEach(() => {
		// Setup mocks
		mockTask = {
			cwd: "/test/path",
			getGlobalStoragePath: jest.fn().mockReturnValue("/test/storage"),
			consecutiveMistakeCount: 0,
			ask: jest.fn(),
		} as any

		mockAskApproval = jest.fn()
		mockHandleError = jest.fn()
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn()
	})

	test("should validate task IDs correctly", async () => {
		const toolUse: ToolUse = {
			type: "tool_use",
			name: "delete_tasks",
			params: {
				task_ids: '["invalid-uuid"]',
			},
			partial: false,
		}

		await deleteTasksTool(
			mockTask,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		expect(mockHandleError).toHaveBeenCalled()
	})

	test("should handle valid task deletion", async () => {
		// Mock successful deletion scenario
		const validUuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

		// Setup mocks for successful case
		// ... implement test logic
	})

	// Add more tests for edge cases
})
```

### Step 8: Integration Testing

Create integration tests that verify:

- Tool registration works correctly
- Tool executes in all contexts (Extension, CLI, API)
- File system operations work cross-platform
- Error handling works as expected

### Step 9: Performance Testing

Create performance tests for:

- Large numbers of tasks (50+, 100+)
- Memory usage during deletion
- File system operation efficiency

## Testing Checklist

- [ ] Unit tests for all core functions
- [ ] Integration tests for end-to-end workflows
- [ ] Error scenario testing
- [ ] Cross-platform compatibility testing
- [ ] Performance testing with large datasets
- [ ] User interaction testing
- [ ] Tool registration verification

## Deployment Checklist

- [ ] All tests pass
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Performance benchmarks met
- [ ] Cross-platform testing completed
- [ ] Integration testing in all contexts
- [ ] User acceptance testing completed

## Common Issues and Solutions

### Issue: Tool not appearing in tool list

**Solution**: Verify tool is added to `toolNames` array in `packages/types/src/tool.ts`

### Issue: Parameter validation failing

**Solution**: Check `toolParamNames` includes `task_ids` in `src/shared/tools.ts`

### Issue: File system permission errors

**Solution**: Add proper error handling and user-friendly error messages

### Issue: Cross-platform path issues

**Solution**: Use `path.join()` consistently and test on all platforms

## Future Enhancements

The implementation is designed to support future enhancements:

1. **Soft Delete**: Replace permanent deletion with move to deleted folder
2. **Bulk Operations**: Optimize for very large task sets
3. **Recovery System**: Add ability to restore deleted tasks
4. **Audit Trail**: Track all deletion operations
5. **Backup Integration**: Automatic backup before deletion

## Maintenance

- Monitor performance metrics
- Update tests when core dependencies change
- Review error handling as new edge cases are discovered
- Keep documentation synchronized with implementation changes

This implementation guide provides a complete roadmap for adding the `delete_tasks` tool while maintaining consistency with the existing codebase architecture and patterns.
