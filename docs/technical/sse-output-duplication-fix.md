# SSE Output Duplication Fix

## Problem Description

The `api-client.js` streaming endpoint is outputting content twice:

1. **First output**: Content streams correctly through SSE `progress` events
2. **Second output**: At completion, the entire final content is dumped again with a `%` at the end

## Root Cause Analysis

The issue is in the `complete`/`completion` event handler in `testStreamingEndpoint()` function (lines 1059-1075):

```javascript
case "complete":
case "completion":
    // Show final result with content type filtering
    let outputSomething = false
    if (showResponse && shouldDisplay && !resultIsSystem && filteredData.result) {
        process.stdout.write(filteredData.result)  // <-- DUPLICATE OUTPUT
        outputSomething = true
    } else if (showResponse && shouldDisplay && !messageIsSystem && filteredData.message) {
        process.stdout.write(filteredData.message)  // <-- OR THIS ONE
        outputSomething = true
    }
```

### Key Issues:

1. **Logic flaw**: The completion handler is outputting the final result even when `--show-response` is `false` (default)
2. **Missing newline**: No proper newline handling causes the `%` shell prompt to appear
3. **Redundant output**: Content already streamed through `progress` events is repeated

## Solution Design

### Fix Strategy:

1. **Respect `--show-response` flag**: Only output final result when explicitly requested
2. **Add proper completion handling**: Show a simple completion indicator by default
3. **Fix newline handling**: Ensure proper terminal output formatting

### Code Changes Required:

#### 1. Fix Completion Logic (lines 1059-1075)

```javascript
case "complete":
case "completion":
    // Only show final result if --show-response is explicitly enabled
    if (showResponse && shouldDisplay) {
        let outputSomething = false
        if (!resultIsSystem && filteredData.result) {
            process.stdout.write(filteredData.result)
            outputSomething = true
        } else if (!messageIsSystem && filteredData.message) {
            process.stdout.write(filteredData.message)
            outputSomething = true
        }
        // Add final newline only if we actually output something
        if (outputSomething) {
            process.stdout.write("\n")
        }
    } else {
        // Default behavior: just ensure we end with a newline for clean terminal output
        process.stdout.write("\n")
    }
    res.destroy()
    return
```

#### 2. Alternative Minimal Fix

If we want to be more conservative, we can simply prevent any output in the completion case when `showResponse` is false:

```javascript
case "complete":
case "completion":
    // Only output anything if --show-response is enabled
    if (showResponse && shouldDisplay) {
        // ... existing logic ...
    }
    // Always ensure clean terminal output
    process.stdout.write("\n")
    res.destroy()
    return
```

## Testing Plan

### Test Cases:

1. **Default behavior** (`./api-client.js --stream "test"`):

    - Should stream content once during progress
    - Should NOT duplicate content at completion
    - Should end with clean newline (no `%`)

2. **With --show-response** (`./api-client.js --stream --show-response "test"`):

    - Should stream content during progress
    - Should show final result at completion
    - Should end with clean newline

3. **Verbose mode** (`./api-client.js --stream --verbose "test"`):
    - Should show detailed event information
    - Should not duplicate content in simple output

## Implementation Priority

**High Priority**: This is a user-facing output formatting issue that affects the CLI experience.

## Files to Modify

- `api-client.js` (lines 1059-1075): Fix completion event handler logic

## Expected Outcome

After the fix:

- Content streams once during progress events
- No duplicate output at completion (unless `--show-response` is used)
- Clean terminal output without trailing `%`
- Proper respect for the `--show-response` flag
