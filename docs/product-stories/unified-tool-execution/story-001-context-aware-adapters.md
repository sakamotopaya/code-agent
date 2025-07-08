# Story 001: Context-Aware Tool Interface Adapters

## Epic

Epic 1: Context-Aware Tool Interface Adapters

## Story Title

Create context-aware adapters that bridge presentAssistantMessage tool interface to CLI and API output systems

## User Story

**As a developer**, I want to create interface adapters that allow the unified tool execution system to work with existing CLI stdio and API SSE output mechanisms, **so that** we can unify tool execution without breaking existing output systems.

## Acceptance Criteria

### CLI Tool Interface Adapter

- [ ] Create `CLIToolInterfaceAdapter` class that implements tool interface methods
- [ ] `askApproval` method integrates with CLI interactive prompts or auto-approves in batch mode
- [ ] `handleError` method outputs errors via `CLIOutputAdapter`
- [ ] `pushToolResult` method outputs tool results via `CLIOutputAdapter`
- [ ] `removeClosingTag` method provides XML tag cleanup functionality
- [ ] Adapter preserves stdio output behavior

### API Tool Interface Adapter

- [ ] Create `SSEToolInterfaceAdapter` class that implements tool interface methods
- [ ] `askApproval` method auto-approves or integrates with question system
- [ ] `handleError` method emits errors via SSE events
- [ ] `pushToolResult` method adds results to userMessageContent and emits SSE events
- [ ] `removeClosingTag` method provides XML tag cleanup functionality
- [ ] Adapter preserves SSE streaming behavior

### Output Adapter Enhancements

- [ ] Enhance `CLIOutputAdapter` with `showToolResult()` method
- [ ] Enhance `CLIOutputAdapter` with `promptUser()` method for interactive approval
- [ ] Enhance `CLIOutputAdapter` with `isInteractive()` method
- [ ] Enhance `SSEOutputAdapter` with `emitToolResult()` method
- [ ] Add `SSE_EVENTS.TOOL_RESULT` event type

### Integration Points

- [ ] Define common interface for tool execution adapters
- [ ] Create factory pattern for adapter creation based on context
- [ ] Ensure adapters work with existing Task constructor patterns

## Technical Requirements

### Interface Definition

```typescript
interface ToolInterfaceAdapter {
	askApproval: AskApproval
	handleError: HandleError
	pushToolResult: PushToolResult
	removeClosingTag: RemoveClosingTag
}
```

### CLI Adapter Implementation

- File: `src/core/adapters/cli/CLIToolInterfaceAdapter.ts`
- Dependencies: `CLIOutputAdapter`, existing CLI prompt infrastructure
- Output: stdio via existing `CLIOutputAdapter` methods

### API Adapter Implementation

- File: `src/core/adapters/api/SSEToolInterfaceAdapter.ts`
- Dependencies: `SSEOutputAdapter`, `TaskApiHandler`
- Output: SSE events via existing `SSEOutputAdapter` methods

### Output Adapter Extensions

- Extend `CLIOutputAdapter` with tool-specific methods
- Extend `SSEOutputAdapter` with tool result emission
- Maintain backward compatibility with existing methods

## Dependencies

### Internal Dependencies

- `CLIOutputAdapter` (existing)
- `SSEOutputAdapter` (existing)
- `TaskApiHandler` (existing)
- Tool interface types from `src/shared/tools.ts`

### External Dependencies

- None

## Testing Strategy

### Unit Tests

- Test each adapter method independently
- Mock output adapters to verify correct method calls
- Test error handling and edge cases
- Verify interface compliance

### Integration Tests

- Test adapters with real output adapters
- Verify stdio output in CLI context
- Verify SSE emission in API context
- Test interactive vs batch mode behavior

### Test Files

- `src/core/adapters/cli/__tests__/CLIToolInterfaceAdapter.test.ts`
- `src/core/adapters/api/__tests__/SSEToolInterfaceAdapter.test.ts`

## Implementation Notes

### CLI Considerations

- Detect interactive vs batch mode using `process.stdin.isTTY`
- Use existing CLI prompt infrastructure for user approval
- Maintain consistent stdio output formatting
- Handle ANSI color codes appropriately

### API Considerations

- Integrate with existing SSE event system
- Maintain real-time streaming behavior
- Consider question system integration for future approval workflows
- Ensure proper error event emission

### Error Handling

- Graceful degradation when output adapters fail
- Consistent error formatting across contexts
- Proper logging for debugging

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] No breaking changes to existing output systems
- [ ] Performance impact assessed and acceptable

## Estimated Effort

**3 story points** (1-2 days)

## Priority

**High** - Foundation for entire unified tool execution system

## Related Stories

- Story 002: CLI Tool Execution Integration
- Story 003: API Tool Execution Integration
- Story 004: Service Integration
