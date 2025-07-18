# SSE Data Flow - Complete Client/Server Architecture

## Client-Side: SSE Data Reception

**File:** `src/tools/api-client.ts`

### 1. Raw Data Reception (line 972)

```typescript
res.on("data", (chunk) => {
  buffer += chunk.toString()
```

### 2. SSE Parsing (lines 977-994)

```typescript
// Split into individual events
const events = buffer.split("\n\n")

// Parse each event
for (const eventData of events) {
	const lines = eventData.split("\n")
	let eventType: string | null = null
	let data: string | null = null

	for (const line of lines) {
		if (line.startsWith("event: ")) {
			eventType = line.substring(7).trim()
		} else if (line.startsWith("data: ")) {
			data = line.substring(6).trim() // JSON string
		}
	}
}
```

### 3. Event Object Creation (line 997)

```typescript
const event = JSON.parse(data) // ← Creates the event object with contentType
```

### 4. Event Processing (line 1014)

```typescript
streamProcessor.processEvent(event, timestamp, contentFilter)
```

## Server-Side: SSE Data Transmission

### 1. FastifyServer.ts - SSE Endpoint Setup

**File:** `src/api/server/FastifyServer.ts` (lines 182-283)

```typescript
// SSE streaming execute endpoint
this.app.post("/execute/stream", async (request, reply) => {
  // Set SSE headers
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  })

  // Create SSE stream
  const stream = this.streamManager.createStream(reply.raw, job.id)

  // Create SSE adapter
  const sseAdapter = new SSEOutputAdapter(this.streamManager, job.id, verbose)
```

### 2. SSEOutputAdapter.ts - Event Creation

**File:** `src/api/streaming/SSEOutputAdapter.ts`

The SSEOutputAdapter implements `IUserInterface` and converts Task events into SSE events:

- **Progress events** (lines 236-287): `emitProgress(message)` → SSE `PROGRESS` event
- **Completion events** (lines 432-528): `emitCompletion(message)` → SSE `COMPLETION` event
- **Tool events** (lines 417-431): `emitToolUse()` → SSE `TOOL_USE` event
- **Error events** (lines 604-622): `emitError()` → SSE `ERROR` event

All events flow through `emitEvent()` (line 625):

```typescript
private emitEvent(event: SSEEvent): void {
  const success = this.streamManager.sendEvent(this.jobId, event)
}
```

### 3. StreamManager.ts - Actual SSE Data Transmission

**File:** `src/api/streaming/StreamManager.ts` (lines 79-139)

This is where the actual SSE data is written to the HTTP response:

```typescript
sendEvent(jobId: string, event: SSEEvent): boolean {
  const stream = this.streams.get(jobId)

  // Format as SSE data
  const eventData = `data: ${JSON.stringify(event)}\n\n`

  // Write to HTTP response stream
  stream.response.write(eventData)  // ← This sends data to client

  // Force flush to ensure immediate delivery
  stream.response.flushHeaders()
}
```

## Complete Data Flow

1. **Server**: Task generates events → SSEOutputAdapter → StreamManager → HTTP response
2. **Client**: HTTP response → SSE parsing → Event object → StreamProcessor → ContentFilter

## Key Points

- **SSE Format**: Data is sent as `data: {JSON}\n\n` format
- **Event Types**: `PROGRESS`, `COMPLETION`, `TOOL_USE`, `ERROR`, `STREAM_END`, etc.
- **ContentType**: Events can include `contentType` field (like `"thinking"`, `"tool"`, etc.)
- **Real-time**: `flushHeaders()` ensures immediate delivery to client

## Where contentType is Set

The `contentType` field in SSE events is set by the `MessageBuffer` class when processing LLM output chunks, which determines if content should be filtered by `--show-thinking` etc.

## Debug Point

To see what `contentType` thinking content actually has, add logging after line 997 in client:

```typescript
const event = JSON.parse(data)
console.log("DEBUG EVENT:", {
	type: event.type,
	contentType: event.contentType,
	message: event.message?.substring(0, 50),
})
```

This will show exactly what contentType values are being sent by the server.
