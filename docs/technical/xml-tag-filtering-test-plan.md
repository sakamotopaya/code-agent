# XML Tag Filtering Test Plan

## Overview

Comprehensive unit test suite for the stateful XML parser in `ClientContentFilter` class that handles `<thinking></thinking>` sections across SSE chunks.

## Test Structure

Tests should be organized in `__tests__/ClientContentFilter.test.js` using Jest framework.

## Test Categories

### 1. Basic Tag Recognition Tests

```javascript
describe("Basic Tag Recognition", () => {
	test("should recognize complete thinking tag in single chunk")
	test("should ignore non-thinking tags")
	test("should handle malformed opening tags")
	test("should handle malformed closing tags")
	test("should handle case sensitivity")
})
```

**Test Cases:**

- `"<thinking>content</thinking>"` → filter content unless showThinking
- `"<other>content</other>"` → pass through unchanged
- `"<thinking>content</other>"` → handle malformed closing
- `"<THINKING>content</THINKING>"` → case sensitivity
- `"<thinking extra='attr'>content</thinking>"` → tags with attributes

### 2. Chunk Boundary Tests

```javascript
describe("Chunk Boundary Handling", () => {
	test("should handle opening tag split across chunks")
	test("should handle closing tag split across chunks")
	test("should handle content split across chunks")
	test("should handle tag name split across chunks")
})
```

**Test Cases:**

- Chunks: `["<thin", "king>content</thinking>"]`
- Chunks: `["<thinking>content</thin", "king>"]`
- Chunks: `["<thinking>con", "tent</thinking>"]`
- Chunks: `["<", "thinking>content</thinking>"]`
- Chunks: `["<thinking>content<", "/thinking>"]`

### 3. State Management Tests

```javascript
describe("Parser State Management", () => {
	test("should maintain correct state transitions")
	test("should reset state after complete tag")
	test("should handle nested content correctly")
	test("should recover from invalid state")
})
```

**Test Cases:**

- Verify state transitions: NORMAL → TAG_OPENING → INSIDE_TAG → TAG_CLOSING → NORMAL
- Multiple thinking sections in sequence
- Invalid XML that should reset to NORMAL state
- Buffer management and cleanup

### 4. Content Filtering Tests

```javascript
describe("Content Filtering", () => {
	test("should suppress thinking content when showThinking=false")
	test("should show thinking content when showThinking=true")
	test("should preserve non-thinking content")
	test("should handle empty thinking sections")
	test("should handle thinking sections with special characters")
})
```

**Test Cases:**

- `showThinking: false` → `"before<thinking>hidden</thinking>after"` → `"beforeafter"`
- `showThinking: true` → `"before<thinking>shown</thinking>after"` → `"before<thinking>shown</thinking>after"`
- Empty: `"<thinking></thinking>"` → `""`
- Special chars: `"<thinking>line1\nline2\ttab</thinking>"` → proper handling

### 5. Multiple Tags Tests

```javascript
describe("Multiple Tags", () => {
	test("should handle multiple thinking sections")
	test("should handle consecutive thinking sections")
	test("should handle thinking sections with content between")
})
```

**Test Cases:**

- `"<thinking>first</thinking>middle<thinking>second</thinking>"`
- `"<thinking>first</thinking><thinking>second</thinking>"`
- Multiple chunks with multiple sections

### 6. Edge Cases Tests

```javascript
describe("Edge Cases", () => {
	test("should handle unclosed thinking tags")
	test("should handle extra closing tags")
	test("should handle empty input")
	test("should handle very large thinking sections")
	test("should handle thinking tags with newlines and whitespace")
})
```

**Test Cases:**

- `"<thinking>unclosed content"` → handle gracefully
- `"content</thinking>"` → ignore orphaned closing tag
- `""` → empty string input
- Large content (>10KB) inside thinking tags
- `"<thinking>\n  content with spaces  \n</thinking>"`

### 7. Performance Tests

```javascript
describe("Performance", () => {
	test("should handle large inputs efficiently")
	test("should not leak memory with many chunks")
	test("should maintain reasonable buffer sizes")
})
```

### 8. Integration Tests

```javascript
describe("SSE Integration", () => {
	test("should integrate with processData method")
	test("should maintain compatibility with existing output modes")
	test("should work with verbose and simple modes")
})
```

## Test Data Fixtures

### Chunk Scenarios

```javascript
const testChunks = {
	singleComplete: ["<thinking>complete content</thinking>"],
	splitOpening: ["<thin", "king>content</thinking>"],
	splitClosing: ["<thinking>content</thin", "king>"],
	splitContent: ["<thinking>part1", "part2</thinking>"],
	multipleInOne: ["<thinking>first</thinking><thinking>second</thinking>"],
	mixedContent: ["before<thinking>hidden</thinking>after"],
	malformed: ["<thinking>content</other>", "<other>content</thinking>"],
	nested: ["<thinking>outer<inner>nested</inner>content</thinking>"],
	empty: ["<thinking></thinking>"],
	whitespace: ["<thinking>  \n  content  \n  </thinking>"],
}
```

### Expected Outputs

```javascript
const expectedOutputs = {
	showThinking: {
		true: {
			singleComplete: "<thinking>complete content</thinking>",
			mixedContent: "before<thinking>hidden</thinking>after",
		},
		false: {
			singleComplete: "",
			mixedContent: "beforeafter",
		},
	},
}
```

## Mock SSE Data Structure

```javascript
const mockSSEData = {
	type: "progress",
	message: "content with <thinking>thoughts</thinking>",
	contentType: "content",
	timestamp: "2024-01-01T00:00:00Z",
}
```

## Test Utilities

```javascript
class TestContentFilter extends ClientContentFilter {
	// Expose internal state for testing
	getParserState() {
		return this.parserState
	}
	getCurrentTag() {
		return this.currentTag
	}
	getTagBuffer() {
		return this.tagBuffer
	}

	// Helper to process multiple chunks
	processChunks(chunks) {
		return chunks.map((chunk) => this.processText(chunk)).join("")
	}
}
```

## Coverage Requirements

- **Line Coverage**: 100% of XML parsing logic
- **Branch Coverage**: All state transitions and conditions
- **Edge Case Coverage**: All identified edge cases
- **Integration Coverage**: Full SSE data processing flow

## Test Execution Strategy

1. **Unit Tests**: Test individual methods in isolation
2. **Integration Tests**: Test full data flow through processData()
3. **Property-Based Tests**: Generate random chunk boundaries for the same content
4. **Regression Tests**: Ensure existing functionality remains intact

## Continuous Integration

- Tests must pass before any XML filtering code is merged
- Performance benchmarks to ensure no significant slowdown
- Memory leak detection for long-running scenarios
- Cross-platform compatibility testing

## Test Implementation Priority

1. **Phase 1**: Basic tag recognition and single-chunk scenarios
2. **Phase 2**: Chunk boundary handling and state management
3. **Phase 3**: Edge cases and error handling
4. **Phase 4**: Performance and integration tests
5. **Phase 5**: Property-based and fuzz testing
