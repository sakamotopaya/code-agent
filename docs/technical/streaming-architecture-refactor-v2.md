# Streaming Architecture Refactor: Revised Design Based on Feedback

## Problem Statement

The current streaming architecture has several critical issues that violate interface abstraction principles and bypass valuable logic:

1. **TaskApiHandler has hardcoded `this.cliMode` checks** that circumvent interface abstraction
2. **Output adapters are created but never used** - FastifyServer creates adapters but doesn't inject them
3. **TaskMessaging.addToClineMessages()** doesn't utilize adapters and has hardcoded `providerRef` logic
4. **Mixed concerns** - event notification vs content output vs state management are conflated

## Revised Architecture Design

### Core Insight: Simplified Adapter Hierarchy

Based on architectural feedback, the solution uses **two adapters** instead of the originally proposed three:

1. **IOutputAdapter**: Handles all content output (including internal streaming strategy)
2. **IStateAdapter**: Handles mode-specific state management (replaces hardcoded `providerRef` logic)

### Key Design Principles

1. **Single Responsibility**: Each adapter has one clear purpose
2. **Internal Strategy**: OutputAdapter internally decides how to handle immediate vs processed content
3. **No Hardcoded Logic**: All mode-specific logic moves to adapters
4. **Event Separation**: onMessage callback remains for event notification, separate from content output

## Interface Definitions

### Revised IOutputAdapter Interface

```typescript
/**
 * Unified interface for all content output
 * Internally handles streaming strategy (immediate + processed)
 */
export interface IOutputAdapter {
	/**
	 * Output a complete message with both immediate streaming and processed content
	 * Adapter internally handles streaming strategy
	 */
	outputContent(message: ClineMessage): Promise<void>

	/**
	 * Output partial/updating content (for streaming updates)
	 */
	outputPartialContent(partialMessage: ClineMessage): Promise<void>

	/**
	 * Reset adapter state for new task
	 */
	reset(): void
}
```

### New IStateAdapter Interface

```typescript
/**
 * Interface for mode-specific state management
 * Replaces hardcoded providerRef logic in TaskMessaging
 */
export interface IStateAdapter {
	/**
	 * Update overall state (replaces provider.postStateToWebview())
	 */
	updateState(): Promise<void>

	/**
	 * Update task history (replaces provider.updateTaskHistory())
	 */
	updateHistory(historyItem: HistoryItem): Promise<void>

	/**
	 * Send partial message updates (replaces provider.postMessageToWebview())
	 */
	sendPartialUpdate(partialMessage: ClineMessage): Promise<void>
}
```

## Implementation Strategy

### 1. TaskMessaging Refactor

```typescript
export class TaskMessaging {
	constructor(
		private taskId: string,
		private instanceId: string,
		private taskNumber: number,
		private globalStoragePath: string,
		private workspacePath: string,
		private outputAdapter?: IOutputAdapter, // handles content output
		private stateAdapter?: IStateAdapter, // handles state management
		// Remove providerRef - logic moves to stateAdapter
	) {}

	async addToClineMessages(
		message: ClineMessage,
		onMessage?: (action: "created" | "updated", message: ClineMessage) => void,
	) {
		// 1. Add to internal messages array
		this.clineMessages.push(message)

		// 2. Output content through adapter (adapter handles streaming strategy)
		if (this.outputAdapter) {
			try {
				await this.outputAdapter.outputContent(message)
			} catch (error) {
				console.error("Output adapter error:", error)
			}
		}

		// 3. Update state through adapter (replaces hardcoded providerRef logic)
		if (this.stateAdapter) {
			try {
				await this.stateAdapter.updateState()
			} catch (error) {
				console.error("State adapter error:", error)
			}
		}

		// 4. Event notification (separate concern from output)
		onMessage?.("created", message)

		// 5. Persistence
		await this.saveClineMessages()

		// 6. Telemetry (existing logic)
		const shouldCaptureMessage = message.partial !== true && CloudService.isEnabled()
		if (shouldCaptureMessage) {
			CloudService.instance.captureEvent({
				event: TelemetryEventName.TASK_MESSAGE,
				properties: { taskId: this.taskId, message },
			})
		}
	}

	async updateClineMessage(
		partialMessage: ClineMessage,
		onMessage?: (action: "created" | "updated", message: ClineMessage) => void,
	) {
		// Output partial content through adapter
		if (this.outputAdapter) {
			try {
				await this.outputAdapter.outputPartialContent(partialMessage)
			} catch (error) {
				console.error("Output adapter error:", error)
			}
		}

		// Send partial update through state adapter (replaces provider.postMessageToWebview)
		if (this.stateAdapter) {
			try {
				await this.stateAdapter.sendPartialUpdate(partialMessage)
			} catch (error) {
				console.error("State adapter error:", error)
			}
		}

		// Event notification
		onMessage?.("updated", partialMessage)

		// Telemetry
		const shouldCaptureMessage = partialMessage.partial !== true && CloudService.isEnabled()
		if (shouldCaptureMessage) {
			CloudService.instance.captureEvent({
				event: TelemetryEventName.TASK_MESSAGE,
				properties: { taskId: this.taskId, message: partialMessage },
			})
		}
	}
}
```

### 2. VSCode Adapter Implementations

```typescript
// src/core/adapters/vscode/VSCodeOutputAdapter.ts
export class VSCodeOutputAdapter implements IOutputAdapter {
	private contentProcessor: IContentProcessor

	constructor(private provider: ClineProvider) {
		this.contentProcessor = new SharedContentProcessor()
	}

	async outputContent(message: ClineMessage): Promise<void> {
		if (!message.text) return

		// 1. Immediate streaming for user feedback
		await this.streamRawChunk(message.text)

		// 2. Process content for structured display
		const processedContent = await this.contentProcessor.processContent(message.text)
		await this.outputProcessedContent(processedContent)
	}

	async outputPartialContent(partialMessage: ClineMessage): Promise<void> {
		if (!partialMessage.text) return

		// Stream partial content immediately
		await this.streamRawChunk(partialMessage.text)
	}

	private async streamRawChunk(chunk: string): Promise<void> {
		// Immediate webview streaming
		await this.provider.postMessageToWebview({
			type: "streamingChunk",
			chunk,
			timestamp: new Date().toISOString(),
		})
	}

	private async outputProcessedContent(content: ProcessedContent[]): Promise<void> {
		for (const item of content) {
			if (item.shouldDisplay) {
				await this.provider.postMessageToWebview({
					type: "processedContent",
					content: item,
					timestamp: new Date().toISOString(),
				})
			}
		}
	}

	reset(): void {
		this.contentProcessor.reset()
	}
}

// src/core/adapters/vscode/VSCodeStateAdapter.ts
export class VSCodeStateAdapter implements IStateAdapter {
	constructor(private provider: ClineProvider) {}

	async updateState(): Promise<void> {
		await this.provider.postStateToWebview()
	}

	async updateHistory(historyItem: HistoryItem): Promise<void> {
		await this.provider.updateTaskHistory(historyItem)
	}

	async sendPartialUpdate(partialMessage: ClineMessage): Promise<void> {
		await this.provider.postMessageToWebview({
			type: "partialMessage",
			partialMessage,
		})
	}
}
```

### 3. CLI Adapter Implementations

```typescript
// src/core/adapters/cli/CLIOutputAdapter.ts
export class CLIOutputAdapter implements IOutputAdapter {
	private contentProcessor: IContentProcessor
	private useColor: boolean

	constructor(useColor: boolean = true) {
		this.useColor = useColor
		this.contentProcessor = new SharedContentProcessor()
	}

	async outputContent(message: ClineMessage): Promise<void> {
		if (!message.text) return

		// 1. Immediate console output
		process.stdout.write(message.text)

		// 2. For CLI, immediate output is usually sufficient
		// Could add structured formatting here if needed
	}

	async outputPartialContent(partialMessage: ClineMessage): Promise<void> {
		if (!partialMessage.text) return
		process.stdout.write(partialMessage.text)
	}

	reset(): void {
		this.contentProcessor.reset()
	}
}

// src/core/adapters/cli/CLIStateAdapter.ts
export class CLIStateAdapter implements IStateAdapter {
	async updateState(): Promise<void> {
		// CLI doesn't need state updates
	}

	async updateHistory(historyItem: HistoryItem): Promise<void> {
		// CLI could log history updates if needed
		console.debug("Task history updated:", historyItem.id)
	}

	async sendPartialUpdate(partialMessage: ClineMessage): Promise<void> {
		// CLI doesn't need separate partial updates
	}
}
```

### 4. SSE Adapter Implementations

```typescript
// src/core/adapters/api/SSEOutputAdapter.ts
export class SSEOutputAdapter implements IOutputAdapter {
	private contentProcessor: IContentProcessor

	constructor(private sseAdapter: SSEOutputAdapter) {
		this.contentProcessor = new SharedContentProcessor()
	}

	async outputContent(message: ClineMessage): Promise<void> {
		if (!message.text) return

		// 1. Immediate SSE streaming
		await this.sseAdapter.emitRawChunk(message.text)

		// 2. Process and emit structured content
		const processedContent = await this.contentProcessor.processContent(message.text)
		for (const item of processedContent) {
			if (item.shouldDisplay) {
				const event: SSEEvent = {
					type: this.getEventType(item),
					jobId: this.sseAdapter.jobId,
					message: item.content,
					toolName: item.toolName,
					contentType: item.contentType,
					timestamp: new Date().toISOString(),
				}
				await this.sseAdapter.emitSSEEvent(event)
			}
		}
	}

	async outputPartialContent(partialMessage: ClineMessage): Promise<void> {
		if (!partialMessage.text) return
		await this.sseAdapter.emitRawChunk(partialMessage.text)
	}

	private getEventType(content: ProcessedContent): SSEEventType {
		if (content.isToolIndicator) return SSE_EVENTS.TOOL_USE
		switch (content.contentType) {
			case "tool_call":
				return SSE_EVENTS.TOOL_USE
			case "content":
				return SSE_EVENTS.PROGRESS
			case "thinking":
				return SSE_EVENTS.LOG
			default:
				return SSE_EVENTS.PROGRESS
		}
	}

	reset(): void {
		this.contentProcessor.reset()
	}
}

// src/core/adapters/api/SSEStateAdapter.ts
export class SSEStateAdapter implements IStateAdapter {
	constructor(private sseAdapter: SSEOutputAdapter) {}

	async updateState(): Promise<void> {
		// Could emit state update events if needed
		await this.sseAdapter.emitSSEEvent({
			type: SSE_EVENTS.LOG,
			jobId: this.sseAdapter.jobId,
			message: "State updated",
			timestamp: new Date().toISOString(),
		})
	}

	async updateHistory(historyItem: HistoryItem): Promise<void> {
		// Could emit history update events
	}

	async sendPartialUpdate(partialMessage: ClineMessage): Promise<void> {
		// SSE handles partial updates through outputPartialContent
	}
}
```

### 5. Task Constructor Updates

```typescript
class Task {
	constructor(options: TaskOptions) {
		// ... existing initialization ...

		// Create appropriate adapters based on available interfaces
		const adapters = this.createAdapters(options)

		// Initialize TaskMessaging with adapters (no more providerRef)
		this.messaging = new TaskMessaging(
			this.taskId,
			this.instanceId,
			this.taskNumber,
			this.globalStoragePath,
			this.workspacePath,
			adapters.output,
			adapters.state,
		)
	}

	private createAdapters(options: TaskOptions): {
		output: IOutputAdapter
		state: IStateAdapter
	} {
		if (options.provider) {
			// VSCode Extension mode
			return {
				output: new VSCodeOutputAdapter(options.provider),
				state: new VSCodeStateAdapter(options.provider),
			}
		} else if (options.userInterface && this.isSSEAdapter(options.userInterface)) {
			// API mode with SSE
			const sseAdapter = options.userInterface as SSEOutputAdapter
			return {
				output: new SSEOutputAdapter(sseAdapter),
				state: new SSEStateAdapter(sseAdapter),
			}
		} else {
			// CLI mode
			return {
				output: new CLIOutputAdapter(),
				state: new CLIStateAdapter(),
			}
		}
	}
}
```

### 6. TaskApiHandler Simplification

```typescript
case "text": {
    assistantMessage += chunk.text
    const prevLength = this.assistantMessageContent.length
    this.assistantMessageContent = parseAssistantMessage(assistantMessage)

    // Single path through messaging system - adapters handle everything
    if (chunk.text) {
        this.messaging.say(
            "text",
            chunk.text,
            undefined,
            true, // partial
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            this.onMessage, // Still used for event notification
        ).catch((error) => {
            this.log(`[TaskApiHandler] Error in messaging system:`, error)
        })
    }

    if (this.assistantMessageContent.length > prevLength) {
        this.userMessageContentReady = false
    }
    break
}
```

## Benefits of Revised Design

### 1. **Cleaner Separation of Concerns**

- **IOutputAdapter**: Handles content display (internal streaming strategy)
- **IStateAdapter**: Handles mode-specific state management
- **onMessage**: Handles event notification only

### 2. **Eliminates All Hardcoded Logic**

- No more `this.cliMode` checks in TaskApiHandler
- No more `providerRef` logic in TaskMessaging
- All mode-specific logic moves to adapters

### 3. **Internal Strategy Pattern**

- OutputAdapter internally decides immediate vs processed content strategy
- No need for TaskMessaging to orchestrate multiple adapters
- Each mode can optimize its own streaming approach

### 4. **Event vs Output Separation**

- `onMessage` callback remains for event-driven workflows
- Content output goes through adapters
- Clear distinction between "notify that something happened" vs "display content"

### 5. **Better Error Isolation**

- Adapter failures don't crash the entire pipeline
- Each adapter can implement its own error recovery
- Graceful degradation if adapters fail

## Migration Strategy

### Phase 1: Create New Interfaces and Adapters

- Define IOutputAdapter and IStateAdapter interfaces
- Implement all adapter classes
- Add comprehensive unit tests

### Phase 2: Update TaskMessaging

- Remove providerRef parameter from constructor
- Add outputAdapter and stateAdapter parameters
- Update addToClineMessages() and updateClineMessage()

---

## CURRENT STATUS: CLI Hang Investigation (Dec 21, 2025)

### ✅ SUCCESS: Streaming Architecture Implementation Works

From test logs, we confirmed:

- CLIProvider and CLIOutputAdapter initialize successfully
- Unified `TaskMessaging.streamChunk()` works correctly
- Real-time streaming displays properly: "Hello World!" output streamed
- Task completes successfully with `attempt_completion`

### ❌ ISSUE: CLI Hangs During Cleanup Phase

The hang occurs **AFTER** successful task completion, during child process cleanup. This is NOT a streaming architecture issue.

### 🔍 REMAINING HARDCODED `this.cliMode` CHECKS

Found 6 instances in `src/core/task/TaskApiHandler.ts`:

```typescript
// Line 58: Mode initialization
this.cliMode = true

// Line 63: Logging conditional
if (this.cliMode) {
    getCLILogger().debug(message, ...args)
}

// Line 89: Configuration logging
if (this.cliMode) {
    this.log(`[TaskApiHandler.attemptApiRequest] Running in CLI mode, using default configuration`)
}

// Line 123: Debug output
cliMode: this.cliMode,

// Line 140: Custom condensing prompt conditional
if (!this.cliMode && state) {
    customCondensingPrompt = state.customCondensingPrompt
}

// Line 561: CLI logger reset
if (this.cliMode) {
    getCLILogger().resetToolDisplay()
}
```

## PROPOSED METHODICAL APPROACH

### Step 1: Add Cleanup Logging (Safe, Diagnostic Only)

**Objective**: Identify exact hang location without changing behavior

**File: `src/cli/services/CleanupManager.ts` (or equivalent cleanup file)**

```typescript
// Add detailed logging around suspected hang points
console.log(`[CLEANUP-DEBUG] Starting cleanup phase`)
console.log(`[CLEANUP-DEBUG] Active handles: ${process._getActiveHandles().length}`)
console.log(`[CLEANUP-DEBUG] Active requests: ${process._getActiveRequests().length}`)

// Before each cleanup operation:
console.log(`[CLEANUP-DEBUG] Starting: Child process cleanup`)
// ... existing cleanup code ...
console.log(`[CLEANUP-DEBUG] Completed: Child process cleanup`)

console.log(`[CLEANUP-DEBUG] Starting: MCP server disposal`)
// ... existing cleanup code ...
console.log(`[CLEANUP-DEBUG] Completed: MCP server disposal`)
```

### Step 2: Conservative `this.cliMode` Cleanup (Low Risk Only)

**Objective**: Remove only non-critical hardcoded checks

**File: `src/core/task/TaskApiHandler.ts`**

**SAFE CHANGE - Line 140 (Custom Condensing Prompt):**

```typescript
// BEFORE:
if (!this.cliMode && state) {
	customCondensingPrompt = state.customCondensingPrompt
}

// AFTER:
if (state) {
	customCondensingPrompt = state.customCondensingPrompt
}
```

**Rationale**: This just makes custom condensing available to all modes, no side effects.

**KEEP UNCHANGED (High Risk):**

- Line 58: `this.cliMode = true` - Core mode detection
- Line 63, 89: Logging conditionals - Could affect debugging during hang investigation
- Line 123: Debug output - Informational only, leave for now
- Line 561: `getCLILogger().resetToolDisplay()` - Tool display state, could have side effects

### Step 3: Test Individual Changes

**Testing Protocol:**

1. Make ONLY Step 1 changes (logging)
2. Run test: `npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "say hello" --verbose`
3. If hangs, analyze logs to identify exact hang point
4. If logs identify issue, make targeted fix
5. Only then proceed with Step 2 (Line 140 change)
6. Test again after each individual change

### Step 4: Rollback Strategy

**Before making ANY code changes:**

1. Create git commit of current working state
2. Keep original code commented for immediate restoration
3. Have exact rollback commands ready

**Rollback Protocol:**

```bash
# If any change causes issues:
git checkout HEAD~1 -- src/core/task/TaskApiHandler.ts
git checkout HEAD~1 -- src/cli/services/CleanupManager.ts  # or relevant file
```

## QUESTIONS FOR APPROVAL

1. **Should I start with Step 1 (cleanup logging) only?**
2. **Are you comfortable with the Line 140 `this.cliMode` removal in Step 2?**
3. **Any specific cleanup areas you want me to focus logging on?**
4. **Should I investigate the child process cleanup specifically, since logs show MCP server disconnection issues?**

## HYPOTHESIS

Based on logs showing MCP server disconnection hanging, the issue may be in:

- `src/cli/connections/StdioMcpConnection.ts`
- `src/services/mcp/McpServerManager.ts`
- Child process termination logic

The streaming architecture changes are working correctly.

- Replace all providerRef usage with adapter calls

### Phase 3: Update Task Constructor

- Add createAdapters() method
- Inject adapters into TaskMessaging
- Remove providerRef from TaskMessaging construction

### Phase 4: Simplify TaskApiHandler

- Remove all cliMode checks
- Simplify streaming logic to single TaskMessaging.say() call
- Remove cliMode parameter from constructor

This revised architecture provides a much cleaner separation of concerns while addressing all the feedback about over-engineering and hardcoded logic.
