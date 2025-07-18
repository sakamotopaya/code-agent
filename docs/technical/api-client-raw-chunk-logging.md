# API Client Raw Chunk Logging Implementation Plan

## Overview

This document outlines the implementation plan for adding raw chunk logging to the API client, reusing the existing logging patterns from the CLI's XMLTagLogger and the TaskApiHandler's LLM interaction logging.

## Current Logging Analysis

### 1. TaskApiHandler LLM Interaction Logging

- **Location**: `src/core/task/TaskApiHandler.ts`
- **Method**: `writeLlmInteractionToFile()`
- **File Pattern**: `llm-interaction-${timestamp}.json`
- **Content**: Structured JSON with system prompt, messages, metadata
- **Purpose**: Log complete LLM interactions for debugging

### 2. CLI Raw Content Logging

- **Location**: `src/cli/services/streaming/XMLTagLogger.ts`
- **Class**: `LLMContentLogger`
- **File Pattern**: `raw-llm-${timestamp}.log`
- **Content**: Raw LLM content chunks with bullet separator (•)
- **Purpose**: Log raw streaming content as received

### 3. API Client Current Structure

- **Location**: `src/tools/api-client.ts`
- **Stream Processing**: `executeStreamingRequest()` function
- **Chunk Reception**: `res.on("data", (chunk) => {...})`
- **Event Parsing**: SSE events parsed from raw chunks
- **Configuration**: Multiple logging options already available

## Implementation Plan

### Phase 1: Create Shared Raw Logging Utility

#### 1.1 Create `ApiChunkLogger` Class

- **Location**: `src/shared/logging/ApiChunkLogger.ts`
- **Pattern**: Similar to `LLMContentLogger` but for API chunks
- **Features**:
    - Log raw HTTP chunks as received
    - Use bullet character (•) separator between chunks
    - Timestamped log files: `raw-api-chunks-${timestamp}.log`
    - Support for different storage directories
    - Context-aware logging (task ID, request metadata)

#### 1.2 Enhanced Logging Context

```typescript
interface ApiChunkLogContext {
	taskId?: string
	requestId?: string
	host: string
	port: number
	endpoint: string
	timestamp: string
	requestMetadata?: any
}
```

#### 1.3 Log File Structure

```
=== API Chunk Log - 2025-01-17T12:34:56.789Z ===
Host: localhost:3000
Endpoint: /api/v1/task/stream
Task ID: 12345678-1234-5678-9012-123456789012
Request ID: req-987654321
===

data: {"type":"start","taskId":"12345678-1234-5678-9012-123456789012"}

•data: {"type":"text","content":"Hello"}

•data: {"type":"text","content":" world"}

•data: {"type":"completion","result":"success"}

•data: {"type":"stream_end"}
```

### Phase 2: Integrate into API Client

#### 2.1 Update `ApiClientOptions`

```typescript
interface ApiClientOptions {
	// ... existing options
	logRawChunks?: boolean
	rawChunkLogDir?: string
}
```

#### 2.2 Modify `executeStreamingRequest()`

- Initialize `ApiChunkLogger` when `logRawChunks` is enabled
- Log raw chunks in the `res.on("data")` handler
- Log request metadata at the start
- Close logger when stream ends

#### 2.3 Integration Points

```typescript
// In executeStreamingRequest()
const chunkLogger = options.logRawChunks ? new ApiChunkLogger(options.rawChunkLogDir) : null

if (chunkLogger) {
	await chunkLogger.initialize(requestContext)
}

res.on("data", (chunk) => {
	// Log raw chunk first
	if (chunkLogger) {
		chunkLogger.logChunk(chunk.toString())
	}

	// Continue with existing processing
	buffer += chunk.toString()
	// ... rest of existing logic
})
```

### Phase 3: Configuration Integration

#### 3.1 Command Line Arguments

- Add `--log-raw-chunks` flag
- Add `--raw-chunk-log-dir <path>` option
- Update help text and documentation

#### 3.2 Configuration Persistence

- Store raw chunk logging preferences in user settings
- Support different log directories per context
- Integration with existing `getGlobalStoragePath()` pattern

### Phase 4: Testing Strategy

#### 4.1 Unit Tests

- Test `ApiChunkLogger` class functionality
- Test chunk separator insertion
- Test file creation and writing
- Test error handling and recovery

#### 4.2 Integration Tests

- Test with real API streaming requests
- Test with different chunk sizes and timing
- Test with interrupted streams
- Test with concurrent requests

#### 4.3 E2E Tests

- Test with CLI tool
- Test with different logging configurations
- Test log file cleanup and rotation

## Technical Details

### File Structure

```
src/
├── shared/
│   └── logging/
│       ├── ApiChunkLogger.ts        # New: Raw chunk logger
│       ├── types.ts                 # New: Logging types
│       └── __tests__/
│           └── ApiChunkLogger.test.ts
├── tools/
│   ├── api-client.ts               # Modified: Add chunk logging
│   ├── types/
│   │   └── api-client-types.ts     # Modified: Add logging options
│   └── __tests__/
│       └── api-client-chunk-logging.test.ts # New: Tests
```

### Key Implementation Points

1. **Reuse Existing Patterns**:

    - Follow `LLMContentLogger` structure for consistency
    - Use same file naming and directory conventions
    - Reuse global storage path logic

2. **Performance Considerations**:

    - Async file operations to avoid blocking
    - Efficient string concatenation
    - Optional logging to minimize overhead

3. **Error Handling**:

    - Graceful degradation when logging fails
    - Don't interrupt stream processing
    - Appropriate error messages

4. **Context Awareness**:
    - Include request metadata in logs
    - Support multiple concurrent streams
    - Proper cleanup on stream end

## Benefits

1. **Debugging**: Raw chunks help debug SSE parsing issues
2. **Consistency**: Reuses existing logging patterns
3. **Flexibility**: Configurable logging levels and locations
4. **Integration**: Works with existing CLI and API infrastructure
5. **Performance**: Minimal impact when disabled

## Migration Strategy

1. **Backward Compatibility**: New feature is opt-in
2. **Configuration**: Uses existing configuration patterns
3. **Testing**: Comprehensive test coverage before release
4. **Documentation**: Update CLI help and user documentation

## Future Enhancements

1. **Log Rotation**: Automatic cleanup of old log files
2. **Compression**: Compress large log files
3. **Structured Logging**: JSON format option for machine parsing
4. **Real-time Monitoring**: Stream log analysis tools
5. **Integration**: Connect with existing monitoring systems
