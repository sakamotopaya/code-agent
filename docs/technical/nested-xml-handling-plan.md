# Nested XML Handling Fix Plan

## Problem Analysis

From the user's output, we can see two critical issues:

1. **`<attempt_completion>` tags are being filtered out** when they should be preserved by default
2. **Nested XML tags are not handled correctly** - `<result>` inside `<attempt_completion>` is being treated as a separate tag instead of content

## Current Parser Behavior (Incorrect)

```
Input: <attempt_completion><result>content</result></attempt_completion>
Current Output: content  (both outer and inner tags removed)
Expected Output: <attempt_completion><result>content</result></attempt_completion>
```

## Root Cause

The parser is incorrectly transitioning to `TAG_OPENING` state when it encounters `<` inside a tag, even when that `<` should be treated as content of the outer tag.

## Solution Strategy

### 1. Fix Tag Nesting Logic

- When inside a recognized tag, `<` characters should be treated as content unless they form a proper closing tag for the current tag
- Only `</current_tag>` should trigger the closing state
- All other `<...>` should be preserved as content

### 2. Update State Machine Logic

```
INSIDE_TAG state:
- If char === '<' AND next chars form '</current_tag>', then transition to TAG_CLOSING
- Otherwise, treat '<' as regular content character
```

### 3. Comprehensive Test Cases

#### Basic Nested Tag Tests

```javascript
// Test 1: Simple nesting
"<attempt_completion><result>content</result></attempt_completion>"
Expected: "<attempt_completion><result>content</result></attempt_completion>"

// Test 2: Multiple nested tags
;("<attempt_completion><result>data</result><status>done</status></attempt_completion>")
Expected: "<attempt_completion><result>data</result><status>done</status></attempt_completion>"

// Test 3: Deeply nested
;("<outer><middle><inner>content</inner></middle></outer>")
Expected: "<outer><middle><inner>content</inner></middle></outer>"
```

#### Mixed Content Tests

```javascript
// Test 4: Thinking with nested content (should filter outer, preserve structure)
"<thinking>I need <tool>data</tool> here</thinking>after"
Expected: "after"
Sections: [{ tagName: "thinking", content: "I need <tool>data</tool> here" }]

// Test 5: Attempt completion with thinking inside (preserve outer, filter inner)
;("<attempt_completion>Done <thinking>my thoughts</thinking> result</attempt_completion>")
Expected: "<attempt_completion>Done  result</attempt_completion>"
```

#### Edge Cases

```javascript
// Test 6: Malformed nested tags
"<outer><inner>content</outer></inner>"
Expected: Handle gracefully

// Test 7: Self-closing tags
"<outer><self-close/>content</outer>"
Expected: "<outer><self-close/>content</outer>"

// Test 8: Tags with attributes
"<outer attr='value'><inner id='test'>content</inner></outer>"
Expected: "<outer attr='value'><inner id='test'>content</inner></outer>"
```

#### Chunk Boundary Tests

```javascript
// Test 9: Nested tag split across chunks
Chunks: ["<outer><in", "ner>content</inner></outer>"]
Expected: "<outer><inner>content</inner></outer>"

// Test 10: Closing tag of nested content split
Chunks: ["<outer><inner>content</in", "ner></outer>"]
Expected: "<outer><inner>content</inner></outer>"
```

## Implementation Steps

### Phase 1: Fix State Machine Logic

1. Update `handleInsideTagState()` to properly handle nested content
2. Implement lookahead for closing tag detection
3. Preserve all `<...>` as content unless it's the actual closing tag

### Phase 2: Create Test Suite

1. Create `test-nested-xml.js` with comprehensive test cases
2. Test all scenarios listed above
3. Verify both filtering and section tracking work correctly

### Phase 3: Fix Default Tag Behavior

1. Ensure `attempt_completion` tags are preserved by default
2. Update `shouldShowTag()` logic if needed
3. Verify all system tags are handled correctly

### Phase 4: Integration Testing

1. Test with real SSE data from the ticket-oracle mode
2. Verify attempt_completion sections are preserved
3. Ensure thinking sections inside other tags are still filtered

## Expected Outcomes

After the fix:

- ✅ `<attempt_completion>` tags preserved by default
- ✅ Nested XML content preserved as part of outer tag content
- ✅ Only the specific filtered tags (like `<thinking>`) are removed
- ✅ Section tracking captures the complete nested content
- ✅ Chunk boundaries handled correctly for nested content

## Test File Structure

```javascript
// test-nested-xml.js
describe("Nested XML Handling", () => {
	test("Simple nested tags preserved")
	test("Multiple nested tags preserved")
	test("Deeply nested tags preserved")
	test("Thinking with nested content filtered correctly")
	test("Attempt completion with thinking inside")
	test("Malformed nested tags handled gracefully")
	test("Self-closing tags preserved")
	test("Tags with attributes preserved")
	test("Nested tags split across chunks")
	test("Closing tags split across chunks")
})
```

This comprehensive approach will ensure the XML parser correctly handles all nesting scenarios while maintaining the filtering behavior for specific tags like `<thinking>`.
