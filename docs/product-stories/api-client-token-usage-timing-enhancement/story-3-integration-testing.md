# Story 3: Integration and Testing

## Goal

Integrate token usage debugging and execution timing features, ensure they work together seamlessly, and provide comprehensive testing

## Background

This story combines the token usage debugging (Story 1) and execution timing infrastructure (Story 2) into a cohesive enhancement to api-client.js, with comprehensive testing to ensure reliability and performance.

## Current State

- ✅ Story 1: Token usage debugging architecture defined
- ✅ Story 2: Execution timing infrastructure defined
- ❌ Integration between features not implemented
- ❌ Comprehensive testing not completed

## Requirements

### Functional Requirements

1. Integrate token usage debugging with timing infrastructure
2. Ensure all flag combinations work correctly
3. Provide comprehensive end-to-end testing
4. Validate performance impact is minimal
5. Ensure backward compatibility

### Non-Functional Requirements

- All existing functionality must continue to work unchanged
- Performance overhead <1% when features are disabled
- Memory usage increase <5MB during execution
- Clear error messages for invalid flag combinations

## Technical Implementation

### 1. Feature Integration

**File**: `api-client.js`
**Location**: Main execution flow integration

```javascript
// Enhanced argument processing with validation
let showTiming = false
let showTokenUsage = true
let hideTokenUsage = false
let verbose = false

// Validate flag combinations
function validateFlags() {
	// Token usage flags validation
	if (showTokenUsage && hideTokenUsage) {
		console.warn("⚠️  Warning: Both --show-token-usage and --hide-token-usage specified. Using --hide-token-usage.")
		showTokenUsage = false
	}

	// Timing flags validation
	if (showTiming && !useStream) {
		console.warn("⚠️  Warning: --show-timing is most effective with --stream mode.")
	}

	// Verbose mode implications
	if (verbose) {
		console.log(`[DEBUG-CONFIG] Configuration:`)
		console.log(`[DEBUG-CONFIG]   showTiming: ${showTiming}`)
		console.log(`[DEBUG-CONFIG]   showTokenUsage: ${showTokenUsage}`)
		console.log(`[DEBUG-CONFIG]   hideTokenUsage: ${hideTokenUsage}`)
		console.log(`[DEBUG-CONFIG]   useStream: ${useStream}`)
		console.log(`[DEBUG-CONFIG]   verbose: ${verbose}`)
	}
}

// Call validation after argument parsing
validateFlags()
```

### 2. Enhanced StreamProcessor Integration

**File**: `api-client.js`
**Location**: StreamProcessor class enhancement

```javascript
class StreamProcessor {
	constructor(options = {}) {
		// ... existing constructor code

		// Add timing integration
		this.executionTimer = options.executionTimer || null
		this.showTiming = options.showTiming || false
	}

	async handleRegularEvent(event, timestamp, contentFilter) {
		// Log timing for significant events
		if (this.executionTimer) {
			switch (event.type) {
				case "start":
					this.executionTimer.logOperation("Task started", event.message || "")
					break
				case "tool_use":
					this.executionTimer.logOperation("Tool execution", event.toolName || "unknown")
					break
				case "token_usage":
					this.executionTimer.logOperation("Token usage received")
					break
				case "complete":
				case "completion":
					this.executionTimer.logOperation("Task completed")
					break
				case "error":
					this.executionTimer.logOperation("Error received", event.error || "")
					break
			}
		}

		// ... existing event handling logic

		// Enhanced token usage handling with timing
		if (event.type === "token_usage") {
			// Debug logging for token usage
			if (this.verbose) {
				console.log(`[DEBUG-TOKEN-USAGE] 📊 Received token usage event at ${timestamp}`)
				console.log(`[DEBUG-TOKEN-USAGE] Raw event data:`, JSON.stringify(event, null, 2))
				console.log(
					`[DEBUG-TOKEN-USAGE] Display flags: showTokenUsage=${showTokenUsage}, hideTokenUsage=${hideTokenUsage}`,
				)
			}

			if (showTokenUsage && !hideTokenUsage) {
				displayTokenUsage(event.tokenUsage, event.timestamp)
				if (this.verbose) {
					console.log(`[DEBUG-TOKEN-USAGE] ✅ Token usage displayed successfully`)
				}
			} else {
				if (this.verbose) {
					const reason = hideTokenUsage ? "hideTokenUsage=true" : "showTokenUsage=false"
					console.log(`[DEBUG-TOKEN-USAGE] ⏭️ Token usage display skipped (${reason})`)
				}
			}
		}

		// ... rest of existing event handling
	}
}
```

### 3. Unified Testing Framework

**File**: `test-api-integration.js` (new file)

```javascript
#!/usr/bin/env node

/**
 * Comprehensive integration test for api-client.js enhancements
 * Tests token usage debugging and execution timing features
 */

const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")

class IntegrationTester {
	constructor() {
		this.testResults = []
		this.apiClientPath = path.join(__dirname, "api-client.js")
	}

	async runTest(name, args, expectedPatterns, unexpectedPatterns = []) {
		console.log(`\n🧪 Running test: ${name}`)
		console.log(`   Command: node api-client.js ${args.join(" ")}`)

		return new Promise((resolve) => {
			const child = spawn("node", [this.apiClientPath, ...args], {
				stdio: ["pipe", "pipe", "pipe"],
			})

			let stdout = ""
			let stderr = ""
			const startTime = Date.now()

			child.stdout.on("data", (data) => {
				stdout += data.toString()
			})

			child.stderr.on("data", (data) => {
				stderr += data.toString()
			})

			child.on("close", (code) => {
				const duration = Date.now() - startTime
				const result = this.analyzeTestResult(
					name,
					stdout,
					stderr,
					code,
					expectedPatterns,
					unexpectedPatterns,
					duration,
				)
				this.testResults.push(result)

				console.log(`   Result: ${result.passed ? "✅ PASS" : "❌ FAIL"}`)
				if (!result.passed) {
					console.log(`   Reason: ${result.reason}`)
				}
				console.log(`   Duration: ${duration}ms`)

				resolve(result)
			})

			// Send a simple task
			child.stdin.write("test task\n")
			child.stdin.end()
		})
	}

	analyzeTestResult(name, stdout, stderr, code, expectedPatterns, unexpectedPatterns, duration) {
		const result = {
			name,
			passed: true,
			reason: "",
			duration,
			stdout,
			stderr,
			code,
		}

		// Check expected patterns
		for (const pattern of expectedPatterns) {
			if (!stdout.includes(pattern) && !stderr.includes(pattern)) {
				result.passed = false
				result.reason = `Expected pattern not found: "${pattern}"`
				return result
			}
		}

		// Check unexpected patterns
		for (const pattern of unexpectedPatterns) {
			if (stdout.includes(pattern) || stderr.includes(pattern)) {
				result.passed = false
				result.reason = `Unexpected pattern found: "${pattern}"`
				return result
			}
		}

		// Check exit code
		if (code !== 0) {
			result.passed = false
			result.reason = `Non-zero exit code: ${code}`
		}

		return result
	}

	async runAllTests() {
		console.log("🚀 Starting API Client Integration Tests\n")

		// Test 1: Basic functionality (baseline)
		await this.runTest(
			"Basic functionality",
			["--stream", "simple test"],
			["task completed in"],
			["[DEBUG-", "ERROR", "FAIL"],
		)

		// Test 2: Token usage debugging
		await this.runTest(
			"Token usage debugging",
			["--stream", "--verbose", "simple test"],
			["[DEBUG-TOKEN-USAGE]", "task completed in"],
			["ERROR", "FAIL"],
		)

		// Test 3: Execution timing
		await this.runTest(
			"Execution timing",
			["--stream", "--show-timing", "simple test"],
			["⏱️", "task completed in"],
			["ERROR", "FAIL"],
		)

		// Test 4: Combined features
		await this.runTest(
			"Combined timing and token debugging",
			["--stream", "--verbose", "--show-timing", "simple test"],
			["[DEBUG-TOKEN-USAGE]", "⏱️", "task completed in"],
			["ERROR", "FAIL"],
		)

		// Test 5: Hidden token usage
		await this.runTest(
			"Hidden token usage",
			["--stream", "--hide-token-usage", "--show-timing", "simple test"],
			["⏱️", "task completed in"],
			["💰 Token Usage:", "ERROR", "FAIL"],
		)

		// Test 6: Non-streaming mode
		await this.runTest(
			"Non-streaming with timing",
			["--show-timing", "simple test"],
			["task completed in"],
			["ERROR", "FAIL"],
		)

		// Test 7: Help documentation
		await this.runTest(
			"Help documentation",
			["--help"],
			["--show-timing", "--show-token-usage", "--hide-token-usage", "Timing Display:"],
			["ERROR", "FAIL"],
		)

		this.generateReport()
	}

	generateReport() {
		console.log("\n📊 Test Results Summary")
		console.log("=".repeat(50))

		const passed = this.testResults.filter((r) => r.passed).length
		const total = this.testResults.length
		const passRate = ((passed / total) * 100).toFixed(1)

		console.log(`Total Tests: ${total}`)
		console.log(`Passed: ${passed}`)
		console.log(`Failed: ${total - passed}`)
		console.log(`Pass Rate: ${passRate}%`)

		if (passed === total) {
			console.log("\n🎉 All tests passed!")
		} else {
			console.log("\n❌ Some tests failed:")
			this.testResults
				.filter((r) => !r.passed)
				.forEach((result) => {
					console.log(`   - ${result.name}: ${result.reason}`)
				})
		}

		// Performance analysis
		const avgDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0) / total
		console.log(`\n⏱️  Average test duration: ${avgDuration.toFixed(0)}ms`)

		// Save detailed results
		const reportPath = path.join(__dirname, "test-results.json")
		fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2))
		console.log(`📄 Detailed results saved to: ${reportPath}`)
	}
}

// Run tests if called directly
if (require.main === module) {
	const tester = new IntegrationTester()
	tester.runAllTests().catch(console.error)
}

module.exports = IntegrationTester
```

### 4. Performance Benchmarking

**File**: `benchmark-api-client.js` (new file)

```javascript
#!/usr/bin/env node

/**
 * Performance benchmark for api-client.js enhancements
 */

const { spawn } = require("child_process")
const path = require("path")

class PerformanceBenchmark {
	constructor() {
		this.apiClientPath = path.join(__dirname, "api-client.js")
		this.iterations = 10
	}

	async benchmarkConfiguration(name, args) {
		console.log(`\n📊 Benchmarking: ${name}`)
		const durations = []

		for (let i = 0; i < this.iterations; i++) {
			const startTime = Date.now()

			await new Promise((resolve) => {
				const child = spawn("node", [this.apiClientPath, ...args], {
					stdio: ["pipe", "pipe", "pipe"],
				})

				child.on("close", () => {
					const duration = Date.now() - startTime
					durations.push(duration)
					resolve()
				})

				child.stdin.write("quick test\n")
				child.stdin.end()
			})
		}

		const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length
		const min = Math.min(...durations)
		const max = Math.max(...durations)
		const stdDev = Math.sqrt(durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length)

		console.log(`   Average: ${avg.toFixed(0)}ms`)
		console.log(`   Min: ${min}ms, Max: ${max}ms`)
		console.log(`   Std Dev: ${stdDev.toFixed(1)}ms`)

		return { name, avg, min, max, stdDev, durations }
	}

	async runBenchmarks() {
		console.log("🚀 Starting Performance Benchmarks\n")

		const results = []

		// Baseline (no new features)
		results.push(
			await this.benchmarkConfiguration("Baseline (no timing, default token usage)", ["--stream", "quick test"]),
		)

		// Token usage debugging
		results.push(
			await this.benchmarkConfiguration("Token usage debugging (verbose)", [
				"--stream",
				"--verbose",
				"quick test",
			]),
		)

		// Execution timing
		results.push(await this.benchmarkConfiguration("Execution timing", ["--stream", "--show-timing", "quick test"]))

		// Combined features
		results.push(
			await this.benchmarkConfiguration("Combined (timing + token debugging)", [
				"--stream",
				"--verbose",
				"--show-timing",
				"quick test",
			]),
		)

		// Hidden token usage
		results.push(
			await this.benchmarkConfiguration("Hidden token usage", ["--stream", "--hide-token-usage", "quick test"]),
		)

		this.analyzeResults(results)
	}

	analyzeResults(results) {
		console.log("\n📈 Performance Analysis")
		console.log("=".repeat(60))

		const baseline = results[0]

		results.forEach((result, index) => {
			if (index === 0) {
				console.log(`${result.name}: ${result.avg.toFixed(0)}ms (baseline)`)
			} else {
				const overhead = ((result.avg - baseline.avg) / baseline.avg) * 100
				const overheadMs = result.avg - baseline.avg
				console.log(
					`${result.name}: ${result.avg.toFixed(0)}ms (+${overheadMs.toFixed(0)}ms, ${overhead.toFixed(1)}% overhead)`,
				)
			}
		})

		// Check if overhead is acceptable
		const maxOverhead = results.slice(1).reduce((max, result) => {
			const overhead = ((result.avg - baseline.avg) / baseline.avg) * 100
			return Math.max(max, overhead)
		}, 0)

		console.log(`\n📊 Maximum overhead: ${maxOverhead.toFixed(1)}%`)

		if (maxOverhead < 1.0) {
			console.log("✅ Performance overhead is acceptable (<1%)")
		} else if (maxOverhead < 5.0) {
			console.log("⚠️  Performance overhead is moderate (1-5%)")
		} else {
			console.log("❌ Performance overhead is high (>5%)")
		}
	}
}

// Run benchmarks if called directly
if (require.main === module) {
	const benchmark = new PerformanceBenchmark()
	benchmark.runBenchmarks().catch(console.error)
}

module.exports = PerformanceBenchmark
```

### 5. Documentation Updates

**File**: `README.md` (update existing or create new section)

````markdown
## API Client Enhancements

### Token Usage Debugging

The api-client.js now includes comprehensive token usage debugging capabilities:

```bash
# Debug token usage issues
node api-client.js --stream --verbose "test task"

# Show token usage explicitly
node api-client.js --stream --show-token-usage "test task"

# Hide token usage
node api-client.js --stream --hide-token-usage "test task"
```
````

### Execution Timing

Track execution performance with detailed timing information:

```bash
# Show detailed timing
node api-client.js --stream --show-timing "test task"

# Basic usage (final time only)
node api-client.js --stream "test task"

# Combined debugging and timing
node api-client.js --stream --verbose --show-timing "test task"
```

### Testing

Run comprehensive integration tests:

```bash
# Run all integration tests
node test-api-integration.js

# Run performance benchmarks
node benchmark-api-client.js
```

````

## Testing Strategy

### Automated Testing

```bash
# Run integration tests
node test-api-integration.js

# Run performance benchmarks
node benchmark-api-client.js

# Run unit tests (if Jest is available)
npm test -- api-client
````

### Manual Testing Scenarios

```bash
# Scenario 1: Verify token usage debugging works
node api-client.js --stream --verbose "simple task"
# Expected: Debug logs show token usage events and processing

# Scenario 2: Verify timing accuracy
time node api-client.js --stream --show-timing "simple task"
# Expected: Internal timing matches external measurement

# Scenario 3: Verify feature combination
node api-client.js --stream --verbose --show-timing --hide-token-usage "simple task"
# Expected: Timing shown, token usage hidden, debug info present

# Scenario 4: Verify backward compatibility
node api-client.js --stream "simple task"
# Expected: Works exactly as before, with final timing added

# Scenario 5: Verify error handling
node api-client.js --stream --show-timing "task that causes error"
# Expected: Timing continues through error, final time still shows
```

## Acceptance Criteria

### Primary Criteria

- [ ] Token usage debugging provides actionable troubleshooting information
- [ ] Execution timing accurately tracks operation performance
- [ ] All flag combinations work correctly together
- [ ] Final execution time always displays in correct format
- [ ] Performance overhead is <1% when features are disabled

### Secondary Criteria

- [ ] Integration tests pass with >95% success rate
- [ ] Performance benchmarks show acceptable overhead
- [ ] Help documentation is clear and comprehensive
- [ ] Error handling is graceful and informative

### Edge Cases

- [ ] Works correctly with connection timeouts
- [ ] Handles malformed server responses gracefully
- [ ] Flag validation prevents invalid combinations
- [ ] Memory usage remains within acceptable limits

## Definition of Done

1. **Feature Integration**: All features work together seamlessly
2. **Testing**: Comprehensive test suite passes
3. **Performance**: Benchmarks show acceptable overhead
4. **Documentation**: Updated help and README
5. **Backward Compatibility**: Existing functionality unchanged
6. **User Validation**: User can debug token usage and monitor timing

## Success Metrics

- Integration test pass rate >95%
- Performance overhead <1% for disabled features
- User can identify token usage issues within 2 minutes
- Timing accuracy within 5% of external measurements
- Zero regressions in existing functionality

## Future Enhancements

1. **Advanced Analytics**: Export timing and token data for analysis
2. **Real-time Monitoring**: Live performance dashboard
3. **Alerting**: Notifications for performance anomalies
4. **Historical Tracking**: Compare performance over time
5. **Optimization Suggestions**: Automated performance recommendations
