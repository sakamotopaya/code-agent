# API Task Cancellation Implementation Plan v2

## Overview

Based on thorough code analysis and log investigation, this plan addresses the **real root cause**: incomplete cancellation implementation. The cancellation detection works perfectly, but LLM streams and task processing continue after `task.abortTask()` is called.

## Root Cause Summary

- ✅ **Client disconnect detection**: Works perfectly
- ✅ **Cancellation initiation**: `task.abortTask()` is called correctly
- ❌ **LLM stream termination**: Active API requests continue streaming
- ❌ **Task loop termination**: `recursivelyMakeClineRequests()` continues processing
- ❌ **Resource cleanup**: No AbortController integration

## Implementation Strategy

### Phase 1: Core AbortController Integration

#### 1.1 Add AbortController to TaskApiHandler

**File**: `src/core/task/TaskApiHandler.ts`

```typescript
export class TaskApiHandler {
	private currentAbortController?: AbortController
	private isAborted: boolean = false

	// Add method to check abort status
	public isTaskAborted(): boolean {
		return this.isAborted || this.currentAbortController?.signal.aborted || false
	}

	// Add method to abort current operations
	public async abortCurrentOperations(): Promise<void> {
		this.isAborted = true

		if (this.currentAbortController) {
			this.currentAbortController.abort()
			this.currentAbortController = undefined
		}

		// Stop streaming
		this.isStreaming = false
	}
}
```

#### 1.2 Integrate AbortController with LLM Requests

**File**: `src/core/task/TaskApiHandler.ts:390`

```typescript
// In attemptApiRequest method
async *attemptApiRequest(
    retryAttempt: number = 0,
    getSystemPrompt: () => Promise<string>,
    getTokenUsage: () => any,
    abort?: boolean,
): ApiStream {
    // Create AbortController for this request
    this.currentAbortController = new AbortController()

    // Check if already aborted
    if (abort || this.isAborted) {
        throw new Error(`Task ${this.taskId} aborted before API request`)
    }

    // ... existing code ...

    // Pass AbortController to API request
    const stream = this.api.createMessage(
        systemPrompt,
        cleanConversationHistory,
        metadata,
        { signal: this.currentAbortController.signal }  // Add abort signal
    )

    // ... rest of method
}
```

#### 1.3 Add Real-time Abort Checking in Stream Processing

**File**: `src/core/task/TaskApiHandler.ts:650`

```typescript
// In recursivelyMakeClineRequests method
for await (const chunk of stream) {
	// Check abort status on every chunk
	if (abort || this.isTaskAborted()) {
		this.log(`[TaskApiHandler] Breaking due to abort signal`)
		break
	}

	// ... existing chunk processing ...
}
```

### Phase 2: Task-Level Cancellation Integration

#### 2.1 Connect Task.abortTask() to TaskApiHandler

**File**: `src/core/task/Task.ts:1325`

```typescript
public async abortTask(isAbandoned = false) {
    if (isAbandoned) {
        this.abandoned = true
    }

    this.abort = true

    // NEW: Abort active API operations
    try {
        await this.apiHandler.abortCurrentOperations()
        this.logDebug(`[Task] API operations aborted successfully`)
    } catch (error) {
        this.logError(`[Task] Error aborting API operations:`, error)
    }

    // ... existing cleanup code ...

    await this.lifecycle.abortTask()
}
```

#### 2.2 Add Abort Checking to Task Processing Loop

**File**: `src/core/task/Task.ts:1384`

```typescript
// In initiateTaskLoop method
while (!this.abort) {
	loopCount++
	this.logDebug(`[Task] Loop iteration ${loopCount}, abort=${this.abort}`)

	// Check abort before each iteration
	if (this.abort) {
		this.logDebug(`[Task] Breaking loop due to abort flag`)
		break
	}

	const didEndLoop = await this.recursivelyMakeClineRequests(nextUserContent, includeFileDetails)

	// Check abort after each iteration
	if (this.abort) {
		this.logDebug(`[Task] Breaking loop due to abort flag after iteration`)
		break
	}

	// ... rest of loop
}
```

### Phase 3: API Handler Integration

#### 3.1 Update API Handler createMessage Method

**File**: `src/api/index.ts` (or relevant API handler file)

```typescript
// Ensure API handlers support AbortController
interface CreateMessageOptions {
	signal?: AbortSignal
	// ... other options
}

class AnthropicApiHandler {
	createMessage(systemPrompt: string, messages: any[], metadata: any, options?: CreateMessageOptions): ApiStream {
		// Pass abort signal to Anthropic SDK
		const anthropicOptions = {
			// ... existing options
			signal: options?.signal,
		}

		// Create request with abort signal
		const stream = this.anthropic.messages.stream(
			{
				// ... message parameters
			},
			anthropicOptions,
		)

		return this.transformStream(stream, options?.signal)
	}
}
```

#### 3.2 Add Stream Transformation with Abort Support

```typescript
private async *transformStream(
    anthropicStream: any,
    abortSignal?: AbortSignal
): ApiStream {
    try {
        for await (const chunk of anthropicStream) {
            // Check abort signal on each chunk
            if (abortSignal?.aborted) {
                this.log(`[API] Stream aborted by signal`)
                break
            }

            yield this.transformChunk(chunk)
        }
    } catch (error) {
        if (abortSignal?.aborted) {
            this.log(`[API] Stream terminated due to abort`)
            return
        }
        throw error
    }
}
```

### Phase 4: Enhanced Error Handling and Cleanup

#### 4.1 Add Comprehensive Cleanup in TaskApiHandler

```typescript
// In TaskApiHandler
async terminateActiveStreams(): Promise<void> {
    this.log(`[TaskApiHandler] Terminating active streams...`)

    // Abort current controller
    if (this.currentAbortController) {
        this.currentAbortController.abort()
        this.currentAbortController = undefined
    }

    // Reset streaming state
    this.isStreaming = false
    this.isWaitingForFirstChunk = false
    this.didCompleteReadingStream = true

    // Clear message content
    this.assistantMessageContent = []
    this.userMessageContent = []
    this.userMessageContentReady = true

    this.log(`[TaskApiHandler] Stream termination completed`)
}
```

#### 4.2 Add Timeout-based Fallback

```typescript
// In Task.abortTask()
public async abortTask(isAbandoned = false) {
    // ... existing code ...

    // NEW: Add timeout-based fallback
    const abortTimeout = setTimeout(() => {
        this.logWarn(`[Task] Force terminating after abort timeout`)
        this.abandoned = true
        // Force cleanup
        this.apiHandler.terminateActiveStreams().catch(error => {
            this.logError(`[Task] Error in force cleanup:`, error)
        })
    }, 5000) // 5 second timeout

    try {
        await this.apiHandler.abortCurrentOperations()
        clearTimeout(abortTimeout)
    } catch (error) {
        this.logError(`[Task] Error during abort:`, error)
        clearTimeout(abortTimeout)
        throw error
    }
}
```

## Implementation Steps

### Step 1: TaskApiHandler Updates

1. Add `currentAbortController` property
2. Add `isTaskAborted()` method
3. Add `abortCurrentOperations()` method
4. Add real-time abort checking in stream processing

### Step 2: Task Integration

1. Update `Task.abortTask()` to call `apiHandler.abortCurrentOperations()`
2. Add abort checking in task processing loop
3. Add timeout-based fallback

### Step 3: API Handler Updates

1. Update `createMessage()` to accept AbortSignal
2. Pass AbortSignal to Anthropic SDK
3. Add abort checking in stream transformation

### Step 4: Testing and Validation

1. Manual testing with API server
2. Unit tests for AbortController integration
3. Integration tests for full cancellation flow

## Success Criteria

1. **< 2 seconds**: Task terminates within 2 seconds of client disconnect
2. **No zombie processes**: No LLM requests continue after abort
3. **Clean resource cleanup**: All streams, controllers, and resources properly disposed
4. **Graceful degradation**: System remains stable after cancellation
5. **Comprehensive logging**: Clear audit trail of cancellation process

## Testing Plan

### Manual Testing

```bash
# Start API server
./run-api.sh

# In another terminal, start a long-running task
./test-api.js --stream "analyze this large codebase in detail"

# Press Ctrl+C after 3 seconds
# Verify: Task stops within 2 seconds, no continued processing in logs
```

### Automated Testing

```typescript
// Unit test for AbortController integration
describe('TaskApiHandler Cancellation', () => {
    it('should abort LLM stream when abortCurrentOperations is called', async () => {
        const handler = new TaskApiHandler(...)
        const streamPromise = handler.recursivelyMakeClineRequests(...)

        // Abort after 100ms
        setTimeout(() => handler.abortCurrentOperations(), 100)

        await expect(streamPromise).rejects.toThrow(/aborted/)
    })
})
```

## Risk Mitigation

1. **Backward Compatibility**: All changes are additive, no breaking changes
2. **Graceful Fallback**: If AbortController fails, timeout-based cleanup activates
3. **Error Isolation**: Cancellation errors don't affect other tasks
4. **Resource Safety**: Multiple abort calls are safe and idempotent

## Monitoring and Observability

1. **Cancellation Metrics**: Track cancellation success rate and timing
2. **Resource Cleanup**: Monitor for resource leaks after cancellation
3. **Error Tracking**: Log and track cancellation-related errors
4. **Performance Impact**: Measure overhead of abort checking

This implementation plan addresses the real root cause and provides a comprehensive solution for proper API task cancellation.
