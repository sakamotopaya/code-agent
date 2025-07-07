# Story 003: API Tool Execution Integration

## Epic

Epic 3: Tool Execution Unification

## Story Title

Replace API executeCliTool with unified presentAssistantMessage pattern using SSE-aware adapters

## User Story

**As an API user**, I want access to all tools available in the VSCode extension (including `list_modes`, `switch_mode`, `new_task`) with proper SSE streaming output, **so that** I have feature parity and real-time tool execution feedback.

## Acceptance Criteria

### API Tool Execution Replacement

- [ ] Replace API tool execution calls with `presentAssistantMessage` pattern
- [ ] Integrate `SSEToolInterfaceAdapter` into API execution flow
- [ ] Maintain existing SSE streaming behavior
- [ ] Preserve real-time tool execution feedback
- [ ] Keep API response format consistency

### Tool Availability

- [ ] `list_modes` tool works in API with SSE streaming
- [ ] `switch_mode` tool works in API context
- [ ] `new_task` tool works in API context
- [ ] All existing VSCode tools work in API context
- [ ] Tool results stream properly via SSE events

### SSE-Specific Behavior

- [ ] Tool execution events emitted in real-time
- [ ] Tool results added to userMessageContent for conversation continuity
- [ ] Error events properly emitted via SSE
- [ ] Progress updates streamed during tool execution
- [ ] Tool completion events indicate execution status

### API Compatibility

- [ ] Existing API endpoints continue to work
- [ ] SSE event format remains consistent
- [ ] No breaking changes to API interface
- [ ] Response timing characteristics maintained

## Technical Requirements

### FastifyServer.ts Modifications

```typescript
// In /execute/stream endpoint, replace:
const toolResult = await this.executeCliTool(block.name, block.params)

// With unified tool execution using SSE adapter
await this.executeUnifiedTools(taskApiHandler, sseAdapter)
```

### API Execution Flow

1. Create `SSEToolInterfaceAdapter` instance with SSE adapter and task handler
2. Inject adapter into Task for `presentAssistantMessage` use
3. Call `presentAssistantMessage(this)` for tool execution
4. Adapter routes output through SSE events and userMessageContent

### SSE Event Enhancements

```typescript
// New SSE event types
SSE_EVENTS.TOOL_START = "tool_start"
SSE_EVENTS.TOOL_RESULT = "tool_result"
SSE_EVENTS.TOOL_PROGRESS = "tool_progress"
SSE_EVENTS.TOOL_COMPLETE = "tool_complete"
```

### Integration Points

- File: `src/api/server/FastifyServer.ts` (lines 177-423)
- Method: `/execute/stream` endpoint tool execution
- Dependencies: `SSEToolInterfaceAdapter`, `presentAssistantMessage`

## Dependencies

### Internal Dependencies

- Story 001: Context-Aware Tool Interface Adapters (must be completed first)
- `presentAssistantMessage` function
- `SSEOutputAdapter` enhancements
- All tool implementations in `src/core/tools/`

### External Dependencies

- None

## Testing Strategy

### Unit Tests

- Test unified tool execution with mocked SSE adapter
- Verify all tools can be executed in API context
- Test SSE event emission for tool execution
- Verify userMessageContent updates

### Integration Tests

- Test complete API workflow with real tools
- Verify `list_modes` works with SSE streaming
- Test tool execution via `/execute/stream` endpoint
- Verify SSE events are properly formatted

### End-to-End Tests

- Test API client consuming tool execution SSE events
- Verify real-time tool progress updates
- Test error scenarios and SSE error events
- Performance testing for tool execution latency

### Test Files

- `src/api/server/__tests__/unified-tool-execution.test.ts`
- `src/api/streaming/__tests__/SSEToolInterfaceAdapter.test.ts`

## Implementation Steps

### Step 1: Enhance SSE Event System

- Add new tool-related SSE event types
- Implement `emitToolResult` method in SSEOutputAdapter
- Add tool progress and completion events

### Step 2: Create API Adapter Integration

- Implement `SSEToolInterfaceAdapter` integration in FastifyServer
- Create unified tool execution method for API context
- Test with single tool execution

### Step 3: Replace Tool Execution Calls

- Replace `executeCliTool` calls in API execution flow
- Update tool result handling to use SSE events
- Maintain userMessageContent updates

### Step 4: Validation and Optimization

- Test all tools work via API
- Optimize SSE event emission performance
- Validate API response consistency

## Risk Mitigation

### High Risk: Breaking API Streaming

- **Mitigation**: Implement behind feature flag initially
- **Mitigation**: Comprehensive SSE event testing
- **Mitigation**: Backward compatibility validation

### Medium Risk: Performance Impact on SSE

- **Mitigation**: Performance benchmarking
- **Mitigation**: Optimize event emission overhead
- **Mitigation**: Monitor SSE connection stability

### Low Risk: Event Format Changes

- **Mitigation**: Maintain existing event structure
- **Mitigation**: Add new events without breaking existing ones
- **Mitigation**: API client compatibility testing

## Implementation Notes

### SSE-Specific Considerations

- Maintain real-time streaming characteristics
- Ensure proper event ordering and timing
- Handle SSE connection drops gracefully
- Respect SSE client buffering behavior

### Tool Execution Context

- Ensure tools have access to API-specific services
- Maintain API request context throughout execution
- Preserve API authentication and authorization
- Handle API-specific error scenarios

### Event Consistency

- Tool events should follow existing SSE event patterns
- Error events should use consistent error format
- Progress events should provide meaningful updates
- Completion events should indicate success/failure

### API Response Integration

- Tool results must be added to userMessageContent
- SSE events provide real-time feedback
- Final response includes complete conversation history
- Error handling maintains API error response format

## Definition of Done

- [ ] All acceptance criteria met
- [ ] `list_modes` tool works in API with SSE streaming
- [ ] All VSCode tools work in API context
- [ ] No breaking changes to existing API functionality
- [ ] SSE events properly emitted for tool execution
- [ ] Performance impact <5% overhead
- [ ] Unit and integration tests passing
- [ ] Code review completed
- [ ] API documentation updated

## Estimated Effort

**5 story points** (3-4 days)

## Priority

**High** - Core functionality for API tool parity

## Related Stories

- Story 001: Context-Aware Tool Interface Adapters (dependency)
- Story 002: CLI Tool Execution Integration
- Story 004: Service Integration
