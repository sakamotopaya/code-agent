# Story 5: Testing and Validation

**Epic**: Quality Assurance  
**Priority**: Medium  
**Effort**: 3 points  
**Dependencies**: Story 4 (Client-Side Display Implementation)

## User Story

**As a** quality assurance engineer  
**I want** comprehensive testing of the token usage exposure feature  
**So that** the feature works reliably across all scenarios and edge cases

## Background

With the complete token usage exposure feature implemented (Stories 1-4), this story ensures comprehensive testing coverage, performance validation, and documentation of all testing scenarios. This includes unit tests, integration tests, performance tests, and manual testing procedures.

## Acceptance Criteria

### 1. Unit Test Coverage

- [ ] All new methods have >95% unit test coverage
- [ ] Edge cases and error conditions tested
- [ ] Mock-based testing for isolated component testing
- [ ] Test performance within acceptable limits

### 2. Integration Test Coverage

- [ ] End-to-end token usage flow tested
- [ ] SSE event delivery and client handling verified
- [ ] Error propagation and handling tested
- [ ] Concurrent usage scenarios tested

### 3. Performance Validation

- [ ] Server-side overhead measured and documented
- [ ] Client-side display performance validated
- [ ] Memory usage impact assessed
- [ ] Network overhead quantified

### 4. Manual Testing Documentation

- [ ] Comprehensive manual testing scenarios documented
- [ ] Edge case testing procedures defined
- [ ] Error scenario testing steps provided
- [ ] User acceptance testing criteria established

## Testing Strategy

### Unit Tests

#### Server-Side Unit Tests

**File**: `src/api/streaming/__tests__/token-usage-types.test.ts`

```typescript
import { SSEEvent, SSE_EVENTS, TokenUsage } from "../types"

describe("Token Usage SSE Event Types", () => {
	test("should create valid token usage event", () => {
		const tokenUsage: TokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 200,
			totalCost: 0.05,
		}

		const event: SSEEvent = {
			type: SSE_EVENTS.TOKEN_USAGE,
			jobId: "test-job",
			timestamp: new Date().toISOString(),
			tokenUsage,
		}

		expect(event.type).toBe("token_usage")
		expect(event.tokenUsage).toEqual(tokenUsage)
	})

	test("should handle optional token usage fields", () => {
		const tokenUsage: TokenUsage = {
			totalTokensIn: 50,
			totalTokensOut: 150,
		}

		expect(tokenUsage.totalCacheReads).toBeUndefined()
		expect(tokenUsage.totalCost).toBeUndefined()
	})
})
```

**File**: `src/api/streaming/__tests__/SSEOutputAdapter-token-usage.test.ts`

```typescript
import { SSEOutputAdapter } from "../SSEOutputAdapter"
import { StreamManager } from "../StreamManager"

describe("SSEOutputAdapter Token Usage", () => {
	let adapter: SSEOutputAdapter
	let mockStreamManager: jest.Mocked<StreamManager>

	beforeEach(() => {
		mockStreamManager = {
			sendEvent: jest.fn().mockReturnValue(true),
			hasActiveStream: jest.fn().mockReturnValue(true),
		} as any

		adapter = new SSEOutputAdapter(mockStreamManager, "test-job", false)
	})

	test("should emit token usage with complete data", async () => {
		const tokenUsage = {
			totalTokensIn: 100,
			totalTokensOut: 200,
			totalCost: 0.05,
		}

		await adapter.emitTokenUsage(tokenUsage)

		expect(mockStreamManager.sendEvent).toHaveBeenCalledWith("test-job", {
			type: "token_usage",
			jobId: "test-job",
			timestamp: expect.any(String),
			message: "Token usage: 100 in, 200 out, $0.0500",
			tokenUsage: {
				totalTokensIn: 100,
				totalTokensOut: 200,
				totalCost: 0.05,
			},
		})
	})

	test("should handle missing token usage data gracefully", async () => {
		await adapter.emitTokenUsage(null)
		expect(mockStreamManager.sendEvent).not.toHaveBeenCalled()
	})
})
```

**File**: `src/core/task/execution/__tests__/ApiTaskExecutionHandler-token-usage.test.ts`

```typescript
import { ApiTaskExecutionHandler } from "../ApiTaskExecutionHandler"
import { SSEOutputAdapter } from "../../../api/streaming/SSEOutputAdapter"

describe("ApiTaskExecutionHandler Token Usage Integration", () => {
	let handler: ApiTaskExecutionHandler
	let mockSSEAdapter: jest.Mocked<SSEOutputAdapter>

	beforeEach(() => {
		mockSSEAdapter = {
			emitTokenUsage: jest.fn().mockResolvedValue(undefined),
			emitCompletion: jest.fn().mockResolvedValue(undefined),
		} as any

		handler = new ApiTaskExecutionHandler(mockSSEAdapter, "test-job", false)
	})

	test("should emit token usage when available", async () => {
		const tokenUsage = { totalTokensIn: 100, totalTokensOut: 200 }
		await handler.onTaskCompleted("test-task", "result", tokenUsage)

		expect(mockSSEAdapter.emitTokenUsage).toHaveBeenCalledWith(tokenUsage)
	})

	test("should continue completion even if token usage emission fails", async () => {
		mockSSEAdapter.emitTokenUsage.mockRejectedValue(new Error("Failed"))

		await expect(handler.onTaskCompleted("test-task", "result", {})).resolves.not.toThrow()
	})
})
```

#### Client-Side Unit Tests

**File**: `__tests__/api-client-token-usage.test.js`

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
		}

		displayTokenUsage(tokenUsage, "2025-01-07T18:31:33.000Z")

		expect(consoleSpy).toHaveBeenCalledWith("💰 [2025-01-07T18:31:33.000Z] Token Usage:")
		expect(consoleSpy).toHaveBeenCalledWith("   Input: 1,000 tokens")
		expect(consoleSpy).toHaveBeenCalledWith("   Output: 2,000 tokens")
		expect(consoleSpy).toHaveBeenCalledWith("   Cost: $0.1234")
	})

	test("should handle missing data gracefully", () => {
		displayTokenUsage(null)
		expect(consoleSpy).not.toHaveBeenCalled()
	})
})
```

### Integration Tests

#### End-to-End Flow Test

**File**: `src/api/__tests__/token-usage-integration.test.ts`

```typescript
describe("Token Usage End-to-End Integration", () => {
	test("should deliver token usage from task completion to client", async () => {
		// Set up real StreamManager and SSEOutputAdapter
		// Execute task with token usage
		// Verify client receives token usage event
		// Validate event data structure and content
	})

	test("should handle concurrent token usage emissions", async () => {
		// Test multiple simultaneous task completions
		// Verify all token usage events are delivered
		// Check for race conditions or data corruption
	})

	test("should maintain event ordering", async () => {
		// Verify token usage events come before completion
		// Test with various result sizes and completion types
	})
})
```

#### Error Handling Integration Test

```typescript
describe("Token Usage Error Handling Integration", () => {
	test("should handle stream disconnection during token usage", async () => {
		// Start task execution
		// Disconnect client during token usage emission
		// Verify server continues normally
		// Test reconnection behavior
	})

	test("should handle malformed token usage data", async () => {
		// Inject various malformed token usage data
		// Verify graceful handling at all levels
		// Ensure task completion continues
	})
})
```

### Performance Tests

#### Server-Side Performance

**File**: `src/api/__tests__/token-usage-performance.test.ts`

```typescript
describe("Token Usage Performance", () => {
	test("should emit token usage within performance budget", async () => {
		const adapter = new SSEOutputAdapter(mockStreamManager, "test-job")
		const tokenUsage = { totalTokensIn: 1000, totalTokensOut: 2000 }

		const startTime = process.hrtime.bigint()
		await adapter.emitTokenUsage(tokenUsage)
		const endTime = process.hrtime.bigint()

		const durationMs = Number(endTime - startTime) / 1_000_000
		expect(durationMs).toBeLessThan(2) // <2ms budget
	})

	test("should handle high-frequency token usage emissions", async () => {
		// Test 100 rapid token usage emissions
		// Measure total time and memory usage
		// Verify no memory leaks or performance degradation
	})
})
```

#### Client-Side Performance

```javascript
describe("Client Token Usage Display Performance", () => {
	test("should display token usage within performance budget", () => {
		const tokenUsage = {
			totalTokensIn: 1000000,
			totalTokensOut: 2000000,
			totalCost: 123.4567,
		}

		const startTime = performance.now()
		displayTokenUsage(tokenUsage)
		const endTime = performance.now()

		expect(endTime - startTime).toBeLessThan(2) // <2ms budget
	})
})
```

### Manual Testing Scenarios

#### Basic Functionality Testing

```bash
# Test 1: Default behavior shows token usage
./api-client.js --stream "create a simple hello world function"
# Expected: Task completion followed by token usage display

# Test 2: Hide token usage
./api-client.js --stream --hide-token-usage "create a simple hello world function"
# Expected: Task completion without token usage display

# Test 3: Explicit show token usage
./api-client.js --stream --show-token-usage "create a simple hello world function"
# Expected: Task completion followed by token usage display

# Test 4: Both flags (hide should take precedence)
./api-client.js --stream --show-token-usage --hide-token-usage "test task"
# Expected: Task completion without token usage display
```

#### Edge Case Testing

```bash
# Test 5: Very large token usage numbers
./api-client.js --stream "analyze this entire codebase in detail"
# Expected: Large numbers formatted with thousands separators

# Test 6: Zero cost scenarios
./api-client.js --stream "what is 2+2"
# Expected: Token usage without cost display (if cost is 0)

# Test 7: Minimal token usage
./api-client.js --stream "hi"
# Expected: Basic token usage display with minimal data

# Test 8: Network interruption
./api-client.js --stream "long running task"
# Disconnect network during execution, reconnect
# Expected: Graceful handling, token usage displayed when available
```

#### Error Scenario Testing

```bash
# Test 9: Server not running
./api-client.js --stream --show-token-usage "test task"
# Expected: Connection error, no token usage display

# Test 10: Invalid mode with token usage
./api-client.js --stream --mode invalid-mode --show-token-usage "test"
# Expected: Mode error, no token usage display

# Test 11: Task failure with token usage
./api-client.js --stream "intentionally cause an error"
# Expected: Error display, token usage may or may not appear
```

#### Compatibility Testing

```bash
# Test 12: With verbose mode
./api-client.js --stream --verbose --show-token-usage "test task"
# Expected: Verbose output plus token usage display

# Test 13: With other display flags
./api-client.js --stream --show-thinking --show-tools --show-token-usage "test"
# Expected: All requested content displayed including token usage

# Test 14: With different modes
./api-client.js --stream --mode architect --show-token-usage "plan a feature"
./api-client.js --stream --mode debug --show-token-usage "find this bug"
# Expected: Mode-specific behavior plus token usage display
```

### Performance Validation

#### Metrics to Measure

1. **Server-Side Overhead**:

    - Token usage emission time: <2ms
    - Memory usage per emission: <200 bytes
    - CPU overhead: <1% additional

2. **Client-Side Overhead**:

    - Display formatting time: <2ms
    - Memory usage per display: <100 bytes
    - No impact on SSE processing speed

3. **Network Overhead**:
    - Additional SSE event size: ~300-500 bytes
    - No impact on connection stability
    - Event delivery success rate: >99%

#### Performance Test Procedures

```bash
# Server performance test
for i in {1..100}; do
  time ./api-client.js --stream "quick test $i"
done

# Memory usage test
./api-client.js --stream "create a large application" &
# Monitor memory usage during execution

# Concurrent usage test
for i in {1..10}; do
  ./api-client.js --stream "concurrent test $i" &
done
wait
```

### Test Data Scenarios

#### Token Usage Data Variations

```javascript
// Complete data
{
  totalTokensIn: 1234,
  totalTokensOut: 5678,
  totalCost: 0.0965,
  contextTokens: 22857,
  totalCacheReads: 22397,
  totalCacheWrites: 22738
}

// Minimal data
{
  totalTokensIn: 10,
  totalTokensOut: 50
}

// Large numbers
{
  totalTokensIn: 1234567,
  totalTokensOut: 9876543,
  totalCost: 123.4567
}

// Edge cases
{
  totalTokensIn: 0,
  totalTokensOut: 0,
  totalCost: 0.0001
}

// Invalid data (should be handled gracefully)
{
  totalTokensIn: "invalid",
  totalTokensOut: null,
  totalCost: undefined
}
```

## Definition of Done

- [ ] All unit tests written and passing with >95% coverage
- [ ] Integration tests cover end-to-end scenarios
- [ ] Performance tests validate overhead within budgets
- [ ] Manual testing scenarios documented and executed
- [ ] Error handling tested for all failure modes
- [ ] Performance metrics measured and documented
- [ ] Test automation integrated into CI/CD pipeline
- [ ] Load testing completed for concurrent usage
- [ ] Memory leak testing completed
- [ ] Documentation updated with testing procedures

## Risk Assessment

### Testing Risks

- **Incomplete Coverage**: Missing edge cases or error scenarios
    - _Mitigation_: Comprehensive test planning and review
- **Performance Regression**: New feature impacts existing performance
    - _Mitigation_: Baseline performance measurement and monitoring
- **Flaky Tests**: Intermittent test failures due to timing or concurrency
    - _Mitigation_: Robust test design with proper mocking and timeouts

### Mitigation Strategies

- **Code Review**: All tests reviewed for completeness and correctness
- **Automated Testing**: CI/CD integration prevents regressions
- **Performance Monitoring**: Continuous monitoring of key metrics
- **Rollback Plan**: Quick rollback procedures if issues discovered

## Success Metrics

- ✅ Unit test coverage: >95% for all new code
- ✅ Integration test success rate: 100%
- ✅ Performance overhead: <2ms server-side, <2ms client-side
- ✅ Memory usage increase: <1MB per 1000 operations
- ✅ Zero critical bugs in production
- ✅ Manual testing scenarios: 100% pass rate

## Test Automation

### CI/CD Integration

```yaml
# .github/workflows/token-usage-tests.yml
name: Token Usage Tests
on: [push, pull_request]

jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v2
            - name: Setup Node.js
              uses: actions/setup-node@v2
              with:
                  node-version: "18"

            - name: Install dependencies
              run: npm install

            - name: Run unit tests
              run: npm run test:unit -- --coverage

            - name: Run integration tests
              run: npm run test:integration

            - name: Run performance tests
              run: npm run test:performance

            - name: Upload coverage
              uses: codecov/codecov-action@v1
```

### Test Scripts

```json
{
	"scripts": {
		"test:token-usage": "jest --testPathPattern=token-usage",
		"test:performance": "jest --testPathPattern=performance",
		"test:integration": "jest --testPathPattern=integration",
		"test:manual": "bash scripts/manual-token-usage-tests.sh"
	}
}
```

## Documentation Updates

### Testing Documentation

- Update testing guidelines with token usage test patterns
- Document performance testing procedures
- Add troubleshooting guide for token usage issues

### User Documentation

- Add token usage examples to API documentation
- Update client usage examples
- Document performance characteristics

## Rollback Testing

### Rollback Scenarios

1. **Feature Disable**: Test disabling token usage display
2. **Server Rollback**: Test reverting server-side changes
3. **Client Rollback**: Test reverting client-side changes
4. **Full Rollback**: Test complete feature removal

### Rollback Validation

- Verify existing functionality unaffected
- Confirm no data corruption or loss
- Validate performance returns to baseline
- Test that rollback can be performed quickly

## Conclusion

This comprehensive testing strategy ensures the token usage exposure feature is robust, performant, and reliable. The combination of unit tests, integration tests, performance validation, and manual testing provides confidence in the feature's quality and readiness for production deployment.

The testing approach follows industry best practices and includes automated testing integration to prevent regressions. Performance validation ensures the feature meets user expectations for responsiveness and resource usage.
