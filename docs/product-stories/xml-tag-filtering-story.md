# Story: XML Tag Filtering for SSE Streams

## User Story

As a developer using the api-client.js client, I want to filter out `<thinking></thinking>` sections from the SSE stream output unless I explicitly request them with `--show-thinking`, so that I can focus on the relevant output without being distracted by internal reasoning.

## Acceptance Criteria

### Primary Requirements

- [ ] `<thinking></thinking>` content is suppressed by default
- [ ] `<thinking></thinking>` content is shown when `--show-thinking` flag is used
- [ ] XML tags that span multiple SSE chunks are handled correctly
- [ ] Non-thinking content is always preserved and output normally
- [ ] Existing functionality remains unchanged

### Technical Requirements

- [ ] Stateful XML parser maintains state between SSE chunks
- [ ] Parser handles malformed XML gracefully
- [ ] Memory usage remains reasonable for large thinking sections
- [ ] Performance impact is minimal for non-thinking content
- [ ] All edge cases are covered with comprehensive unit tests

## Implementation Approach

### Phase 1: Test Infrastructure Setup

**Goal**: Establish comprehensive test suite before implementation

**Tasks**:

1. Create `__tests__/ClientContentFilter.test.js`
2. Set up test utilities and mock data structures
3. Implement basic test cases for single-chunk scenarios
4. Create test fixtures for various chunk boundary scenarios

**Definition of Done**:

- Test file structure is in place
- Basic test cases are written (but failing)
- Test utilities for chunk processing are implemented
- CI pipeline runs tests successfully

### Phase 2: Basic XML Parser Implementation

**Goal**: Implement core XML parsing logic with state management

**Tasks**:

1. Add parser state properties to `ClientContentFilter` constructor
2. Implement `processText()` method for character-by-character parsing
3. Implement state transition methods (`handleTagOpening`, `handleInsideTag`, `handleTagClosing`)
4. Add `shouldShowTag()` method for tag-specific filtering rules

**Definition of Done**:

- Single-chunk thinking tag filtering works correctly
- Basic state transitions are implemented
- Unit tests for Phase 1 scenarios pass
- Parser correctly identifies `<thinking>` tags

### Phase 3: Chunk Boundary Handling

**Goal**: Handle XML tags that span multiple SSE chunks

**Tasks**:

1. Implement buffer management for partial tags
2. Handle tag names split across chunks
3. Handle tag content split across chunks
4. Handle closing tags split across chunks

**Definition of Done**:

- All chunk boundary test cases pass
- Parser maintains correct state across chunk boundaries
- No memory leaks in buffer management
- Handles arbitrarily split tag boundaries

### Phase 4: Edge Case Handling

**Goal**: Robust error handling and edge case management

**Tasks**:

1. Handle malformed XML tags gracefully
2. Implement recovery from invalid parser states
3. Handle unclosed tags and orphaned closing tags
4. Add support for tags with attributes (if needed)

**Definition of Done**:

- All edge case tests pass
- Parser recovers gracefully from malformed input
- No crashes or infinite loops on invalid input
- Comprehensive error logging for debugging

### Phase 5: Integration and Performance

**Goal**: Integrate with existing SSE processing and optimize performance

**Tasks**:

1. Update `processData()` method to use XML parser
2. Ensure compatibility with verbose and simple output modes
3. Performance testing and optimization
4. Memory usage profiling and optimization

**Definition of Done**:

- Full integration with existing SSE processing
- No performance regression for non-thinking content
- Memory usage remains bounded for large inputs
- All integration tests pass

## Test-Driven Development Workflow

### Red-Green-Refactor Cycle

1. **Red**: Write failing test for specific functionality
2. **Green**: Implement minimal code to make test pass
3. **Refactor**: Improve code quality while keeping tests green

### Test Categories Priority

1. **Basic Recognition**: Single-chunk complete tags
2. **Chunk Boundaries**: Tags split across chunks
3. **State Management**: Parser state transitions
4. **Content Filtering**: Show/hide logic
5. **Edge Cases**: Error handling and recovery
6. **Performance**: Large inputs and memory usage

### Example TDD Iteration

```javascript
// 1. RED: Write failing test
test('should filter thinking content when showThinking=false', () => {
  const filter = new ClientContentFilter({ showThinking: false })
  const result = filter.processText('before<thinking>hidden</thinking>after')
  expect(result).toBe('beforeafter')
})

// 2. GREEN: Implement minimal functionality
processText(text) {
  // Minimal implementation to pass test
  return text.replace(/<thinking>.*?<\/thinking>/g, '')
}

// 3. REFACTOR: Improve to handle chunk boundaries
processText(text) {
  // More sophisticated state-based implementation
  // ...
}
```

## Risk Mitigation

### Technical Risks

- **Complexity**: State management across chunks is complex
    - _Mitigation_: Comprehensive test suite and incremental development
- **Performance**: Character-by-character parsing may be slow
    - _Mitigation_: Performance testing and optimization in Phase 5
- **Memory**: Buffering content may cause memory issues
    - _Mitigation_: Bounded buffers and memory profiling

### Integration Risks

- **Breaking Changes**: May affect existing functionality
    - _Mitigation_: Comprehensive regression testing
- **SSE Compatibility**: May not work with all SSE data formats
    - _Mitigation_: Test with real SSE data from API server

## Success Metrics

- [ ] 100% test coverage for XML parsing logic
- [ ] No performance regression (< 5% slowdown)
- [ ] Memory usage bounded (< 10MB for large thinking sections)
- [ ] All existing functionality preserved
- [ ] Zero crashes on malformed input

## Future Extensibility

The XML parser should be designed to easily support additional tags:

- `<tool_call>` sections for tool filtering
- `<system>` sections for system message filtering
- Custom tag types with configurable filtering rules
- Tag-specific formatting and display options

## Dependencies

- Jest testing framework
- Existing `ClientContentFilter` class structure
- SSE data processing pipeline in `api-client.js`

## Estimated Effort

- **Phase 1**: 1-2 days (test setup)
- **Phase 2**: 2-3 days (basic implementation)
- **Phase 3**: 2-3 days (chunk boundaries)
- **Phase 4**: 1-2 days (edge cases)
- **Phase 5**: 1-2 days (integration/performance)
- **Total**: 7-12 days

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Comprehensive test suite with 100% coverage
- [ ] Performance benchmarks within acceptable limits
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Integration testing with real API server
- [ ] No regressions in existing functionality
