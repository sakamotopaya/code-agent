# Token Usage Debug Plan

## Current Issue Analysis

The logs show:

1. Token usage data is calculated correctly in the Task
2. `taskCompleted` event is emitted with token usage data
3. `TaskExecutionOrchestrator` receives the event and calls `onTaskCompleted`
4. But our debug messages in `onTaskCompleted` method are not appearing

## Hypothesis

The `tokenUsage` parameter is `undefined` when it reaches `onTaskCompleted`, even though it should contain data.

## Debug Strategy

### 1. Add Debug Logging in TaskExecutionOrchestrator

Add logging in the `taskCompleted` event handler to see what data is being received:

```typescript
task.on("taskCompleted", async (tid: string, tokenUsage: any, toolUsage: any) => {
    handler.logDebug(`[TaskExecutionOrchestrator] Task completed: ${tid}`)
    handler.logDebug(`[TaskExecutionOrchestrator] 🔍 Received tokenUsage:`, JSON.stringify(tokenUsage, null, 2))
    handler.logDebug(`[TaskExecutionOrchestrator] 🔍 Received toolUsage:`, JSON.stringify(toolUsage, null, 2))
    this.clearAllTimers(state)

    try {
        await this.disposeTask(task)
        handler.logDebug(`[TaskExecutionOrchestrator] 📡 About to call onTaskCompleted with tokenUsage:`, !!tokenUsage)
        await handler.onTaskCompleted(taskId, "Task completed successfully", tokenUsage, toolUsage)
```

### 2. Add Debug Logging in ApiTaskExecutionHandler

Enhance the existing debug logging to show when tokenUsage is undefined:

```typescript
async onTaskCompleted(taskId: string, result: string, tokenUsage?: any, toolUsage?: any): Promise<void> {
    console.log(`[ApiTaskExecutionHandler] 🔍 onTaskCompleted called with:`)
    console.log(`[ApiTaskExecutionHandler] 🔍 - taskId: ${taskId}`)
    console.log(`[ApiTaskExecutionHandler] 🔍 - result: ${result?.substring(0, 50)}...`)
    console.log(`[ApiTaskExecutionHandler] 🔍 - tokenUsage type: ${typeof tokenUsage}`)
    console.log(`[ApiTaskExecutionHandler] 🔍 - tokenUsage value:`, JSON.stringify(tokenUsage, null, 2))
    console.log(`[ApiTaskExecutionHandler] 🔍 - toolUsage type: ${typeof toolUsage}`)

    if (this.verbose) {
        console.log(`[ApiTaskExecutionHandler] Task ${taskId} completed for job ${this.jobId}`)
        console.log(`[ApiTaskExecutionHandler] Result:`, result.substring(0, 200) + "...")
        console.log(`[ApiTaskExecutionHandler] Token usage:`, tokenUsage)
        console.log(`[ApiTaskExecutionHandler] Tool usage:`, toolUsage)
    }

    // ✅ ALWAYS emit token usage information if available, even for duplicate completions
    if (tokenUsage) {
        console.log(`[ApiTaskExecutionHandler] 🔍 About to emit token usage for task ${taskId}:`, JSON.stringify(tokenUsage, null, 2))
        // ... existing emission logic
    } else {
        console.log(`[ApiTaskExecutionHandler] ⚠️ No token usage data available for task ${taskId} - tokenUsage is ${typeof tokenUsage}`)
    }
```

### 3. Check for Multiple Event Listeners

Verify if there are multiple listeners for the `taskCompleted` event that might be interfering.

### 4. Test the Fix

After adding debug logging:

1. Run the API test again
2. Check logs for the new debug messages
3. Identify exactly where token usage data is being lost
4. Implement the appropriate fix

## Expected Debug Output

With the enhanced logging, we should see:

- What data `TaskExecutionOrchestrator` receives from the `taskCompleted` event
- What data gets passed to `onTaskCompleted`
- Whether the issue is in the event emission or the parameter passing

## Next Steps

1. Add the debug logging
2. Test with API client
3. Analyze the debug output
4. Implement the fix based on findings
