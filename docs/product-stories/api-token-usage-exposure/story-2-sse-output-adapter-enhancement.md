# Story 2: SSE Output Adapter Enhancement

**Epic**: Server-Side Infrastructure  
**Priority**: High  
**Effort**: 3 points  
**Dependencies**: Story 1 (SSE Event Type Extension)

## User Story

**As a** server-side developer  
**I want** to emit token usage events through the SSE stream  
**So that** clients can receive token usage information in real-time

## Background

With the token usage event type defined in Story 1, this story implements the server-side method to emit token usage events through the existing SSE infrastructure. The `SSEOutputAdapter` needs a new method to format and emit token usage data while following existing patterns and error handling.

## Acceptance Criteria

### 1. Token Usage Emission Method

- [ ] Add `emitTokenUsage(tokenUsage: any)` method to `SSEOutputAdapter`
- [ ] Method creates properly formatted `token_usage` SSE event
- [ ] Follows existing event emission patterns and error handling
- [ ] Handles missing or invalid token usage data gracefully

### 2. Data Formatting

- [ ] Convert raw token usage data to structured `TokenUsage` format
- [ ] Generate human-readable message for the event
- [ ] Handle optional fields (cache stats, cost) appropriately
- [ ] Ensure numeric values are properly formatted

### 3. Error Handling

- [ ] Gracefully handle undefined/null token usage data
- [ ] Log warnings for malformed token usage data
- [ ] Continue normal operation if token usage emission fails
- [ ] No impact on core task completion flow

### 4. Integration with Existing Infrastructure

- [ ] Use existing `emitEvent()` method for consistency
- [ ] Follow same logging patterns as other emit methods
- [ ] Maintain same performance characteristics
- [ ] Work with existing stream management

## Technical Implementation

### File Changes

#### `src/api/streaming/SSEOutputAdapter.ts`

Add new method after existing emit methods:

```typescript
/**
 * Emit token usage information to the client
 */
async emitTokenUsage(tokenUsage: any): Promise<void> {
  // Handle missing or invalid data gracefully
  if (!tokenUsage || typeof tokenUsage !== 'object') {
    if (this.verbose) {
      console.log(`[SSE-TOKEN-USAGE] ⚠️ No token usage data provided, skipping emission`)
    }
    return
  }

  try {
    // Extract and validate token usage data
    const totalTokensIn = Number(tokenUsage.totalTokensIn) || 0
    const totalTokensOut = Number(tokenUsage.totalTokensOut) || 0
    const totalCost = tokenUsage.totalCost ? Number(tokenUsage.totalCost) : undefined
    const contextTokens = tokenUsage.contextTokens ? Number(tokenUsage.contextTokens) : undefined
    const totalCacheReads = tokenUsage.totalCacheReads ? Number(tokenUsage.totalCacheReads) : undefined
    const totalCacheWrites = tokenUsage.totalCacheWrites ? Number(tokenUsage.totalCacheWrites) : undefined

    // Generate human-readable message
    let message = `Token usage: ${totalTokensIn.toLocaleString()} in, ${totalTokensOut.toLocaleString()} out`
    if (totalCost !== undefined) {
      message += `, $${totalCost.toFixed(4)}`
    }

    // Create structured token usage object
    const structuredTokenUsage: TokenUsage = {
      totalTokensIn,
      totalTokensOut,
      ...(totalCacheReads !== undefined && { totalCacheReads }),
      ...(totalCacheWrites !== undefined && { totalCacheWrites }),
      ...(totalCost !== undefined && { totalCost }),
      ...(contextTokens !== undefined && { contextTokens }),
    }

    // Create and emit SSE event
    const event: SSEEvent = {
      type: SSE_EVENTS.TOKEN_USAGE,
      jobId: this.jobId,
      timestamp: new Date().toISOString(),
      message,
      tokenUsage: structuredTokenUsage,
    }

    if (this.verbose) {
      console.log(`[SSE-TOKEN-USAGE] 📊 Emitting token usage for job ${this.jobId}:`, {
        totalTokensIn,
        totalTokensOut,
        totalCost,
        contextTokens,
        cacheReads: totalCacheReads,
        cacheWrites: totalCacheWrites,
      })
    }

    this.emitEvent(event)
  } catch (error) {
    // Log error but don't throw - token usage is supplementary information
    this.logger.warn(`Failed to emit token usage for job ${this.jobId}: ${error}`)
    if (this.verbose) {
      console.log(`[SSE-TOKEN-USAGE] ❌ Error emitting token usage:`, error)
    }
  }
}
```

### Integration Points

#### Import Statement

Add to existing imports:

```typescript
import { TokenUsage } from "./types"
```

#### Method Placement

Place after `emitCompletion()` method to maintain logical grouping.

## Testing Strategy

### Unit Tests

Create test file: `src/api/streaming/__tests__/SSEOutputAdapter-token-usage.test.ts`

```typescript
import { SSEOutputAdapter } from "../SSEOutputAdapter"
import { StreamManager } from "../StreamManager"
import { SSE_EVENTS } from "../types"

describe("SSEOutputAdapter Token Usage", () => {
	let adapter: SSEOutputAdapter
	let mockStreamManager: jest.Mocked<StreamManager>

	beforeEach(() => {
		mockStreamManager = {
			sendEvent: jest.fn().mockReturnValue(true),
			hasActiveStream: jest.fn().mockReturnValue(true),
			closeStream: jest.fn(),
			getActiveStreamIds: jest.fn().mockReturnValue(["test-job"]),
		} as any

		adapter = new SSEOutputAdapter(mockStreamManager, "test-job", false)
	})

	test("should emit token usage with complete data", async () => {
		const tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 200,
			totalCost: 0.05,
			contextTokens: 1000,
			totalCacheReads: 50,
			totalCacheWrites: 25,
		}

		await adapter.emitTokenUsage(tokenUsage)

		expect(mockStreamManager.sendEvent).toHaveBeenCalledWith("test-job", {
			type: SSE_EVENTS.TOKEN_USAGE,
			jobId: "test-job",
			timestamp: expect.any(String),
			message: "Token usage: 100 in, 200 out, $0.0500",
			tokenUsage: {
				totalTokensIn: 100,
				totalTokensOut: 200,
				totalCost: 0.05,
				contextTokens: 1000,
				totalCacheReads: 50,
				totalCacheWrites: 25,
			},
		})
	})

	test("should handle minimal token usage data", async () => {
		const tokenUsage = {
			totalTokensIn: 50,
			totalTokensOut: 150,
		}

		await adapter.emitTokenUsage(tokenUsage)

		expect(mockStreamManager.sendEvent).toHaveBeenCalledWith("test-job", {
			type: SSE_EVENTS.TOKEN_USAGE,
			jobId: "test-job",
			timestamp: expect.any(String),
			message: "Token usage: 50 in, 150 out",
			tokenUsage: {
				totalTokensIn: 50,
				totalTokensOut: 150,
			},
		})
	})

	test("should handle missing token usage data gracefully", async () => {
		await adapter.emitTokenUsage(null)
		await adapter.emitTokenUsage(undefined)
		await adapter.emitTokenUsage({})

		expect(mockStreamManager.sendEvent).not.toHaveBeenCalled()
	})

	test("should handle malformed token usage data", async () => {
		const tokenUsage = {
			totalTokensIn: "invalid",
			totalTokensOut: null,
			totalCost: "not-a-number",
		}

		await adapter.emitTokenUsage(tokenUsage)

		expect(mockStreamManager.sendEvent).toHaveBeenCalledWith("test-job", {
			type: SSE_EVENTS.TOKEN_USAGE,
			jobId: "test-job",
			timestamp: expect.any(String),
			message: "Token usage: 0 in, 0 out",
			tokenUsage: {
				totalTokensIn: 0,
				totalTokensOut: 0,
			},
		})
	})

	test("should not throw on stream manager failure", async () => {
		mockStreamManager.sendEvent.mockReturnValue(false)

		const tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 200,
		}

		await expect(adapter.emitTokenUsage(tokenUsage)).resolves.not.toThrow()
	})
})
```

### Integration Tests

```typescript
describe("SSEOutputAdapter Integration", () => {
	test("should emit token usage in task completion flow", async () => {
		// Test that token usage emission works with real StreamManager
		// and doesn't interfere with other events
	})

	test("should handle concurrent token usage emissions", async () => {
		// Test multiple rapid token usage emissions
	})
})
```

## Error Handling Strategy

### Input Validation

- **Null/Undefined**: Skip emission, log in verbose mode
- **Invalid Type**: Skip emission, log warning
- **Missing Required Fields**: Use defaults (0 for token counts)
- **Invalid Numbers**: Convert to 0, continue processing

### Stream Failures

- **Stream Inactive**: Log warning, continue execution
- **Send Failure**: Log warning, don't throw exception
- **Network Issues**: Handled by existing StreamManager error handling

### Performance Considerations

- **Data Processing**: Minimal overhead for number conversion and formatting
- **Memory Usage**: Small structured object creation
- **Error Recovery**: Fast failure path for invalid data

## Performance Impact Analysis

### Expected Overhead

- **CPU**: ~1-2ms for data formatting and validation
- **Memory**: ~200 bytes per token usage event
- **Network**: ~300-500 bytes additional SSE data per task

### Optimization Strategies

- **Lazy Formatting**: Only format message if stream is active
- **Number Caching**: Cache formatted numbers for repeated values
- **Early Return**: Fast path for missing data

## Definition of Done

- [ ] `emitTokenUsage()` method implemented in `SSEOutputAdapter`
- [ ] Method handles all token usage data formats correctly
- [ ] Error handling prevents method from throwing exceptions
- [ ] Human-readable message generation works properly
- [ ] Unit tests written and passing (>95% coverage)
- [ ] Integration tests verify end-to-end functionality
- [ ] Performance impact measured and acceptable (<5ms)
- [ ] Code review completed
- [ ] Documentation updated

## Risk Assessment

### Medium Risk

- **Data Format Variations**: Different LLM providers may return different formats
    - _Mitigation_: Flexible parsing with defaults
- **Performance Impact**: Additional processing per task completion
    - _Mitigation_: Lightweight implementation, performance testing

### Low Risk

- **Error Handling**: Well-defined error boundaries
- **Integration**: Uses existing SSE infrastructure
- **Testing**: Comprehensive test coverage

## Dependencies

### Upstream Dependencies

- Story 1: SSE Event Type Extension (required for `TokenUsage` type)

### Downstream Dependencies

- Story 3: Task Execution Handler Integration (will use this method)
- Story 4: Client-Side Display Implementation (will consume these events)

## Acceptance Testing

### Manual Testing Scenarios

1. **Complete Token Usage**: Test with all fields present
2. **Minimal Token Usage**: Test with only required fields
3. **Invalid Data**: Test with malformed input
4. **Stream Failures**: Test with inactive streams
5. **Performance**: Test with high-frequency emissions

### Automated Testing

1. **Unit Tests**: All code paths covered
2. **Integration Tests**: Real StreamManager integration
3. **Performance Tests**: Measure emission overhead
4. **Error Tests**: All error conditions handled

## Success Metrics

- ✅ Method execution time: <2ms average
- ✅ Unit test coverage: >95%
- ✅ Zero exceptions thrown in production
- ✅ Event delivery success rate: >99%
- ✅ Memory usage increase: <1MB per 1000 events

## Implementation Notes

### Design Decisions

1. **Graceful Degradation**: Missing token usage doesn't break functionality
2. **Flexible Parsing**: Handles various input formats from different LLM providers
3. **Consistent Patterns**: Follows existing SSE adapter method patterns
4. **Performance First**: Optimized for minimal overhead

### Future Enhancements

- **Caching**: Cache formatted messages for repeated values
- **Batching**: Batch multiple token usage events if needed
- **Compression**: Compress token usage data for large values
- **Analytics**: Add hooks for usage analytics collection

## Rollback Plan

If issues arise:

1. **Immediate**: Add feature flag to disable token usage emission
2. **Short-term**: Revert method implementation, keep interface
3. **Long-term**: Full rollback of Story 1 and 2 if necessary

The method is designed to fail gracefully, so rollback risk is minimal.
