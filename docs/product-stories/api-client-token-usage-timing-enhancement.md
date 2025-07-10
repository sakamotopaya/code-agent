# API Client Token Usage and Timing Enhancement

## Overview

Enhance the api-client.js to properly debug token usage emission and add comprehensive execution timing functionality.

## Problem Statement

1. **Token Usage Issue**: Token usage may not be properly displayed in api-client.js - need to determine if it's a client display issue or server emission issue
2. **Missing Timing**: Need execution timing functionality with granular control via --show-timing flag
3. **Final Timing Display**: Always show final execution time in format "task completed in min:sec:millis"

## Current State Analysis

### Token Usage Current Implementation

- ✅ Server-side: `SSEOutputAdapter.emitTokenUsage()` exists and is called from `ApiTaskExecutionHandler`
- ✅ Client-side: `api-client.js` has token usage display logic in `displayTokenUsage()` function
- ✅ Client-side: `--show-token-usage` and `--hide-token-usage` flags exist
- ❓ **Unknown**: Whether token usage events are actually being received by client

### Timing Current State

- ❌ No execution timing functionality exists
- ❌ No --show-timing flag
- ❌ No final execution time display

## Requirements

### Token Usage Debugging

1. Add comprehensive logging to determine if token usage events are being received
2. Add debug logging for token usage event processing
3. Ensure token usage is properly displayed when received

### Execution Timing

1. Add --show-timing flag for detailed timing information
2. Track timing for individual operations (tool calls, API requests, etc.)
3. Always display final execution time in format: "task completed in min:sec:millis"
4. Show detailed timing only when --show-timing is enabled

## Technical Architecture

### Token Usage Debugging Enhancement

```javascript
// Enhanced token usage event handling with debugging
case "token_usage":
    console.log(`[DEBUG-TOKEN-USAGE] Received token usage event:`, event) // Debug logging
    if (showTokenUsage && !hideTokenUsage) {
        displayTokenUsage(event.tokenUsage, event.timestamp)
    } else {
        console.log(`[DEBUG-TOKEN-USAGE] Token usage display disabled (showTokenUsage: ${showTokenUsage}, hideTokenUsage: ${hideTokenUsage})`)
    }
    break
```

### Execution Timing Architecture

```javascript
class ExecutionTimer {
	constructor(showTiming = false) {
		this.showTiming = showTiming
		this.startTime = Date.now()
		this.operationTimes = []
		this.lastOperationTime = this.startTime
	}

	logOperation(operation, details = "") {
		const now = Date.now()
		const operationDuration = now - this.lastOperationTime
		const totalDuration = now - this.startTime

		this.operationTimes.push({
			operation,
			details,
			duration: operationDuration,
			totalTime: totalDuration,
			timestamp: new Date(now).toISOString(),
		})

		if (this.showTiming) {
			console.log(
				`⏱️  [${this.formatDuration(totalDuration)}] ${operation}${details ? ": " + details : ""} (+${operationDuration}ms)`,
			)
		}

		this.lastOperationTime = now
	}

	formatDuration(ms) {
		const minutes = Math.floor(ms / 60000)
		const seconds = Math.floor((ms % 60000) / 1000)
		const millis = ms % 1000
		return `${minutes}:${seconds.toString().padStart(2, "0")}:${millis.toString().padStart(3, "0")}`
	}

	getFinalSummary() {
		const totalDuration = Date.now() - this.startTime
		return `task completed in ${this.formatDuration(totalDuration)}`
	}
}
```

## Implementation Stories

### Story 1: Token Usage Debugging Enhancement

**Goal**: Add comprehensive logging to debug token usage emission and display

**Tasks**:

1. Add debug logging for all token usage events received
2. Add debug logging for token usage display decisions
3. Add verbose token usage event details when --verbose is enabled
4. Test token usage flow end-to-end

**Acceptance Criteria**:

- Debug logs show whether token usage events are received
- Debug logs show why token usage is/isn't displayed
- Token usage displays correctly when events are received

### Story 2: Execution Timing Infrastructure

**Goal**: Create timing infrastructure for tracking execution times

**Tasks**:

1. Create ExecutionTimer class
2. Add --show-timing command line flag
3. Integrate timer with existing event processing
4. Add timing for key operations (connection, first response, tool calls, completion)

**Acceptance Criteria**:

- --show-timing flag controls detailed timing display
- Individual operation times are tracked and displayed
- Timing doesn't interfere with existing functionality

### Story 3: Final Execution Time Display

**Goal**: Always show final execution time regardless of --show-timing flag

**Tasks**:

1. Track total execution time from start to completion
2. Display final time in "task completed in min:sec:millis" format
3. Ensure final time shows even if --show-timing is disabled
4. Handle edge cases (errors, interruptions, timeouts)

**Acceptance Criteria**:

- Final execution time always displays
- Format is consistent: "task completed in min:sec:millis"
- Works with both streaming and non-streaming modes

## Implementation Details

### Command Line Arguments

```javascript
// Add new timing flag
else if (arg === "--show-timing") {
    showTiming = true
}

// Initialize timer
const executionTimer = new ExecutionTimer(showTiming)
```

### Event Processing Integration

```javascript
// In testStreamingEndpoint()
const executionTimer = new ExecutionTimer(showTiming)
executionTimer.logOperation("Connection initiated")

res.on("data", (chunk) => {
	if (firstDataReceived === false) {
		executionTimer.logOperation("First data received")
		firstDataReceived = true
	}
	// ... existing data processing
})

// In event processing
switch (event.type) {
	case "start":
		executionTimer.logOperation("Task started", event.message)
		break
	case "tool_use":
		executionTimer.logOperation("Tool execution", event.toolName || "unknown")
		break
	case "token_usage":
		executionTimer.logOperation("Token usage received")
		// Enhanced debug logging
		if (verbose) {
			console.log(`[DEBUG-TOKEN-USAGE] Event details:`, JSON.stringify(event, null, 2))
		}
		break
	case "complete":
		executionTimer.logOperation("Task completed")
		// Always show final time
		console.log(`✅ ${executionTimer.getFinalSummary()}`)
		break
}
```

### Help Documentation Update

```javascript
if (showHelp) {
	console.log(`
Options:
  // ... existing options
  --show-timing    Show detailed execution timing for operations (default: false)
  --show-token-usage Show token usage information (default: true)
  --hide-token-usage Hide token usage information

Timing Display:
  Default mode shows only final execution time.
  Use --show-timing to see detailed operation timing.
  Final execution time is always shown in format: "task completed in min:sec:millis"

Examples:
  # Show detailed timing
  node api-client.js --stream --show-timing "test task"
  
  # Hide token usage but show timing
  node api-client.js --stream --hide-token-usage --show-timing "test task"
`)
}
```

## Testing Strategy

### Manual Testing Commands

```bash
# Test token usage debugging
node api-client.js --stream --verbose "test task"

# Test timing functionality
node api-client.js --stream --show-timing "test task"

# Test combined functionality
node api-client.js --stream --show-timing --verbose "test task"

# Test without timing (should still show final time)
node api-client.js --stream "test task"

# Test with hidden token usage
node api-client.js --stream --hide-token-usage --show-timing "test task"
```

### Debug Scenarios

1. **Token Usage Not Received**: Debug logs should show no token_usage events
2. **Token Usage Received But Not Displayed**: Debug logs should show events received but display disabled
3. **Token Usage Working**: Debug logs should show events received and displayed
4. **Timing Accuracy**: Compare timing with external measurements

## Success Criteria

### Token Usage

- ✅ Clear debug logging shows whether token usage events are received
- ✅ Token usage displays correctly when events are present
- ✅ Debug information helps identify root cause of any issues

### Execution Timing

- ✅ --show-timing flag controls detailed timing display
- ✅ Individual operations are timed and displayed when enabled
- ✅ Final execution time always displays in correct format
- ✅ Timing doesn't interfere with existing functionality
- ✅ Performance impact is minimal

### User Experience

- ✅ Clear help documentation for new flags
- ✅ Consistent behavior across streaming and non-streaming modes
- ✅ Graceful handling of edge cases and errors

## Future Enhancements

1. **Timing Statistics**: Average, min, max operation times
2. **Performance Alerts**: Warnings for slow operations
3. **Timing Export**: Save timing data to files for analysis
4. **Token Usage Trends**: Track token usage over multiple requests
