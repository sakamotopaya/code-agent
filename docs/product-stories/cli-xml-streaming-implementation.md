# CLI XML Streaming Implementation Stories

## Epic: Clean XML-Aware CLI Output

**Goal**: Implement XML-aware streaming for CLI to show clean user content instead of raw XML tags.

**Success Criteria**:

- CLI shows only user-relevant content, hiding XML tags
- Support for `--thinking` and `--tools` flags
- Maintain streaming performance
- Handle partial XML tags across chunks
- Full test coverage

---

## Story 1: Create CLIStreamProcessor Service

**As a** CLI user  
**I want** XML tags to be filtered out of the output  
**So that** I only see clean, readable content

### Acceptance Criteria

- [ ] Create `CLIStreamProcessor` class with composition architecture
- [ ] Integrate with existing `MessageBuffer` for XML parsing
- [ ] Filter content types: show `content`, hide `thinking/tool_call/system/tool_result`
- [ ] Handle special case for `attempt_completion` result content
- [ ] Return structured output indicating if content should be displayed

### Implementation Details

- **File**: `src/core/adapters/cli/CLIStreamProcessor.ts`
- **Dependencies**: `MessageBuffer`, `ProcessedMessage`
- **Interface**:
    ```typescript
    interface CLIOutputResult {
    	content: string
    	hasOutput: boolean
    }
    ```

### Definition of Done

- [ ] Unit tests pass for all content type filtering
- [ ] Integration test with MessageBuffer works
- [ ] Handles empty/whitespace-only chunks correctly
- [ ] Performance benchmarks show minimal overhead

---

## Story 2: Integrate CLIStreamProcessor into CLIOutputAdapter

**As a** developer  
**I want** the CLI to use the new stream processor  
**So that** XML filtering happens automatically

### Acceptance Criteria

- [ ] Modify `CLIOutputAdapter.outputPartialContent()` to use `CLIStreamProcessor`
- [ ] Pass CLI options (thinking, tools, color) to processor
- [ ] Maintain existing interface compatibility
- [ ] Add reset functionality for new tasks
- [ ] Remove direct `process.stdout.write` of raw XML

### Implementation Details

- **File**: `src/core/adapters/cli/CLIOutputAdapters.ts`
- **Changes**: Constructor injection of processor, modify `outputPartialContent()`
- **Backward Compatibility**: All existing IOutputAdapter methods work unchanged

### Definition of Done

- [ ] All existing CLI functionality works
- [ ] Raw XML no longer appears in CLI output
- [ ] Integration tests pass
- [ ] No breaking changes to IOutputAdapter interface

---

## Story 3: Add --thinking CLI Flag Support

**As a** CLI user  
**I want** to optionally see thinking content  
**So that** I can understand the assistant's reasoning process

### Acceptance Criteria

- [ ] Add `--thinking` flag to CLI argument parser
- [ ] When enabled, show thinking content with `🤔` prefix
- [ ] When disabled (default), hide thinking content completely
- [ ] Support color formatting for thinking content
- [ ] Add help text and documentation

### Implementation Details

- **Files**: CLI argument parser, `CLIStreamProcessor.formatMessage()`
- **Format**: `🤔 [thinking content]` (gray color if enabled)
- **Default**: Disabled (thinking hidden)

### Definition of Done

- [ ] `--thinking` flag works correctly
- [ ] Help text documents the flag
- [ ] Color formatting works properly
- [ ] Unit tests cover thinking display logic

---

## Story 4: Add --tools CLI Flag Support

**As a** CLI user  
**I want** to optionally see when tools are being used  
**So that** I know what actions the assistant is taking

### Acceptance Criteria

- [ ] Add `--tools` flag to CLI argument parser
- [ ] When enabled, show tool usage notifications
- [ ] Format: `🔧 Using tool: [tool_name]`
- [ ] When disabled (default), hide tool notifications
- [ ] Support color formatting for tool notifications

### Implementation Details

- **Files**: CLI argument parser, `CLIStreamProcessor.formatMessage()`
- **Format**: `🔧 Using tool: read_file` (yellow color if enabled)
- **Default**: Disabled (tools hidden)

### Definition of Done

- [ ] `--tools` flag works correctly
- [ ] All tool names display correctly
- [ ] Color formatting works properly
- [ ] Unit tests cover tool display logic

---

## Story 5: Handle Edge Cases and Error Scenarios

**As a** CLI user  
**I want** the CLI to work reliably even with malformed XML  
**So that** I never lose output due to parsing errors

### Acceptance Criteria

- [ ] Handle partial XML tags that span multiple chunks
- [ ] Graceful fallback to raw output if XML parsing fails
- [ ] Log XML parsing errors for debugging (not user-visible)
- [ ] Handle empty chunks and whitespace-only content
- [ ] Memory management for long streaming sessions

### Implementation Details

- **Error Handling**: Try-catch around XML processing with fallback
- **Logging**: Debug-level logging for XML parsing issues
- **Memory**: Reset buffer state appropriately

### Definition of Done

- [ ] Stress testing with malformed XML passes
- [ ] No CLI crashes due to XML processing
- [ ] Error logging works correctly
- [ ] Memory usage remains stable

---

## Story 6: Comprehensive Test Suite

**As a** developer  
**I want** comprehensive tests for the XML streaming functionality  
**So that** I can refactor confidently and prevent regressions

### Acceptance Criteria

- [ ] Unit tests for `CLIStreamProcessor` covering all content types
- [ ] Integration tests for CLI end-to-end streaming
- [ ] Performance benchmarks for streaming overhead
- [ ] Edge case tests (partial XML, malformed content)
- [ ] CLI flag combination tests

### Test Files

- `src/core/adapters/cli/__tests__/CLIStreamProcessor.test.ts`
- `src/core/adapters/cli/__tests__/CLIOutputAdapter.integration.test.ts`
- `src/cli/__tests__/xml-streaming-e2e.test.ts`

### Definition of Done

- [ ] 95%+ code coverage for new components
- [ ] All edge cases covered
- [ ] Performance benchmarks established
- [ ] CI/CD integration tests pass

---

## Story 7: Update CLI Documentation and Help

**As a** CLI user  
**I want** clear documentation for the new flags  
**So that** I know how to control output formatting

### Acceptance Criteria

- [ ] Update CLI help text with `--thinking` and `--tools` flags
- [ ] Add examples to README showing flag usage
- [ ] Document performance implications
- [ ] Add troubleshooting section for XML parsing issues

### Implementation Details

- **Files**: CLI help system, README.md, user documentation
- **Examples**:
    ```bash
    roo --thinking "explain the code"
    roo --tools --batch "create a file"
    ```

### Definition of Done

- [ ] Help text is clear and accurate
- [ ] README has usage examples
- [ ] Documentation is reviewed and approved

---

## Story 8: Performance Optimization and Monitoring

**As a** CLI user  
**I want** XML processing to have minimal performance impact  
**So that** streaming remains fast and responsive

### Acceptance Criteria

- [ ] Benchmark XML processing overhead (< 5% impact)
- [ ] Optimize MessageBuffer for CLI usage patterns
- [ ] Add optional performance metrics logging
- [ ] Memory usage profiling for long streams

### Implementation Details

- **Benchmarks**: Before/after performance comparison
- **Optimization**: Buffer size tuning, string concatenation efficiency
- **Monitoring**: Optional `--perf` flag for debugging

### Definition of Done

- [ ] Performance impact is < 5% of baseline
- [ ] No memory leaks in long streaming sessions
- [ ] Benchmarks documented and automated

---

## Technical Dependencies

### Existing Components

- ✅ `MessageBuffer` - Already handles XML parsing and state management
- ✅ `CLIOutputAdapter` - Existing CLI output interface
- ✅ `ProcessedMessage` - Content classification types

### New Components

- 🆕 `CLIStreamProcessor` - XML filtering service (composition)
- 🆕 CLI flag parsing for `--thinking` and `--tools`
- 🆕 Test suites for new functionality

### Integration Points

- **VS Code Extension**: No changes required
- **API Endpoints**: No changes required
- **CLI**: Enhanced with XML processing

---

## Rollout Plan

### Phase 1: Core Implementation (Stories 1-2)

- Implement basic XML filtering
- Integrate into CLI output adapter
- Ensure no breaking changes

### Phase 2: User Features (Stories 3-4)

- Add CLI flags for thinking and tools
- User-facing functionality complete

### Phase 3: Robustness (Stories 5-6)

- Error handling and edge cases
- Comprehensive test coverage

### Phase 4: Documentation and Optimization (Stories 7-8)

- User documentation
- Performance optimization

---

## Success Metrics

1. **User Experience**: CLI output is clean without XML tags
2. **Performance**: < 5% overhead for XML processing
3. **Reliability**: No crashes due to malformed XML
4. **Usability**: Clear documentation and helpful flags
5. **Code Quality**: 95%+ test coverage, maintainable architecture

---

## Risk Mitigation

| Risk                    | Impact | Mitigation                                 |
| ----------------------- | ------ | ------------------------------------------ |
| Performance degradation | High   | Benchmarking, optimization, fallback       |
| Breaking changes        | Medium | Interface compatibility, extensive testing |
| Complex XML edge cases  | Medium | Graceful fallback, comprehensive testing   |
| User adoption of flags  | Low    | Good documentation, sensible defaults      |
