# API Task Cancellation Fix

## Problem Analysis

When a client running an API task presses Ctrl+C to cancel, the API server detects the client disconnect but the task continues running. This happens because:

1. **Client Disconnect Detection**: FastifyServer.ts correctly detects client disconnect (line 243-246) and calls `jobManager.cancelJob()`
2. **JobManager Cancellation**: JobManager.cancelJob() calls `abortController.abort()` and updates job status to cancelled
3. **Missing Connection**: The TaskExecutionOrchestrator running the actual task is never notified of the cancellation
4. **Task Continues**: The task keeps running because it doesn't know it should stop

## Root Cause

The JobManager creates an AbortController but doesn't connect it to the TaskExecutionOrchestrator. The orchestrator has a `cancelExecution` method, but it's never called when the client disconnects.

## Solution Architecture

### 1. Connect JobManager to TaskExecutionOrchestrator

**Current Flow:**

```
Client Disconnect → FastifyServer → JobManager.cancelJob() → AbortController.abort()
                                                           ↓
                                                    [DISCONNECTED]
                                                           ↓
                                            TaskExecutionOrchestrator (continues running)
```

**Fixed Flow:**

```
Client Disconnect → FastifyServer → JobManager.cancelJob() → AbortController.abort()
                                                           ↓
                                                    orchestrator.cancelExecution()
                                                           ↓
                                                    Task.abortTask() → cleanup
```

### 2. Implementation Plan

#### Phase 1: Connect JobManager to TaskExecutionOrchestrator

**File: `src/api/jobs/JobManager.ts`**

- Add reference to TaskExecutionOrchestrator in active jobs tracking
- Modify `cancelJob()` to call orchestrator's `cancelExecution()`
- Ensure proper cleanup of orchestrator references

**File: `src/api/server/FastifyServer.ts`**

- Pass TaskExecutionOrchestrator reference to JobManager
- Store orchestrator reference when starting jobs

#### Phase 2: Enhance TaskExecutionOrchestrator Cancellation

**File: `src/core/task/execution/TaskExecutionOrchestrator.ts`**

- Improve `cancelExecution()` method to handle AbortSignal
- Add proper cleanup of timers and resources
- Ensure task abortion propagates correctly

#### Phase 3: AbortSignal Integration

**File: `src/core/task/Task.ts`**

- Add AbortSignal support to task execution loop
- Check abort signal in critical execution points
- Ensure graceful shutdown when aborted

#### Phase 4: Testing and Validation

- Add unit tests for cancellation flow
- Add integration tests for API cancellation
- Test edge cases (cancellation during tool execution, etc.)

## Detailed Implementation

### 1. JobManager Enhancement

```typescript
// src/api/jobs/JobManager.ts
export class JobManager {
	private activeJobs = new Map<
		string,
		{
			task: Task
			abortController: AbortController
			orchestrator?: TaskExecutionOrchestrator // Add orchestrator reference
		}
	>()

	// Modify startJob to accept orchestrator reference
	async startJob(jobId: string, taskInstance: Task, orchestrator?: TaskExecutionOrchestrator): Promise<void> {
		// ... existing code ...

		this.activeJobs.set(jobId, {
			task: taskInstance,
			abortController,
			orchestrator, // Store orchestrator reference
		})

		// ... rest of method ...
	}

	// Enhance cancelJob to notify orchestrator
	cancelJob(jobId: string, reason?: string): boolean {
		const job = this.store.get(jobId)
		const activeJob = this.activeJobs.get(jobId)

		if (!job || !activeJob) {
			return false
		}

		// Cancel via orchestrator if available
		if (activeJob.orchestrator) {
			activeJob.orchestrator.cancelExecution(jobId, reason || "Job cancelled").catch((error) => {
				this.logger.error(`Error cancelling orchestrator execution:`, error)
			})
		}

		// Existing abort controller logic
		activeJob.abortController.abort()
		this.activeJobs.delete(jobId)

		// ... rest of existing logic ...
	}
}
```

### 2. FastifyServer Integration

```typescript
// src/api/server/FastifyServer.ts
// In /execute/stream endpoint, around line 362:

// Store orchestrator reference in job tracking
await this.jobManager.startJob(job.id, taskInstance, this.taskExecutionOrchestrator)

// The orchestrator execution should now be cancellable
this.taskExecutionOrchestrator
	.executeTask(taskInstance, taskPromise, executionHandler, executionOptions)
	.then(async (result) => {
		// ... existing completion logic ...
	})
	.catch(async (error: any) => {
		// Handle cancellation gracefully
		if (error.message.includes("cancelled") || error.message.includes("aborted")) {
			this.app.log.info(`Task execution cancelled for job ${job.id}`)
		} else {
			this.app.log.error(`Task execution failed for job ${job.id}:`, error)
		}
		// ... existing error handling ...
	})
```

### 3. TaskExecutionOrchestrator Enhancement

```typescript
// src/core/task/execution/TaskExecutionOrchestrator.ts
export class TaskExecutionOrchestrator {
	// Enhance cancelExecution method
	async cancelExecution(taskId: string, reason: string = "Cancelled"): Promise<boolean> {
		const state = this.activeExecutions.get(taskId)
		if (!state) {
			return false
		}

		state.handler.logDebug(`[TaskExecutionOrchestrator] Cancelling execution ${taskId}: ${reason}`)

		try {
			// Mark as completed to prevent further processing
			state.isCompleted = true

			// Clear all timers
			this.clearAllTimers(state)

			// Abort the task if possible
			if (typeof state.task.abortTask === "function") {
				await state.task.abortTask()
			}

			// Clean up execution state
			this.cleanup(state)
			this.activeExecutions.delete(taskId)

			// Notify handler of cancellation
			await state.handler.onTaskFailed(taskId, new Error(reason))
			return true
		} catch (error) {
			state.handler.logDebug(`[TaskExecutionOrchestrator] Error cancelling execution:`, error)
			return false
		}
	}

	// Add method to check if execution can be cancelled
	canCancelExecution(taskId: string): boolean {
		return this.activeExecutions.has(taskId)
	}

	// Add method to get execution status
	getExecutionStatus(taskId: string): "running" | "completed" | "not-found" {
		const state = this.activeExecutions.get(taskId)
		if (!state) return "not-found"
		return state.isCompleted ? "completed" : "running"
	}
}
```

### 4. Task AbortSignal Integration

```typescript
// src/core/task/Task.ts
export class Task extends EventEmitter {
	private abortSignal?: AbortSignal

	// Add method to set abort signal
	setAbortSignal(signal: AbortSignal): void {
		this.abortSignal = signal

		// Listen for abort events
		signal.addEventListener("abort", () => {
			this.abortTask().catch((error) => {
				this.logger?.error("Error during abort:", error)
			})
		})
	}

	// Check abort signal in critical execution points
	private checkAbortSignal(): void {
		if (this.abortSignal?.aborted || this.abort) {
			throw new Error("Task execution aborted")
		}
	}

	// Modify task execution loop to check abort signal
	private async executeTask(): Promise<void> {
		while (!this.abort && !this.abortSignal?.aborted) {
			this.checkAbortSignal()

			// ... existing task execution logic ...

			// Check abort signal between major operations
			this.checkAbortSignal()
		}
	}
}
```

## Testing Strategy

### 1. Unit Tests

**File: `src/api/jobs/__tests__/JobManager.cancellation.test.ts`**

```typescript
describe("JobManager Cancellation", () => {
	it("should cancel orchestrator execution when job is cancelled", async () => {
		// Test orchestrator.cancelExecution is called
	})

	it("should handle cancellation when orchestrator is not available", async () => {
		// Test fallback behavior
	})

	it("should clean up resources properly on cancellation", async () => {
		// Test resource cleanup
	})
})
```

**File: `src/core/task/execution/__tests__/TaskExecutionOrchestrator.cancellation.test.ts`**

```typescript
describe("TaskExecutionOrchestrator Cancellation", () => {
	it("should cancel running execution", async () => {
		// Test cancelExecution method
	})

	it("should clean up timers on cancellation", async () => {
		// Test timer cleanup
	})

	it("should abort task on cancellation", async () => {
		// Test task.abortTask is called
	})
})
```

### 2. Integration Tests

**File: `src/api/__tests__/cancellation.integration.test.ts`**

```typescript
describe("API Task Cancellation Integration", () => {
	it("should cancel task when client disconnects", async () => {
		// Start API task
		// Simulate client disconnect
		// Verify task is cancelled
		// Verify resources are cleaned up
	})

	it("should handle cancellation during tool execution", async () => {
		// Test cancellation during various tool operations
	})

	it("should send proper SSE events on cancellation", async () => {
		// Test SSE stream behavior during cancellation
	})
})
```

### 3. Manual Testing

1. **Basic Cancellation Test**

    - Start API task: `./api-client.js --stream "create a large file"`
    - Press Ctrl+C during execution
    - Verify task stops immediately
    - Check server logs for proper cancellation

2. **Tool Execution Cancellation**

    - Start task that uses tools (file operations, commands)
    - Cancel during tool execution
    - Verify tools are properly interrupted

3. **Long-running Task Cancellation**
    - Start task with long timeout
    - Cancel after significant time
    - Verify no resource leaks

## Implementation Order

1. **Phase 1**: JobManager and FastifyServer integration (connect orchestrator)
2. **Phase 2**: TaskExecutionOrchestrator cancellation enhancement
3. **Phase 3**: Task AbortSignal integration
4. **Phase 4**: Unit tests
5. **Phase 5**: Integration tests
6. **Phase 6**: Manual testing and validation

## Success Criteria

- [ ] Client Ctrl+C immediately stops API task execution
- [ ] Task resources are properly cleaned up on cancellation
- [ ] SSE stream sends appropriate cancellation events
- [ ] No memory leaks or hanging processes
- [ ] Cancellation works during all phases of task execution
- [ ] Unit and integration tests pass
- [ ] Manual testing confirms expected behavior

## Risk Mitigation

1. **Backward Compatibility**: Ensure existing API behavior is preserved
2. **Resource Cleanup**: Verify all resources (terminals, browsers, files) are properly cleaned up
3. **Error Handling**: Handle edge cases where cancellation fails
4. **Performance**: Ensure cancellation detection doesn't impact normal execution performance
5. **Race Conditions**: Handle concurrent cancellation requests properly

## Future Enhancements

1. **Graceful Cancellation**: Allow tasks to complete current operation before cancelling
2. **Cancellation Timeout**: Force-kill tasks that don't respond to cancellation within timeout
3. **Partial Results**: Return partial results when task is cancelled
4. **Cancellation Reasons**: Provide more detailed cancellation reasons to clients
