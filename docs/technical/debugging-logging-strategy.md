# Debugging Logging Strategy - Mode Parameter Issue

## Problem Summary

Task completes immediately with 0 tokens, indicating the LLM is never called. We need strategic logging to identify where the execution flow breaks.

## Critical Logging Points

### 1. Task.ts - Task Creation and Startup

**File**: `src/core/task/Task.ts`

**Line 1285-1287** - `startTask()` method:

```javascript
private async startTask(task?: string, images?: string[]): Promise<void> {
    console.log(`[TASK-DEBUG] startTask() called with task: "${task}", images: ${images?.length || 0}`)
    await this.lifecycle.startTask(task, images, (userContent) => this.initiateTaskLoop(userContent))
    console.log(`[TASK-DEBUG] startTask() completed, isInitialized: ${this.isInitialized}`)
    this.isInitialized = true
}
```

**Line 1338-1344** - `initiateTaskLoop()` method:

```javascript
private async initiateTaskLoop(userContent: Anthropic.Messages.ContentBlockParam[]): Promise<void> {
    console.log(`[TASK-DEBUG] initiateTaskLoop() called for task ${this.taskId}.${this.instanceId}`)
    console.log(`[TASK-DEBUG] Current mode: ${this.mode}`)
    console.log(`[TASK-DEBUG] User content length: ${userContent.length}`)
    console.log(`[TASK-DEBUG] About to call recursivelyMakeClineRequests`)
    console.log(`[TASK-DEBUG] Abort flag: ${this.abort}`)
    // ... existing code
}
```

**Line 1432** - Before calling `apiHandler.recursivelyMakeClineRequests`:

```javascript
console.log(`[TASK-DEBUG] About to call apiHandler.recursivelyMakeClineRequests`)
console.log(`[TASK-DEBUG] Abort flag before API call: ${this.abort}`)
return this.apiHandler.recursivelyMakeClineRequests(
    // ... existing parameters
```

### 2. TaskLifecycle.ts - Task Lifecycle Management

**File**: `src/core/task/TaskLifecycle.ts`

**Line 68-77** - `initiateTaskLoop` callback:

```javascript
if (initiateTaskLoop) {
	this.log(`[LIFECYCLE-DEBUG] Calling initiateTaskLoop...`)
	console.log(`[LIFECYCLE-DEBUG] About to call initiateTaskLoop with userContent:`, userContent)
	try {
		await initiateTaskLoop([
			{
				type: "text",
				text: `<task>\n${task}\n</task>`,
			},
			...imageBlocks,
		])
		console.log(`[LIFECYCLE-DEBUG] initiateTaskLoop completed successfully`)
	} catch (error) {
		console.error(`[LIFECYCLE-DEBUG] Error in initiateTaskLoop:`, error)
		// ... existing error handling
	}
}
```

### 3. TaskApiHandler.ts - API Handler

**File**: `src/core/task/TaskApiHandler.ts`

Find the `recursivelyMakeClineRequests` method and add logging at the start:

```javascript
async recursivelyMakeClineRequests(...) {
    console.log(`[API-HANDLER-DEBUG] recursivelyMakeClineRequests() called`)
    console.log(`[API-HANDLER-DEBUG] User content:`, userContent)
    console.log(`[API-HANDLER-DEBUG] Include file details:`, includeFileDetails)
    console.log(`[API-HANDLER-DEBUG] About to make LLM request`)

    // Add logging before any early returns or completions
    // ... existing method logic
}
```

### 4. Task Event Emissions

**File**: `src/core/task/Task.ts`

**Line 1443** - Where `taskCompleted` is emitted:

```javascript
;(taskId, tokenUsage, toolUsage) => {
	console.log(`[TASK-DEBUG] taskCompleted event about to be emitted`)
	console.log(`[TASK-DEBUG] TaskId: ${taskId}`)
	console.log(`[TASK-DEBUG] Token usage:`, tokenUsage)
	console.log(`[TASK-DEBUG] Tool usage:`, toolUsage)
	console.log(`[TASK-DEBUG] Stack trace:`, new Error().stack)
	this.emit("taskCompleted", taskId, tokenUsage, toolUsage)
}
```

### 5. TaskExecutionOrchestrator.ts - Orchestrator Events

**File**: `src/core/task/execution/TaskExecutionOrchestrator.ts`

**Line 352-355** - Standard task completion handler:

```javascript
task.on("taskCompleted", (tid: string, tokenUsage: any, toolUsage: any) => {
    handler.logDebug(`[ORCHESTRATOR-DEBUG] Standard task completed: ${tid}`)
    console.log(`[ORCHESTRATOR-DEBUG] Task completed with tokens:`, tokenUsage)
    console.log(`[ORCHESTRATOR-DEBUG] Task completed with tools:`, toolUsage)
    console.log(`[ORCHESTRATOR-DEBUG] Calling complete() with "Standard task completion"`)
    complete("Standard task completion")
})
```

### 6. API Configuration Validation

**File**: `src/api/server/FastifyServer.ts`

**After line 297** - API configuration loading:

```javascript
console.log(`[API-CONFIG-DEBUG] API configuration loaded:`, {
	provider: apiConfiguration.apiProvider,
	hasApiKey: !!apiConfiguration.apiKey,
	model: apiConfiguration.apiModelId,
	keyPrefix: apiConfiguration.apiKey?.substring(0, 10),
})
```

### 7. Custom Mode Validation

**File**: `src/api/server/FastifyServer.ts`

**After line 197** - Mode validation:

```javascript
console.log(`[MODE-DEBUG] Custom mode validation result:`, {
	requested: mode,
	selected: selectedMode.slug,
	name: selectedMode.name,
	isCustomMode: selectedMode.isCustom || false,
})
```

## Logging Strategy

### Phase 1: Basic Flow Tracking

Add logging to track the basic execution flow:

1. Task creation
2. Task startup
3. Task loop initiation
4. API handler call
5. Task completion

### Phase 2: Detailed State Tracking

Add logging to track:

1. Abort flag status at each step
2. API configuration validation
3. Mode-specific behavior
4. Token usage tracking

### Phase 3: Error Condition Detection

Add logging to detect:

1. Early returns or exits
2. Exception handling
3. Configuration issues
4. Mode-specific problems

## Expected Output

With this logging, we should see exactly where the execution stops and why the task completes without calling the LLM. The logs will show:

1. **If task starts properly**: Lifecycle and initiation logs
2. **If API handler is called**: API handler entry logs
3. **If LLM request is made**: Token usage logs
4. **Why task completes**: Completion event logs with stack trace

This will pinpoint the exact location where the execution flow breaks.
