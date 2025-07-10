# Task Restart Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing task restart functionality that allows the API client to continue tasks created in any context (VSCode Extension, CLI, or API).

## Prerequisites

- Understanding of the existing Task system architecture
- Familiarity with the API server structure
- Knowledge of the storage system for tasks
- Understanding of the VSCode extension task loading mechanism

## Implementation Steps

### Step 1: API Client Enhancement

#### 1.1 Modify api-client.js Parameter Parsing

**Location**: `api-client.js` (lines 39-80)

Add task restart parameter support:

```javascript
// Add new variables at the top with other declarations
let taskId = null
let restartTask = false

// Add to the parameter parsing loop (around line 39)
} else if (arg === "--task") {
    taskId = args[++i]
    if (!taskId) {
        console.error("Error: --task requires a task ID")
        process.exit(1)
    }
    restartTask = true
    console.log(`Task restart mode: ${taskId}`)
```

#### 1.2 Update Help Text

Add task restart information to help text:

```javascript
// In the help text section
console.log("  --task <id>     Restart an existing task by ID")
console.log("")
console.log("Examples:")
console.log('  node api-client.js --stream "Create a todo app"')
console.log('  node api-client.js --stream --task abc123-def456 "Add authentication"')
```

#### 1.3 Modify Request Payload

Update the request body construction:

```javascript
// In both streaming and non-streaming request sections
const requestBody = JSON.stringify({
	task: task,
	mode: mode,
	...(restartTask && {
		taskId: taskId,
		restartTask: true,
	}),
})
```

#### 1.4 Add Task ID Validation

Add basic validation for task ID format:

```javascript
function validateTaskId(taskId) {
    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(taskId)
}

// Use in parameter parsing
} else if (arg === "--task") {
    taskId = args[++i]
    if (!taskId) {
        console.error("Error: --task requires a task ID")
        process.exit(1)
    }
    if (!validateTaskId(taskId)) {
        console.error("Error: Invalid task ID format. Expected UUID format.")
        process.exit(1)
    }
    restartTask = true
    console.log(`Task restart mode: ${taskId}`)
```

### Step 2: API Server Request Interface

#### 2.1 Update API Request Types

**Location**: `src/api/index.ts`

```typescript
export interface ApiRequest {
	task: string
	mode?: string
	taskId?: string // New field for restart
	restartTask?: boolean // New field to indicate restart
}

export interface ApiMetadata {
	mode?: string
	taskId: string
	restartTask?: boolean // Add restart flag to metadata
}
```

#### 2.2 Update Request Validation

**Location**: `src/api/server/FastifyServer.ts`

Add validation schema for restart requests:

```typescript
// Add to the schema definitions
const restartTaskSchema = {
	type: "object",
	properties: {
		task: { type: "string" },
		mode: { type: "string" },
		taskId: { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
		restartTask: { type: "boolean" },
	},
	required: ["task"],
	additionalProperties: false,
}
```

### Step 3: Unified Task Service

#### 3.1 Create UnifiedTaskService

**Location**: `src/shared/services/UnifiedTaskService.ts` (new file)

```typescript
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
		const firstMessage =
			uiMessages.find((m) => m.type === "ask" && m.ask === "request_limit_exceeded_new_task") ||
			uiMessages.find((m) => m.type === "say" && m.say === "text")

		const task = this.extractTaskFromMessages(apiHistory, uiMessages)
		const { tokensIn, tokensOut, totalCost } = this.calculateTokenUsage(apiHistory)
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

		// Fallback to UI messages
		const taskMessage = uiMessages.find((m) => m.type === "say" && m.say === "text")
		return taskMessage?.text?.substring(0, 100) || "Unknown task"
	}

	private calculateTokenUsage(apiHistory: ApiMessage[]): { tokensIn: number; tokensOut: number; totalCost: number } {
		let tokensIn = 0
		let tokensOut = 0
		let totalCost = 0

		for (const message of apiHistory) {
			if (message.usage) {
				tokensIn += message.usage.input_tokens || 0
				tokensOut += message.usage.output_tokens || 0
				// Cost calculation would depend on the provider
				totalCost +=
					(message.usage.input_tokens || 0) * 0.000003 + (message.usage.output_tokens || 0) * 0.000015
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
```

### Step 4: FastifyServer Task Restart Logic

#### 4.1 Add Task Loading Methods

**Location**: `src/api/server/FastifyServer.ts`

Add these methods to the FastifyServer class:

```typescript
private unifiedTaskService: UnifiedTaskService

// In constructor, after other initializations
constructor(config: ApiConfigManager) {
    // ... existing initialization
    this.unifiedTaskService = new UnifiedTaskService(
        this.config.getConfiguration().globalStoragePath || getStoragePath()
    )
}

private async loadExistingTask(taskId: string): Promise<TaskData | null> {
    try {
        this.app.log.info(`Loading existing task: ${taskId}`)
        const taskData = await this.unifiedTaskService.findTask(taskId)

        if (!taskData) {
            this.app.log.warn(`Task not found: ${taskId}`)
            return null
        }

        this.app.log.info(`Successfully loaded task ${taskId} from ${taskData.originContext} context`)
        return taskData
    } catch (error) {
        this.app.log.error(`Failed to load task ${taskId}:`, error)
        return null
    }
}

private async continueExistingTask(
    taskData: TaskData,
    newUserMessage: string,
    reply: FastifyReply,
    sseAdapter: SSEOutputAdapter,
    job: Job
): Promise<void> {
    try {
        this.app.log.info(`Continuing task ${taskData.historyItem.id} with new message`)

        // Send initial start event with task continuation info
        await sseAdapter.emitStart(
            `Continuing task from ${taskData.originContext} context`,
            newUserMessage,
            taskData.historyItem.id
        )

        // Get API configuration (same as new tasks)
        const apiConfiguration = await this.getApiConfiguration()

        // Create task options with existing history
        const taskOptions = {
            apiConfiguration,
            task: newUserMessage, // The new message to continue with
            mode: taskData.mode,
            historyItem: taskData.historyItem, // This triggers resume from history
            startTask: false, // Don't auto-start, we'll resume manually
            fileSystem: this.adapters.fileSystem,
            terminal: this.adapters.terminal,
            browser: this.adapters.browser,
            userInterface: sseAdapter, // Use SSE adapter for communication
            telemetry: this.adapters.telemetry,
            workspacePath: taskData.workspace || this.config.getConfiguration().workspaceRoot || process.cwd(),
            globalStoragePath: this.config.getConfiguration().globalStoragePath || getStoragePath(),
            verbose: this.config.getConfiguration().verbose || false,
            logger: this.adapters.logger,
            customModesService: this.customModesService,
            outputAdapter: sseAdapter
        }

        this.app.log.info(`Creating Task instance for continued task ${taskData.historyItem.id}`)

        // Create Task instance
        const [taskInstance, taskPromise] = Task.create(taskOptions)

        // Restore API conversation history
        taskInstance.apiConversationHistory = taskData.apiConversationHistory

        this.app.log.info(`Task instance created, starting job tracking for ${job.id}`)

        // Start job tracking
        await this.jobManager.startJob(job.id, taskInstance, this.taskExecutionOrchestrator)

        // Create execution handler
        const executionHandler = new ApiTaskExecutionHandler(
            sseAdapter,
            this.questionManager,
            this.app.log
        )

        // Execute with orchestrator (similar to new tasks)
        const executionOptions = {
            isInfoQuery: false,
            slidingTimeoutMs: this.config.getConfiguration().timeouts?.task,
            useSlidingTimeout: true,
            taskIdentifier: job.id
        }

        this.app.log.info(`Starting task execution for continued task ${job.id}`)

        // Resume the task with the new message
        await taskInstance.resumePausedTask(newUserMessage)

        // Execute with orchestrator
        this.taskExecutionOrchestrator
            .executeTask(taskInstance, taskPromise, executionHandler, executionOptions)
            .then(async (result) => {
                this.app.log.info(`Task ${job.id} completed successfully`)
                await sseAdapter.emitCompletion(
                    "Task completed successfully",
                    taskData.historyItem.id
                )
                await sseAdapter.close()
            })
            .catch(async (error) => {
                this.app.log.error(`Task ${job.id} failed:`, error)
                await sseAdapter.emitError(`Task execution failed: ${error.message}`)
                await sseAdapter.close()
            })

    } catch (error) {
        this.app.log.error(`Failed to continue task ${taskData.historyItem.id}:`, error)
        await sseAdapter.emitError(`Failed to continue task: ${error.message}`)
        await sseAdapter.close()
    }
}
```

#### 4.2 Modify Streaming Endpoint

**Location**: `src/api/server/FastifyServer.ts` (in the `/chat/stream` endpoint)

Update the streaming endpoint to handle restart requests:

```typescript
// In the /chat/stream endpoint handler (around line 180)
const body = request.body as any
const task = body.task || "No task specified"
const mode = body.mode || "code"
const taskId = body.taskId
const restartTask = body.restartTask || false

this.app.log.info(`Received ${restartTask ? "restart" : "new"} task request`)
if (restartTask) {
	this.app.log.info(`Task restart requested for: ${taskId}`)
} else {
	this.app.log.info(`New task: ${task}`)
}

// Handle task restart
if (restartTask && taskId) {
	const taskData = await this.loadExistingTask(taskId)
	if (!taskData) {
		reply.code(404).send({
			error: "Task not found",
			message: `Task ${taskId} could not be found or loaded. It may have been deleted or corrupted.`,
			taskId: taskId,
		})
		return
	}

	// Create job for the continued task
	const job = this.jobManager.createJob(`Continue: ${task}`, {
		mode: taskData.mode,
		originalTaskId: taskId,
	})

	this.app.log.info(`Created continuation job ${job.id} for task ${taskId}`)

	// Set up SSE
	reply.raw.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "Cache-Control",
	})

	const sseAdapter = new SSEOutputAdapter(reply.raw, this.questionManager)

	// Continue the existing task
	await this.continueExistingTask(taskData, task, reply, sseAdapter, job)
	return
}

// ... rest of the existing new task logic
```

### Step 5: SSE Adapter Enhancement

#### 5.1 Update SSE Events to Include Task ID

**Location**: `src/api/streaming/SSEOutputAdapter.ts`

Modify the `emitStart` method:

```typescript
async emitStart(message: string = "Task started", task?: string, taskId?: string): Promise<void> {
    const event: SSEEvent = {
        type: "start",
        timestamp: Date.now(),
        data: {
            message,
            task,
            ...(taskId && { taskId }) // Include task ID if provided
        }
    }
    await this.sendEvent(event)
}
```

Add a new method for completion with restart info:

```typescript
async emitCompletion(message: string, taskId?: string): Promise<void> {
    const event: SSEEvent = {
        type: "completion",
        timestamp: Date.now(),
        data: {
            message,
            ...(taskId && {
                taskId,
                restartCommand: `--task ${taskId}`
            })
        }
    }
    await this.sendEvent(event)
}
```

### Step 6: Task Resume Enhancement

#### 6.1 Enhance resumePausedTask Method

**Location**: `src/core/task/Task.ts`

Ensure the `resumePausedTask` method works properly for API context:

```typescript
public async resumePausedTask(lastMessage: string) {
    this.logInfo(`Resuming task with new message: ${lastMessage.substring(0, 100)}...`)

    // Add the new user message to continue the conversation
    await this.say("user", lastMessage)

    // Resume from history - this will restore the conversation and continue
    await this.resumeTaskFromHistory()

    this.logInfo("Task resumed successfully")
}
```

### Step 7: Error Handling

#### 7.1 Add Comprehensive Error Handling

**Location**: `src/api/server/FastifyServer.ts`

Add error handling for various restart scenarios:

```typescript
private handleTaskRestartError(error: any, taskId: string, reply: FastifyReply): void {
    this.app.log.error(`Task restart error for ${taskId}:`, error)

    let statusCode = 500
    let errorMessage = "Internal server error"
    let suggestions: string[] = []

    if (error.code === 'ENOENT') {
        statusCode = 404
        errorMessage = `Task ${taskId} not found`
        suggestions = [
            "Verify the task ID is correct",
            "Use the list_tasks tool to see available tasks",
            "The task may have been deleted or moved"
        ]
    } else if (error.name === 'SyntaxError') {
        statusCode = 422
        errorMessage = `Task ${taskId} data is corrupted`
        suggestions = [
            "The task data files may be corrupted",
            "Try creating a new task instead",
            "Contact support if this persists"
        ]
    } else if (error.code === 'EACCES') {
        statusCode = 403
        errorMessage = `Access denied to task ${taskId}`
        suggestions = [
            "Check file permissions",
            "Ensure you have access to the task storage directory"
        ]
    }

    reply.code(statusCode).send({
        error: errorMessage,
        taskId: taskId,
        suggestions: suggestions,
        timestamp: new Date().toISOString()
    })
}
```

### Step 8: Configuration

#### 8.1 Add Task Restart Configuration

**Location**: `src/api/config/ApiConfigManager.ts`

Add configuration options for task restart:

```typescript
// In the configuration schema
taskRestart: z.object({
	enabled: z.boolean().default(true),
	crossContextAccess: z.boolean().default(true),
	maxRestartAttempts: z.number().default(3),
	taskLoadTimeoutMs: z.number().default(10000),
}).optional()
```

### Step 9: Testing

#### 9.1 Create Test Cases

**Location**: `src/api/server/__tests__/FastifyServer.restart.test.ts` (new file)

```typescript
import { FastifyServer } from "../FastifyServer"
import { ApiConfigManager } from "../../config/ApiConfigManager"

describe("FastifyServer Task Restart", () => {
	let server: FastifyServer
	let config: ApiConfigManager

	beforeEach(async () => {
		config = new ApiConfigManager()
		server = new FastifyServer(config)
		await server.initialize()
	})

	afterEach(async () => {
		await server.shutdown()
	})

	describe("Task Restart Endpoint", () => {
		it("should restart existing task successfully", async () => {
			// Test implementation
		})

		it("should return 404 for non-existent task", async () => {
			// Test implementation
		})

		it("should handle corrupted task data gracefully", async () => {
			// Test implementation
		})
	})
})
```

## Deployment Checklist

- [ ] API client parameter parsing implemented and tested
- [ ] API server task loading logic implemented
- [ ] UnifiedTaskService created and tested
- [ ] Task restart detection and routing implemented
- [ ] SSE adapter enhanced with task ID support
- [ ] Error handling implemented for all failure scenarios
- [ ] Configuration options added and documented
- [ ] Integration tests passing
- [ ] Performance benchmarks meet requirements
- [ ] Security validation implemented
- [ ] Documentation updated

## Usage Examples

### Starting a New Task

```bash
node api-client.js --stream "Create a todo application with React"
# Output includes: Task ID: abc123-def456-ghi789
```

### Restarting an Existing Task

```bash
node api-client.js --stream --task abc123-def456-ghi789 "Add user authentication to the todo app"
```

### Listing Available Tasks

```bash
node api-client.js --stream "list all my tasks"
```

## Troubleshooting

### Common Issues

1. **Task Not Found**: Verify task ID format and existence
2. **Permission Denied**: Check storage directory permissions
3. **Corrupted Task Data**: Task files may be damaged, create new task
4. **Context Mismatch**: Workspace paths may differ between contexts

### Debug Commands

```bash
# Enable verbose logging
node api-client.js --verbose --stream --task abc123 "continue task"

# Check task storage
ls -la ~/.vscode/extensions/*/globalStorage/*/tasks/

# Validate task data
cat ~/.vscode/extensions/*/globalStorage/*/tasks/abc123/api_conversation_history.json
```

This implementation guide provides a complete roadmap for adding task restart functionality to the API client while maintaining compatibility with existing systems.
