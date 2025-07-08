# Story: Fix Nested XML Tag Handling in Content Filter

## User Story

As a developer using the test-api.js client, I want nested XML tags to be preserved correctly within outer tags, so that complex structured content like `<attempt_completion><result>data</result></attempt_completion>` is handled properly without losing inner XML structure.

## Problem Statement

Currently, the XML parser incorrectly handles nested tags:

- `<attempt_completion>` tags are being filtered out when they should be preserved
- Nested XML like `<result>` inside `<attempt_completion>` is treated as separate tags instead of content
- This breaks the structure of complex XML responses from the system

## Acceptance Criteria

### Primary Requirements

- [ ] Nested XML tags are preserved as content within outer tags
- [ ] Only the outermost tag filtering rules apply (inner tags preserved as content)
- [ ] `<attempt_completion>` tags are preserved by default
- [ ] Section tracking captures complete nested content
- [ ] Chunk boundary handling works for nested content

### Technical Requirements

- [ ] State machine correctly handles `<` characters inside tags as content
- [ ] Only proper closing tags (`</current_tag>`) trigger state transitions
- [ ] All other `<...>` patterns preserved as content
- [ ] Comprehensive test coverage for nested scenarios
- [ ] Performance remains acceptable for complex nested content

## Test Cases Required

### Basic Nested Preservation

```javascript
// Input: "<attempt_completion><result>content</result></attempt_completion>"
// Expected: "<attempt_completion><result>content</result></attempt_completion>"

// Input: "<outer><middle><inner>content</inner></middle></outer>"
// Expected: "<outer><middle><inner>content</inner></middle></outer>"
```

### Filtering with Nested Content

```javascript
// Input: "<thinking>I need <tool>data</tool> here</thinking>after"
// Expected Output: "after"
// Expected Section: { tagName: 'thinking', content: 'I need <tool>data</tool> here' }

// Input: "<attempt_completion>Done <thinking>thoughts</thinking> result</attempt_completion>"
// Expected: "<attempt_completion>Done  result</attempt_completion>"
```

### Edge Cases

```javascript
// Malformed nesting, self-closing tags, attributes, chunk boundaries
```

## Implementation Approach

### Phase 1: Fix State Machine (2-3 hours)

1. Update `handleInsideTagState()` to treat nested `<...>` as content
2. Implement proper closing tag detection with lookahead
3. Preserve all content until actual closing tag found

### Phase 2: Create Test Suite (1-2 hours)

1. Create `test-nested-xml.js` with comprehensive test cases
2. Cover all scenarios: basic nesting, filtering, edge cases, chunks
3. Verify both output and section tracking work correctly

### Phase 3: Integration Testing (1 hour)

1. Test with real SSE data from ticket-oracle mode
2. Verify `<attempt_completion>` sections work correctly
3. Ensure no regressions in existing functionality

## Definition of Done

- [ ] All test cases pass
- [ ] Real SSE output preserves nested XML correctly
- [ ] `<attempt_completion>` tags visible in output
- [ ] Section tracking captures complete nested content
- [ ] No performance regression
- [ ] Documentation updated

## Risk Mitigation

- **Complexity Risk**: Nested parsing is complex
    - _Mitigation_: Comprehensive test suite and incremental development
- **Performance Risk**: More complex parsing logic
    - _Mitigation_: Performance testing with large nested content
- **Regression Risk**: Changes might break existing functionality
    - _Mitigation_: Run all existing tests before and after changes

## Success Metrics

- [ ] Nested XML preserved correctly in 100% of test cases
- [ ] `<attempt_completion>` tags visible in real output
- [ ] All existing tests continue to pass
- [ ] Processing time increase < 10% for typical content
- [ ] Zero crashes on malformed nested content

## Dependencies

- Existing XML parser state machine
- Current test infrastructure
- SSE processing pipeline

## Estimated Effort: 4-6 hours

- Analysis and planning: 1 hour ✅ (completed)
- Implementation: 2-3 hours
- Testing: 1-2 hours
- Integration and verification: 1 hour
