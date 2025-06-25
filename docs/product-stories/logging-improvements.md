# Product Stories: Logging Improvements for Multi-Platform Code Agent

## Epic: Fix CLI Verbose Logging Issues

**As a** CLI user  
**I want** debug messages to only appear when I use the `--verbose` flag  
**So that** my terminal output is clean and focused on essential information

### Acceptance Criteria

- Running CLI without `--verbose` shows no debug messages
- Running CLI with `--verbose` shows all debug messages
- All platforms (CLI, VSCode, API) have consistent logging behavior
- No breaking changes to existing functionality

---

## Story 1: Create Unified Logging Interface

**As a** developer  
**I want** a unified logging interface that works across all platforms  
**So that** core modules can log consistently regardless of execution context

### Tasks

- [ ] Create `ILogger` interface in `src/core/interfaces/ILogger.ts`
- [ ] Define log levels: DEBUG, VERBOSE, INFO, WARN, ERROR
- [ ] Add JSDoc documentation with usage examples
- [ ] Create unit tests for interface contract

### Acceptance Criteria

- Interface supports all required log levels
- Interface is platform-agnostic
- Documentation explains usage patterns
- Tests verify interface contract

**Estimated Effort:** 2 hours

---

## Story 2: Implement CLI Logger Adapter

**As a** CLI user  
**I want** logging to respect my verbose and quiet settings  
**So that** I get appropriate output for my use case

### Tasks

- [ ] Create `CLILoggerAdapter` in `src/core/adapters/cli/CLILoggerAdapter.ts`
- [ ] Integrate with existing `CLILogger` infrastructure
- [ ] Implement verbose/quiet flag respect
- [ ] Add colored output support
- [ ] Route debug messages to stderr
- [ ] Create unit tests

### Acceptance Criteria

- Verbose messages only show with `--verbose` flag
- Quiet mode suppresses non-essential output
- Error messages always appear
- Colors work when terminal supports them
- Messages route to appropriate streams

**Estimated Effort:** 4 hours

---

## Story 3: Create Logger Factory Service

**As a** developer  
**I want** a centralized way to create platform-appropriate loggers  
**So that** I can easily get the right logger for my context

### Tasks

- [ ] Create `LoggerFactory` in `src/core/services/LoggerFactory.ts`
- [ ] Implement platform detection logic
- [ ] Add logger creation methods for each platform
- [ ] Handle fallback scenarios
- [ ] Create integration tests

### Acceptance Criteria

- Factory correctly detects execution context
- Returns appropriate logger implementation
- Handles missing dependencies gracefully
- Supports configuration overrides

**Estimated Effort:** 3 hours

---

## Story 4: Fix CLIProvider Logging

**As a** CLI user  
**I want** CLIProvider messages to respect verbose settings  
**So that** I don't see `[CLIProvider] Initialized successfully` unless I want to

### Tasks

- [ ] Update `src/core/adapters/cli/CLIProvider.ts`
- [ ] Replace hardcoded `console.log` on line 72
- [ ] Inject logger via constructor
- [ ] Update `showStatus()`, `showTaskHistory()` methods
- [ ] Test verbose/non-verbose scenarios

### Acceptance Criteria

- `[CLIProvider]` messages only appear with `--verbose`
- Status methods still work correctly
- No breaking changes to public API
- All tests pass

**Estimated Effort:** 2 hours

---

## Story 5: Fix Task Module Logging

**As a** CLI user  
**I want** Task module debug messages to respect verbose settings  
**So that** I don't see `[Task]` messages cluttering my output

### Tasks

- [ ] Update `src/core/task/Task.ts`
- [ ] Replace hardcoded `console.log` statements (lines 515, 519, 523, 528, etc.)
- [ ] Inject logger via constructor or context
- [ ] Update `logDebug()` method to use injected logger
- [ ] Test task execution with/without verbose

### Acceptance Criteria

- `[Task]` messages only appear with `--verbose`
- Task execution works correctly in both modes
- Error messages still appear when needed
- Performance is not impacted

**Estimated Effort:** 3 hours

---

## Story 6: Fix CoreProvider Logging

**As a** CLI user  
**I want** CoreProvider messages to respect verbose settings  
**So that** I don't see stack management messages unless debugging

### Tasks

- [ ] Update `src/core/provider/CoreProvider.ts`
- [ ] Replace hardcoded `console.log` statements (lines 42, 58, 222, etc.)
- [ ] Update `log()` method to use injected logger
- [ ] Inject logger via constructor
- [ ] Test provider functionality

### Acceptance Criteria

- `[CoreProvider]` messages only appear with `--verbose`
- Task stack management works correctly
- Parent/child task relationships maintained
- All provider functionality intact

**Estimated Effort:** 2 hours

---

## Story 7: Fix State Synchronization Logging

**As a** CLI user  
**I want** state synchronization messages to respect verbose settings  
**So that** I don't see `📊 State synchronized` unless debugging

### Tasks

- [ ] Update `src/core/adapters/cli/CLIOutputAdapters.ts`
- [ ] Replace hardcoded `console.log` on line 128
- [ ] Inject logger via constructor
- [ ] Update state synchronization notification
- [ ] Test state updates

### Acceptance Criteria

- State sync messages only appear with `--verbose`
- State synchronization works correctly
- UI feedback preserved where appropriate
- No functional regressions

**Estimated Effort:** 1 hour

---

## Story 8: Fix Messaging Persistence Logging

**As a** CLI user  
**I want** messaging persistence debug output to respect verbose settings  
**So that** I don't see `[MESSAGING-PERSISTENCE]` spam in my output

### Tasks

- [ ] Update `src/core/task/TaskApiHandler.ts`
- [ ] Replace hardcoded `console.log` statements (lines 624-659)
- [ ] Inject logger via constructor or context
- [ ] Update messaging persistence debug output
- [ ] Test message handling

### Acceptance Criteria

- `[MESSAGING-PERSISTENCE]` messages only appear with `--verbose`
- Message persistence works correctly
- Error handling preserved
- Performance not impacted

**Estimated Effort:** 2 hours

---

## Story 9: Update CLI Entry Point Integration

**As a** CLI user  
**I want** the CLI to use the new logging system throughout  
**So that** all verbose settings are consistently applied

### Tasks

- [ ] Update `src/cli/index.ts`
- [ ] Initialize logger factory with CLI settings
- [ ] Pass logger to all core services
- [ ] Update PlatformServiceFactory integration
- [ ] Test end-to-end CLI scenarios

### Acceptance Criteria

- All CLI verbose settings work consistently
- Logger propagates to all components
- No hardcoded console.log statements remain in CLI path
- Backwards compatibility maintained

**Estimated Effort:** 3 hours

---

## Story 10: Add VSCode Logger Adapter (Future)

**As a** VSCode extension user  
**I want** debug information to appear in the appropriate output channel  
**So that** I can troubleshoot issues without cluttering the UI

### Tasks

- [ ] Create `VSCodeLoggerAdapter` in `src/core/adapters/vscode/VSCodeLoggerAdapter.ts`
- [ ] Integrate with VSCode output channels
- [ ] Handle notification levels appropriately
- [ ] Test in VSCode environment

### Acceptance Criteria

- Debug messages appear in output channel
- Important messages trigger notifications
- User can control verbosity via settings
- No console spam in VSCode

**Estimated Effort:** 4 hours

---

## Story 11: Add API Logger Adapter (Future)

**As an** API consumer  
**I want** logging information available via SSE or structured responses  
**So that** I can monitor agent execution programmatically

### Tasks

- [ ] Create `APILoggerAdapter` in `src/core/adapters/api/APILoggerAdapter.ts`
- [ ] Integrate with SSE streaming
- [ ] Support structured log data
- [ ] Add API log level controls

### Acceptance Criteria

- Log data available via SSE when requested
- Structured format for programmatic consumption
- Configurable log levels per request
- No performance impact on API responses

**Estimated Effort:** 5 hours

---

## Definition of Done

For each story to be considered complete:

- [ ] All code changes implemented and tested
- [ ] Unit tests written and passing
- [ ] Integration tests verify end-to-end behavior
- [ ] No hardcoded console.log statements in affected files
- [ ] Verbose flag behavior verified in CLI
- [ ] Documentation updated where needed
- [ ] Performance impact measured and acceptable
- [ ] Backwards compatibility maintained

## Testing Scenarios

### CLI Verbose Flag Test

```bash
# Should show minimal output
npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "say hello"

# Should show all debug messages
npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "say hello" --verbose
```

### Error Handling Test

```bash
# Errors should always appear, even without --verbose
npm run start:cli --silent -- --config nonexistent.json --batch "test"
```

### Integration Test

- All three platforms (CLI, VSCode, API) can use the same core modules
- Each platform gets appropriate logging behavior
- No cross-platform logging leakage

## Success Metrics

- [ ] CLI runs cleanly without --verbose flag (no debug messages)
- [ ] CLI shows comprehensive debug info with --verbose flag
- [ ] All existing functionality preserved
- [ ] Code coverage maintained or improved
- [ ] No performance regressions detected
- [ ] Zero hardcoded console.log statements in core modules
