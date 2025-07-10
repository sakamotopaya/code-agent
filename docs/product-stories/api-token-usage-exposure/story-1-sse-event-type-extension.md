# Story 1: SSE Event Type Extension

**Epic**: Server-Side Infrastructure  
**Priority**: High  
**Effort**: 2 points  
**Dependencies**: None

## User Story

**As a** system architect  
**I want** to add a new SSE event type for token usage  
**So that** token usage information can be streamed to clients

## Background

The current SSE event system supports various event types (start, progress, completion, error, etc.) but lacks a dedicated event type for token usage information. This story adds the foundational event type and data structure needed to stream token usage data to API clients.

## Acceptance Criteria

### 1. Event Type Definition

- [ ] Add `"token_usage"` to the SSE event type union in `SSEEvent` interface
- [ ] Add `SSE_EVENTS.TOKEN_USAGE = "token_usage"` constant
- [ ] Ensure type safety with existing SSE event handling

### 2. Token Usage Data Structure

- [ ] Add optional `tokenUsage` field to `SSEEvent` interface
- [ ] Define `TokenUsage` interface with required fields:
    - `totalTokensIn: number`
    - `totalTokensOut: number`
    - `totalCacheWrites?: number` (optional)
    - `totalCacheReads?: number` (optional)
    - `totalCost?: number` (optional)
    - `contextTokens?: number` (optional)

### 3. Backward Compatibility

- [ ] All existing SSE event handlers continue to work
- [ ] No breaking changes to existing event processing
- [ ] Optional fields don't affect existing event serialization

### 4. Type Safety

- [ ] TypeScript compilation passes without errors
- [ ] All SSE event consumers handle new event type gracefully
- [ ] Event type discrimination works correctly

## Technical Implementation

### File Changes

#### `src/api/streaming/types.ts`

```typescript
export interface TokenUsage {
	totalTokensIn: number
	totalTokensOut: number
	totalCacheWrites?: number
	totalCacheReads?: number
	totalCost?: number
	contextTokens?: number
}

export interface SSEEvent {
	type:
		| "start"
		| "progress"
		| "tool_use"
		| "completion"
		| "stream_end"
		| "error"
		| "log"
		| "question"
		| "warning"
		| "information"
		| "question_ask"
		| "token_usage" // NEW
	jobId: string
	timestamp: string
	// ... existing fields
	tokenUsage?: TokenUsage // NEW
}

export const SSE_EVENTS = {
	START: "start",
	PROGRESS: "progress",
	TOOL_USE: "tool_use",
	COMPLETION: "completion",
	STREAM_END: "stream_end",
	ERROR: "error",
	LOG: "log",
	QUESTION: "question",
	QUESTION_ASK: "question_ask",
	WARNING: "warning",
	INFORMATION: "information",
	TOKEN_USAGE: "token_usage", // NEW
} as const
```

### Validation Steps

#### 1. Type Checking

```bash
# Ensure TypeScript compilation passes
cd src && npm run type-check
```

#### 2. Event Type Validation

```typescript
// Test that event type discrimination works
const event: SSEEvent = {
	type: "token_usage",
	jobId: "test-job",
	timestamp: new Date().toISOString(),
	tokenUsage: {
		totalTokensIn: 100,
		totalTokensOut: 200,
		totalCost: 0.05,
	},
}

// Should compile without errors
```

#### 3. Backward Compatibility Test

```typescript
// Existing event creation should still work
const existingEvent: SSEEvent = {
	type: "completion",
	jobId: "test-job",
	timestamp: new Date().toISOString(),
	message: "Task completed",
}
```

## Testing Strategy

### Unit Tests

Create test file: `src/api/streaming/__tests__/token-usage-types.test.ts`

```typescript
import { SSEEvent, SSE_EVENTS, TokenUsage } from "../types"

describe("Token Usage SSE Event Types", () => {
	test("should create valid token usage event", () => {
		const tokenUsage: TokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 200,
			totalCost: 0.05,
		}

		const event: SSEEvent = {
			type: SSE_EVENTS.TOKEN_USAGE,
			jobId: "test-job",
			timestamp: new Date().toISOString(),
			tokenUsage,
		}

		expect(event.type).toBe("token_usage")
		expect(event.tokenUsage).toEqual(tokenUsage)
	})

	test("should handle optional token usage fields", () => {
		const tokenUsage: TokenUsage = {
			totalTokensIn: 50,
			totalTokensOut: 150,
			// Optional fields omitted
		}

		expect(tokenUsage.totalCacheReads).toBeUndefined()
		expect(tokenUsage.totalCost).toBeUndefined()
	})

	test("should maintain backward compatibility", () => {
		const existingEvent: SSEEvent = {
			type: "completion",
			jobId: "test-job",
			timestamp: new Date().toISOString(),
			message: "Task completed",
		}

		expect(existingEvent.tokenUsage).toBeUndefined()
	})
})
```

### Integration Tests

- Verify SSE event serialization includes new fields
- Test event type discrimination in existing handlers
- Validate JSON serialization/deserialization

## Definition of Done

- [ ] `TokenUsage` interface defined with all required fields
- [ ] `token_usage` event type added to `SSEEvent` union
- [ ] `SSE_EVENTS.TOKEN_USAGE` constant defined
- [ ] TypeScript compilation passes without errors
- [ ] Unit tests written and passing
- [ ] Backward compatibility verified
- [ ] Code review completed
- [ ] Documentation updated

## Risk Assessment

### Low Risk

- **Type Safety**: TypeScript ensures compile-time validation
- **Backward Compatibility**: Additive changes only
- **Testing**: Comprehensive unit test coverage

### Mitigation Strategies

- **Gradual Rollout**: Types can be added without immediate usage
- **Validation**: Extensive testing of type definitions
- **Rollback Plan**: Changes are purely additive and can be reverted easily

## Dependencies

### Upstream Dependencies

- None - this is foundational work

### Downstream Dependencies

- Story 2: SSE Output Adapter Enhancement (depends on these types)
- Story 3: Task Execution Handler Integration (depends on these types)

## Acceptance Testing

### Manual Verification

1. **Type Compilation**: Verify TypeScript compiles without errors
2. **Event Creation**: Create sample token usage events
3. **Serialization**: Verify events serialize to JSON correctly
4. **Backward Compatibility**: Ensure existing events still work

### Automated Testing

1. **Unit Tests**: All new type definitions tested
2. **Integration Tests**: Event handling pipeline tested
3. **Type Tests**: TypeScript type checking in CI

## Success Metrics

- ✅ TypeScript compilation success rate: 100%
- ✅ Unit test coverage: >95% for new types
- ✅ No breaking changes to existing functionality
- ✅ Event serialization performance impact: <1ms

## Implementation Notes

### Design Decisions

1. **Optional Fields**: Cache and cost fields are optional to handle various LLM providers
2. **Separate Interface**: `TokenUsage` interface for reusability
3. **Consistent Naming**: Follows existing SSE event naming patterns

### Future Considerations

- Additional token usage metrics can be added to `TokenUsage` interface
- Event versioning strategy if breaking changes needed
- Performance monitoring fields could be added later

## Rollback Plan

If issues arise:

1. **Immediate**: Comment out new event type from union
2. **Short-term**: Remove `tokenUsage` field from `SSEEvent`
3. **Long-term**: Revert entire commit if necessary

Changes are purely additive, so rollback risk is minimal.
