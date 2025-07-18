# Story 3: Remove Hardcoded Status Messages from API Handler

## Overview

Update the `ApiTaskExecutionHandler.ts` to remove hardcoded status messages and use the actual LLM result correctly in the completion emission, ensuring API clients receive only the meaningful task result.

## Acceptance Criteria

- [ ] Hardcoded status messages are removed from `emitCompletion` calls
- [ ] The actual LLM result is used as the completion message
- [ ] Both normal and streaming completion paths are fixed
- [ ] API clients receive only the LLM result, not status messages
- [ ] The `emitCompletion` method is called with correct parameters

## Technical Details

### Files to Modify

- `src/core/task/execution/ApiTaskExecutionHandler.ts`

### Current Implementation

```typescript
// Line 81 - Incorrect parameter usage
await this.sseAdapter.emitCompletion(result, "Task has been completed successfully", undefined, "final")

// Line 128 - Hardcoded status message in streaming path
await this.sseAdapter.emitCompletion(
	"Task completed successfully",
	"Task has been completed successfully",
	undefined,
	"final",
)
```

### emitCompletion Method Signature

```typescript
async emitCompletion(
    message: string = "Task completed",
    result?: any,
    taskId?: string,
    completionType: 'intermediate' | 'final' = 'final'
): Promise<void>
```

### Required Changes

```typescript
// Line 81 - Use result as message, no hardcoded status
await this.sseAdapter.emitCompletion(result, undefined, undefined, "final")

// Line 128 - Same fix for streaming path
await this.sseAdapter.emitCompletion(result, undefined, undefined, "final")
```

### Key Locations

1. **Line 81**: Normal completion path - fix parameter usage
2. **Line 128**: Streaming completion path - fix hardcoded message

## Implementation Notes

- The `result` parameter in `onTaskCompleted` now contains the actual LLM result (from Stories 1 & 2)
- The `emitCompletion` method's first parameter (`message`) should be the LLM result
- The second parameter (`result`) should be undefined since we're not sending separate result data
- Need to handle cases where result might be undefined or empty

## Error Handling Considerations

- What if result is undefined or empty string?
- Should we provide a fallback message like "Task completed" or pass empty string?
- Ensure streaming path behaves consistently with normal path

## Testing Strategy

- Verify API clients receive only LLM result content
- Test both small and large result scenarios
- Validate streaming completion works correctly
- Ensure no hardcoded status messages appear in client output
- Test error cases where result might be undefined

## Risk Assessment

**High Impact**: This change directly affects what API clients receive, so it's critical to get it right.

**Potential Issues**:

- Empty or undefined results could cause poor user experience
- Need to ensure streaming path works consistently
- Changes to client-facing behavior require careful testing

## Dependencies

- **Depends on**: Story 1 (Fix LLM Result Event Emission)
- **Depends on**: Story 2 (Update Task Orchestrator Result Handling)

## Definition of Done

- [ ] Hardcoded status messages removed from both completion paths
- [ ] Actual LLM result is used as the completion message
- [ ] `emitCompletion` method is called with correct parameters
- [ ] API clients receive only meaningful task results
- [ ] Error handling for undefined/empty results is implemented
- [ ] Both normal and streaming completion paths work correctly
- [ ] No regressions in API client experience
- [ ] All existing tests pass
- [ ] New tests added for result handling scenarios

## Additional Considerations

- Consider adding logging to track what content is being sent to clients
- Ensure the fix works for both MessageBuffer enabled and disabled modes
- Validate behavior in verbose vs non-verbose modes
