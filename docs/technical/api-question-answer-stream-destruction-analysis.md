# API Question Answer Stream Destruction Analysis

## Status: ROOT CAUSE IDENTIFIED

_Investigation completed - ready for implementation_

## Issue Summary

The SSE stream gets destroyed during answer processing in API question/answer flows, causing "Stream response already destroyed" errors and premature task cancellation.

## Root Cause

**The `emitCompletion()` method in `SSEOutputAdapter` automatically schedules stream closure after every completion event, including intermediate completions during question/answer cycles.**

### Problem Flow

1. **Question Sent**: Task creates question via `ask_followup_question` tool
2. **Answer Received**: User submits answer, question promise resolves
3. **Task Continues**: Task execution continues with received answer
4. **Intermediate Completion**: Task calls `emitCompletion()` for progress update
5. **❌ Stream Scheduled for Closure**: `emitCompletion()` schedules `emitStreamEnd()` in 50ms
6. **❌ Stream Destroyed**: `emitStreamEnd()` calls `close()` which destroys the stream
7. **❌ Task Continues on Dead Stream**: Subsequent task operations fail with "Stream response already destroyed"

### Code Evidence

**SSEOutputAdapter.ts Lines 527-530:**

```typescript
// ✅ NEW: Schedule stream_end event after completion processing
console.log(`[SSE-COMPLETION] 🕐 Scheduling stream_end event in 50ms`)
setTimeout(() => {
	this.emitStreamEnd()
}, 50)
```

**This happens EVERY time `emitCompletion()` is called, regardless of whether the task is actually finished.**

## Impact

- ✅ Questions generate and deliver correctly
- ✅ User interaction works (answers are received)
- ❌ Stream destroyed after answer processing
- ❌ Task execution stops prematurely
- ❌ "Client disconnected" cancellation triggered

## Solution Architecture

### 1. Add Completion Type Distinction

Modify `emitCompletion()` to accept a completion type parameter:

```typescript
async emitCompletion(
    message: string = "Task completed",
    result?: any,
    taskId?: string,
    completionType: 'intermediate' | 'final' = 'final'
): Promise<void>
```

### 2. Conditional Stream Closure

Only schedule stream closure for final completions:

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

### 3. Update Task Execution

Modify task execution to specify completion types:

- **Intermediate**: Progress updates, question answered, tool completed
- **Final**: Task truly finished, attempt_completion called

## Implementation Plan

### Phase 1: Core Stream Management Fix

1. **Modify SSEOutputAdapter.emitCompletion()** - Add completionType parameter
2. **Update call sites** - Identify intermediate vs final completions
3. **Test basic functionality** - Ensure streams stay alive during Q&A cycles

### Phase 2: Task Integration

1. **Update Task execution** - Use appropriate completion types
2. **Update attempt_completion** - Ensure final completion is called
3. **Test end-to-end** - Verify complete question/answer/continue workflow

### Phase 3: Robust Error Handling

1. **Add completion timeout** - Fallback closure after maximum task time
2. **Add health checks** - Detect truly orphaned streams
3. **Test edge cases** - Task errors, client disconnects, timeouts

## Success Criteria

- [ ] User can complete full question/answer cycle without stream destruction
- [ ] Server receives and processes answers correctly
- [ ] Stream remains active throughout interaction
- [ ] Task continues executing after receiving answer
- [ ] Stream only closes when task is truly finished
- [ ] No "Stream response already destroyed" errors

## Files to Modify

### Primary

- `src/api/streaming/SSEOutputAdapter.ts` - Core completion logic
- Task execution files (TBD - need to identify callers)

### Secondary

- `src/api/streaming/StreamManager.ts` - Enhanced logging/diagnostics
- Test files for question/answer workflows

## Priority

**Critical** - This is the final blocker for API question/answer functionality.

## Dependencies

- ✅ Unified question manager working
- ✅ Question generation and delivery working
- 🔄 Answer processing (current focus)
