# Story 1: Create ApiChunkLogger Class

## Story Overview

**Epic**: Raw Chunk Logging Infrastructure  
**Points**: 5  
**Dependencies**: None  
**Priority**: High

## User Story

As a developer, I want a dedicated logging class that can capture raw HTTP chunks so that I can debug streaming issues effectively.

## Acceptance Criteria

### AC1: Basic ApiChunkLogger Class

- [ ] Create `ApiChunkLogger` class in `src/shared/logging/ApiChunkLogger.ts`
- [ ] Class follows same pattern as existing `LLMContentLogger`
- [ ] Constructor accepts configuration options (enabled, logDir, context)
- [ ] Implements async initialization and cleanup methods

### AC2: Chunk Logging Functionality

- [ ] `logChunk(chunk: string)` method appends raw chunk to log file
- [ ] First chunk has no separator prefix
- [ ] Subsequent chunks prefixed with bullet character (•)
- [ ] Chunks logged exactly as received (no modification)

### AC3: File Management

- [ ] Creates timestamped log files: `raw-api-chunks-${timestamp}.log`
- [ ] Timestamp format: `YYYY-MM-DD_HH-mm-ss`
- [ ] Automatically creates log directory if it doesn't exist
- [ ] Handles file writing errors gracefully

### AC4: Request Context Logging

- [ ] `initialize(context: ApiChunkLogContext)` method
- [ ] Writes log header with request metadata
- [ ] Includes host, port, endpoint, taskId, requestId
- [ ] Includes request timestamp

### AC5: Error Handling

- [ ] Graceful degradation when file operations fail
- [ ] Appropriate error logging without throwing exceptions
- [ ] Continues operation even if logging fails

## Technical Implementation

### Class Structure

```typescript
export class ApiChunkLogger {
	private logFilePath: string
	private isEnabled: boolean
	private isFirstChunk: boolean
	private context: ApiChunkLogContext | null

	constructor(enabled: boolean, logDir?: string)
	async initialize(context: ApiChunkLogContext): Promise<void>
	async logChunk(chunk: string): Promise<void>
	async close(): Promise<void>
	getLogFilePath(): string
	isLoggingEnabled(): boolean
}
```

### Context Interface

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

### Log File Format

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
```

## Files to Create/Modify

### New Files

- `src/shared/logging/ApiChunkLogger.ts` - Main logger class
- `src/shared/logging/types.ts` - Type definitions
- `src/shared/logging/__tests__/ApiChunkLogger.test.ts` - Unit tests

### Test Coverage Requirements

- [ ] Constructor with different configurations
- [ ] Initialization with context
- [ ] Chunk logging with separators
- [ ] File creation and writing
- [ ] Error handling scenarios
- [ ] Cleanup operations

## Definition of Done

- [ ] `ApiChunkLogger` class implemented
- [ ] Unit tests with >90% coverage
- [ ] All acceptance criteria met
- [ ] Code follows existing patterns
- [ ] Error handling validated
- [ ] Documentation comments added
- [ ] Lint and type checks pass

## Testing Strategy

### Unit Tests

```typescript
describe("ApiChunkLogger", () => {
	test("creates timestamped log files")
	test("logs chunks with bullet separators")
	test("handles initialization with context")
	test("gracefully handles file errors")
	test("maintains chunk order and boundaries")
})
```

### Integration Points

- Verify compatibility with existing logging infrastructure
- Test with different log directory configurations
- Validate performance impact

## Implementation Notes

### Key Considerations

1. **Performance**: Async file operations to avoid blocking
2. **Consistency**: Follow existing `LLMContentLogger` patterns
3. **Reliability**: Never break stream processing due to logging
4. **Flexibility**: Support different log locations and contexts

### Reuse Patterns

- File naming conventions from `LLMContentLogger`
- Directory creation from `getGlobalStoragePath()`
- Error handling patterns from existing logging
- Async operations from `TaskApiHandler`

## Review Checklist

- [ ] Class structure matches existing logging patterns
- [ ] Bullet separator logic works correctly
- [ ] Error handling doesn't interrupt main flow
- [ ] File operations are properly async
- [ ] Context logging includes all required fields
- [ ] Tests cover all functionality
- [ ] Code is well-documented
- [ ] Performance impact is minimal
