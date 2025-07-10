# Story 3: Task Execution Handler Integration

**Epic**: Server-Side Infrastructure  
**Priority**: High  
**Effort**: 2 points  
**Dependencies**: Story 2 (SSE Output Adapter Enhancement)

## User Story

**As a** task execution system  
**I want** to emit token usage information when tasks complete  
**So that** clients receive token usage data automatically with task results

## Background

The `ApiTaskExecutionHandler` already receives token usage information in the `onTaskCompleted` method but only logs it to the console. This story integrates the new `emitTokenUsage` method from Story 2 to automatically send token usage information to clients when tasks complete.

## Acceptance Criteria

### 1. Token Usage Emission Integration

- [ ] Call `sseAdapter.emitTokenUsage()` in `onTaskCompleted` method
- [ ] Emit token usage after task completion but before final completion event
- [ ] Only emit if token usage data is available and valid
- [ ] Maintain existing task completion flow and timing

### 2. Error Handling

- [ ] Token usage emission failure doesn't affect task completion
- [ ] Log warnings for token usage emission failures
- [ ] Preserve existing error handling for task completion
- [ ] No impact on task success/failure status

### 3. Timing and Order

- [ ] Token usage emitted after completion logging
- [ ] Token usage emitted before final completion streaming
- [ ] Maintain existing completion event sequence
- [ ] No race conditions with other completion events

### 4. Backward Compatibility

- [ ] Existing task completion behavior unchanged
- [ ] Console logging of token usage preserved
- [ ] No breaking changes to task execution flow
- [ ] Works with tasks that don't provide token usage

## Technical Implementation

### File Changes

#### `src/core/task/execution/ApiTaskExecutionHandler.ts`

Modify the `onTaskCompleted` method:

```typescript
async onTaskCompleted(taskId: string, result: string, tokenUsage?: any, toolUsage?: any): Promise<void> {
  // ✅ Prevent duplicate completion processing
  if (this.completionEmitted) {
    if (this.verbose) {
      console.log(`[ApiTaskExecutionHandler] ⚠️ Task ${taskId} completion already processed, skipping duplicate`)
    }
    return
  }

  this.completionEmitted = true

  if (this.verbose) {
    console.log(`[ApiTaskExecutionHandler] Task ${taskId} completed for job ${this.jobId}`)
    console.log(`[ApiTaskExecutionHandler] Result:`, result.substring(0, 200) + "...")
    console.log(`[ApiTaskExecutionHandler] Token usage:`, tokenUsage)
    console.log(`[ApiTaskExecutionHandler] Tool usage:`, toolUsage)
  }

  // ✅ NEW: Emit token usage information if available
  if (tokenUsage) {
    try {
      await this.sseAdapter.emitTokenUsage(tokenUsage)
      if (this.verbose) {
        console.log(`[ApiTaskExecutionHandler] ✅ Token usage emitted for task ${taskId}`)
      }
    } catch (error) {
      // Log warning but don't fail task completion
      console.warn(`[ApiTaskExecutionHandler] ⚠️ Failed to emit token usage for task ${taskId}:`, error)
    }
  } else if (this.verbose) {
    console.log(`[ApiTaskExecutionHandler] ℹ️ No token usage data available for task ${taskId}`)
  }

  // Stream completion result in real-time rather than sending as one large block
  if (typeof result === "string" && result.length > 100) {
    // For large completion results, stream them chunk by chunk for better UX
    await this.streamCompletionResult(result)
  } else {
    // For small results, emit normally
    await this.sseAdapter.emitCompletion(result, "Task has been completed successfully")
  }
}
```

### Integration Points

#### Method Placement

- **Before**: Existing completion logging
- **After**: Token usage emission
- **Before**: Result streaming/completion emission

#### Error Isolation

- Token usage emission wrapped in try-catch
- Failures logged but don't propagate
- Task completion continues normally

## Testing Strategy

### Unit Tests

Create test file: `src/core/task/execution/__tests__/ApiTaskExecutionHandler-token-usage.test.ts`

```typescript
import { ApiTaskExecutionHandler } from "../ApiTaskExecutionHandler"
import { SSEOutputAdapter } from "../../../api/streaming/SSEOutputAdapter"

describe("ApiTaskExecutionHandler Token Usage Integration", () => {
	let handler: ApiTaskExecutionHandler
	let mockSSEAdapter: jest.Mocked<SSEOutputAdapter>

	beforeEach(() => {
		mockSSEAdapter = {
			emitTokenUsage: jest.fn().mockResolvedValue(undefined),
			emitCompletion: jest.fn().mockResolvedValue(undefined),
			showProgress: jest.fn().mockResolvedValue(undefined),
		} as any

		handler = new ApiTaskExecutionHandler(mockSSEAdapter, "test-job", false)
	})

	test("should emit token usage when available", async () => {
		const tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 200,
			totalCost: 0.05,
		}

		await handler.onTaskCompleted("test-task", "Task result", tokenUsage)

		expect(mockSSEAdapter.emitTokenUsage).toHaveBeenCalledWith(tokenUsage)
		expect(mockSSEAdapter.emitCompletion).toHaveBeenCalled()
	})

	test("should not emit token usage when not available", async () => {
		await handler.onTaskCompleted("test-task", "Task result")

		expect(mockSSEAdapter.emitTokenUsage).not.toHaveBeenCalled()
		expect(mockSSEAdapter.emitCompletion).toHaveBeenCalled()
	})

	test("should continue completion even if token usage emission fails", async () => {
		const tokenUsage = { totalTokensIn: 100, totalTokensOut: 200 }
		mockSSEAdapter.emitTokenUsage.mockRejectedValue(new Error("Emission failed"))

		await expect(handler.onTaskCompleted("test-task", "Task result", tokenUsage)).resolves.not.toThrow()

		expect(mockSSEAdapter.emitTokenUsage).toHaveBeenCalledWith(tokenUsage)
		expect(mockSSEAdapter.emitCompletion).toHaveBeenCalled()
	})

	test("should emit token usage before completion", async () => {
		const tokenUsage = { totalTokensIn: 100, totalTokensOut: 200 }
		const callOrder: string[] = []

		mockSSEAdapter.emitTokenUsage.mockImplementation(async () => {
			callOrder.push("tokenUsage")
		})
		mockSSEAdapter.emitCompletion.mockImplementation(async () => {
			callOrder.push("completion")
		})

		await handler.onTaskCompleted("test-task", "Short result", tokenUsage)

		expect(callOrder).toEqual(["tokenUsage", "completion"])
	})

	test("should handle duplicate completion calls", async () => {
		const tokenUsage = { totalTokensIn: 100, totalTokensOut: 200 }

		await handler.onTaskCompleted("test-task", "Task result", tokenUsage)
		await handler.onTaskCompleted("test-task", "Task result", tokenUsage)

		expect(mockSSEAdapter.emitTokenUsage).toHaveBeenCalledTimes(1)
		expect(mockSSEAdapter.emitCompletion).toHaveBeenCalledTimes(1)
	})

	test("should work with verbose logging enabled", async () => {
		const verboseHandler = new ApiTaskExecutionHandler(mockSSEAdapter, "test-job", true)
		const tokenUsage = { totalTokensIn: 100, totalTokensOut: 200 }

		const consoleSpy = jest.spyOn(console, "log").mockImplementation()

		await verboseHandler.onTaskCompleted("test-task", "Task result", tokenUsage)

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Token usage emitted for task test-task"))
		expect(mockSSEAdapter.emitTokenUsage).toHaveBeenCalledWith(tokenUsage)

		consoleSpy.mockRestore()
	})
})
```

### Integration Tests

```typescript
describe("ApiTaskExecutionHandler Integration", () => {
	test("should emit token usage in real task completion flow", async () => {
		// Test with real SSEOutputAdapter and StreamManager
		// Verify token usage events are sent to clients
	})

	test("should handle large result streaming with token usage", async () => {
		// Test that token usage is emitted correctly with large results
		// that trigger the streaming completion flow
	})

	test("should maintain event order in concurrent scenarios", async () => {
		// Test multiple rapid task completions with token usage
	})
})
```

## Error Handling Strategy

### Token Usage Emission Failures

- **Network Issues**: Log warning, continue completion
- **Invalid Data**: SSEOutputAdapter handles gracefully
- **Stream Closed**: Log warning, continue completion
- **Timeout**: Use existing SSE timeout handling

### Task Completion Flow Protection

- **Try-Catch Wrapper**: Isolates token usage emission failures
- **Completion Guarantee**: Task completion always proceeds
- **Status Preservation**: Task success/failure status unaffected
- **Logging Continuity**: Existing logs preserved

### Duplicate Completion Handling

- **Existing Protection**: `completionEmitted` flag prevents duplicates
- **Token Usage Deduplication**: Only emit once per task
- **Idempotent Behavior**: Multiple calls have no additional effect

## Performance Impact Analysis

### Expected Overhead

- **CPU**: ~0.5ms for method call and error handling
- **Memory**: Minimal - no additional data structures
- **Network**: Handled by SSEOutputAdapter (Story 2)

### Optimization Strategies

- **Early Return**: Skip processing if no token usage data
- **Async Handling**: Non-blocking token usage emission
- **Error Isolation**: Fast failure path for emission errors

## Definition of Done

- [ ] `onTaskCompleted` method calls `emitTokenUsage` when data available
- [ ] Token usage emission happens before completion events
- [ ] Error handling prevents token usage failures from affecting completion
- [ ] Existing task completion behavior preserved
- [ ] Verbose logging includes token usage emission status
- [ ] Unit tests written and passing (>95% coverage)
- [ ] Integration tests verify end-to-end flow
- [ ] Performance impact measured and acceptable (<1ms)
- [ ] Code review completed
- [ ] Documentation updated

## Risk Assessment

### Low Risk

- **Error Isolation**: Token usage failures don't affect core functionality
- **Backward Compatibility**: Additive changes only
- **Performance**: Minimal overhead
- **Testing**: Comprehensive coverage

### Mitigation Strategies

- **Graceful Degradation**: System works without token usage
- **Comprehensive Testing**: All error scenarios covered
- **Performance Monitoring**: Track emission overhead

## Dependencies

### Upstream Dependencies

- Story 2: SSE Output Adapter Enhancement (required for `emitTokenUsage` method)

### Downstream Dependencies

- Story 4: Client-Side Display Implementation (will receive these events)

## Acceptance Testing

### Manual Testing Scenarios

1. **Normal Completion**: Task with token usage completes successfully
2. **No Token Usage**: Task without token usage completes normally
3. **Emission Failure**: Token usage emission fails, task still completes
4. **Large Results**: Token usage emitted correctly with streaming results
5. **Duplicate Calls**: Multiple completion calls handled correctly

### Automated Testing

1. **Unit Tests**: All code paths and error conditions
2. **Integration Tests**: Real SSE adapter integration
3. **Performance Tests**: Measure completion overhead
4. **Concurrency Tests**: Multiple simultaneous completions

## Success Metrics

- ✅ Task completion success rate: 100% (unchanged)
- ✅ Token usage emission success rate: >99%
- ✅ Completion overhead: <1ms additional
- ✅ Zero task failures due to token usage issues
- ✅ Event ordering maintained in 100% of cases

## Implementation Notes

### Design Decisions

1. **Non-Blocking**: Token usage emission doesn't block completion
2. **Error Isolation**: Failures contained within try-catch
3. **Order Preservation**: Token usage before completion events
4. **Backward Compatibility**: Works with existing task flows

### Timing Considerations

- **Emission Timing**: After logging, before completion streaming
- **Async Handling**: Await token usage emission for proper ordering
- **Error Recovery**: Fast failure path maintains performance

### Future Enhancements

- **Batching**: Batch token usage with completion events
- **Caching**: Cache token usage for retry scenarios
- **Analytics**: Hook for token usage analytics collection
- **Configuration**: Per-job token usage emission settings

## Rollback Plan

If issues arise:

1. **Immediate**: Comment out `emitTokenUsage` call
2. **Short-term**: Add feature flag to disable token usage emission
3. **Long-term**: Revert integration changes

The integration is designed to be easily removable without affecting core functionality.

## Code Review Checklist

- [ ] Token usage emission only called when data is available
- [ ] Error handling prevents exceptions from propagating
- [ ] Existing completion flow timing preserved
- [ ] Verbose logging includes appropriate messages
- [ ] No breaking changes to method signature
- [ ] Performance impact is minimal
- [ ] Tests cover all scenarios including error cases
