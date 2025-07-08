# SSE Output Duplication Debugging Plan

## Current Status

The fix applied to the `complete`/`completion` case handler didn't resolve the duplicate output issue. We need to debug why.

## Debugging Approach

### 1. Add Temporary Logging

Add console.error() statements (to stderr) to track:

- What event types are being received
- The values of `showResponse` and `shouldDisplay` variables
- When the completion case is triggered
- What content is being output

### 2. Specific Debug Points

#### A. Variable State Logging

```javascript
// At the start of the streaming function
console.error(`DEBUG: showResponse=${showResponse}, showCompletion=${showCompletion}`)
```

#### B. Event Type Logging

```javascript
// In the SSE data processing loop
console.error(`DEBUG: Received event type: ${filteredData.type}`)
```

#### C. Completion Case Logging

```javascript
case "complete":
case "completion":
    console.error(`DEBUG: Completion event - showResponse=${showResponse}, shouldDisplay=${shouldDisplay}`)
    console.error(`DEBUG: filteredData.result exists: ${!!filteredData.result}`)
    console.error(`DEBUG: filteredData.message exists: ${!!filteredData.message}`)
    // ... rest of the logic
```

#### D. All Output Logging

```javascript
// Before any process.stdout.write() calls
console.error(`DEBUG: About to output: ${content.substring(0, 50)}...`)
```

### 3. Alternative Theories to Test

#### Theory 1: Server sends duplicate events

- Log all incoming SSE events to see if server is sending completion twice

#### Theory 2: Multiple code paths

- Check if there are other switch cases or conditions that might output the final result

#### Theory 3: Event type mismatch

- The completion might come as a different event type (not "complete" or "completion")

#### Theory 4: Content filter issue

- The `ClientContentFilter.processData()` might not be filtering correctly

### 4. Minimal Test Case

Create a simple test to isolate the issue:

```bash
./api-client.js --stream --mode code "hello world" 2>debug.log
```

This will capture debug output to stderr while showing the duplicate issue.

## Implementation Plan

1. **Add debug logging** to key points in the streaming logic
2. **Run test case** and capture debug output
3. **Analyze logs** to understand the flow
4. **Identify root cause** based on debug information
5. **Apply targeted fix** based on findings

## Expected Debug Output

We should see something like:

```
DEBUG: showResponse=false, showCompletion=false
DEBUG: Received event type: start
DEBUG: Received event type: progress
DEBUG: Received event type: progress
...
DEBUG: Received event type: complete
DEBUG: Completion event - showResponse=false, shouldDisplay=true
DEBUG: About to output: [content]...
```

This will help us understand exactly where the duplicate output is coming from.
