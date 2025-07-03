# Streaming Architecture Refactor: Fix LLM SSE Events and Output Adapter Integration

## Problem Statement

The current streaming architecture has several critical issues that violate interface abstraction principles and bypass valuable logic:

1. **TaskApiHandler has hardcoded `this.cliMode` checks** (lines 610-645) that circumvent the interface abstraction
2. **Output adapters are created but never used** - FastifyServer creates SSEStreamingAdapter and SSEContentOutputAdapter but doesn't inject them into Task/TaskMessaging
3. **TaskMessaging.say() → addToClineMessages()** doesn't utilize output adapters for proper content emission
4. **Valuable logic is bypassed** - TaskApiHandler directly calls `getCLILogger().streamLLMOutput()` and `task.userInterface.emitRawChunk()` instead of flowing through TaskMessaging
5. **onMessage handler in Task.ts** (line 557) emits Task events, but streaming should flow through interfaces

## Current Architecture Issues

### Issue 1: Hard-coded Mode Detection in TaskApiHandler.ts

```typescript
// Lines 610-645 - PROBLEMATIC CODE
if (this.cliMode && chunk.text) {
	getCLILogger().streamLLMOutput(chunk.text)
}

if (!this.cliMode && chunk.text) {
	// Direct userInterface access bypassing messaging system
	const task = this.taskRef?.deref()
	if (task?.userInterface && "emitRawChunk" in task.userInterface) {
		await (task.userInterface as any).emitRawChunk(chunk.text)
	}
}
```

### Issue 2: Unused Output Adapters in FastifyServer.ts

```typescript
// Lines 172-173 - CREATED BUT NEVER USED
const sseStreamingAdapter = new SSEStreamingAdapter(sseAdapter)
const sseContentOutputAdapter = new SSEContentOutputAdapter(sseAdapter)
```

### Issue 3: TaskMessaging.addToClineMessages() Lacks Output Logic

The `addToClineMessages()` method only handles persistence and webview updates, but doesn't emit to output adapters for streaming or processed content display.

## Proposed Solution Architecture

### Core Principle: Single Flow Through TaskMessaging

All content (CLI, API, VSCode) should flow through:
`TaskApiHandler` → `TaskMessaging.say()` → `TaskMessaging.addToClineMessages()` → Output Adapters

### Phase 1: Interface Injection into TaskMessaging

#### 1.1 Update TaskMessaging Constructor

```typescript
export class TaskMessaging {
	constructor(
		private taskId: string,
		private instanceId: string,
		private taskNumber: number,
		private globalStoragePath: string,
		private workspacePath: string,
		private providerRef?: WeakRef<ClineProvider>,
		private streamingAdapter?: IStreamingAdapter, // NEW
		private contentOutputAdapter?: IContentOutputAdapter, // NEW
		private contentProcessor?: IContentProcessor, // NEW
	) {}
}
```

#### 1.2 Enhanced addToClineMessages() with Output Logic

```typescript
async addToClineMessages(
    message: ClineMessage,
    onMessage?: (action: "created" | "updated", message: ClineMessage) => void,
) {
    // 1. Add to internal messages (existing)
    this.clineMessages.push(message)

    // 2. Immediate streaming for real-time feedback
    if (this.streamingAdapter && message.text) {
        await this.streamingAdapter.streamRawChunk(message.text)
    }

    // 3. Process and emit structured content
    if (this.contentOutputAdapter && this.contentProcessor && message.text) {
        const processedContent = await this.contentProcessor.processContent(message.text)
        await this.contentOutputAdapter.outputProcessedContent(processedContent)
    }

    // 4. Continue with existing logic (provider, persistence, telemetry)
    const provider = this.providerRef?.deref()
    await provider?.postStateToWebview()
    onMessage?.("created", message)
    await this.saveClineMessages()

    // ... existing telemetry and cloud service logic
}
```

### Phase 2: Adapter Creation in Task Constructor

#### 2.1 Mode-Specific Adapter Factory

```typescript
class Task {
	constructor(options: TaskOptions) {
		// ... existing initialization ...

		// Create appropriate output adapters based on available interfaces
		const adapters = this.createOutputAdapters(options)

		// Initialize TaskMessaging with adapters
		this.messaging = new TaskMessaging(
			this.taskId,
			this.instanceId,
			this.taskNumber,
			this.globalStoragePath,
			this.workspacePath,
			this.providerRef,
			adapters.streaming,
			adapters.contentOutput,
			adapters.contentProcessor,
		)
	}

	private createOutputAdapters(options: TaskOptions): {
		streaming: IStreamingAdapter
		contentOutput: IContentOutputAdapter
		contentProcessor: IContentProcessor
	} {
		const sharedProcessor = new SharedContentProcessor()

		if (options.provider) {
			// VSCode Extension mode
			return {
				streaming: new VSCodeStreamingAdapter(options.provider),
				contentOutput: new VSCodeContentOutputAdapter(options.provider),
				contentProcessor: sharedProcessor,
			}
		} else if (options.userInterface && this.isSSEAdapter(options.userInterface)) {
			// API mode with SSE
			const sseAdapter = options.userInterface as SSEOutputAdapter
			return {
				streaming: new SSEStreamingAdapter(sseAdapter),
				contentOutput: new SSEContentOutputAdapter(sseAdapter),
				contentProcessor: sharedProcessor,
			}
		} else {
			// CLI mode
			return {
				streaming: new CLIStreamingAdapter(),
				contentOutput: new CLIContentOutputAdapter(),
				contentProcessor: sharedProcessor,
			}
		}
	}
}
```

### Phase 3: Simplify TaskApiHandler

#### 3.1 Remove Hard-coded Mode Logic

Replace complex streaming logic (lines 610-679) with simple delegation:

```typescript
case "text": {
    assistantMessage += chunk.text
    const prevLength = this.assistantMessageContent.length
    this.assistantMessageContent = parseAssistantMessage(assistantMessage)

    // Single path through messaging system - adapters handle the rest
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
            this.onMessage,
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

#### 3.2 Remove Constructor Parameters

- Remove `cliMode: boolean = false` parameter
- Remove `cliApiConfiguration` parameter
- Remove all `this.cliMode` conditional logic

### Phase 4: Create Missing VSCode Adapters

#### 4.1 VSCode Streaming Adapter

```typescript
// src/core/adapters/vscode/VSCodeOutputAdapters.ts
export class VSCodeStreamingAdapter implements IStreamingAdapter {
	constructor(private provider: ClineProvider) {}

	async streamRawChunk(chunk: string): Promise<void> {
		// Stream to webview for immediate user feedback
		await this.provider.postMessageToWebview({
			type: "streamingChunk",
			chunk,
			timestamp: new Date().toISOString(),
		})
	}

	reset(): void {
		// No state to reset for VSCode streaming
	}
}
```

#### 4.2 VSCode Content Output Adapter

```typescript
export class VSCodeContentOutputAdapter implements IContentOutputAdapter {
	constructor(private provider: ClineProvider) {}

	async outputProcessedContent(content: ProcessedContent[]): Promise<void> {
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
		// No state to reset for VSCode content output
	}
}
```

### Phase 5: Update FastifyServer Integration

#### 5.1 Remove Unused Adapter Creation

```typescript
// REMOVE these unused lines (172-173):
// const sseStreamingAdapter = new SSEStreamingAdapter(sseAdapter)
// const sseContentOutputAdapter = new SSEContentOutputAdapter(sseAdapter)

// Task will create its own adapters based on userInterface
const taskOptions = {
	apiConfiguration,
	task,
	startTask: true,
	userInterface: sseAdapter, // Task will detect this and create SSE adapters
	fileSystem: taskAdapters.fileSystem,
	terminal: taskAdapters.terminal,
	browser: taskAdapters.browser,
	telemetry: taskAdapters.telemetry,
	workspacePath: this.config.getConfiguration().workspaceRoot || process.cwd(),
	verbose: this.config.getConfiguration().debug,
}
```

## Implementation Benefits

### 1. **Unified Code Path**

- All modes (CLI, API, VSCode) use identical `TaskMessaging.say()` → `addToClineMessages()` flow
- No more branching logic based on mode detection

### 2. **True Interface Abstraction**

- Zero hardcoded mode checks in core logic
- Each mode provides its own adapter implementation
- Easy to add new output modes (e.g., file output, network streaming)

### 3. **Immediate + Processed Content**

- `IStreamingAdapter.streamRawChunk()` provides immediate user feedback
- `IContentOutputAdapter.outputProcessedContent()` handles formatted display
- Both happen at the right architectural layer

### 4. **Separation of Concerns**

- TaskApiHandler: Handles LLM API streaming and parsing
- TaskMessaging: Handles message persistence and output coordination
- Output Adapters: Handle mode-specific output formatting and emission

### 5. **Enhanced Testability**

- Each adapter can be unit tested independently
- Mock adapters can be injected for testing
- Clear interfaces make behavior predictable

### 6. **Better Error Handling**

- Adapter failures don't crash the entire streaming pipeline
- Mode-specific error handling in each adapter
- Consistent error reporting through interfaces

## File Modification Summary

### Modified Files:

1. **`src/core/task/TaskMessaging.ts`**

    - Add adapter injection to constructor
    - Enhance `addToClineMessages()` with output logic
    - Add content processing integration

2. **`src/core/task/Task.ts`**

    - Add `createOutputAdapters()` method
    - Inject adapters into TaskMessaging constructor
    - Remove mode-specific logic

3. **`src/core/task/TaskApiHandler.ts`**

    - Remove hardcoded `this.cliMode` checks
    - Simplify text chunk handling
    - Remove constructor mode parameters
    - Delegate all output to TaskMessaging

4. **`src/api/server/FastifyServer.ts`**
    - Remove unused adapter creation
    - Rely on Task to create appropriate adapters

### New Files:

1. **`src/core/adapters/vscode/VSCodeOutputAdapters.ts`**

    - VSCodeStreamingAdapter implementation
    - VSCodeContentOutputAdapter implementation

2. **`src/core/adapters/vscode/index.ts`**
    - Export barrel for VSCode adapters

## Testing Strategy

### Unit Tests:

- Test each adapter independently
- Mock the underlying providers/services
- Verify correct content formatting and emission

### Integration Tests:

- Test complete flow from TaskApiHandler → TaskMessaging → Adapters
- Verify all three modes (CLI, API, VSCode) work correctly
- Test error handling and recovery

### End-to-End Tests:

- CLI: Verify console output matches expected format
- API: Verify SSE events are emitted correctly
- VSCode: Verify webview receives proper streaming updates

## Migration Path

### Phase 1: Infrastructure (Low Risk)

1. Create new adapter files
2. Update interfaces as needed
3. Add unit tests for new adapters

### Phase 2: Integration (Medium Risk)

1. Update TaskMessaging constructor and methods
2. Update Task constructor to create adapters
3. Update integration tests

### Phase 3: Cleanup (Low Risk)

1. Simplify TaskApiHandler by removing hardcoded logic
2. Update FastifyServer to remove unused code
3. Run full test suite to verify functionality

### Phase 4: Validation (Critical)

1. Test all three modes extensively
2. Verify streaming performance is maintained
3. Confirm no regression in functionality

This architecture provides a clean, maintainable solution that properly abstracts output concerns while maintaining the performance characteristics needed for real-time streaming.
