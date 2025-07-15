# AC-001: Modify SSEOutputAdapter Completion Logic

## Story

As a developer, I need to modify the `SSEOutputAdapter.emitCompletion()` method to support completion type distinction, so that streams are only closed for final completions and not intermediate progress updates.

## Acceptance Criteria

### 1. Add Completion Type Parameter

- [ ] Modify `emitCompletion()` method signature to include `completionType` parameter
- [ ] Support two completion types: `'intermediate'` and `'final'`
- [ ] Default to `'final'` for backward compatibility

```typescript
async emitCompletion(
    message: string = "Task completed",
    result?: any,
    taskId?: string,
    completionType: 'intermediate' | 'final' = 'final'
): Promise<void>
```

### 2. Conditional Stream Closure Logic

- [ ] Only schedule `emitStreamEnd()` for `'final'` completions
- [ ] Skip stream closure scheduling for `'intermediate'` completions
- [ ] Add appropriate logging for both completion types

```typescript
// Only schedule stream_end for final completions
if (completionType === "final") {
	console.log(`[SSE-COMPLETION] 🕐 Scheduling stream_end event in 50ms`)
	setTimeout(() => {
		this.emitStreamEnd()
	}, 50)
} else {
	console.log(`[SSE-COMPLETION] ⏳ Intermediate completion - keeping stream alive`)
}
```

### 3. Enhanced Logging

- [ ] Add completion type to log messages
- [ ] Distinguish between intermediate and final completion events
- [ ] Include stream state information in logs

### 4. Backward Compatibility

- [ ] Existing callers continue to work without changes
- [ ] Default behavior unchanged (still closes stream)
- [ ] No breaking changes to public API

## Technical Details

### Files to Modify

- `src/api/streaming/SSEOutputAdapter.ts` - Primary implementation

### Key Changes

1. **Method Signature Update** (line ~432):

```typescript
async emitCompletion(
    message: string = "Task completed",
    result?: any,
    taskId?: string,
    completionType: 'intermediate' | 'final' = 'final'
): Promise<void>
```

2. **Conditional Stream Closure** (lines ~527-530):

```typescript
// Replace automatic scheduling with conditional logic
if (completionType === "final") {
	console.log(`[SSE-COMPLETION] 🕐 Scheduling stream_end event in 50ms`)
	setTimeout(() => {
		this.emitStreamEnd()
	}, 50)
} else {
	console.log(`[SSE-COMPLETION] ⏳ Intermediate completion - keeping stream alive`)
}
```

3. **Enhanced Logging** (line ~434):

```typescript
console.log(`[SSE-COMPLETION] 🎯 emitCompletion(${completionType}) called at ${new Date().toISOString()}`)
```

## Testing Requirements

### Unit Tests

- [ ] Test `emitCompletion()` with `completionType: 'intermediate'` - should NOT schedule stream closure
- [ ] Test `emitCompletion()` with `completionType: 'final'` - should schedule stream closure
- [ ] Test default behavior (no completionType) - should schedule stream closure
- [ ] Test logging output for both completion types

### Integration Tests

- [ ] Test stream remains active after intermediate completion
- [ ] Test stream closes after final completion
- [ ] Test multiple intermediate completions followed by final completion

## Definition of Done

- [ ] Method signature updated with completionType parameter
- [ ] Conditional stream closure logic implemented
- [ ] Enhanced logging added
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Backward compatibility maintained
- [ ] Documentation updated

## Impact

This change enables fine-grained control over stream lifecycle, preventing premature stream closure during question/answer cycles while maintaining proper cleanup for completed tasks.

## Dependencies

None - this is a standalone change to the SSEOutputAdapter class.

## Estimated Effort

2-3 hours (implementation + testing)
