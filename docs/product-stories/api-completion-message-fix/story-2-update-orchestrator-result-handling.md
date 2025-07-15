# Story 2: Update Task Orchestrator Result Handling

## Overview

Update the `TaskExecutionOrchestrator.ts` to receive the actual LLM result from the `taskCompleted` event and pass it to the completion handler instead of hardcoded status messages.

## Acceptance Criteria

- [ ] The `taskCompleted` event handler receives the result parameter
- [ ] The actual result is passed to `onTaskCompleted` instead of hardcoded messages
- [ ] Both normal and info query completion paths are updated
- [ ] Token usage and tool usage data flow is preserved

## Technical Details

### Files to Modify

- `src/core/task/execution/TaskExecutionOrchestrator.ts`

### Current Implementation

```typescript
// Line 448 - Event handler without result parameter
task.on("taskCompleted", async (tid: string, tokenUsage: any, toolUsage: any) => {
	// ...
	// Line 469 - Hardcoded status message
	await handler.onTaskCompleted(taskId, "Task completed successfully", tokenUsage, toolUsage)
})

// Line 96 - Info query path (this one might already be correct)
await handler.onTaskCompleted(taskId, result || reason)
```

### Required Changes

```typescript
// Update event handler to receive result parameter
task.on("taskCompleted", async (tid: string, result: string, tokenUsage: any, toolUsage: any) => {
	// ...
	// Pass actual result instead of hardcoded message
	await handler.onTaskCompleted(taskId, result, tokenUsage, toolUsage)
})
```

### Key Locations

1. **Line 448**: Event handler signature update to include result
2. **Line 469**: Replace hardcoded message with actual result
3. **Line 96**: Info query path (may already be correct)

## Implementation Notes

- The event handler signature changes from `(tid, tokenUsage, toolUsage)` to `(tid, result, tokenUsage, toolUsage)`
- Need to ensure the result parameter is properly handled (not undefined or empty)
- Consider fallback behavior if result is missing or invalid
- The info query path at line 96 might already be correct and may not need changes

## Error Handling Considerations

- What if result is undefined or empty string?
- Should we provide a fallback message or pass empty string?
- Ensure token usage and tool usage are still properly handled

## Testing Strategy

- Verify the orchestrator receives result data from the event
- Test result parameter passing to handlers
- Validate token usage and tool usage are preserved
- Test both normal completion and info query paths

## Risk Assessment

**Medium Risk**: This change modifies event handling logic in a core orchestrator component.

**Potential Issues**:

- Other event listeners might need updates if they also listen to `taskCompleted`
- Need to ensure result parameter is always valid
- Changes to core orchestration logic could affect multiple execution paths

## Dependencies

- **Depends on**: Story 1 (Fix LLM Result Event Emission)
- **Blocks**: Story 3 (Remove Hardcoded Status Messages from API Handler)

## Definition of Done

- [ ] Event handler signature updated to include result parameter
- [ ] Actual result is passed to `onTaskCompleted` instead of hardcoded message
- [ ] Error handling for undefined/empty results is implemented
- [ ] Token usage and tool usage data flow is preserved
- [ ] Both normal and info query completion paths work correctly
- [ ] All existing tests pass
- [ ] No regressions in task orchestration behavior
