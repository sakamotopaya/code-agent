# Streaming Restoration Plan

## Problem Summary

The streaming functionality in the REPL (`--repl` mode) was broken when the working `executeStreamingRequest` function was replaced with a stub implementation. Users now see "🌊 Streaming request implementation..." instead of actual streaming responses.

## Root Cause

1. The original working `executeStreamingRequest` function was replaced with a stub
2. The replacement implementation is not properly handling SSE (Server-Sent Events) streaming
3. The API endpoint `/execute/stream` is working correctly, but the client-side streaming logic is broken

## Required Fix Strategy

### Step 1: Identify the Working Pattern

- The FastifyServer has a working `/execute/stream` endpoint that sends SSE events
- The endpoint expects POST requests with JSON payload containing `task`, `mode`, etc.
- The endpoint responds with `text/event-stream` content type
- Events are formatted as SSE with `data: {JSON}` format

### Step 2: Restore Proper Streaming Implementation

The `executeStreamingRequest` function needs to:

1. Make HTTP POST request to `/execute/stream` endpoint
2. Handle the SSE stream response
3. Parse each `data: {JSON}` event
4. Process events through the existing StreamProcessor
5. Display content in real-time as it arrives

### Step 3: Key Components Required

- **HTTP Client**: Make POST request with proper headers
- **SSE Parser**: Parse incoming `data: {JSON}` events
- **Stream Processor**: Process events using existing StreamProcessor class
- **Content Filter**: Filter content based on user preferences
- **Error Handling**: Properly handle connection errors and timeouts

### Step 4: Reference Implementation Pattern

The working implementation should follow this pattern:

```typescript
async function executeStreamingRequest(
	options: ApiClientOptions,
	task: string,
	replSession?: REPLSession,
): Promise<void> {
	// 1. Prepare request data
	const requestData = {
		task,
		mode: options.mode,
		verbose: options.verbose,
		// ... other options
	}

	// 2. Make HTTP request with SSE headers
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "text/event-stream",
		},
		body: JSON.stringify(requestData),
	})

	// 3. Process SSE stream
	const reader = response.body?.getReader()
	const decoder = new TextDecoder()

	while (true) {
		const { done, value } = await reader.read()
		if (done) break

		const chunk = decoder.decode(value, { stream: true })
		// Parse SSE events and process them
	}
}
```

## Testing Strategy

1. **Unit Test**: Test the SSE parsing logic
2. **Integration Test**: Test full streaming with API server
3. **Manual Test**: Verify REPL streaming works end-to-end
4. **Regression Test**: Ensure all existing functionality still works

## Rollback Strategy

If the fix doesn't work immediately:

1. Check git history for the last working version
2. Identify the exact working implementation
3. Restore the known working code
4. Test thoroughly before making any changes

## Success Criteria

- REPL mode (`--repl`) shows real-time streaming responses
- No more "🌊 Streaming request implementation..." message
- Content appears progressively as it's generated
- All existing CLI options still work (verbose, show-thinking, etc.)
- Error handling works properly
