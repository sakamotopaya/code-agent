# Token Usage Emission Fix - Updated Analysis

## Problem Summary

Token usage information is not being emitted to API clients via SSE (Server-Sent Events) despite being calculated correctly in the server logs.

## Current Investigation Status

### What We Know

1. **Token usage data is being calculated correctly** - Server logs show entries like:

    ```
    [ApiTaskExecutionHandler] Token usage: { "totalTokensIn": 8, ... }
    ```

2. **The `taskCompleted` event is being emitted** - From `attemptCompletionTool.ts`:

    ```
    cline.emit("taskCompleted", cline.taskId, cline.getTokenUsage(), cline.toolUsage)
    ```

3. **Debug messages from our `onTaskCompleted` method are missing** - None of these appear in logs:
    - "🔍 About to emit token usage"
    - "⚠️ No token usage data available"

### Critical Gap Identified

**Missing logging at the source**: There's no logging in `attemptCompletionTool.ts` to show what `cline.getTokenUsage()` returns when the event is emitted.

## Debugging Strategy - Phase 1: Source Logging

### Step 1: Add Logging at Event Emission

**File**: `src/core/tools/attemptCompletionTool.ts`

Add logging before each `taskCompleted` event emission:

**Location 1** (around line 53):

```typescript
// Use the task's telemetry service instead of a global instance
if (cline.telemetry) {
	cline.telemetry.captureTaskCompleted(cline.taskId)
}

// NEW: Log token usage data before emission
const tokenUsage = cline.getTokenUsage()
const toolUsage = cline.toolUsage
console.log(`[attemptCompletionTool] 🔍 About to emit taskCompleted event:`)
console.log(`[attemptCompletionTool] 🔍 - taskId: ${cline.taskId}`)
console.log(`[attemptCompletionTool] 🔍 - tokenUsage type: ${typeof tokenUsage}`)
console.log(`[attemptCompletionTool] 🔍 - tokenUsage defined: ${tokenUsage !== undefined}`)
if (tokenUsage) {
	console.log(`[attemptCompletionTool] 🔍 - tokenUsage value:`, JSON.stringify(tokenUsage, null, 2))
}
console.log(`[attemptCompletionTool] 🔍 - toolUsage:`, JSON.stringify(toolUsage, null, 2))

cline.emit("taskCompleted", cline.taskId, tokenUsage, toolUsage)
```

**Location 2** (around line 82):

```typescript
// Use the task's telemetry service instead of a global instance
if (cline.telemetry) {
	cline.telemetry.captureTaskCompleted(cline.taskId)
}

// NEW: Log token usage data before emission
const tokenUsage = cline.getTokenUsage()
const toolUsage = cline.toolUsage
console.log(`[attemptCompletionTool] 🔍 About to emit taskCompleted event (path 2):`)
console.log(`[attemptCompletionTool] 🔍 - taskId: ${cline.taskId}`)
console.log(`[attemptCompletionTool] 🔍 - tokenUsage type: ${typeof tokenUsage}`)
if (tokenUsage) {
	console.log(`[attemptCompletionTool] 🔍 - tokenUsage value:`, JSON.stringify(tokenUsage, null, 2))
}

cline.emit("taskCompleted", cline.taskId, tokenUsage, toolUsage)
```

**Location 3** (around line 110):

```typescript
// Use the task's telemetry service instead of a global instance
if (cline.telemetry) {
	cline.telemetry.captureTaskCompleted(cline.taskId)
}

// NEW: Log token usage data before emission
const tokenUsage = cline.getTokenUsage()
const toolUsage = cline.toolUsage
console.log(`[attemptCompletionTool] 🔍 About to emit taskCompleted event (path 3):`)
console.log(`[attemptCompletionTool] 🔍 - taskId: ${cline.taskId}`)
console.log(`[attemptCompletionTool] 🔍 - tokenUsage type: ${typeof tokenUsage}`)
if (tokenUsage) {
	console.log(`[attemptCompletionTool] 🔍 - tokenUsage value:`, JSON.stringify(tokenUsage, null, 2))
}

cline.emit("taskCompleted", cline.taskId, tokenUsage, toolUsage)
```

### Step 2: Add Logging at Event Reception

**File**: `src/core/task/execution/TaskExecutionOrchestrator.ts`

```typescript
// Task completion
task.on("taskCompleted", async (tid: string, tokenUsage: any, toolUsage: any) => {
    handler.logDebug(`[TaskExecutionOrchestrator] Task completed: ${tid}`)
    handler.logDebug(`[TaskExecutionOrchestrator] 🔍 Event received with tokenUsage type: ${typeof tokenUsage}`)
    handler.logDebug(`[TaskExecutionOrchestrator] 🔍 Event received with tokenUsage defined: ${tokenUsage !== undefined}`)
    if (tokenUsage) {
        handler.logDebug(`[TaskExecutionOrchestrator] 🔍 Event tokenUsage:`, JSON.stringify(tokenUsage, null, 2))
    } else {
        handler.logDebug(`[TaskExecutionOrchestrator] ⚠️ Event received with NO tokenUsage data`)
    }

    this.clearAllTimers(state)

    try {
        await this.disposeTask(task)
        handler.logDebug(`[TaskExecutionOrchestrator] 📡 About to call onTaskCompleted with tokenUsage: ${!!tokenUsage}`)
        await handler.onTaskCompleted(taskId, "Task completed successfully", tokenUsage, toolUsage)
```

### Step 3: Add Logging at Final Handler

**File**: `src/core/task/execution/ApiTaskExecutionHandler.ts`

```typescript
async onTaskCompleted(taskId: string, result: string, tokenUsage?: any, toolUsage?: any): Promise<void> {
    // NEW: Always log what we receive
    console.log(`[ApiTaskExecutionHandler] 🔍 onTaskCompleted called:`)
    console.log(`[ApiTaskExecutionHandler] 🔍 - taskId: ${taskId}`)
    console.log(`[ApiTaskExecutionHandler] 🔍 - tokenUsage type: ${typeof tokenUsage}`)
    console.log(`[ApiTaskExecutionHandler] 🔍 - tokenUsage defined: ${tokenUsage !== undefined}`)
    if (tokenUsage) {
        console.log(`[ApiTaskExecutionHandler] 🔍 - tokenUsage value:`, JSON.stringify(tokenUsage, null, 2))
    }

    if (this.verbose) {
        console.log(`[ApiTaskExecutionHandler] Task ${taskId} completed for job ${this.jobId}`)
        console.log(`[ApiTaskExecutionHandler] Result:`, result.substring(0, 200) + "...")
        console.log(`[ApiTaskExecutionHandler] Token usage:`, tokenUsage)
        console.log(`[ApiTaskExecutionHandler] Tool usage:`, toolUsage)
    }

    // ✅ ALWAYS emit token usage information if available, even for duplicate completions
    if (tokenUsage) {
        console.log(`[ApiTaskExecutionHandler] 🔍 About to emit token usage for task ${taskId}:`, JSON.stringify(tokenUsage, null, 2))
        try {
            console.log(`[ApiTaskExecutionHandler] 📡 Calling sseAdapter.emitTokenUsage()`)
            await this.sseAdapter.emitTokenUsage(tokenUsage)
            console.log(`[ApiTaskExecutionHandler] ✅ Token usage emitted for task ${taskId}`)
        } catch (error) {
            console.error(`[ApiTaskExecutionHandler] ❌ Failed to emit token usage for task ${taskId}:`, error)
        }
    } else {
        console.log(`[ApiTaskExecutionHandler] ⚠️ No token usage data available for task ${taskId} - tokenUsage is ${typeof tokenUsage}`)
    }

    // Rest of existing method...
}
```

## Expected Debug Flow

With this logging, we should see a complete trace:

1. **At emission**: What `cline.getTokenUsage()` returns
2. **At reception**: What the event listener receives
3. **At handler**: What `onTaskCompleted` receives

## Possible Scenarios

### Scenario A: Source has no data

```
[attemptCompletionTool] 🔍 - tokenUsage type: undefined
```

**Root cause**: `cline.getTokenUsage()` returns undefined

### Scenario B: Source has data, reception loses it

```
[attemptCompletionTool] 🔍 - tokenUsage value: { "totalTokensIn": 8 }
[TaskExecutionOrchestrator] ⚠️ Event received with NO tokenUsage data
```

**Root cause**: Event emission/reception issue

### Scenario C: Data flows correctly but handler doesn't emit

```
[attemptCompletionTool] 🔍 - tokenUsage value: { "totalTokensIn": 8 }
[TaskExecutionOrchestrator] 🔍 Event tokenUsage: { "totalTokensIn": 8 }
[ApiTaskExecutionHandler] 🔍 - tokenUsage value: { "totalTokensIn": 8 }
[ApiTaskExecutionHandler] ❌ Failed to emit token usage: [error]
```

**Root cause**: SSE emission failure

## Next Steps

1. **Add the source logging first** - This is the most critical gap
2. **Test with API client**
3. **Analyze the complete data flow**
4. **Implement targeted fix based on findings**

## Files to Modify

1. `src/core/tools/attemptCompletionTool.ts` - **PRIORITY 1** - Add emission logging
2. `src/core/task/execution/TaskExecutionOrchestrator.ts` - Add reception logging
3. `src/core/task/execution/ApiTaskExecutionHandler.ts` - Add handler logging
