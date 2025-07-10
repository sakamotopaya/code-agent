# Story 4: Client-Side Display Implementation

**Epic**: Client-Side Enhancement  
**Priority**: High  
**Effort**: 4 points  
**Dependencies**: Story 3 (Task Execution Handler Integration)

## User Story

**As a** developer using the API client  
**I want** to see token usage information displayed after task completion  
**So that** I can monitor my API usage costs and optimize my requests

## Background

With the server-side infrastructure complete (Stories 1-3), this story implements the client-side display of token usage information in `api-client.js`. The client needs to handle the new `token_usage` SSE events and display the information in a clear, user-friendly format with configurable visibility options.

## Acceptance Criteria

### 1. Command Line Arguments

- [ ] Add `--show-token-usage` flag (explicit enable, default behavior)
- [ ] Add `--hide-token-usage` flag (disable token usage display)
- [ ] Update help text with new options
- [ ] Default behavior shows token usage (user requested default)

### 2. SSE Event Handling

- [ ] Handle `token_usage` SSE events in streaming endpoint
- [ ] Parse token usage data from event payload
- [ ] Display token usage information when enabled
- [ ] Gracefully handle missing or malformed token usage data

### 3. Display Formatting

- [ ] Clear, readable token usage display with emoji indicator
- [ ] Format numbers with thousands separators
- [ ] Show cost with appropriate decimal precision
- [ ] Display cache statistics when available
- [ ] Consistent formatting with existing output

### 4. Configuration Logic

- [ ] Show token usage by default (`showTokenUsage = true`)
- [ ] `--hide-token-usage` sets `showTokenUsage = false`
- [ ] `--show-token-usage` explicitly sets `showTokenUsage = true`
- [ ] Hide flag takes precedence over show flag if both provided

## Technical Implementation

### File Changes

#### `api-client.js` - Command Line Argument Parsing

Add new variables and argument handling:

```javascript
// Add to existing variable declarations (around line 32)
let showTokenUsage = true  // Default to show (user requested)
let hideTokenUsage = false

// Add to argument parsing loop (around line 64)
} else if (arg === "--show-token-usage") {
  showTokenUsage = true
  hideTokenUsage = false
} else if (arg === "--hide-token-usage") {
  showTokenUsage = false
  hideTokenUsage = true
```

#### `api-client.js` - Help Text Update

Update help text (around line 90):

```javascript
  --show-token-usage Show token usage information (default: true)
  --hide-token-usage Hide token usage information
```

Add to examples section:

```javascript
# Token usage display
node api-client.js --stream "test task"                    # Shows token usage (default)
node api-client.js --stream --hide-token-usage "test task" # Hides token usage
node api-client.js --stream --show-token-usage "test task" # Explicitly shows token usage
```

#### `api-client.js` - SSE Event Handling

Add token usage event handler in both verbose and non-verbose streaming sections:

```javascript
// In testStreamingEndpoint function, verbose mode (around line 330)
case "token_usage":
  if (showTokenUsage && !hideTokenUsage) {
    displayTokenUsage(event.tokenUsage, event.timestamp)
  }
  break

// In testStreamingEndpoint function, non-verbose mode (around line 380)
case "token_usage":
  if (showTokenUsage && !hideTokenUsage) {
    displayTokenUsage(event.tokenUsage, event.timestamp)
  }
  break
```

#### `api-client.js` - Display Function

Add new display function after existing helper functions:

```javascript
/**
 * Display token usage information in a formatted way
 */
function displayTokenUsage(tokenUsage, timestamp) {
	if (!tokenUsage) {
		return
	}

	const time = timestamp ? `[${timestamp}] ` : ""
	console.log(`💰 ${time}Token Usage:`)

	// Always show input/output tokens
	if (tokenUsage.totalTokensIn !== undefined) {
		console.log(`   Input: ${tokenUsage.totalTokensIn.toLocaleString()} tokens`)
	}
	if (tokenUsage.totalTokensOut !== undefined) {
		console.log(`   Output: ${tokenUsage.totalTokensOut.toLocaleString()} tokens`)
	}

	// Show cost if available
	if (tokenUsage.totalCost !== undefined && tokenUsage.totalCost > 0) {
		console.log(`   Cost: $${tokenUsage.totalCost.toFixed(4)}`)
	}

	// Show context tokens if available
	if (tokenUsage.contextTokens !== undefined && tokenUsage.contextTokens > 0) {
		console.log(`   Context: ${tokenUsage.contextTokens.toLocaleString()} tokens`)
	}

	// Show cache statistics if available
	if (tokenUsage.totalCacheReads !== undefined || tokenUsage.totalCacheWrites !== undefined) {
		const reads = tokenUsage.totalCacheReads || 0
		const writes = tokenUsage.totalCacheWrites || 0
		console.log(`   Cache: ${reads.toLocaleString()} reads, ${writes.toLocaleString()} writes`)
	}
}
```

#### `api-client.js` - ClientContentFilter Integration

Update `ClientContentFilter` class to handle token usage display preference:

```javascript
// Add to ClientContentFilter constructor
constructor(showThinking = false, showTools = false, showSystem = false,
           showResponse = false, showCompletion = false, showMcpUse = false,
           showTokenUsage = true) {  // NEW parameter
  // ... existing initialization
  this.showTokenUsage = showTokenUsage
}

// Update filter instantiation in streaming functions
const filter = new ClientContentFilter(
  showThinking, showTools, showSystem, showResponse,
  showCompletion, showMcpUse, showTokenUsage
)
```

## Testing Strategy

### Unit Tests

Create test file: `__tests__/api-client-token-usage.test.js`

```javascript
const { displayTokenUsage } = require("../api-client.js")

describe("API Client Token Usage Display", () => {
	let consoleSpy

	beforeEach(() => {
		consoleSpy = jest.spyOn(console, "log").mockImplementation()
	})

	afterEach(() => {
		consoleSpy.mockRestore()
	})

	test("should display complete token usage information", () => {
		const tokenUsage = {
			totalTokensIn: 1000,
			totalTokensOut: 2000,
			totalCost: 0.1234,
			contextTokens: 5000,
			totalCacheReads: 100,
			totalCacheWrites: 50,
		}

		displayTokenUsage(tokenUsage, "2025-01-07T18:31:33.000Z")

		expect(consoleSpy).toHaveBeenCalledWith("💰 [2025-01-07T18:31:33.000Z] Token Usage:")
		expect(consoleSpy).toHaveBeenCalledWith("   Input: 1,000 tokens")
		expect(consoleSpy).toHaveBeenCalledWith("   Output: 2,000 tokens")
		expect(consoleSpy).toHaveBeenCalledWith("   Cost: $0.1234")
		expect(consoleSpy).toHaveBeenCalledWith("   Context: 5,000 tokens")
		expect(consoleSpy).toHaveBeenCalledWith("   Cache: 100 reads, 50 writes")
	})

	test("should display minimal token usage information", () => {
		const tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 200,
		}

		displayTokenUsage(tokenUsage)

		expect(consoleSpy).toHaveBeenCalledWith("💰 Token Usage:")
		expect(consoleSpy).toHaveBeenCalledWith("   Input: 100 tokens")
		expect(consoleSpy).toHaveBeenCalledWith("   Output: 200 tokens")
		expect(consoleSpy).toHaveBeenCalledTimes(3) // Header + 2 lines
	})

	test("should handle missing token usage data", () => {
		displayTokenUsage(null)
		displayTokenUsage(undefined)
		displayTokenUsage({})

		expect(consoleSpy).not.toHaveBeenCalled()
	})

	test("should format large numbers with separators", () => {
		const tokenUsage = {
			totalTokensIn: 1234567,
			totalTokensOut: 9876543,
			contextTokens: 12345678,
		}

		displayTokenUsage(tokenUsage)

		expect(consoleSpy).toHaveBeenCalledWith("   Input: 1,234,567 tokens")
		expect(consoleSpy).toHaveBeenCalledWith("   Output: 9,876,543 tokens")
		expect(consoleSpy).toHaveBeenCalledWith("   Context: 12,345,678 tokens")
	})

	test("should handle zero cost appropriately", () => {
		const tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 200,
			totalCost: 0,
		}

		displayTokenUsage(tokenUsage)

		expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("Cost:"))
	})
})

describe("Command Line Argument Parsing", () => {
	// Test argument parsing logic
	test("should default to showing token usage", () => {
		// Test default behavior
	})

	test("should hide token usage with --hide-token-usage", () => {
		// Test hide flag
	})

	test("should show token usage with --show-token-usage", () => {
		// Test explicit show flag
	})
})
```

### Integration Tests

```javascript
describe("Token Usage Integration", () => {
	test("should display token usage in streaming response", async () => {
		// Test full streaming flow with token usage events
	})

	test("should respect hide token usage flag", async () => {
		// Test that token usage is not displayed when hidden
	})

	test("should handle malformed token usage events", async () => {
		// Test error handling for bad token usage data
	})
})
```

### Manual Testing Scenarios

#### Basic Functionality

```bash
# Default behavior - show token usage
./api-client.js --stream "test task"

# Hide token usage
./api-client.js --stream --hide-token-usage "test task"

# Explicitly show token usage
./api-client.js --stream --show-token-usage "test task"
```

#### Edge Cases

```bash
# Both flags provided (hide should take precedence)
./api-client.js --stream --show-token-usage --hide-token-usage "test task"

# With other flags
./api-client.js --stream --verbose --hide-token-usage "test task"
./api-client.js --stream --show-thinking --show-token-usage "test task"
```

#### Error Scenarios

```bash
# Server not running
./api-client.js --stream --show-token-usage "test task"

# Network interruption during token usage event
./api-client.js --stream "long running task" # disconnect network
```

## Display Format Examples

### Complete Token Usage

```
💰 [2025-01-07T18:31:33.000Z] Token Usage:
   Input: 1,234 tokens
   Output: 5,678 tokens
   Cost: $0.0965
   Context: 22,857 tokens
   Cache: 22,397 reads, 22,738 writes
```

### Minimal Token Usage

```
💰 Token Usage:
   Input: 100 tokens
   Output: 300 tokens
```

### With Cost Only

```
💰 Token Usage:
   Input: 500 tokens
   Output: 1,200 tokens
   Cost: $0.0234
```

## Error Handling Strategy

### Missing Data

- **No Token Usage**: Skip display entirely
- **Partial Data**: Show available fields only
- **Invalid Numbers**: Skip invalid fields, show valid ones

### Network Issues

- **Event Loss**: No special handling needed (supplementary info)
- **Malformed Events**: Parse what's available, ignore rest
- **Connection Drops**: Standard SSE reconnection handles this

### Display Errors

- **Console Errors**: Catch and ignore display errors
- **Formatting Errors**: Use fallback formatting
- **Memory Issues**: Minimal impact due to small data size

## Performance Considerations

### Client-Side Impact

- **CPU**: ~1ms for formatting and display
- **Memory**: ~100 bytes per token usage display
- **Network**: No additional requests (uses existing SSE)

### Optimization Strategies

- **Lazy Formatting**: Only format when displaying
- **Number Caching**: Cache formatted numbers for repeated values
- **Early Return**: Fast path for hidden token usage

## Definition of Done

- [ ] Command line flags `--show-token-usage` and `--hide-token-usage` implemented
- [ ] Default behavior shows token usage information
- [ ] SSE `token_usage` events handled in both verbose and non-verbose modes
- [ ] Token usage display function formats information clearly
- [ ] Help text updated with new options and examples
- [ ] Unit tests written and passing (>90% coverage)
- [ ] Integration tests verify end-to-end functionality
- [ ] Manual testing scenarios completed successfully
- [ ] Performance impact measured and acceptable (<2ms)
- [ ] Code review completed
- [ ] Documentation updated

## Risk Assessment

### Medium Risk

- **User Experience**: Additional output might be overwhelming
    - _Mitigation_: Clear formatting, hide option available
- **Backward Compatibility**: New default behavior shows more information
    - _Mitigation_: Information is valuable, hide option available

### Low Risk

- **Performance**: Minimal display overhead
- **Error Handling**: Graceful degradation for missing data
- **Testing**: Comprehensive test coverage

## Dependencies

### Upstream Dependencies

- Story 3: Task Execution Handler Integration (provides token usage events)

### Downstream Dependencies

- None - this completes the client-side implementation

## Acceptance Testing

### Automated Testing

1. **Unit Tests**: Display function and argument parsing
2. **Integration Tests**: Full SSE event handling
3. **Performance Tests**: Display overhead measurement
4. **Error Tests**: Malformed data handling

### Manual Testing Checklist

- [ ] Default behavior shows token usage
- [ ] `--hide-token-usage` hides token usage
- [ ] `--show-token-usage` explicitly shows token usage
- [ ] Help text displays correctly
- [ ] Token usage formats properly with all data types
- [ ] Error handling works for missing/invalid data
- [ ] Performance is acceptable
- [ ] Works with other existing flags

## Success Metrics

- ✅ Token usage display success rate: >99%
- ✅ Display formatting time: <2ms average
- ✅ User adoption of default behavior: >80%
- ✅ Hide flag usage: <20% (most users want to see usage)
- ✅ Zero display-related crashes
- ✅ Help text clarity: User feedback positive

## Implementation Notes

### Design Decisions

1. **Default Show**: User requested token usage shown by default
2. **Clear Formatting**: Emoji indicator and structured display
3. **Graceful Degradation**: Missing data doesn't break display
4. **Consistent Style**: Matches existing output formatting

### User Experience Considerations

- **Information Hierarchy**: Token usage after task completion
- **Visual Separation**: Emoji and indentation for clarity
- **Number Formatting**: Thousands separators for readability
- **Optional Details**: Cache stats only when available

### Future Enhancements

- **Color Coding**: Different colors for cost ranges
- **Summary Mode**: Session-wide token usage totals
- **Export Options**: Save token usage to file
- **Alerts**: Warnings for high-cost operations

## Rollback Plan

If issues arise:

1. **Immediate**: Set default `showTokenUsage = false`
2. **Short-term**: Add feature flag to disable token usage display
3. **Long-term**: Remove token usage display code entirely

The display is purely additive and can be easily disabled or removed.

## Code Review Checklist

- [ ] Command line argument parsing handles all flag combinations
- [ ] Default behavior shows token usage as requested
- [ ] Display function handles all data formats gracefully
- [ ] Error handling prevents display failures from affecting core functionality
- [ ] Help text is clear and includes examples
- [ ] Performance impact is minimal
- [ ] Tests cover all scenarios including edge cases
- [ ] Code follows existing patterns and style
