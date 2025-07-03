# CLI Output Duplication Fix - Product Stories

## Epic: Fix CLI Output Duplication Issue

**Problem Statement**: The CLI outputs the same content multiple times due to multiple output adapters writing to stdout simultaneously without coordination.

**Goal**: Create a centralized CLI output coordination system that eliminates duplication while maintaining all existing functionality.

**Success Criteria**:

- Zero output duplication in CLI mode
- All existing CLI functionality preserved
- No performance degradation
- Improved debugging capabilities

---

## Phase 1: Core Infrastructure (Priority: High)

### Story 1.1: Implement CLIOutputCoordinator

**As a** CLI user  
**I want** consistent, non-duplicated output  
**So that** I can read the CLI responses clearly without confusion

**Acceptance Criteria**:

- [ ] Create `CLIOutputCoordinator` class in `src/cli/services/output/CLIOutputCoordinator.ts`
- [ ] Implement content deduplication using SHA-256 hashing
- [ ] Support sliding window of 100 recent content hashes
- [ ] Provide configurable deduplication settings
- [ ] Include comprehensive error handling with fallback to direct stdout
- [ ] Add debug logging for content flow tracking
- [ ] Implement unit tests with >95% coverage

**Technical Details**:

```typescript
interface CLIOutputCoordinatorConfig {
	enableDeduplication: boolean
	contentHashWindow: number
	similarityThreshold: number
	bufferSize: number
	flushInterval: number
	enableDebugLogging: boolean
}

class CLIOutputCoordinator {
	outputContent(content: string, source?: string): Promise<void>
	streamContent(chunk: string, source?: string): Promise<void>
	writeToolIndicator(toolName: string): Promise<void>
	reset(): void
	dispose(): Promise<void>
}
```

**Definition of Done**:

- CLIOutputCoordinator class implemented and tested
- Configuration system working
- Deduplication logic validated
- Error handling tested
- Documentation complete

---

### Story 1.2: Implement OutputContentTracker

**As a** developer  
**I want** intelligent content deduplication  
**So that** the system can identify and prevent duplicate content efficiently

**Acceptance Criteria**:

- [ ] Create `OutputContentTracker` class in `src/cli/services/output/OutputContentTracker.ts`
- [ ] Implement content fingerprinting using crypto hashing
- [ ] Support time-based content expiration (5-second window)
- [ ] Detect semantic similarity (95% threshold configurable)
- [ ] Track content sources and correlation IDs
- [ ] Provide content history inspection for debugging
- [ ] Handle memory cleanup to prevent leaks

**Technical Details**:

```typescript
class OutputContentTracker {
	trackContent(content: string, source: string): boolean
	isContentDuplicate(content: string): boolean
	getSimilarContent(content: string): string[]
	clearExpiredContent(): void
	getContentHistory(): ContentHistoryItem[]
}
```

**Definition of Done**:

- Content tracking system implemented
- Hash collision handling working
- Memory management validated
- Performance benchmarks meet requirements
- Unit tests passing

---

## Phase 2: Adapter Integration (Priority: High)

### Story 2.1: Refactor CLIOutputAdapter to Use Coordinator

**As a** CLI system  
**I want** all output to go through the coordinator  
**So that** duplication is eliminated at the source

**Acceptance Criteria**:

- [ ] Modify `src/core/adapters/cli/CLIOutputAdapters.ts`
- [ ] Replace direct `process.stdout.write()` calls with coordinator calls
- [ ] Update `outputContent()`, `outputPartialContent()`, and `streamChunk()` methods
- [ ] Maintain backward compatibility with existing interface
- [ ] Add coordinator dependency injection
- [ ] Update error handling to use coordinator fallbacks
- [ ] Ensure all existing functionality preserved

**Technical Changes**:

```typescript
// Before
async outputContent(message: ClineMessage): Promise<void> {
  process.stdout.write(message.text)
}

// After
async outputContent(message: ClineMessage): Promise<void> {
  await this.coordinator.outputContent(message.text, 'CLIOutputAdapter')
}
```

**Definition of Done**:

- CLIOutputAdapter refactored to use coordinator
- All tests passing
- No regression in functionality
- Integration tests validate deduplication

---

### Story 2.2: Update BatchProcessor Output Flow

**As a** CLI user running batch commands  
**I want** clean output without duplication  
**So that** I can parse the results accurately

**Acceptance Criteria**:

- [ ] Modify `src/cli/commands/batch.ts` BatchProcessor class
- [ ] Remove redundant output adapter instantiation
- [ ] Consolidate to single coordinator instance
- [ ] Update task event handling to use coordinator
- [ ] Remove deprecated streaming adapters
- [ ] Validate batch mode output is clean
- [ ] Ensure error output is not duplicated

**Technical Changes**:

```typescript
// Remove multiple adapters
// this.cliStreamingAdapter = new CLIStreamingAdapter()
// this.cliContentOutputAdapter = new CLIContentOutputAdapter()

// Use single coordinator
this.outputCoordinator = new CLIOutputCoordinator(options)
```

**Definition of Done**:

- BatchProcessor uses single output path
- Multiple adapter instances removed
- Batch mode testing validates no duplication
- Performance maintains or improves

---

## Phase 3: Task System Integration (Priority: Medium)

### Story 3.1: Integrate Coordinator with Task Events

**As a** CLI system  
**I want** task events to output through the coordinator  
**So that** task-generated content is deduplicated

**Acceptance Criteria**:

- [ ] Modify `src/core/task/Task.ts` to accept coordinator instance
- [ ] Update task event handlers to use coordinator
- [ ] Add event correlation IDs to prevent duplicate processing
- [ ] Update task message processing pipeline
- [ ] Ensure tool output goes through coordinator
- [ ] Validate MCP tool output deduplication
- [ ] Add coordinator to TaskOptions interface

**Technical Changes**:

```typescript
interface TaskOptions {
	// ... existing options
	outputCoordinator?: CLIOutputCoordinator
}

// In Task constructor
this.outputCoordinator = options.outputCoordinator || new DefaultOutputAdapter()

// In event handlers
this.emit("message", event) // becomes
await this.outputCoordinator.outputContent(event.message?.text, `task-${this.taskId}`)
```

**Definition of Done**:

- Task system integrated with coordinator
- Event deduplication working
- Tool output coordinated
- CLI task execution produces clean output

---

### Story 3.2: Add Output Coordination to CLI Services

**As a** CLI system  
**I want** all CLI services to use coordinated output  
**So that** system messages are also deduplicated

**Acceptance Criteria**:

- [ ] Update `CLIUIService` to use coordinator
- [ ] Modify `CLILogger` to coordinate debug output
- [ ] Update progress indicators to use coordinator
- [ ] Ensure error messages are coordinated
- [ ] Update session management output
- [ ] Coordinate MCP service output
- [ ] Add coordinator dependency injection across services

**Definition of Done**:

- All CLI services use coordinator
- System messages deduplicated
- Error handling maintains functionality
- Service integration tests pass

---

## Phase 4: Legacy Cleanup (Priority: Low)

### Story 4.1: Remove Deprecated Output Classes

**As a** developer  
**I want** clean, maintainable output code  
**So that** the system is easier to understand and maintain

**Acceptance Criteria**:

- [ ] Mark `CLIStreamingAdapter` as deprecated
- [ ] Remove redundant `CLIContentOutputAdapter` usage
- [ ] Consolidate `ConsoleOutputWriter` with coordinator
- [ ] Remove direct stdout/stderr writes from CLI code
- [ ] Update import statements across codebase
- [ ] Remove unused output interfaces
- [ ] Clean up output-related configuration

**Definition of Done**:

- Deprecated classes removed or marked
- No direct stdout writes in CLI code
- Import statements updated
- Code review validates cleanup

---

### Story 4.2: Update CLI Entry Points

**As a** CLI user  
**I want** consistent output across all CLI entry points  
**So that** the experience is uniform regardless of how I invoke the CLI

**Acceptance Criteria**:

- [ ] Update `src/cli/index.ts` to initialize coordinator
- [ ] Modify REPL mode to use coordinator
- [ ] Update batch mode entry point
- [ ] Ensure config and version commands use coordinator
- [ ] Validate help output is coordinated
- [ ] Update error handling across entry points

**Definition of Done**:

- All CLI entry points use coordinator
- Consistent output experience
- Entry point tests validate coordination

---

## Phase 5: Testing and Validation (Priority: Medium)

### Story 5.1: Create Comprehensive Integration Tests

**As a** developer  
**I want** thorough testing of the output coordination system  
**So that** I can be confident the duplication issue is resolved

**Acceptance Criteria**:

- [ ] Create integration test suite for CLI output
- [ ] Test simple commands ("say hello" scenario)
- [ ] Test complex tool usage scenarios
- [ ] Test error handling and edge cases
- [ ] Validate performance under load
- [ ] Test memory usage over time
- [ ] Create regression test for duplication issue

**Test Cases**:

```typescript
describe("CLI Output Coordination", () => {
	it("should not duplicate simple responses", async () => {
		const output = await runCLICommand("say hello")
		expect(output.split("Hello").length).toBe(2) // Only one "Hello"
	})

	it("should coordinate tool output", async () => {
		const output = await runCLICommand("use github mcp to list repos")
		expect(hasNoDuplicatedLines(output)).toBe(true)
	})
})
```

**Definition of Done**:

- Integration test suite implemented
- All test scenarios passing
- Performance benchmarks within limits
- Memory leak tests passing

---

### Story 5.2: Performance Optimization and Monitoring

**As a** CLI user  
**I want** fast, responsive CLI operations  
**So that** the output coordination doesn't slow down my workflow

**Acceptance Criteria**:

- [ ] Benchmark coordinator performance vs direct output
- [ ] Optimize content hashing for speed
- [ ] Implement content buffering for efficiency
- [ ] Add performance monitoring hooks
- [ ] Optimize memory usage for long-running sessions
- [ ] Create performance regression tests
- [ ] Document performance characteristics

**Performance Targets**:

- Coordinator overhead: <10ms per operation
- Memory usage: <50MB for coordinator state
- Hash computation: <1ms for typical content
- Deduplication decision: <5ms

**Definition of Done**:

- Performance targets met
- Optimization implemented
- Monitoring hooks active
- Performance tests passing

---

## Testing Strategy

### Unit Tests

- CLIOutputCoordinator class (>95% coverage)
- OutputContentTracker functionality
- Content deduplication logic
- Error handling and fallbacks

### Integration Tests

- End-to-end CLI command execution
- Task system output coordination
- Tool usage scenarios
- Error condition handling

### Regression Tests

- Specific test for "say hello" duplication issue
- Complex tool usage scenarios
- Long-running session stability
- Memory leak detection

### Performance Tests

- Output latency benchmarks
- Memory usage over time
- Concurrent operation handling
- Large content processing

---

## Risk Mitigation

### High Risk Items

1. **Breaking existing functionality**: Comprehensive testing and gradual rollout
2. **Performance degradation**: Continuous benchmarking and optimization
3. **Memory leaks**: Regular memory profiling and cleanup validation
4. **Complex debugging**: Enhanced logging and diagnostic tools

### Rollback Plan

- Feature flag to disable coordinator and use legacy output
- Graceful degradation to direct stdout on coordinator failure
- Quick revert capability for production issues

---

## Success Metrics

### Primary Success Criteria

- [ ] Zero output duplication in CLI mode
- [ ] All existing CLI functionality preserved
- [ ] Performance within acceptable limits (<10ms overhead)
- [ ] No memory leaks or excessive memory usage

### Secondary Success Criteria

- [ ] Improved debugging experience
- [ ] Cleaner, more maintainable output code
- [ ] Enhanced error handling
- [ ] Better developer experience

### Measurement Plan

- Automated tests validate zero duplication
- Performance benchmarks run in CI/CD
- Memory usage monitoring in long-running tests
- User acceptance testing for functionality preservation
