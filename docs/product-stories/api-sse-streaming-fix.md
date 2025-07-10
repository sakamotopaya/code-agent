# API SSE Streaming Fix

## Problem Statement

The API server executes tasks correctly but doesn't stream AI responses to SSE clients. The task output appears in console logs but not in the SSE stream.

## Root Cause Analysis

The `TaskApiHandler` detects CLI mode when there's no VSCode `providerRef` and streams AI responses directly to `getCLILogger().streamLLMOutput(chunk.text)` instead of through the messaging system that triggers Task "message" events.

**Key Issue Location:** `src/core/task/TaskApiHandler.ts` line 608

```typescript
// Stream LLM output to terminal in CLI mode
if (this.cliMode && chunk.text) {
	getCLILogger().streamLLMOutput(chunk.text)
}
```

This bypasses the messaging system that would emit Task "message" events → TaskExecutionOrchestrator → ApiTaskExecutionHandler → SSE stream.

## Technical Solution

Add messaging system calls alongside CLI logging to ensure AI responses flow through both console AND SSE pipeline:

```typescript
// Stream LLM output to terminal in CLI mode
if (this.cliMode && chunk.text) {
	getCLILogger().streamLLMOutput(chunk.text)
}

// ALWAYS also send through messaging system for SSE streaming
if (chunk.text) {
	this.messaging.say("text", chunk.text, undefined, true).catch(() => {})
}
```

## Implementation Plan

### Step 1: Verify Current State

- Check that TaskExecutionOrchestrator properly handles "message" events
- Verify ApiTaskExecutionHandler forwards messages to SSE adapter

### Step 2: Modify TaskApiHandler

- Add messaging.say() call for AI response chunks
- Ensure proper error handling
- Add debug logging to verify execution

### Step 3: Test

- Run API server with modified TaskApiHandler
- Execute test query via SSE client
- Verify AI response chunks appear in SSE stream

## Expected Outcome

- API behavior matches CLI behavior
- AI responses stream in real-time via SSE
- Console logging preserved for debugging
- Task execution maintains existing functionality

## Files Modified

- `src/core/task/TaskApiHandler.ts` - Add messaging system calls

## Testing

- Execute: `node api-client.js --stream "list your MCP servers"`
- Verify SSE events include actual AI response content
- Confirm console logs still show for debugging
