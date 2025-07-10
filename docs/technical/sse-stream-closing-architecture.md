# SSE Stream Closing - Architecture Design

## Current Architecture (Problematic)

```mermaid
sequenceDiagram
    participant Client as API Client
    participant Server as Fastify Server
    participant SM as StreamManager
    participant SSE as SSEOutputAdapter
    participant Task as Task Execution

    Client->>Server: POST /execute/stream
    Server->>SM: createStream(response, jobId)
    SM->>Client: SSE Headers + Stream
    Server->>SSE: new SSEOutputAdapter(streamManager, jobId)
    Server->>Task: executeTask()

    loop Task Execution
        Task->>SSE: progress events
        SSE->>SM: sendEvent(jobId, event)
        SM->>Client: data: {...}
    end

    Task->>SSE: emitCompletion("Task completed")
    SSE->>SM: sendEvent(jobId, completion)
    SM->>Client: data: {type: "completion", ...}

    Note over Client: ❌ RACE CONDITION
    Client->>Client: res.destroy() immediately

    Note over Task: Task still finishing...
    Task->>SSE: Additional completion events
    SSE->>SM: sendEvent(jobId, event)
    Note over SM: ❌ Stream already closed!
    SM-->>SSE: sendEvent returns false

    Note over Server: ❌ Lost completion content
```

## New Architecture (Fixed)

```mermaid
sequenceDiagram
    participant Client as API Client
    participant Server as Fastify Server
    participant SM as StreamManager
    participant SSE as SSEOutputAdapter
    participant Task as Task Execution

    Client->>Server: POST /execute/stream
    Server->>SM: createStream(response, jobId)
    SM->>Client: SSE Headers + Stream
    Server->>SSE: new SSEOutputAdapter(streamManager, jobId)
    Server->>Task: executeTask()

    loop Task Execution
        Task->>SSE: progress events
        SSE->>SM: sendEvent(jobId, event)
        SM->>Client: data: {...}
    end

    Task->>SSE: emitCompletion("Task completed")

    Note over SSE: ✅ NEW COMPLETION FLOW
    SSE->>SSE: Queue completion event
    SSE->>SM: sendEvent(jobId, completion)
    SM->>Client: data: {type: "completion", ...}

    Note over Client: ✅ NO IMMEDIATE CLOSURE
    Client->>Client: Process completion, wait for stream_end

    Note over SSE: ✅ CONTROLLED CLOSURE
    SSE->>SSE: setTimeout(50ms)
    SSE->>SM: sendEvent(jobId, stream_end)
    SM->>Client: data: {type: "stream_end", ...}

    SSE->>SSE: setTimeout(100ms)
    SSE->>SM: closeStream(jobId)
    SM->>SM: Cleanup resources

    Note over Client: ✅ SAFE TO CLOSE
    Client->>Client: res.destroy() on stream_end
```

## Component Architecture

```mermaid
graph TB
    subgraph "Client Side (api-client.js)"
        C1[HTTP Request] --> C2[SSE Event Handler]
        C2 --> C3{Event Type?}
        C3 -->|progress| C4[Display Content]
        C3 -->|completion| C5[Process Completion]
        C3 -->|stream_end| C6[Close Connection]
        C5 --> C7[Wait for stream_end]
        C7 --> C6
        C6 --> C8[Cleanup & Resolve]
    end

    subgraph "Server Side"
        subgraph "FastifyServer"
            S1[POST /execute/stream] --> S2[Create Job]
            S2 --> S3[Create SSE Stream]
            S3 --> S4[Execute Task]
        end

        subgraph "StreamManager"
            SM1[createStream] --> SM2[Store Stream]
            SM3[sendEvent] --> SM4[Write to Response]
            SM5[closeStream] --> SM6[Cleanup Resources]
        end

        subgraph "SSEOutputAdapter"
            SSE1[emitCompletion] --> SSE2[Send Completion Event]
            SSE2 --> SSE3[Schedule stream_end]
            SSE3 --> SSE4[Send stream_end Event]
            SSE4 --> SSE5[Schedule Stream Closure]
            SSE5 --> SSE6[Close Stream]
        end

        subgraph "Task Execution"
            T1[Task.execute] --> T2[Progress Events]
            T2 --> T3[Completion Event]
            T3 --> T4[Cleanup]
        end
    end

    S3 --> SM1
    S4 --> T1
    T2 --> SSE1
    T3 --> SSE1
    SSE2 --> SM3
    SSE4 --> SM3
    SSE6 --> SM5
```

## Event Flow Timing

```mermaid
gantt
    title SSE Stream Event Timeline
    dateFormat X
    axisFormat %L ms

    section Task Execution
    Task Processing    :active, task, 0, 1000
    Task Completion    :milestone, complete, 1000, 0

    section Server Events
    Progress Events    :progress, 0, 1000
    Completion Event   :milestone, comp-event, 1000, 0
    Stream End Event   :milestone, end-event, 1050, 0
    Stream Closure     :milestone, closure, 1150, 0

    section Client Handling
    Process Events     :client, 0, 1000
    Handle Completion  :comp-handle, 1000, 1050
    Wait for End       :wait, 1000, 1050
    Close Connection   :milestone, close, 1050, 0
```

## Data Structures

### New SSE Event Type

```typescript
// src/api/streaming/types.ts
export const SSE_EVENTS = {
	START: "start",
	PROGRESS: "progress",
	COMPLETION: "completion",
	STREAM_END: "stream_end", // ✅ NEW
	ERROR: "error",
	// ... other events
} as const

export interface SSEEvent {
	type: SSEEventType
	jobId: string
	timestamp: string
	message?: string
	result?: string
	contentType?: string
	// ... other fields
}
```

### Stream State Management

```typescript
// Enhanced SSEStream interface
export interface SSEStream {
	jobId: string
	response: ServerResponse
	isActive: boolean
	lastActivity: Date
	completionSent: boolean // ✅ NEW
	streamEndSent: boolean // ✅ NEW
	scheduledClosure?: NodeJS.Timeout // ✅ NEW
}
```

## Implementation Details

### Server-Side Changes

#### 1. SSEOutputAdapter.emitCompletion()

```typescript
async emitCompletion(message: string): Promise<void> {
    // Send completion event immediately
    const completionEvent: SSEEvent = {
        type: SSE_EVENTS.COMPLETION,
        jobId: this.jobId,
        timestamp: new Date().toISOString(),
        message: message
    }

    this.emitEvent(completionEvent)

    // Schedule stream_end event after small delay
    setTimeout(() => {
        if (this.isActive()) {
            const endEvent: SSEEvent = {
                type: SSE_EVENTS.STREAM_END,
                jobId: this.jobId,
                timestamp: new Date().toISOString(),
                message: "Stream ending"
            }

            this.emitEvent(endEvent)

            // Schedule actual stream closure
            setTimeout(() => {
                this.close()
            }, 100)
        }
    }, 50)
}
```

#### 2. StreamManager Enhanced Closure

```typescript
closeStream(jobId: string): void {
    const stream = this.streams.get(jobId)
    if (!stream) return

    // Clear any scheduled closures
    if (stream.scheduledClosure) {
        clearTimeout(stream.scheduledClosure)
    }

    stream.isActive = false

    // ... existing cleanup logic
}
```

### Client-Side Changes

#### 1. Updated Event Handling

```javascript
// In testStreamingEndpoint()
switch (filteredData.type) {
	case "complete":
	case "completion":
		// Process completion content
		if (showResponse && shouldDisplay) {
			// ... display logic
		}
		// ✅ DON'T close stream here anymore
		break

	case "stream_end":
		// ✅ NOW we close the stream
		if (verbose) {
			console.log("     🔚 Stream ended by server")
		}
		res.destroy()
		return

	// ... other cases
}
```

#### 2. Timeout Protection

```javascript
// Add timeout fallback
const STREAM_TIMEOUT = 30000 // 30 seconds
const streamTimeout = setTimeout(() => {
	if (verbose) {
		console.log("     ⏰ Stream timeout - forcing closure")
	}
	res.destroy()
}, STREAM_TIMEOUT)

res.on("end", () => {
	clearTimeout(streamTimeout)
	resolve()
})

res.on("error", (error) => {
	clearTimeout(streamTimeout)
	reject(error)
})
```

## Benefits of New Architecture

1. **Eliminates Race Condition**: Server controls stream closure timing
2. **Guarantees Message Delivery**: All completion events sent before closure
3. **Maintains Performance**: Minimal delays (50-100ms total)
4. **Provides Safety**: Timeout fallbacks prevent hanging connections
5. **Enables Monitoring**: Clear stream lifecycle events for observability
6. **Backward Compatible**: Can support both old and new protocols

## Risk Mitigation

### Resource Leaks

- **Timeout fallbacks** at multiple levels
- **Cleanup on connection errors**
- **Monitoring for orphaned streams**

### Performance Impact

- **Minimal delays** (50ms + 100ms)
- **Asynchronous processing** doesn't block other operations
- **Load testing** to validate performance

### Deployment Safety

- **Feature flags** for gradual rollout
- **Backward compatibility** during transition
- **Rollback capability** if issues arise

This architecture ensures reliable, complete delivery of SSE stream content while maintaining performance and safety characteristics.
