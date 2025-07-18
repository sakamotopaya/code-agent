# Story 2: Integrate ApiChunkLogger with API Client

## Story Overview

**Epic**: Raw Chunk Logging Infrastructure  
**Points**: 8  
**Dependencies**: Story 1 (ApiChunkLogger class)  
**Priority**: High

## User Story

As a developer, I want raw chunk logging integrated into the API client so that I can capture streaming data during actual API requests.

## Acceptance Criteria

### AC1: API Client Integration

- [ ] Import `ApiChunkLogger` into `src/tools/api-client.ts`
- [ ] Initialize chunk logger in `executeStreamingRequest()` when enabled
- [ ] Log raw chunks in the `res.on("data")` handler before processing
- [ ] Properly close logger when stream ends or errors

### AC2: Chunk Logging Integration Points

- [ ] Log chunks immediately when received in `res.on("data")`
- [ ] Maintain existing stream processing flow
- [ ] Log before any parsing or processing occurs
- [ ] Handle concurrent requests with separate loggers

### AC3: Request Context Integration

- [ ] Extract request context from function parameters
- [ ] Include host, port, endpoint information
- [ ] Generate unique request ID for each request
- [ ] Extract task ID from stream events when available

### AC4: Error Handling Integration

- [ ] Stream processing continues if logging fails
- [ ] Appropriate error messages for logging failures
- [ ] Cleanup logger on stream errors
- [ ] No impact on existing error handling

### AC5: Performance Optimization

- [ ] Logging operations don't block stream processing
- [ ] Minimal overhead when logging is disabled
- [ ] Efficient string handling for large chunks
- [ ] Proper async handling of file operations

## Technical Implementation

### Integration Points in executeStreamingRequest()

```typescript
async function executeStreamingRequest(
	options: ApiClientOptions,
	task: string,
	replSession?: REPLSession,
): Promise<void> {
	return new Promise((resolve, reject) => {
		// Initialize chunk logger if enabled
		const chunkLogger = options.logRawChunks ? new ApiChunkLogger(true, options.rawChunkLogDir) : null

		// Prepare request context
		const requestContext: ApiChunkLogContext = {
			requestId: generateRequestId(),
			host: options.host,
			port: options.port,
			endpoint: `/api/v1/task/${options.useStream ? "stream" : "execute"}`,
			timestamp: new Date().toISOString(),
			requestMetadata: {
				mode: options.mode,
				useStream: options.useStream,
				task: task.substring(0, 100), // Truncate for log
			},
		}

		// Initialize logger with context
		if (chunkLogger) {
			chunkLogger.initialize(requestContext).catch((error) => {
				if (options.verbose) {
					console.error("Failed to initialize chunk logger:", error)
				}
			})
		}

		const req = http.request(requestOptions, (res) => {
			res.on("data", (chunk) => {
				// Log raw chunk FIRST
				if (chunkLogger) {
					chunkLogger.logChunk(chunk.toString()).catch((error) => {
						if (options.verbose) {
							console.error("Failed to log chunk:", error)
						}
					})
				}

				// Continue with existing processing
				buffer += chunk.toString()
				// ... rest of existing logic
			})

			res.on("end", () => {
				// Close logger
				if (chunkLogger) {
					chunkLogger.close().catch((error) => {
						if (options.verbose) {
							console.error("Failed to close chunk logger:", error)
						}
					})
				}
				resolve()
			})

			res.on("error", (error) => {
				// Close logger on error
				if (chunkLogger) {
					chunkLogger.close().catch((closeError) => {
						if (options.verbose) {
							console.error("Failed to close chunk logger on error:", closeError)
						}
					})
				}
				reject(error)
			})
		})
	})
}
```

### Request ID Generation

```typescript
function generateRequestId(): string {
	return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
```

### Task ID Extraction

```typescript
// Extract task ID from stream events
if (event.type === "start" && event.taskId && chunkLogger) {
	chunkLogger.updateContext({ taskId: event.taskId })
}
```

## Files to Create/Modify

### Modified Files

- `src/tools/api-client.ts` - Main integration points
- `src/tools/types/api-client-types.ts` - Add logging options (Story 3)

### New Files

- `src/tools/__tests__/api-client-chunk-logging.test.ts` - Integration tests

## Integration Testing Requirements

### Test Scenarios

- [ ] Chunk logging with successful streaming request
- [ ] Chunk logging with failed streaming request
- [ ] Multiple concurrent requests with separate loggers
- [ ] Large chunks and high-frequency streaming
- [ ] Error handling when logging fails
- [ ] Performance impact measurement

### Test Structure

```typescript
describe("API Client Chunk Logging Integration", () => {
	test("logs raw chunks when enabled")
	test("maintains stream processing when logging fails")
	test("handles concurrent requests correctly")
	test("extracts and logs request context")
	test("updates task ID from stream events")
	test("cleans up logger on stream end")
	test("handles errors gracefully")
})
```

## Definition of Done

- [ ] Raw chunk logging integrated into API client
- [ ] Integration tests with >90% coverage
- [ ] All acceptance criteria met
- [ ] No performance regression when disabled
- [ ] Proper error handling validated
- [ ] Memory leaks prevented
- [ ] Concurrent request handling works
- [ ] Stream processing remains unaffected

## Implementation Details

### Key Integration Points

1. **Logger Initialization**:

    ```typescript
    const chunkLogger = options.logRawChunks ? new ApiChunkLogger(true, options.rawChunkLogDir) : null
    ```

2. **Chunk Logging**:

    ```typescript
    res.on("data", (chunk) => {
    	// Log first, process second
    	if (chunkLogger) {
    		chunkLogger.logChunk(chunk.toString())
    	}
    	buffer += chunk.toString()
    	// ... continue processing
    })
    ```

3. **Context Updates**:

    ```typescript
    // Update with task ID when available
    if (event.type === "start" && event.taskId) {
    	chunkLogger?.updateContext({ taskId: event.taskId })
    }
    ```

4. **Cleanup**:
    ```typescript
    // Always close logger
    if (chunkLogger) {
    	await chunkLogger.close()
    }
    ```

### Performance Considerations

- Async logging operations
- Efficient string handling
- Minimal overhead when disabled
- Proper cleanup to prevent memory leaks

### Error Handling Strategy

- Never interrupt stream processing
- Log errors appropriately
- Graceful degradation
- Proper cleanup on errors

## Review Checklist

- [ ] Integration doesn't break existing functionality
- [ ] Raw chunks logged before any processing
- [ ] Error handling is comprehensive
- [ ] Performance impact is minimal
- [ ] Context information is complete
- [ ] Cleanup is properly handled
- [ ] Tests cover all scenarios
- [ ] Concurrent requests work correctly
- [ ] Memory management is proper
- [ ] Documentation is updated
