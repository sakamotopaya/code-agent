# Story 2: Execution Timing Infrastructure

## Goal

Create comprehensive timing infrastructure for tracking execution times with --show-timing flag control

## Background

The user requested execution timing functionality to monitor performance of API operations. This should include detailed timing for individual operations when --show-timing is enabled, but always show final execution time.

## Current State

- ❌ No execution timing functionality exists
- ❌ No --show-timing flag
- ❌ No timing infrastructure or classes

## Requirements

### Functional Requirements

1. Add --show-timing command line flag
2. Create ExecutionTimer class for timing operations
3. Track timing for key operations (connection, first response, tool calls, completion)
4. Show detailed timing only when --show-timing is enabled
5. Always show final execution time regardless of flag

### Non-Functional Requirements

- Minimal performance overhead when timing is disabled
- Accurate timing measurements (within 5% of external tools)
- Clean, readable timing output format
- Graceful handling of timing edge cases

## Technical Implementation

### 1. ExecutionTimer Class

**File**: `api-client.js`
**Location**: Add after existing classes (around line 531)

```javascript
/**
 * Execution timing tracker with configurable display options
 */
class ExecutionTimer {
	constructor(showTiming = false, verbose = false) {
		this.showTiming = showTiming
		this.verbose = verbose
		this.startTime = Date.now()
		this.operations = []
		this.lastOperationTime = this.startTime
	}

	/**
	 * Log an operation with timing information
	 * @param {string} operation - Operation name
	 * @param {string} details - Optional operation details
	 * @param {boolean} forceShow - Force show even if showTiming is false
	 */
	logOperation(operation, details = "", forceShow = false) {
		const now = Date.now()
		const operationDuration = now - this.lastOperationTime
		const totalDuration = now - this.startTime

		const operationRecord = {
			operation,
			details,
			duration: operationDuration,
			totalTime: totalDuration,
			timestamp: new Date(now).toISOString(),
		}

		this.operations.push(operationRecord)

		// Show timing if enabled or forced
		if (this.showTiming || forceShow) {
			const totalFormatted = this.formatDuration(totalDuration)
			const opFormatted =
				operationDuration < 1000 ? `${operationDuration}ms` : this.formatDuration(operationDuration)
			console.log(`⏱️  [${totalFormatted}] ${operation}${details ? ": " + details : ""} (+${opFormatted})`)
		}

		// Verbose logging always captures timing data for debugging
		if (this.verbose && !this.showTiming) {
			console.log(`[DEBUG-TIMING] ${operation}: ${operationDuration}ms (total: ${totalDuration}ms)`)
		}

		this.lastOperationTime = now
	}

	/**
	 * Format duration in min:sec:millis format
	 * @param {number} ms - Duration in milliseconds
	 * @returns {string} Formatted duration
	 */
	formatDuration(ms) {
		const minutes = Math.floor(ms / 60000)
		const seconds = Math.floor((ms % 60000) / 1000)
		const millis = ms % 1000
		return `${minutes}:${seconds.toString().padStart(2, "0")}:${millis.toString().padStart(3, "0")}`
	}

	/**
	 * Get final execution summary (always shown)
	 * @returns {string} Final timing summary
	 */
	getFinalSummary() {
		const totalDuration = Date.now() - this.startTime
		return `task completed in ${this.formatDuration(totalDuration)}`
	}

	/**
	 * Get timing statistics for analysis
	 * @returns {object} Timing statistics
	 */
	getStatistics() {
		const totalDuration = Date.now() - this.startTime
		return {
			totalDuration,
			operationCount: this.operations.length,
			operations: this.operations,
			averageOperationTime:
				this.operations.length > 0
					? this.operations.reduce((sum, op) => sum + op.duration, 0) / this.operations.length
					: 0,
			longestOperation:
				this.operations.length > 0
					? this.operations.reduce((max, op) => (op.duration > max.duration ? op : max))
					: null,
		}
	}

	/**
	 * Reset timer for new operation
	 */
	reset() {
		this.startTime = Date.now()
		this.operations = []
		this.lastOperationTime = this.startTime
	}
}
```

### 2. Command Line Argument Processing

**File**: `api-client.js`
**Location**: Around line 38 in argument parsing

```javascript
// Add timing flag variable
let showTiming = false

// In the argument parsing loop, add:
else if (arg === "--show-timing") {
    showTiming = true
}
```

### 3. Help Documentation Update

**File**: `api-client.js`
**Location**: Around line 80 in help text

```javascript
Options:
  // ... existing options
  --show-timing    Show detailed execution timing for operations (default: false)
  // ... rest of options

Timing Display:
  Default mode shows only final execution time in format: "task completed in min:sec:millis"
  Use --show-timing to see detailed operation timing during execution.
  Use --verbose to see debug timing information even without --show-timing.

  Timing Format:
    [total_time] operation_name: details (+operation_duration)
    Example: [0:05:234] Tool execution: read_file (+1:23:456)

Examples:
  # Basic usage with final timing only
  node api-client.js --stream "test task"

  # Detailed timing display
  node api-client.js --stream --show-timing "test task"

  # Debug timing with verbose
  node api-client.js --stream --verbose --show-timing "test task"
```

### 4. Streaming Endpoint Integration

**File**: `api-client.js`
**Location**: In `testStreamingEndpoint()` function around line 1311

```javascript
function testStreamingEndpoint() {
	return new Promise((resolve, reject) => {
		if (verbose) {
			console.log("🌊 Testing POST /execute/stream (SSE)...\n")
		}

		// Initialize execution timer
		const executionTimer = new ExecutionTimer(showTiming, verbose)
		executionTimer.logOperation("API connection initiated", `${baseUrl}/execute/stream`)

		// ... existing contentFilter and streamProcessor setup

		const req = http.request(
			{
				hostname: host,
				port: port,
				path: "/execute/stream",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(payload),
					Accept: "text/event-stream",
					"Cache-Control": "no-cache",
				},
			},
			(res) => {
				executionTimer.logOperation("Connection established", `Status: ${res.statusCode}`)

				if (verbose) {
					console.log(`   Status: ${res.statusCode}`)
					console.log(`   Content-Type: ${res.headers["content-type"]}`)
					console.log("   Events:")
				}

				let buffer = ""
				let firstDataReceived = false
				let firstEventProcessed = false

				// ... existing sliding timeout setup

				res.on("data", (chunk) => {
					// Reset sliding timeout on any data activity
					resetSlidingTimeout()

					if (!firstDataReceived) {
						executionTimer.logOperation("First data received")
						firstDataReceived = true
					}

					buffer += chunk.toString()

					// Process complete SSE messages
					const lines = buffer.split("\n")
					buffer = lines.pop() || "" // Keep incomplete line in buffer

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							try {
								const data = JSON.parse(line.slice(6))
								const timestamp = new Date(data.timestamp).toLocaleTimeString()

								if (!firstEventProcessed) {
									executionTimer.logOperation("First event processed", data.type)
									firstEventProcessed = true
								}

								// Log specific event types with timing
								switch (data.type) {
									case "start":
										executionTimer.logOperation("Task started", data.message || "")
										break
									case "tool_use":
										executionTimer.logOperation("Tool execution", data.toolName || "unknown")
										break
									case "token_usage":
										executionTimer.logOperation("Token usage received")
										break
									case "complete":
									case "completion":
										executionTimer.logOperation("Task completed")
										break
									case "stream_end":
										executionTimer.logOperation("Stream ended")
										break
									case "error":
										executionTimer.logOperation("Error received", data.error || "")
										break
								}

								// Process data through content filter
								const filterResult = contentFilter.processData(data)

								if (!filterResult.shouldOutput) {
									continue // Skip this data if filter says not to output
								}

								// Use filtered data for all output
								const filteredData = filterResult.content

								// Use StreamProcessor for event handling
								;(async () => {
									try {
										await streamProcessor.processEvent(filteredData, timestamp, contentFilter)
									} catch (error) {
										console.error(`❌ Stream processor error: ${error.message}`)
									}
								})()

								// Handle special events that need immediate processing
								if (filteredData.type === "stream_end") {
									console.log("🔚 Stream ended by server, closing connection...")
									clearTimeout(streamTimeout)
									res.destroy()
									return
								}
							} catch (e) {
								if (verbose) {
									console.log(`     📄 Raw: ${line}`)
								}
							}
						}
					}
				})

				res.on("end", () => {
					// Clear sliding timeout when stream ends normally
					if (streamTimeout) {
						clearTimeout(streamTimeout)
						streamTimeout = null
					}

					// Always show final timing
					console.log(`✅ ${executionTimer.getFinalSummary()}`)

					// Show timing statistics in verbose mode
					if (verbose) {
						const stats = executionTimer.getStatistics()
						console.log(`[DEBUG-TIMING] Statistics:`, {
							totalOperations: stats.operationCount,
							averageOperationTime: `${stats.averageOperationTime.toFixed(2)}ms`,
							longestOperation: stats.longestOperation
								? `${stats.longestOperation.operation} (${stats.longestOperation.duration}ms)`
								: "none",
							totalDuration: `${stats.totalDuration}ms`,
						})
					}

					if (verbose) {
						console.log("     🔚 Stream ended\n")
					}
					resolve()
				})

				// ... existing error handling
			},
		)

		// ... existing request error handling and completion
	})
}
```

### 5. Non-Streaming Endpoint Integration

**File**: `api-client.js`
**Location**: In `testExecuteEndpoint()` function around line 1137

```javascript
async function testExecuteEndpoint() {
	if (verbose) {
		console.log("⚡ Testing POST /execute...\n")
	}

	// Initialize execution timer
	const executionTimer = new ExecutionTimer(showTiming, verbose)
	executionTimer.logOperation("API request initiated", "/execute")

	try {
		const payload = JSON.stringify({
			task,
			mode,
			logSystemPrompt,
			logLlm,
		})

		executionTimer.logOperation("Request payload prepared", `${payload.length} bytes`)

		const response = await makeRequest(
			{
				hostname: host,
				port: port,
				path: "/execute",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(payload),
				},
			},
			payload,
		)

		executionTimer.logOperation("Response received", `Status: ${response.statusCode}`)

		if (verbose) {
			console.log(`   Status: ${response.statusCode}`)
			if (response.statusCode === 200) {
				const result = JSON.parse(response.body)
				console.log(`   Success: ${result.success}`)
				console.log(`   Message: ${result.message}`)
				console.log(`   Task: ${result.task}`)
				console.log(`   Timestamp: ${result.timestamp}`)
			} else {
				console.log(`   Error: ${response.body}`)
			}
			console.log("")
		} else {
			if (response.statusCode === 200) {
				const result = JSON.parse(response.body)
				if (showResponse) {
					console.log(result.message || result.result || "Task completed successfully")
				}
			} else {
				console.log(`❌ Error: ${response.body}`)
			}
		}

		// Always show final timing
		console.log(`✅ ${executionTimer.getFinalSummary()}`)

		// Show timing statistics in verbose mode
		if (verbose) {
			const stats = executionTimer.getStatistics()
			console.log(`[DEBUG-TIMING] Statistics:`, {
				totalOperations: stats.operationCount,
				averageOperationTime: `${stats.averageOperationTime.toFixed(2)}ms`,
				totalDuration: `${stats.totalDuration}ms`,
			})
		}
	} catch (error) {
		executionTimer.logOperation("Request failed", error.message)

		// Always show final timing even on error
		console.log(`❌ ${executionTimer.getFinalSummary()}`)

		if (verbose) {
			console.log(`   ❌ Failed: ${error.message}\n`)
		} else {
			console.log(`❌ Failed: ${error.message}`)
		}
	}
}
```

## Testing Strategy

### Manual Testing Commands

```bash
# Test 1: Basic timing (final time only)
node api-client.js --stream "simple task"
# Expected: Only final "task completed in min:sec:millis" at end

# Test 2: Detailed timing display
node api-client.js --stream --show-timing "simple task"
# Expected: Detailed operation timing throughout execution + final time

# Test 3: Verbose timing debug
node api-client.js --stream --verbose --show-timing "simple task"
# Expected: Detailed timing + debug timing info + statistics

# Test 4: Non-streaming with timing
node api-client.js --show-timing "simple task"
# Expected: Basic operation timing + final time

# Test 5: Timing accuracy test
time node api-client.js --stream --show-timing "simple task"
# Expected: Internal timing should match external time measurement (±5%)

# Test 6: Error scenario timing
node api-client.js --stream --show-timing "task that causes error"
# Expected: Timing continues through error, final time still shows
```

### Performance Testing

```bash
# Test timing overhead
for i in {1..10}; do
    time node api-client.js --stream "quick task" > /dev/null
done

# Test with timing enabled
for i in {1..10}; do
    time node api-client.js --stream --show-timing "quick task" > /dev/null
done

# Compare results - overhead should be <1% difference
```

### Unit Testing

```javascript
// Test ExecutionTimer class
describe("ExecutionTimer", () => {
	test("should format duration correctly", () => {
		const timer = new ExecutionTimer()
		expect(timer.formatDuration(1234)).toBe("0:01:234")
		expect(timer.formatDuration(61234)).toBe("1:01:234")
		expect(timer.formatDuration(3661234)).toBe("61:01:234")
	})

	test("should track operations correctly", () => {
		const timer = new ExecutionTimer()
		timer.logOperation("test", "details")
		const stats = timer.getStatistics()
		expect(stats.operationCount).toBe(1)
		expect(stats.operations[0].operation).toBe("test")
		expect(stats.operations[0].details).toBe("details")
	})

	test("should calculate statistics correctly", () => {
		const timer = new ExecutionTimer()
		timer.logOperation("op1")
		// Simulate time passing
		timer.lastOperationTime = timer.lastOperationTime + 100
		timer.logOperation("op2")

		const stats = timer.getStatistics()
		expect(stats.operationCount).toBe(2)
		expect(stats.averageOperationTime).toBeGreaterThan(0)
	})
})
```

## Acceptance Criteria

### Primary Criteria

- [ ] --show-timing flag controls detailed timing display
- [ ] ExecutionTimer class accurately tracks operation timing
- [ ] Final execution time always displays in "min:sec:millis" format
- [ ] Timing works with both streaming and non-streaming modes
- [ ] Performance overhead is <1% when timing is disabled

### Secondary Criteria

- [ ] Timing output is clear and readable
- [ ] Verbose mode provides additional timing statistics
- [ ] Error scenarios still show final timing
- [ ] Help documentation clearly explains timing features

### Edge Cases

- [ ] Handles very short operations (<1ms) gracefully
- [ ] Handles very long operations (>1 hour) correctly
- [ ] Works correctly with connection timeouts
- [ ] Timing continues through stream interruptions

## Definition of Done

1. **Code Implementation**: ExecutionTimer class and integration complete
2. **Command Line Interface**: --show-timing flag implemented
3. **Manual Testing**: All test scenarios pass
4. **Performance Testing**: Overhead within acceptable limits
5. **Documentation**: Help text updated with timing information
6. **Error Handling**: Graceful handling of timing edge cases

## Success Metrics

- Timing accuracy within 5% of external measurements
- Performance overhead <1% when timing disabled
- Clear, readable timing output format
- Final timing always displays regardless of execution path
- User can monitor execution performance effectively

## Future Enhancements

1. **Timing Thresholds**: Warn when operations exceed expected duration
2. **Timing Export**: Save timing data to JSON files for analysis
3. **Timing Visualization**: Generate timing charts and graphs
4. **Historical Timing**: Compare current timing with previous runs
5. **Operation Categorization**: Group timing by operation types
