# Story 1: Token Usage Debugging Enhancement

## Goal

Add comprehensive logging to debug token usage emission and display in api-client.js

## Background

The user reports that token usage may not be properly displayed in api-client.js. We need to determine if this is a client display issue or a server emission issue by adding comprehensive debug logging.

## Current State

- ✅ Server-side: `SSEOutputAdapter.emitTokenUsage()` exists and is called
- ✅ Client-side: `displayTokenUsage()` function exists
- ✅ Client-side: Token usage flags exist (`--show-token-usage`, `--hide-token-usage`)
- ❓ **Unknown**: Whether token usage events are actually being received by client

## Requirements

### Functional Requirements

1. Add debug logging to show when token usage events are received
2. Add debug logging to show token usage display decision logic
3. Enhance existing `displayTokenUsage()` function with debug information
4. Ensure debug logging works with existing `--verbose` flag

### Non-Functional Requirements

- Debug logging should not impact performance when disabled
- Debug information should be clear and actionable
- Existing functionality must remain unchanged

## Technical Implementation

### 1. Enhanced Token Usage Event Handling

**File**: `api-client.js`
**Location**: Around line 417 in the event processing switch statement

```javascript
case "token_usage":
    // Always log reception for debugging when verbose
    if (verbose) {
        console.log(`[DEBUG-TOKEN-USAGE] 📊 Received token usage event at ${timestamp}`)
        console.log(`[DEBUG-TOKEN-USAGE] Raw event data:`, JSON.stringify(event, null, 2))
        console.log(`[DEBUG-TOKEN-USAGE] Display flags: showTokenUsage=${showTokenUsage}, hideTokenUsage=${hideTokenUsage}`)
    }

    if (showTokenUsage && !hideTokenUsage) {
        displayTokenUsage(event.tokenUsage, event.timestamp)
        if (verbose) {
            console.log(`[DEBUG-TOKEN-USAGE] ✅ Token usage displayed successfully`)
        }
    } else {
        if (verbose) {
            const reason = hideTokenUsage ? 'hideTokenUsage=true' : 'showTokenUsage=false'
            console.log(`[DEBUG-TOKEN-USAGE] ⏭️ Token usage display skipped (${reason})`)
        }
    }
    break
```

### 2. Enhanced displayTokenUsage Function

**File**: `api-client.js`
**Location**: Around line 1274

```javascript
function displayTokenUsage(tokenUsage, timestamp) {
	if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] 🔍 displayTokenUsage called with:`, {
			tokenUsage: tokenUsage ? "present" : "null/undefined",
			timestamp: timestamp || "no timestamp",
		})
	}

	if (!tokenUsage) {
		if (verbose) {
			console.log(`[DEBUG-TOKEN-USAGE] ⚠️ No token usage data provided, skipping display`)
		}
		return
	}

	const time = timestamp ? `[${timestamp}] ` : ""
	console.log(`💰 ${time}Token Usage:`)

	// Always show input/output tokens with debug info
	if (tokenUsage.totalTokensIn !== undefined) {
		console.log(`   Input: ${tokenUsage.totalTokensIn.toLocaleString()} tokens`)
		if (verbose) {
			console.log(`[DEBUG-TOKEN-USAGE] Input tokens: ${tokenUsage.totalTokensIn} (raw value)`)
		}
	} else if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] ⚠️ totalTokensIn is undefined`)
	}

	if (tokenUsage.totalTokensOut !== undefined) {
		console.log(`   Output: ${tokenUsage.totalTokensOut.toLocaleString()} tokens`)
		if (verbose) {
			console.log(`[DEBUG-TOKEN-USAGE] Output tokens: ${tokenUsage.totalTokensOut} (raw value)`)
		}
	} else if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] ⚠️ totalTokensOut is undefined`)
	}

	// Show cost if available
	if (tokenUsage.totalCost !== undefined && tokenUsage.totalCost > 0) {
		console.log(`   Cost: $${tokenUsage.totalCost.toFixed(4)}`)
		if (verbose) {
			console.log(`[DEBUG-TOKEN-USAGE] Cost: $${tokenUsage.totalCost} (raw value)`)
		}
	} else if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] Cost not available (totalCost: ${tokenUsage.totalCost})`)
	}

	// Show context tokens if available
	if (tokenUsage.contextTokens !== undefined && tokenUsage.contextTokens > 0) {
		console.log(`   Context: ${tokenUsage.contextTokens.toLocaleString()} tokens`)
		if (verbose) {
			console.log(`[DEBUG-TOKEN-USAGE] Context tokens: ${tokenUsage.contextTokens} (raw value)`)
		}
	} else if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] Context tokens not available (contextTokens: ${tokenUsage.contextTokens})`)
	}

	// Show cache statistics if available
	if (tokenUsage.totalCacheReads !== undefined || tokenUsage.totalCacheWrites !== undefined) {
		const reads = tokenUsage.totalCacheReads || 0
		const writes = tokenUsage.totalCacheWrites || 0
		console.log(`   Cache: ${reads.toLocaleString()} reads, ${writes.toLocaleString()} writes`)
		if (verbose) {
			console.log(
				`[DEBUG-TOKEN-USAGE] Cache reads: ${tokenUsage.totalCacheReads}, writes: ${tokenUsage.totalCacheWrites} (raw values)`,
			)
		}
	} else if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] Cache statistics not available`)
	}

	if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] ✅ Token usage display completed successfully`)
	}
}
```

### 3. Enhanced Help Documentation

**File**: `api-client.js`
**Location**: In the help text around line 80

Add to the help documentation:

```javascript
Token Usage Display:
  Token usage is shown by default when available from the server.
  Use --hide-token-usage to suppress token usage display.
  Use --verbose to see detailed debug information about token usage events.

  Debug Information:
    --verbose shows whether token usage events are received from server
    --verbose shows why token usage is displayed or skipped
    --verbose shows raw token usage data for troubleshooting

Examples:
  # Debug token usage issues
  node api-client.js --stream --verbose "test task"

  # Show token usage explicitly
  node api-client.js --stream --show-token-usage "test task"

  # Hide token usage
  node api-client.js --stream --hide-token-usage "test task"
```

## Testing Strategy

### Manual Testing Commands

```bash
# Test 1: Basic token usage with debug logging
node api-client.js --stream --verbose "simple task that should generate token usage"

# Expected Output:
# [DEBUG-TOKEN-USAGE] 📊 Received token usage event at [timestamp]
# [DEBUG-TOKEN-USAGE] Raw event data: { ... }
# [DEBUG-TOKEN-USAGE] Display flags: showTokenUsage=true, hideTokenUsage=false
# 💰 Token Usage:
#    Input: X tokens
#    Output: Y tokens
#    Cost: $Z
# [DEBUG-TOKEN-USAGE] ✅ Token usage displayed successfully

# Test 2: Token usage with display disabled
node api-client.js --stream --verbose --hide-token-usage "simple task"

# Expected Output:
# [DEBUG-TOKEN-USAGE] 📊 Received token usage event at [timestamp]
# [DEBUG-TOKEN-USAGE] ⏭️ Token usage display skipped (hideTokenUsage=true)

# Test 3: Check if token usage events are being sent at all
node api-client.js --stream --verbose "simple task" | grep -i token

# Expected: Should show debug lines if events are received, nothing if not

# Test 4: Normal operation (no debug spam)
node api-client.js --stream "simple task"

# Expected: Only token usage display, no debug information
```

### Debugging Scenarios

#### Scenario 1: Token Usage Events Not Received

**Symptoms**: No `[DEBUG-TOKEN-USAGE]` logs appear even with `--verbose`
**Diagnosis**: Server is not emitting token usage events
**Next Steps**: Check server-side `ApiTaskExecutionHandler` and `SSEOutputAdapter`

#### Scenario 2: Token Usage Events Received But Not Displayed

**Symptoms**: `[DEBUG-TOKEN-USAGE] 📊 Received token usage event` appears but no display
**Diagnosis**: Display flags are preventing display
**Next Steps**: Check flag logic and user command line arguments

#### Scenario 3: Token Usage Events Malformed

**Symptoms**: `[DEBUG-TOKEN-USAGE] ⚠️ No token usage data provided` or field warnings
**Diagnosis**: Server is sending events but data structure is incorrect
**Next Steps**: Check server-side event formatting

#### Scenario 4: Token Usage Working Correctly

**Symptoms**: Debug logs show events received and displayed
**Diagnosis**: Everything working as expected
**Next Steps**: User can disable debug logging for normal use

## Acceptance Criteria

### Primary Criteria

- [ ] Debug logging shows whether token usage events are received from server
- [ ] Debug logging shows why token usage is displayed or skipped
- [ ] Enhanced `displayTokenUsage()` provides detailed field-level debug information
- [ ] Debug logging only appears when `--verbose` flag is used
- [ ] Normal operation (without `--verbose`) remains unchanged

### Secondary Criteria

- [ ] Debug information is clear and actionable for troubleshooting
- [ ] All existing token usage functionality continues to work
- [ ] Help documentation clearly explains debug capabilities
- [ ] Performance impact is negligible when debug logging is disabled

### Edge Cases

- [ ] Handles missing or null token usage data gracefully
- [ ] Handles malformed token usage events without crashing
- [ ] Debug logging works with all flag combinations
- [ ] Debug output is properly formatted and readable

## Definition of Done

1. **Code Implementation**: All code changes implemented and tested
2. **Manual Testing**: All test scenarios pass successfully
3. **Documentation**: Help text updated with debug information
4. **Backward Compatibility**: Existing functionality unchanged
5. **Performance**: No measurable performance impact when debug disabled
6. **User Feedback**: User can determine root cause of token usage issues

## Success Metrics

- User can definitively determine if token usage events are being received
- User can identify why token usage is not displaying (if applicable)
- Debug information provides actionable troubleshooting steps
- No regression in existing token usage functionality

## Future Enhancements

1. **Structured Debug Output**: JSON format for programmatic analysis
2. **Debug Log Export**: Save debug information to files
3. **Token Usage Validation**: Verify token usage data integrity
4. **Performance Metrics**: Track token usage event processing time
