# MessageBuffer Bypass Plan

## Objective

Temporarily remove MessageBuffer from the API streaming pipeline to isolate its impact on tool execution, without deleting the MessageBuffer code.

## Current MessageBuffer Usage in SSEOutputAdapter

### 1. Progress Events (line 247)

```typescript
// In non-verbose mode, use MessageBuffer to filter content
const processedMessages = this.messageBuffer.processMessage(message)
```

### 2. Log Events (line 299)

```typescript
// In non-verbose mode, use MessageBuffer to filter content
const processedMessages = this.messageBuffer.processMessage(message)
```

### 3. Completion Events (line 421)

```typescript
// In non-verbose mode, use MessageBuffer to filter content
const processedMessages = this.messageBuffer.processMessage(message)
```

## Bypass Strategy

### Option 1: Environment Variable Flag

Add `BYPASS_MESSAGE_BUFFER=true` environment variable to skip MessageBuffer processing:

```typescript
const bypassMessageBuffer = process.env.BYPASS_MESSAGE_BUFFER === "true"

if (this.verbose || bypassMessageBuffer) {
	// Direct emission without MessageBuffer
	const event: SSEEvent = {
		/* ... */
	}
	this.emitEvent(event)
} else {
	// Original MessageBuffer processing
	const processedMessages = this.messageBuffer.processMessage(message)
	// ...
}
```

### Option 2: Constructor Flag

Add a constructor parameter to SSEOutputAdapter:

```typescript
constructor(
    jobId: string,
    response: ServerResponse,
    verbose: boolean = false,
    bypassMessageBuffer: boolean = false, // NEW
    questionManager?: ApiQuestionManager
) {
    this.bypassMessageBuffer = bypassMessageBuffer
    // ...
}
```

### Option 3: Force Verbose Mode

Temporarily force verbose mode which already bypasses MessageBuffer:

```typescript
// In constructor or method
this.verbose = true // Force bypass MessageBuffer
```

## Recommended Approach

**Option 1 (Environment Variable)** is recommended because:

- No API changes required
- Easy to toggle on/off
- Can be set in docker/development environment
- Preserves all existing functionality

## Implementation Steps

1. Add environment variable check in SSEOutputAdapter
2. Modify the three MessageBuffer usage points to check the flag
3. Test API with `BYPASS_MESSAGE_BUFFER=true`
4. Compare tool execution behavior with/without MessageBuffer
5. Document findings

## Expected Results

With MessageBuffer bypassed:

- Tool execution should work like VSCode extension
- Raw text should be accumulated and parsed correctly
- MCP calls should execute immediately
- API tasks should complete successfully

## Files to Modify

- `src/api/streaming/SSEOutputAdapter.ts` - Add bypass logic
- `docker/development/.env` or test script - Set environment variable
