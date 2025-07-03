# Product Requirements Document: Streaming Architecture Refactor

## Overview

**Epic**: Fix LLM SSE Events and Output Adapter Integration
**Priority**: High
**Estimated Effort**: 3-4 sprints
**Business Value**: Eliminates hardcoded mode logic, improves maintainability, enables consistent streaming across all platforms

## Background

The current streaming architecture has fundamental design flaws that prevent proper interface abstraction:

- Hardcoded mode detection in core streaming logic
- Output adapters are created but never utilized
- Valuable processing logic is bypassed
- Inconsistent streaming behavior across CLI, API, and VSCode extension modes

## Goals

1. **Unified Streaming Flow**: All modes use the same code path through TaskMessaging
2. **Interface Abstraction**: Remove all hardcoded mode checks from core logic
3. **Proper Adapter Utilization**: Actually use the output adapters that are created
4. **Consistent Behavior**: Identical streaming behavior across all platforms
5. **Enhanced Maintainability**: Single place to modify streaming logic

## Success Criteria

- [ ] All hardcoded `this.cliMode` checks removed from TaskApiHandler
- [ ] All three modes (CLI, API, VSCode) stream through TaskMessaging.addToClineMessages()
- [ ] Output adapters are properly injected and used
- [ ] Streaming performance is maintained or improved
- [ ] All existing tests pass
- [ ] New unit tests cover adapter functionality

---

## User Stories

### Story 1: Update TaskMessaging to Accept Output Adapters

**As a** developer
**I want** TaskMessaging to accept output adapters during construction
**So that** it can emit content through proper interfaces instead of hardcoded logic

#### Acceptance Criteria:

- [ ] TaskMessaging constructor accepts IStreamingAdapter and IContentOutputAdapter parameters
- [ ] TaskMessaging constructor accepts IContentProcessor parameter
- [ ] All parameters are optional to maintain backward compatibility
- [ ] Constructor parameters are stored as private fields

#### Technical Details:

```typescript
constructor(
    private taskId: string,
    private instanceId: string,
    private taskNumber: number,
    private globalStoragePath: string,
    private workspacePath: string,
    private providerRef?: WeakRef<ClineProvider>,
    private streamingAdapter?: IStreamingAdapter,
    private contentOutputAdapter?: IContentOutputAdapter,
    private contentProcessor?: IContentProcessor
) {}
```

#### Definition of Done:

- [ ] Constructor signature updated
- [ ] All parameters stored as private fields
- [ ] Existing functionality unaffected
- [ ] Unit tests updated to cover new constructor parameters

---

### Story 2: Enhance addToClineMessages with Output Logic

**As a** developer
**I want** TaskMessaging.addToClineMessages() to handle output through adapters
**So that** all streaming logic is centralized in one place

#### Acceptance Criteria:

- [ ] addToClineMessages() calls streamingAdapter.streamRawChunk() for immediate output
- [ ] addToClineMessages() processes content through contentProcessor
- [ ] addToClineMessages() emits processed content through contentOutputAdapter
- [ ] Existing message persistence and provider logic is preserved
- [ ] Error handling prevents adapter failures from breaking the pipeline

#### Technical Details:

```typescript
async addToClineMessages(message: ClineMessage, onMessage?: (action: "created" | "updated", message: ClineMessage) => void) {
    // 1. Existing: Add to internal messages
    this.clineMessages.push(message)

    // 2. NEW: Immediate streaming
    if (this.streamingAdapter && message.text) {
        try {
            await this.streamingAdapter.streamRawChunk(message.text)
        } catch (error) {
            console.error('Streaming adapter error:', error)
        }
    }

    // 3. NEW: Process and emit structured content
    if (this.contentOutputAdapter && this.contentProcessor && message.text) {
        try {
            const processedContent = await this.contentProcessor.processContent(message.text)
            await this.contentOutputAdapter.outputProcessedContent(processedContent)
        } catch (error) {
            console.error('Content output adapter error:', error)
        }
    }

    // 4. Existing: Provider, persistence, telemetry
    const provider = this.providerRef?.deref()
    await provider?.postStateToWebview()
    onMessage?.("created", message)
    await this.saveClineMessages()

    // ... rest of existing logic
}
```

#### Definition of Done:

- [ ] Streaming adapter integration implemented
- [ ] Content processor integration implemented
- [ ] Content output adapter integration implemented
- [ ] Error handling prevents cascading failures
- [ ] All existing functionality preserved
- [ ] Unit tests cover new logic paths

---

### Story 3: Create VSCode Output Adapters

**As a** VSCode extension user
**I want** streaming to work through proper adapters
**So that** I get consistent behavior with other platforms

#### Acceptance Criteria:

- [ ] VSCodeStreamingAdapter implements IStreamingAdapter
- [ ] VSCodeContentOutputAdapter implements IContentOutputAdapter
- [ ] Adapters integrate with existing webview messaging
- [ ] Adapters handle VSCode-specific formatting
- [ ] Adapters include proper error handling

#### Technical Details:

Create `src/core/adapters/vscode/VSCodeOutputAdapters.ts`:

```typescript
export class VSCodeStreamingAdapter implements IStreamingAdapter {
	constructor(private provider: ClineProvider) {}

	async streamRawChunk(chunk: string): Promise<void> {
		await this.provider.postMessageToWebview({
			type: "streamingChunk",
			chunk,
			timestamp: new Date().toISOString(),
		})
	}

	reset(): void {}
}

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

	reset(): void {}
}
```

#### Definition of Done:

- [ ] VSCodeStreamingAdapter class created
- [ ] VSCodeContentOutputAdapter class created
- [ ] Both classes implement required interfaces
- [ ] Integration with ClineProvider webview messaging
- [ ] Unit tests for both adapter classes
- [ ] Export barrel file created

---

### Story 4: Add Adapter Factory to Task Constructor

**As a** developer
**I want** Task to automatically create appropriate output adapters
**So that** each mode gets the right adapter without manual configuration

#### Acceptance Criteria:

- [ ] Task constructor detects available interfaces (provider, userInterface, etc.)
- [ ] Task creates appropriate adapters based on detection
- [ ] VSCode mode creates VSCode adapters
- [ ] API mode creates SSE adapters
- [ ] CLI mode creates CLI adapters
- [ ] Adapters are passed to TaskMessaging constructor
- [ ] Factory method is easily testable

#### Technical Details:

```typescript
private createOutputAdapters(options: TaskOptions): {
    streaming: IStreamingAdapter,
    contentOutput: IContentOutputAdapter,
    contentProcessor: IContentProcessor
} {
    const sharedProcessor = new SharedContentProcessor()

    if (options.provider) {
        // VSCode Extension mode
        return {
            streaming: new VSCodeStreamingAdapter(options.provider),
            contentOutput: new VSCodeContentOutputAdapter(options.provider),
            contentProcessor: sharedProcessor
        }
    } else if (options.userInterface && this.isSSEAdapter(options.userInterface)) {
        // API mode with SSE
        const sseAdapter = options.userInterface as SSEOutputAdapter
        return {
            streaming: new SSEStreamingAdapter(sseAdapter),
            contentOutput: new SSEContentOutputAdapter(sseAdapter),
            contentProcessor: sharedProcessor
        }
    } else {
        // CLI mode
        return {
            streaming: new CLIStreamingAdapter(),
            contentOutput: new CLIContentOutputAdapter(),
            contentProcessor: sharedProcessor
        }
    }
}
```

#### Definition of Done:

- [ ] createOutputAdapters() method implemented
- [ ] Mode detection logic works correctly
- [ ] All three modes create appropriate adapters
- [ ] Adapters passed to TaskMessaging constructor
- [ ] Helper method isSSEAdapter() implemented
- [ ] Unit tests cover all adapter creation paths

---

### Story 5: Simplify TaskApiHandler Streaming Logic

**As a** developer
**I want** TaskApiHandler to delegate all output to TaskMessaging
**So that** there's no hardcoded mode logic in the streaming pipeline

#### Acceptance Criteria:

- [ ] All `this.cliMode` checks removed from TaskApiHandler
- [ ] Direct calls to getCLILogger().streamLLMOutput() removed
- [ ] Direct calls to task.userInterface.emitRawChunk() removed
- [ ] Text chunk handling simplified to single TaskMessaging.say() call
- [ ] Complex streaming logic (lines 610-679) replaced with simple delegation
- [ ] All existing functionality preserved

#### Technical Details:

Replace complex streaming logic with:

```typescript
case "text": {
    assistantMessage += chunk.text
    const prevLength = this.assistantMessageContent.length
    this.assistantMessageContent = parseAssistantMessage(assistantMessage)

    // Single path through messaging system
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

#### Definition of Done:

- [ ] TaskApiHandler.constructor cliMode parameter removed
- [ ] All this.cliMode references removed
- [ ] Hardcoded CLI streaming logic removed
- [ ] Hardcoded API streaming logic removed
- [ ] Single delegation path to TaskMessaging.say()
- [ ] All existing streaming tests pass

---

### Story 6: Update FastifyServer to Remove Unused Adapters

**As a** developer
**I want** FastifyServer to remove unused adapter creation
**So that** Task handles adapter creation consistently

#### Acceptance Criteria:

- [ ] Remove unused SSEStreamingAdapter creation
- [ ] Remove unused SSEContentOutputAdapter creation
- [ ] Task constructor receives sseAdapter as userInterface
- [ ] Task automatically creates SSE adapters from userInterface
- [ ] No regression in API streaming functionality

#### Technical Details:

Remove lines 172-173:

```typescript
// REMOVE:
// const sseStreamingAdapter = new SSEStreamingAdapter(sseAdapter)
// const sseContentOutputAdapter = new SSEContentOutputAdapter(sseAdapter)

// Task will create adapters automatically
const taskOptions = {
	apiConfiguration,
	task,
	startTask: true,
	userInterface: sseAdapter, // Task detects this and creates SSE adapters
	// ... other options
}
```

#### Definition of Done:

- [ ] Unused adapter creation removed
- [ ] Task constructor properly receives sseAdapter
- [ ] API streaming functionality unchanged
- [ ] Integration tests pass
- [ ] No unused imports remain

---

### Story 7: Create Comprehensive Test Suite

**As a** developer
**I want** comprehensive tests for the new adapter architecture
**So that** I can be confident the refactor doesn't break existing functionality

#### Acceptance Criteria:

- [ ] Unit tests for all new adapter classes
- [ ] Integration tests for TaskMessaging with adapters
- [ ] End-to-end tests for all three modes
- [ ] Performance tests to ensure no regression
- [ ] Mock adapters for testing other components

#### Technical Details:

Test categories:

1. **Unit Tests**: Each adapter class individually
2. **Integration Tests**: TaskMessaging + adapters
3. **End-to-End Tests**: Full streaming flow for each mode
4. **Performance Tests**: Streaming latency measurements
5. **Error Handling Tests**: Adapter failure scenarios

#### Definition of Done:

- [ ] 90%+ test coverage for new adapter code
- [ ] All existing tests continue to pass
- [ ] Performance benchmarks show no regression
- [ ] Error handling tests cover adapter failures
- [ ] Mock adapters available for testing

---

## Risk Assessment

### High Risk:

- **Streaming Performance**: Changes to core streaming logic could impact latency
- **Integration Complexity**: Three different modes need to work correctly

### Medium Risk:

- **Error Handling**: Adapter failures could break streaming pipeline
- **Backward Compatibility**: Existing API contracts must remain unchanged

### Low Risk:

- **Code Organization**: Moving logic around without changing behavior
- **Test Coverage**: Adding tests for new functionality

### Mitigation Strategies:

1. **Gradual Rollout**: Implement behind feature flags
2. **Performance Monitoring**: Benchmark before/after changes
3. **Comprehensive Testing**: Cover all three modes extensively
4. **Error Isolation**: Ensure adapter failures don't cascade

---

## Implementation Plan

### Sprint 1: Foundation

- Story 1: Update TaskMessaging constructor
- Story 3: Create VSCode output adapters
- Story 7: Basic unit tests

### Sprint 2: Integration

- Story 2: Enhance addToClineMessages
- Story 4: Add adapter factory to Task
- Story 7: Integration tests

### Sprint 3: Cleanup

- Story 5: Simplify TaskApiHandler
- Story 6: Update FastifyServer
- Story 7: End-to-end tests

### Sprint 4: Validation

- Performance testing
- Error handling validation
- Documentation updates
- Release preparation

---

## Metrics and Monitoring

### Performance Metrics:

- **Streaming Latency**: Time from LLM chunk to user display
- **Memory Usage**: Ensure no memory leaks in adapters
- **Error Rate**: Adapter failure frequency

### Success Metrics:

- **Code Complexity**: Reduced cyclomatic complexity in TaskApiHandler
- **Test Coverage**: 90%+ coverage for new adapter code
- **Bug Reports**: No increase in streaming-related bugs

### Monitoring:

- **Real-time Dashboards**: Streaming performance metrics
- **Error Tracking**: Adapter failure logs and alerts
- **User Feedback**: Streaming quality surveys

This refactor represents a significant architectural improvement that will make the codebase more maintainable, testable, and extensible while maintaining the high-performance streaming capabilities users expect.
