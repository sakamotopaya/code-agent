# Story 1: Fix LLM Result Event Emission

## Overview

Update the `attemptCompletionTool.ts` to include the actual LLM result in the `taskCompleted` event emission, ensuring the result data flows through the completion chain.

## Acceptance Criteria

- [ ] The `taskCompleted` event includes the actual LLM result parameter
- [ ] All existing event emission paths are updated consistently
- [ ] Token usage and tool usage data are still included
- [ ] No breaking changes to event structure

## Technical Details

### Files to Modify

- `src/core/tools/attemptCompletionTool.ts`

### Current Implementation

```typescript
// Line 69 - Missing result parameter
cline.emit("taskCompleted", cline.taskId, tokenUsage, toolUsage)

// Line 114 - Missing result parameter
cline.emit("taskCompleted", cline.taskId, tokenUsage, toolUsage)

// Line 155 - Missing result parameter
cline.emit("taskCompleted", cline.taskId, tokenUsage, toolUsage)
```

### Required Changes

```typescript
// Update all three emission points to include result
cline.emit("taskCompleted", cline.taskId, result, tokenUsage, toolUsage)
```

### Key Locations

1. **Line 69**: Normal completion path with result
2. **Line 114**: Alternative completion path
3. **Line 155**: Final completion path

## Implementation Notes

- The `result` variable is already available in the scope at all three emission points
- Need to ensure the result is properly formatted and not undefined
- The event signature changes from `(taskId, tokenUsage, toolUsage)` to `(taskId, result, tokenUsage, toolUsage)`

## Testing Strategy

- Verify event emission includes result data
- Test with various result sizes (small, large)
- Ensure token usage and tool usage are still captured
- Validate event structure remains consistent

## Risk Assessment

**Low Risk**: This change only adds a parameter to existing event emissions without changing core logic.

## Dependencies

- Understanding of the `result` variable scope in `attemptCompletionTool.ts`
- Knowledge of event emission patterns in the codebase

## Definition of Done

- [ ] All three `taskCompleted` event emissions include the result parameter
- [ ] Event structure is consistent across all emission points
- [ ] Result data is properly formatted and not undefined
- [ ] No regressions in existing functionality
- [ ] Code changes are tested and validated
