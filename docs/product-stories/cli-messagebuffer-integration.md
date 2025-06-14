# CLI MessageBuffer Integration

## Overview

Refactor the CLI streaming logic to use the centralized MessageBuffer class instead of maintaining separate XML parsing logic in CLILogger.

## Problem Statement

Currently, the CLI and SSE streaming paths use different parsing implementations:

- **SSEOutputAdapter** uses `MessageBuffer` for sophisticated XML parsing and content classification
- **CLILogger** has its own manual XML parsing logic in `streamLLMOutput()`
- **TaskApiHandler** routes CLI streaming directly to `CLILogger.streamLLMOutput()`, bypassing `MessageBuffer`

This creates:

- Duplicate parsing logic that can diverge over time
- Inconsistent behavior between CLI and SSE modes
- Maintenance burden of keeping two parsing implementations in sync
- Different tool name sets and system tag handling

## Architecture Analysis

### Current Flow

```
TaskApiHandler → CLILogger.streamLLMOutput() → Manual XML Parsing → CLI Output
TaskApiHandler → SSEOutputAdapter → MessageBuffer.processMessage() → SSE Events
```

### Proposed Flow

```
TaskApiHandler → CLILogger.streamLLMOutput() → MessageBuffer.processMessage() → Content Type Mapping → CLI Output
TaskApiHandler → SSEOutputAdapter → MessageBuffer.processMessage() → SSE Events
```

## Implementation Stories

### Story 1: MessageBuffer Integration in CLILogger

**As a** developer  
**I want** CLILogger to use MessageBuffer for content parsing  
**So that** CLI and SSE modes have consistent parsing behavior

**Acceptance Criteria:**

- [ ] CLILogger constructor creates a MessageBuffer instance
- [ ] `streamLLMOutput()` uses `MessageBuffer.processMessage()` instead of manual parsing
- [ ] All existing tool display functionality is preserved
- [ ] Manual XML parsing logic is removed
- [ ] Tool name tracking still works correctly

**Technical Details:**

- Add `private messageBuffer: MessageBuffer` to CLILogger
- Replace manual XML parsing with `messageBuffer.processMessage(content)`
- Process returned `ProcessedMessage[]` array appropriately

### Story 2: Content Type Handling for CLI

**As a** CLI user  
**I want** different content types to be displayed appropriately  
**So that** I see the right information at the right time

**Acceptance Criteria:**

- [ ] `'content'` type displays normally with markdown formatting
- [ ] `'thinking'` type displays only when `showThinking` is enabled
- [ ] `'tool_call'` type displays tool name indicators (yellow "toolname...")
- [ ] `'tool_result'` type is handled appropriately (likely skipped)
- [ ] `'system'` type is skipped (internal XML tags)

**Technical Details:**

- Create `handleProcessedMessage(message: ProcessedMessage)` method
- Map ContentType enum values to CLI display decisions
- Preserve existing color coding and formatting

### Story 3: State Management Synchronization

**As a** developer  
**I want** CLI streaming state to be properly managed  
**So that** multi-task scenarios work correctly

**Acceptance Criteria:**

- [ ] `resetMessageBuffer()` method resets both MessageBuffer and CLI state
- [ ] Tool display tracking (`displayedToolNames`) is synchronized with buffer resets
- [ ] Partial message handling works correctly across chunk boundaries
- [ ] Task boundaries properly reset streaming state

**Technical Details:**

- Add `resetMessageBuffer()` method to CLILogger
- Call `messageBuffer.reset()` and `displayedToolNames.clear()`
- Ensure TaskApiHandler calls reset at appropriate times

### Story 4: Tool Name and System Tag Consolidation

**As a** developer  
**I want** tool names and system tags to be defined in one place  
**So that** CLI and SSE modes stay in sync when new tools are added

**Acceptance Criteria:**

- [ ] Remove hardcoded tool names from CLILogger
- [ ] Remove hardcoded system tags from CLILogger
- [ ] Verify MessageBuffer.TOOL_NAMES includes all CLI-supported tools
- [ ] Verify MessageBuffer.SYSTEM_TAGS covers all necessary tags
- [ ] Update tests to use shared definitions

**Technical Details:**

- Remove `toolNames` Set from CLILogger
- Remove `systemTags` Set from CLILogger
- Ensure MessageBuffer constants are comprehensive
- Update any CLI-specific tool handling to use MessageBuffer classifications

### Story 5: Testing and Validation

**As a** developer  
**I want** comprehensive tests for the integrated implementation  
**So that** CLI streaming behavior is reliable and maintainable

**Acceptance Criteria:**

- [ ] Unit tests for CLILogger with MessageBuffer integration
- [ ] Integration tests comparing CLI and SSE output for same input
- [ ] Tests for all ContentType handling paths
- [ ] Tests for state reset scenarios
- [ ] Performance tests to ensure no regression

**Technical Details:**

- Create `CLILogger.test.ts` with MessageBuffer integration tests
- Test all content type handling branches
- Mock MessageBuffer to test CLI-specific logic
- Add integration tests in TaskApiHandler tests

### Story 6: Backward Compatibility and Migration

**As a** user  
**I want** CLI behavior to remain consistent during the migration  
**So that** my workflows are not disrupted

**Acceptance Criteria:**

- [ ] All existing CLI output formatting is preserved
- [ ] Tool name display timing and format matches current behavior
- [ ] Thinking section handling works identically
- [ ] Color coding and prefixes remain the same
- [ ] Performance characteristics are maintained or improved

**Technical Details:**

- Feature flag for new vs old implementation during testing
- Extensive comparison testing of output formats
- Performance benchmarking of parsing logic
- Graceful fallback mechanisms if needed

## Implementation Order

1. **Story 4** (Consolidation) - Prepare shared definitions
2. **Story 1** (Core Integration) - Implement MessageBuffer usage
3. **Story 2** (Content Type Handling) - Map content types to CLI behavior
4. **Story 3** (State Management) - Ensure proper state synchronization
5. **Story 5** (Testing) - Validate implementation thoroughly
6. **Story 6** (Migration) - Ensure backward compatibility

## Benefits

1. **Single Source of Truth:** All XML parsing logic centralized in MessageBuffer
2. **Consistent Behavior:** CLI and SSE use identical parsing logic
3. **Maintainability:** Changes to parsing only need to be made in one place
4. **Extensibility:** New content types automatically available to CLI
5. **Testing:** Easier to test with shared test cases
6. **Reduced Code Duplication:** Remove ~70 lines of duplicate parsing logic

## Risks and Mitigations

**Risk:** Changes in MessageBuffer behavior could break CLI output  
**Mitigation:** Comprehensive integration tests, feature flagging during development

**Risk:** Performance regression from object creation overhead  
**Mitigation:** Performance benchmarking, optimize if needed

**Risk:** Subtle differences in parsing behavior  
**Mitigation:** Extensive comparison testing before migration

## Success Metrics

- [ ] All existing CLI streaming tests pass
- [ ] No performance regression > 5%
- [ ] Zero duplicate parsing logic between CLI and SSE
- [ ] All tool names and system tags defined in single location
- [ ] CLI and SSE produce identical parsing results for same input
