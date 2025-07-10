import { ToolArgs } from "./types"

export function getListTasksDescription(args: ToolArgs): string {
	return `## list_tasks
Description: Request to list all stored tasks with comprehensive details including metadata, status, and usage statistics. This tool provides information about task history, current status, mode information, and resource usage.
Reports involving listing tasks should include the task identifier.

Suggested Reporting Style:
1. **Task: list the 5 most recent tasks** (b1b94bd6-3279-43a2-8196-6ec64836bb7e)
   - Created: 07/10/2025, 09:59:43 PM
   - Status: Failed
   - Mode: 💻 Code (ticket-oracle)
   - Duration: 20secs

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
</list_tasks>

4. Filter by mode:
<list_tasks>
<filter>code</filter>
</list_tasks>`
}
