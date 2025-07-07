# Story 3: Comprehensive Testing of API Execution Fix

## Story Description

**As a** developer  
**I want** comprehensive testing of the API execution fix  
**So that** I can be confident the issue is resolved without regressions

## Background

After removing the informational query logic from the API, we need to thoroughly test that:

1. The original issue is fixed
2. No regressions are introduced
3. All API functionality works correctly
4. The behavior matches the VS Code extension

## Acceptance Criteria

### Primary Fix Validation

- [ ] Original failing command works correctly:
    ```bash
    ./test-api.js --stream --mode ticket-oracle "what is your current mode"
    ```
- [ ] Task executes normally (no immediate "Standard task completion")
- [ ] LLM provides a proper response about the current mode
- [ ] Streaming works throughout the entire execution

### Question Format Testing

- [ ] Test various question formats that previously failed:
    - "what is your current mode"
    - "how do I create a file"
    - "where should I put this code"
    - "which tool should I use"
    - "who can help me with this"
    - "when should I run this command"
- [ ] All question formats execute normally and provide LLM responses
- [ ] No immediate termination for any question format

### Mode Parameter Testing

- [ ] Test with different built-in modes:
    - `--mode code`
    - `--mode debug`
    - `--mode architect`
    - `--mode ask`
    - `--mode test`
- [ ] Test with custom modes (if available):
    - `--mode ticket-oracle`
    - `--mode product-owner`
- [ ] All modes work correctly with question-style tasks
- [ ] Mode-specific behavior is preserved

### Regression Testing

- [ ] Test normal non-question tasks:
    - "Create a simple HTML file"
    - "Fix the bug in this code"
    - "Implement a new feature"
- [ ] Test streaming functionality:
    - `--stream` parameter works correctly
    - Events are streamed properly
    - No connection issues
- [ ] Test error handling:
    - Invalid mode names
    - Malformed requests
    - Network interruptions
- [ ] Test timeout behavior:
    - Long-running tasks
    - User interaction scenarios

### Performance Testing

- [ ] Response times are not degraded
- [ ] Memory usage remains stable
- [ ] No new performance bottlenecks introduced
- [ ] Streaming latency is acceptable

## Testing Plan

### Phase 1: Core Fix Validation (30 minutes)

1. **Original Issue Test**

    ```bash
    ./test-api.js --stream --mode ticket-oracle "what is your current mode"
    ```

    - Expected: Task executes normally, provides LLM response
    - Verify: No "Standard task completion" message
    - Verify: Proper streaming throughout execution

2. **Mode Verification**
    ```bash
    ./test-api.js --stream --mode code "what is your current mode"
    ./test-api.js --stream --mode debug "what is your current mode"
    ./test-api.js --stream --mode architect "what is your current mode"
    ```
    - Expected: Each mode responds appropriately
    - Verify: Mode-specific behavior is maintained

### Phase 2: Question Format Testing (45 minutes)

Test various question patterns that would have triggered informational query detection:

```bash
# Question words that previously failed
./test-api.js --stream --mode code "what should I do next"
./test-api.js --stream --mode code "how do I create a React component"
./test-api.js --stream --mode code "where should I put this function"
./test-api.js --stream --mode code "which approach is better"
./test-api.js --stream --mode code "who wrote this code"
./test-api.js --stream --mode code "when should I use async/await"

# Question marks
./test-api.js --stream --mode code "Can you help me with this?"
./test-api.js --stream --mode code "What's the best way to do this?"

# Mixed patterns
./test-api.js --stream --mode code "Show me how to implement this feature"
./test-api.js --stream --mode code "List all the files in this directory"
./test-api.js --stream --mode code "Display the current configuration"
```

### Phase 3: Regression Testing (60 minutes)

1. **Normal Task Testing**

    ```bash
    ./test-api.js --stream --mode code "Create a simple HTML file with a form"
    ./test-api.js --stream --mode debug "Find and fix the bug in this JavaScript code"
    ./test-api.js --stream --mode architect "Plan the architecture for a new microservice"
    ```

2. **Streaming Functionality**

    - Verify events are streamed in real-time
    - Check for proper event types (start, progress, completion)
    - Ensure no connection drops or timeouts

3. **Error Handling**

    ```bash
    ./test-api.js --stream --mode invalid-mode "test task"
    ./test-api.js --stream --mode code ""  # empty task
    ```

4. **Long-running Tasks**
    ```bash
    ./test-api.js --stream --mode code "Create a complex web application with multiple components"
    ```

### Phase 4: Performance Testing (30 minutes)

1. **Response Time Measurement**

    - Measure time from request to first response
    - Compare with baseline before fix
    - Ensure no significant degradation

2. **Memory Usage**

    - Monitor API server memory during testing
    - Check for memory leaks
    - Verify stable memory usage

3. **Concurrent Requests**
    - Test multiple simultaneous API calls
    - Verify no interference between requests
    - Check resource cleanup

## Test Environment Setup

### Prerequisites

- API server running with the fix applied
- `test-api.js` script available
- Network connectivity to API server
- Sufficient system resources for testing

### Test Data Collection

For each test, collect:

- Request timestamp
- Response timestamp
- Response content
- Error messages (if any)
- Performance metrics
- Log output

### Success Criteria

- All tests pass without errors
- Response times within acceptable limits
- No memory leaks or resource issues
- Behavior matches VS Code extension

## Automated Testing Script

Create a comprehensive test script:

```bash
#!/bin/bash
# test-api-fix.sh

echo "Testing API Execution Fix"
echo "========================="

# Test 1: Original failing case
echo "Test 1: Original failing case"
./test-api.js --stream --mode ticket-oracle "what is your current mode"

# Test 2: Various question formats
echo "Test 2: Question formats"
for question in \
  "what should I do next" \
  "how do I create a file" \
  "where should I put this" \
  "which tool is best" \
  "who can help me" \
  "when should I run this"
do
  echo "Testing: $question"
  ./test-api.js --stream --mode code "$question"
done

# Test 3: Different modes
echo "Test 3: Different modes"
for mode in code debug architect ask test
do
  echo "Testing mode: $mode"
  ./test-api.js --stream --mode $mode "what is your current mode"
done

# Test 4: Normal tasks
echo "Test 4: Normal tasks"
./test-api.js --stream --mode code "Create a simple HTML file"
./test-api.js --stream --mode debug "Fix this bug"

echo "Testing complete!"
```

## Definition of Done

- [ ] All test phases completed successfully
- [ ] No regressions identified
- [ ] Performance within acceptable limits
- [ ] Documentation updated with test results
- [ ] Test script created for future validation

## Risk Mitigation

- **Test in isolated environment** to avoid affecting production
- **Backup original code** before applying fix
- **Monitor system resources** during testing
- **Have rollback plan** ready if issues are found

## Estimated Effort

2-3 hours for comprehensive testing and validation.
