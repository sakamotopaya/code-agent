# Story 002: CLI Tool Execution Integration

## Epic

Epic 3: Tool Execution Unification

## Story Title

Replace CLI executeCliTool with unified presentAssistantMessage pattern using context-aware adapters

## User Story

**As a CLI user**, I want access to all tools available in the VSCode extension (including `list_modes`, `switch_mode`, `new_task`) with proper stdio output, **so that** I have feature parity across all execution contexts.

## Acceptance Criteria

### CLI Tool Execution Replacement

- [ ] Remove `executeCliTool` method from `Task.ts`
- [ ] Replace CLI tool execution calls with `presentAssistantMessage` pattern
- [ ] Integrate `CLIToolInterfaceAdapter` into CLI execution flow
- [ ] Maintain existing CLI stdio output behavior
- [ ] Preserve CLI batch and interactive modes

### Tool Availability

- [ ] `list_modes` tool works in CLI with stdio output
- [ ] `switch_mode` tool works in CLI context
- [ ] `new_task` tool works in CLI context
- [ ] All existing VSCode tools work in CLI context
- [ ] Tool results display properly in CLI format

### CLI-Specific Behavior

- [ ] Auto-approval in batch mode (non-interactive)
- [ ] Interactive approval prompts when stdin is TTY
- [ ] Proper error handling with CLI-appropriate formatting
- [ ] Tool results formatted for CLI consumption
- [ ] Progress indicators work in CLI context

### Backward Compatibility

- [ ] Existing CLI commands continue to work
- [ ] CLI output format remains consistent
- [ ] No breaking changes to CLI interface
- [ ] Performance characteristics maintained

## Technical Requirements

### Task.ts Modifications

```typescript
// Replace this pattern:
const toolResult = await this.executeCliTool(block.name, block.params)

// With this pattern:
await this.executeUnifiedTools(taskApiHandler)
```

### CLI Execution Flow

1. Create `CLIToolInterfaceAdapter` instance
2. Inject adapter into Task for `presentAssistantMessage` use
3. Call `presentAssistantMessage(this)` for tool execution
4. Adapter routes output through `CLIOutputAdapter`

### Integration Points

- File: `src/core/task/Task.ts` (lines 1364-1513)
- Method: Replace CLI tool execution function
- Dependencies: `CLIToolInterfaceAdapter`, `presentAssistantMessage`

### CLI Output Formatting

- Tool results formatted with CLI-appropriate styling
- Error messages use CLI error formatting
- Progress indicators use CLI-compatible display
- ANSI color support based on CLI configuration

## Dependencies

### Internal Dependencies

- Story 001: Context-Aware Tool Interface Adapters (must be completed first)
- `presentAssistantMessage` function
- `CLIOutputAdapter` enhancements
- All tool implementations in `src/core/tools/`

### External Dependencies

- None

## Testing Strategy

### Unit Tests

- Test unified tool execution with mocked CLI adapter
- Verify all tools can be executed in CLI context
- Test error handling and edge cases
- Verify output formatting

### Integration Tests

- Test complete CLI workflow with real tools
- Verify `list_modes` works with stdio output
- Test interactive vs batch mode behavior
- Verify tool results display correctly

### End-to-End Tests

- Test CLI commands that use tools
- Verify output matches expected CLI format
- Test error scenarios and recovery
- Performance regression testing

### Test Files

- `src/core/task/__tests__/cli-unified-tools.test.ts`
- `src/cli/__tests__/unified-tool-execution.test.ts`

## Implementation Steps

### Step 1: Prepare Integration Points

- Identify all `executeCliTool` call sites
- Plan replacement strategy for each call site
- Create unified tool execution method

### Step 2: Implement Unified Execution

- Create `executeUnifiedTools` method in Task
- Implement CLI adapter creation and injection
- Replace first tool execution call site

### Step 3: Iterative Replacement

- Replace remaining `executeCliTool` calls one by one
- Test each replacement thoroughly
- Maintain backward compatibility

### Step 4: Cleanup

- Remove `executeCliTool` method
- Remove unused CLI-specific tool imports
- Update documentation

## Risk Mitigation

### High Risk: Breaking CLI Functionality

- **Mitigation**: Implement behind feature flag initially
- **Mitigation**: Comprehensive testing before rollout
- **Mitigation**: Gradual replacement of call sites

### Medium Risk: Performance Degradation

- **Mitigation**: Performance benchmarking before/after
- **Mitigation**: Optimize adapter overhead
- **Mitigation**: Profile tool execution paths

### Low Risk: Output Format Changes

- **Mitigation**: Careful adapter implementation
- **Mitigation**: Output comparison testing
- **Mitigation**: User feedback collection

## Implementation Notes

### CLI-Specific Considerations

- Preserve existing CLI argument parsing
- Maintain CLI exit codes and error handling
- Keep CLI progress indicators and status updates
- Respect CLI verbosity settings

### Tool Execution Context

- Ensure tools have access to CLI-specific services
- Maintain CLI working directory context
- Preserve CLI environment variables
- Handle CLI-specific error scenarios

### Output Consistency

- Tool results should match existing CLI output style
- Error messages should use CLI formatting conventions
- Progress indicators should work in CLI environment
- Color output should respect CLI color settings

## Definition of Done

- [ ] All acceptance criteria met
- [ ] `list_modes` tool works in CLI with proper output
- [ ] All VSCode tools work in CLI context
- [ ] No breaking changes to existing CLI functionality
- [ ] Performance impact <5% overhead
- [ ] Unit and integration tests passing
- [ ] Code review completed
- [ ] Documentation updated

## Estimated Effort

**5 story points** (3-4 days)

## Priority

**High** - Core functionality for CLI tool parity

## Related Stories

- Story 001: Context-Aware Tool Interface Adapters (dependency)
- Story 003: API Tool Execution Integration
- Story 004: Service Integration
