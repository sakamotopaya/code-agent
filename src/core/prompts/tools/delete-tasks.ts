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
