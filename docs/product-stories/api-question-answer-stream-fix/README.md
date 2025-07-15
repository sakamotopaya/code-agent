# API Question Answer Stream Destruction Fix

## Overview

Fix the SSE stream destruction issue that occurs during API question/answer processing, where the stream gets destroyed after answer submission causing "Stream response already destroyed" errors.

## Problem Statement

Currently, the `emitCompletion()` method in `SSEOutputAdapter` automatically schedules stream closure after every completion event, including intermediate completions during question/answer cycles. This causes premature stream destruction when tasks continue after receiving user answers.

## Root Cause

The issue stems from lines 527-530 in `SSEOutputAdapter.ts`:

```typescript
// ✅ NEW: Schedule stream_end event after completion processing
console.log(`[SSE-COMPLETION] 🕐 Scheduling stream_end event in 50ms`)
setTimeout(() => {
	this.emitStreamEnd()
}, 50)
```

This happens EVERY time `emitCompletion()` is called, regardless of whether the task is actually finished.

## Solution Architecture

### Core Fix: Completion Type Distinction

Add a completion type parameter to distinguish between intermediate progress updates and final task completion:

```typescript
async emitCompletion(
    message: string = "Task completed",
    result?: any,
    taskId?: string,
    completionType: 'intermediate' | 'final' = 'final'
): Promise<void>
```

### Conditional Stream Closure

Only schedule stream closure for final completions:

```typescript
// Only schedule stream_end for final completions
if (completionType === "final") {
	setTimeout(() => {
		this.emitStreamEnd()
	}, 50)
} else {
	console.log(`[SSE-COMPLETION] ⏳ Intermediate completion - keeping stream alive`)
}
```

## Implementation Stories

### Phase 1: Core Stream Management

- **AC-001**: [Modify SSEOutputAdapter completion logic](./AC-001-completion-type-parameter.md)
- **AC-002**: [Update emitCompletion call sites](./AC-002-update-call-sites.md)
- **AC-003**: [Test basic stream persistence](./AC-003-test-stream-persistence.md)

### Phase 2: Task Integration

- **AC-004**: [Update task execution completion types](./AC-004-task-execution-types.md)
- **AC-005**: [Ensure final completion on attempt_completion](./AC-005-final-completion-integration.md)
- **AC-006**: [End-to-end question/answer workflow](./AC-006-e2e-workflow.md)

### Phase 3: Robust Error Handling

- **AC-007**: [Add completion timeout fallback](./AC-007-completion-timeout.md)
- **AC-008**: [Add stream health checks](./AC-008-stream-health-checks.md)
- **AC-009**: [Test edge case scenarios](./AC-009-edge-case-testing.md)

## Success Criteria

- [ ] User can complete full question/answer cycle without stream destruction
- [ ] Server receives and processes answers correctly
- [ ] Stream remains active throughout interaction
- [ ] Task continues executing after receiving answer
- [ ] Stream only closes when task is truly finished
- [ ] No "Stream response already destroyed" errors

## Technical Requirements

### Primary Changes

- Modify `SSEOutputAdapter.emitCompletion()` method signature
- Add conditional stream closure logic
- Update all `emitCompletion()` call sites

### Secondary Changes

- Enhanced logging for stream lifecycle debugging
- Stream health monitoring
- Completion timeout fallback mechanism

## Testing Strategy

1. **Unit Tests**: Test completion type logic in isolation
2. **Integration Tests**: Test question/answer cycles with stream persistence
3. **End-to-End Tests**: Test complete workflows with various completion scenarios
4. **Edge Case Tests**: Test error conditions, timeouts, and disconnections

## Dependencies

- ✅ Unified question manager working
- ✅ Question generation and delivery working
- 🔄 Answer processing (current focus)

## Priority

**Critical** - This is the final blocker for API question/answer functionality.

## Related Issues

- Original issue: Stream destruction during answer processing
- Root cause: Automatic stream closure after every completion
- Impact: Premature task cancellation and "Client disconnected" errors
