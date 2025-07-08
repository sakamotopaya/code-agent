# MessageBuffer Tool Execution Issue

## Problem Summary

The API mode has a critical issue where tool execution fails because of conflicting message processing systems. The LLM starts responding correctly but tool calls never get executed, causing tasks to hang.

## Root Cause Analysis

### The Issue

There are two separate parsing systems that conflict:

1. **MessageBuffer** (`src/api/streaming/MessageBuffer.ts`)

    - Processes streaming chunks and classifies content types (thinking, tool_call, content)
    - Buffers incomplete tool calls until they're complete
    - Used by SSEOutputAdapter for streaming display

2. **parseAssistantMessage** (`src/core/assistant-message/parseAssistantMessage.ts`)
    - Parses complete assistant messages to extract tool blocks
    - Used by TaskApiHandler to identify tools for execution

### The Conflict

**VSCode Extension (WORKS):**

```typescript
// TaskApiHandler.ts line 683 - VSCode extension approach
assistantMessage += chunk.text
this.assistantMessageContent = parseAssistantMessage(assistantMessage)
```

**API Mode (BROKEN):**

```typescript
// API mode uses MessageBuffer which buffers tool content
const processedMessages = messageBuffer.processMessage(chunk.text)
// parseAssistantMessage() called on incomplete text (tools still buffered)
this.assistantMessageContent = parseAssistantMessage(assistantMessage)
```

**The Problem:**

- **VSCode extension** accumulates raw text and re-parses on every chunk - tools found immediately
- **API mode** uses MessageBuffer which holds back tool content until "complete"
- `parseAssistantMessage()` in API mode never sees complete tool blocks
- Tool execution never happens in API mode

### Evidence from Logs

```
[TaskMessaging] No streaming capability - chunk will be shown when message completes
```

This shows MessageBuffer is buffering content instead of releasing it for tool processing.

## Current Flow (Broken)

1. LLM starts responding with text + `<thinking>` + tool calls
2. MessageBuffer buffers the content, waiting for complete tool blocks
3. TaskApiHandler calls `parseAssistantMessage(assistantMessage)` on incomplete text
4. No tools are found because they're still buffered
5. Task hangs waiting for tool execution that never occurs

## Proposed Solution

### The Correct Fix: Use VSCode Extension Approach

The API mode should use the **exact same approach** as the VSCode extension:

```typescript
// Current API mode (BROKEN):
const processedMessages = messageBuffer.processMessage(chunk.text)
this.assistantMessageContent = parseAssistantMessage(assistantMessage) // incomplete text

// Fixed API mode (use VSCode approach):
assistantMessage += chunk.text
this.assistantMessageContent = parseAssistantMessage(assistantMessage) // complete accumulated text
```

### Why This Works

1. **Raw text accumulation** - Same as VSCode extension
2. **Immediate re-parsing** - `parseAssistantMessage()` sees complete tool blocks as they arrive
3. **Immediate tool execution** - Tools are found and executed as soon as they're complete
4. **No buffering delays** - No MessageBuffer interference with tool parsing

### MessageBuffer Role

MessageBuffer should be used **only for display formatting**, not for tool parsing:

- **Display**: MessageBuffer processes chunks for streaming display (thinking, content, tool_call classification)
- **Tool Execution**: Raw text accumulation + `parseAssistantMessage()` for immediate tool detection

## Recommended Fix

**Use VSCode Extension Approach** because:

- **Proven to work** - VSCode extension uses this successfully
- **Minimal changes** - Just bypass MessageBuffer for tool parsing
- **Maintains compatibility** - Same `parseAssistantMessage()` function
- **Immediate execution** - No buffering delays

## Implementation Steps

1. Modify TaskApiHandler to use MessageBuffer's processed output
2. Add tool call handling to the streaming loop
3. Remove dependency on parseAssistantMessage for tool extraction
4. Test with API mode to ensure tools execute immediately

## Files to Modify

- `src/core/task/TaskApiHandler.ts` - Main integration point
- `src/api/streaming/MessageBuffer.ts` - Possible enhancements
- `src/core/task/TaskMessaging.ts` - Streaming integration

## Testing

Test with:

```bash
./api-client.js --stream --mode ticket-oracle "list your mcp servers and available tools"
```

Should see:

- Immediate tool execution (not buffered)
- Proper MCP server listing
- Complete task execution without hanging
