# Task Restart Implementation Plan

## Overview

This document outlines the implementation plan for enabling task restart functionality in the API client, allowing users to continue tasks that were previously completed or interrupted, regardless of the original execution context (VSCode Extension, CLI, or API).

## Current State Analysis

### How VSCode Extension Handles Task Restart

1. **Task Storage Structure**:

    - Tasks are stored in `globalStoragePath/tasks/{taskId}/`
    - Each task directory contains:
        - `api_conversation_history.json` - API messages with timestamps
        - `ui_messages.json` - UI messages for display
        - Additional metadata files

2. **Task Loading Process**:

    - `ClineProvider.getTaskWithId()` loads task data from storage
    - `ClineProvider.initClineWithHistoryItem()` creates new Task instance
    - `TaskLifecycle.resumeTaskFromHistory()` restores conversation state
    - Task continues from where it left off

3. **Key State Preserved**:
    - Conversation history (API messages)
    - UI messages for display
    - Task metadata (HistoryItem)
    - File context and workspace state
    - Tool usage history
    - Mode configuration

## Implementation Plan

### Phase 1: API Client Enhancement

#### 1.1 Add --task Parameter to API Client

**File**: `api-client.js`

Add support for `--task <taskId>` parameter:

```javascript
// New command line options
let taskId = null
let restartTask = false

// Parse --task parameter
} else if (arg === "--task") {
    taskId = args[++i]
    restartTask = true
```

#### 1.2 Modify Request Payload

When `--task` is provided, include it in the request:

```javascript
const requestBody = {
	task: restartTask ? `Continue task: ${task}` : task,
	mode: mode,
	taskId: taskId, // New field for restart
	restartTask: restartTask, // Flag to indicate restart
}
```

### Phase 2: API Server Enhancement

#### 2.1 Extend API Request Interface

**File**: `src/api/index.ts`

```typescript
export interface ApiRequest {
	task: string
	mode?: string
	taskId?: string // New field
	restartTask?: boolean // New field
}
```

#### 2.2 Enhance FastifyServer Task Handling

**File**: `src/api/server/FastifyServer.ts`

Add task restart logic in the streaming endpoint:

```typescript
// In the /chat/stream endpoint
const body = request.body as any
const task = body.task || "No task specified"
const mode = body.mode || "code"
const taskId = body.taskId
const restartTask = body.restartTask || false

if (restartTask && taskId) {
	// Load existing task and continue
	const taskData = await this.loadExistingTask(taskId)
	if (taskData) {
		return this.continueExistingTask(taskData, task, reply, sseAdapter)
	} else {
		throw new Error(`Task ${taskId} not found or cannot be loaded`)
	}
}
```

#### 2.3 Implement Task Loading Logic

Add methods to FastifyServer:

```typescript
private async loadExistingTask(taskId: string): Promise<TaskData | null> {
    try {
        const globalStoragePath = this.config.getConfiguration().globalStoragePath
        const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)

        // Load task files
        const apiHistoryPath = path.join(taskDir, GlobalFileNames.apiConversationHistory)
        const uiMessagesPath = path.join(taskDir, GlobalFileNames.uiMessages)

        if (!await fileExistsAtPath(apiHistoryPath)) {
            return null
        }

        const apiConversationHistory = JSON.parse(await fs.readFile(apiHistoryPath, "utf8"))
        const uiMessages = JSON.parse(await fs.readFile(uiMessagesPath, "utf8"))

        // Create HistoryItem from stored data
        const historyItem = await this.createHistoryItemFromStorage(taskId, taskDir)

        return {
            historyItem,
            apiConversationHistory,
            uiMessages,
            taskDir
        }
    } catch (error) {
        this.app.log.error(`Failed to load task ${taskId}:`, error)
        return null
    }
}

private async continueExistingTask(
    taskData: TaskData,
    newUserMessage: string,
    reply: FastifyReply,
    sseAdapter: SSEOutputAdapter
): Promise<void> {
    // Create Task instance with existing history
    const taskOptions = {
        ...this.getBaseTaskOptions(),
        historyItem: taskData.historyItem,
        startTask: false // Don't auto-start, we'll resume manually
    }

    const [taskInstance, taskPromise] = Task.create(taskOptions)

    // Restore conversation history
    taskInstance.apiConversationHistory = taskData.apiConversationHistory

    // Add new user message and continue
    await taskInstance.resumePausedTask(newUserMessage)

    // Handle execution similar to new tasks
    // ... rest of execution logic
}
```

### Phase 3: Cross-Context Task Discovery

#### 3.1 Unified Task Storage Access

Create a service to access tasks across all contexts:

**File**: `src/shared/services/UnifiedTaskService.ts`

```typescript
export class UnifiedTaskService {
	constructor(private globalStoragePath: string) {}

	async findTask(taskId: string): Promise<TaskData | null> {
		// Search in all possible storage locations
		const taskDir = await getTaskDirectoryPath(this.globalStoragePath, taskId)
		return this.loadTaskFromDirectory(taskDir, taskId)
	}

	async listAllTasks(): Promise<TaskInfo[]> {
		// List tasks from all contexts
		const tasksDir = path.join(this.globalStoragePath, "tasks")
		// ... implementation similar to listTasksTool
	}

	private async loadTaskFromDirectory(taskDir: string, taskId: string): Promise<TaskData | null> {
		// Implementation similar to ClineProvider.getTaskWithId
	}
}
```

#### 3.2 Enhance Task Loading with Context Detection

Add logic to detect and handle different task origins:

```typescript
interface TaskData {
	historyItem: HistoryItem
	apiConversationHistory: ApiMessage[]
	uiMessages: ClineMessage[]
	taskDir: string
	originContext: "extension" | "cli" | "api" // New field
	mode: string
	workspace?: string
}
```

### Phase 4: State Restoration

#### 4.1 Enhance Task.resumePausedTask()

**File**: `src/core/task/Task.ts`

Ensure the existing `resumePausedTask()` method works properly for API context:

```typescript
public async resumePausedTask(lastMessage: string) {
    // Add the new user message to continue the conversation
    await this.userInterface.say("user", lastMessage)

    // Resume from history
    await this.resumeTaskFromHistory()
}
```

#### 4.2 Context-Aware Initialization

Modify Task initialization to handle cross-context scenarios:

```typescript
// In Task constructor or initialization
if (this.isApiContext() && historyItem?.workspace) {
	// Ensure workspace path is correctly set for API context
	this.workspacePath = historyItem.workspace || this.workspacePath
}
```

### Phase 5: API Response Enhancement

#### 5.1 Include Task ID in Responses

Modify SSE responses to include task ID:

**File**: `src/api/streaming/SSEOutputAdapter.ts`

```typescript
async emitStart(message: string = "Task started", task?: string, taskId?: string): Promise<void> {
    const event: SSEEvent = {
        type: "start",
        timestamp: Date.now(),
        data: {
            message,
            task,
            taskId // Include task ID
        }
    }
    await this.sendEvent(event)
}
```

#### 5.2 Task Completion with Restart Info

When tasks complete, provide restart information:

```typescript
async emitCompletion(message: string, taskId: string): Promise<void> {
    const event: SSEEvent = {
        type: "completion",
        timestamp: Date.now(),
        data: {
            message,
            taskId,
            restartCommand: `--task ${taskId}` // Helpful for users
        }
    }
    await this.sendEvent(event)
}
```

## Implementation Sequence

### Step 1: Basic API Client Support

1. Add `--task` parameter parsing to `api-client.js`
2. Modify request payload to include task restart information
3. Test with mock task IDs

### Step 2: API Server Task Loading

1. Implement `loadExistingTask()` method in FastifyServer
2. Add task restart detection in streaming endpoint
3. Create `UnifiedTaskService` for cross-context access

### Step 3: Task Restoration Logic

1. Enhance Task initialization for restart scenarios
2. Ensure `resumePausedTask()` works in API context
3. Test with actual task data from VSCode extension

### Step 4: Response Enhancement

1. Include task IDs in API responses
2. Provide restart information in completion messages
3. Update API client to display task IDs

### Step 5: Integration Testing

1. Create task in VSCode extension
2. Restart task using API client
3. Verify conversation continuity and state preservation

## Configuration

### API Client Usage

```bash
# Start new task
node api-client.js --stream "Create a todo app"

# Restart existing task
node api-client.js --stream --task "abc123-def456-ghi789" "Add user authentication"
```

### API Server Configuration

Add task restart settings to API configuration:

```typescript
interface ApiConfig {
	// ... existing config
	taskRestart: {
		enabled: boolean
		crossContextAccess: boolean
		maxRestartAttempts: number
	}
}
```

## Error Handling

1. **Task Not Found**: Clear error message with suggestion to list available tasks
2. **Invalid Task State**: Detect corrupted task data and provide recovery options
3. **Context Mismatch**: Handle workspace/environment differences gracefully
4. **Permission Issues**: Proper error handling for storage access problems

## Security Considerations

1. **Task Access Control**: Ensure users can only access their own tasks
2. **Path Validation**: Validate task IDs to prevent directory traversal
3. **Storage Isolation**: Maintain separation between different user contexts

## Testing Strategy

1. **Unit Tests**: Test task loading and restoration logic
2. **Integration Tests**: Test cross-context task continuation
3. **E2E Tests**: Full workflow from VSCode to API restart
4. **Performance Tests**: Ensure task loading doesn't impact API performance

## Future Enhancements

1. **Task Branching**: Allow creating new branches from existing tasks
2. **Task Merging**: Combine multiple task histories
3. **Task Templates**: Save task patterns for reuse
4. **Task Sharing**: Share tasks between users (with proper permissions)
