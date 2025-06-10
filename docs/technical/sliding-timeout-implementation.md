# Sliding Timeout Implementation for Batch Execution

## Problem

The batch execution code had a fixed 60-second timeout that would kill processes regardless of whether work was happening. This was problematic for long-running tasks that had periods of activity.

## Solution

Implemented a sliding timeout that resets whenever there's activity, ensuring tasks only timeout during periods of inactivity.

## Implementation

### Key Changes in `src/cli/commands/batch.ts`

1. **Replaced Fixed Timeout with Sliding Timeout**:

    ```typescript
    // Before: Fixed timeout
    const timeout = setTimeout(() => {
    	reject(new Error(`Task execution timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    // After: Sliding timeout with reset capability
    let timeout: NodeJS.Timeout
    const resetTimeout = () => {
    	if (timeout) clearTimeout(timeout)
    	timeout = setTimeout(() => {
    		reject(new Error(`Task execution timeout after ${timeoutMs}ms of inactivity`))
    	}, timeoutMs)
    }
    ```

2. **Activity Detection**:
   The timeout resets on these Task events:

    - `taskStarted` - When task begins
    - `taskModeSwitched` - When switching between modes (e.g., code, debug)
    - `taskPaused` / `taskUnpaused` - When task state changes
    - `taskSpawned` - When new tasks are created
    - `taskTokenUsageUpdated` - When API calls are made (frequent during active work)
    - `message` - When messages are created/updated

3. **User Input Handling**:

    - Timeout is **paused** when questions are asked to the user
    - Timeout is **resumed** when user responds (`taskAskResponded` event)
    - This prevents false timeouts while waiting for user input
    - Users can take as long as needed to respond to questions

4. **Proper Cleanup**:
    - Timeout is cleared when task completes successfully
    - Timeout is cleared when task is aborted
    - Timeout is cleared when tool failures occur

## Benefits

1. **No More False Timeouts**: Tasks won't timeout while actively working
2. **Still Prevents Hanging**: Tasks will timeout after 60 seconds of true inactivity
3. **Better User Experience**: Long-running tasks can complete without manual intervention
4. **Maintains Safety**: Still protects against truly stuck processes

## Testing

Created comprehensive tests and a demonstration script showing:

- Basic timeout behavior after inactivity period
- Timeout reset on activity events
- Proper cleanup on completion/abort
- Multiple rapid activity events handling

## Demo Output

```
=== Sliding Timeout Demo ===

Scenario 1: Task times out after 5 seconds of inactivity
Timeout reset - task has 5000ms of inactivity before timeout
Task timed out after 5000ms of inactivity
❌ Task timed out due to inactivity!

Scenario 2: Task with periodic activity
Timeout reset - task has 5000ms of inactivity before timeout
Activity detected - resetting timeout
Timeout reset - task has 5000ms of inactivity before timeout
Activity detected - resetting timeout
Timeout reset - task has 5000ms of inactivity before timeout

Scenario 3: Task completes before timeout
Timeout reset - task has 5000ms of inactivity before timeout
Task completed - clearing timeout
Timeout cleared
✅ Task completed successfully before timeout
```

## Configuration

The timeout duration remains configurable at 60 seconds (60000ms) but now represents inactivity timeout rather than total execution time.

## Backward Compatibility

This change is backward compatible - existing batch execution will work the same but with improved timeout behavior.
