# List Tasks Tool Implementation

## Overview

This document outlines the technical implementation of the `list_tasks` tool, which provides LLMs with the ability to browse and manage tasks stored in the agent's storage system. The tool follows the established pattern of the existing `list_modes` tool.

## Architecture

### Storage Structure

Tasks are stored in the following directory structure:

```
storage/
└── tasks/
    ├── {uuid-1}/
    │   ├── ui_messages.json
    │   └── api_conversation_history.json
    ├── {uuid-2}/
    │   ├── ui_messages.json
    │   └── api_conversation_history.json
    └── ...
```

### Data Sources

#### ui_messages.json

Contains UI interaction messages with the following structure:

```typescript
interface UIMessage {
	ts: number // Timestamp
	type: "say" // Message type
	say: string // Message category
	text: string // Message content
	partial?: boolean // Partial message flag
}
```

#### api_conversation_history.json

Contains the actual conversation history with the LLM:

```typescript
interface ConversationMessage {
	role: "user" | "assistant" | "system"
	content: Array<{
		type: "text"
		text: string
	}>
	ts: number // Timestamp
}
```

## Implementation Details

### Core Components

#### 1. Main Tool Function

**File**: `src/core/tools/listTasksTool.ts`

```typescript
export async function listTasksTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void>
```

**Responsibilities**:

- Handle tool execution lifecycle
- Coordinate data collection and formatting
- Apply user-specified filtering
- Present results to the user

#### 2. Task Discovery

```typescript
async function getTasksFromStorage(storagePath: string): Promise<TaskInfo[]>
```

**Process**:

1. Resolve storage base path using `getStorageBasePath()`
2. Scan `tasks/` subdirectory for UUID-named folders
3. For each task directory:
    - Validate directory structure
    - Extract task metadata
    - Handle corrupted or incomplete tasks

#### 3. Metadata Extraction

```typescript
async function extractTaskMetadata(taskDir: string): Promise<TaskInfo>
```

**Data Extraction Strategy**:

From `ui_messages.json`:

- **Creation Date**: First message timestamp
- **Title**: First user message text (truncated to reasonable length)
- **Status**: Derived from message flow patterns
- **Duration**: Time between first and last messages

From `api_conversation_history.json`:

- **Mode Information**: Extract from environment details in messages
- **Token Usage**: Sum from API request metadata
- **Cost Calculation**: Extract from API response data
- **Message Count**: Total conversation messages

#### 4. Task Information Structure

```typescript
interface TaskInfo {
	id: string // Task UUID
	createdAt: Date // First message timestamp
	lastActivity: Date // Last message timestamp
	status: TaskStatus // Derived status
	title: string // First user message (truncated)
	mode: {
		current?: string // Current mode slug
		name?: string // Current mode display name
	}
	tokenUsage: {
		total: number // Total tokens used
		cost: number // Total cost in USD
	}
	messageCount: number // Total messages in conversation
	duration?: number // Task duration in milliseconds
	workspaceDir?: string // Workspace directory if available
}

type TaskStatus = "active" | "completed" | "failed" | "abandoned" | "unknown"
```

#### 5. Status Determination Logic

```typescript
function determineTaskStatus(uiMessages: UIMessage[], apiHistory: ConversationMessage[]): TaskStatus
```

**Status Rules**:

- **Active**: Recent activity (< 24 hours) with no completion indicators
- **Completed**: Contains completion messages or attempt_completion tool usage
- **Failed**: Contains error messages or failure indicators
- **Abandoned**: No recent activity (> 7 days) without completion
- **Unknown**: Cannot determine from available data

### Integration Points

#### Tool Registration

**File**: `src/shared/tools.ts`

```typescript
export interface ListTasksToolUse extends ToolUse {
	name: "list_tasks"
	params: Partial<Pick<Record<ToolParamName, string>, "filter">>
}

// Add to tool names mapping
export const toolNamesMap = {
	// ... existing tools
	list_tasks: "list tasks",
} as const

// Add to mode tool groups
export const toolGroups = {
	modes: {
		tools: ["switch_mode", "new_task", "list_modes", "list_tasks"],
		alwaysAvailable: true,
	},
	// ... other groups
}
```

#### Tool Description

**File**: `src/core/prompts/tools/list-tasks.ts`

```typescript
export function getListTasksDescription(args: ToolArgs): string {
	return `## list_tasks
Description: Request to list all stored tasks with comprehensive details including metadata, status, and usage statistics. This tool provides information about task history, current status, and resource usage.

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
</list_tasks>`
}
```

#### Execution Handler

**File**: `src/core/task/Task.ts`

```typescript
case "list_tasks": {
    // Import and use the list tasks tool
    const { listTasksTool } = await import("../tools/listTasksTool")
    await listTasksTool(this, toolUse, askApproval, handleError, pushToolResult, removeClosingTag)
    break
}
```

#### Presentation Logic

**File**: `src/core/assistant-message/presentAssistantMessage.ts`

```typescript
case "list_tasks":
    return `[${block.name}${block.params.filter ? ` filter: ${block.params.filter}` : ""}]`

// In execution section:
case "list_tasks":
    await listTasksTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
    break
```

## Error Handling

### File System Errors

- **Missing storage directory**: Create directory or use fallback
- **Permission errors**: Report error and suggest solutions
- **Corrupted JSON files**: Skip task with warning, continue processing

### Data Parsing Errors

- **Invalid JSON**: Log warning, mark task as corrupted
- **Missing required fields**: Use defaults where possible
- **Timestamp parsing**: Handle various timestamp formats

### Performance Considerations

- **Large task counts**: Implement pagination for >100 tasks
- **Memory usage**: Stream processing for large JSON files
- **File system performance**: Batch file operations where possible

## Output Format

### Summary Header

```
Available Tasks:

Total: 45 tasks (12 active, 28 completed, 3 failed, 2 abandoned)
Storage: /path/to/storage/tasks
```

### Task Entries

```
### Task: Fix authentication bug (a1b2c3d4-e5f6-7890-abcd-ef1234567890)
- **Created**: 2025-01-07 14:30:22
- **Status**: Completed
- **Mode**: 🪲 Debug (debug)
- **Duration**: 45 minutes
- **Messages**: 23 messages
- **Tokens**: 15,420 tokens ($0.23)
- **Workspace**: /Users/dev/project-x
```

### Filtering

When filter is applied:

```
Showing 8 tasks matching filter "debug"
```

## Testing Strategy

### Unit Tests

- **Metadata extraction**: Test with various JSON structures
- **Status determination**: Test all status scenarios
- **Filtering logic**: Test various filter patterns
- **Error handling**: Test with corrupted/missing files

### Integration Tests

- **Storage path resolution**: Test custom vs default paths
- **Cross-platform compatibility**: Test on Windows/macOS/Linux
- **Large dataset performance**: Test with 100+ tasks
- **Memory usage**: Monitor memory consumption

### End-to-End Tests

- **VSCode extension**: Test in extension context
- **CLI mode**: Test in command-line context
- **API mode**: Test via API endpoints

## Security Considerations

### Path Validation

- Validate all file paths to prevent directory traversal
- Sanitize user input in filter parameters
- Ensure storage directory permissions are appropriate

### Data Privacy

- Avoid logging sensitive task content
- Respect user privacy settings
- Handle personal information appropriately

## Performance Benchmarks

### Target Performance

- **<100 tasks**: Response time <500ms
- **100-500 tasks**: Response time <2s
- **500+ tasks**: Paginated response, <3s per page
- **Memory usage**: <50MB for 1000 tasks

### Optimization Strategies

- **Lazy loading**: Load task details on demand
- **Caching**: Cache frequently accessed metadata
- **Parallel processing**: Process multiple tasks concurrently
- **Streaming**: Stream results for large datasets

## Future Enhancements

### Planned Features

- **Task search**: Full-text search within task content
- **Task analytics**: Usage patterns and statistics
- **Task cleanup**: Automated cleanup of old tasks
- **Export functionality**: Export task data to various formats

### API Extensions

- **REST endpoints**: HTTP API for task management
- **WebSocket support**: Real-time task updates
- **Bulk operations**: Batch task operations
- **Task relationships**: Link related tasks

## Migration Considerations

### Backward Compatibility

- Support existing task storage formats
- Graceful handling of legacy data structures
- Migration utilities for format changes

### Version Management

- Track storage format versions
- Provide upgrade paths for breaking changes
- Maintain compatibility with older agent versions
