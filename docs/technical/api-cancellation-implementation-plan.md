# API Task Cancellation Implementation Plan

## Root Cause Analysis

Based on the test results and log analysis, the issue is a **race condition** between:

1. **Client Disconnect Detection**: FastifyServer detects disconnect and calls `jobManager.cancelJob(job.id)`
2. **Task Execution Start**: TaskExecutionOrchestrator starts tracking the execution asynchronously
3. **Timing Gap**: The cancellation happens before the orchestrator has registered the execution

## Key Findings from Logs

```
[STREAM-WRITE] ❌ Stream not found or inactive for job job_mctkbw0n_ff38d214
[WARN] Attempted to send event to inactive stream job_mctkbw0n_ff38d214
```

This shows the client disconnected, but the task continued processing:

```
[API-HANDLER-DEBUG] About to make LLM request
[API-HANDLER-DEBUG] Stream created, about to iterate
```

## Implementation Strategy

### 1. Fix Race Condition in FastifyServer

**Problem**: Client disconnect handler is set up before orchestrator execution starts
**Solution**: Ensure cancellation works regardless of timing

```typescript
// Current problematic flow:
reply.raw.on("close", () => {
    this.jobManager.cancelJob(job.id, "Client disconnected")  // May happen too early
})

// Start orchestrator execution (async)
this.taskExecutionOrchestrator.executeTask(...)
```

**Fix**: Add retry logic and better coordination

### 2. Enhance JobManager Cancellation

**File**: `src/api/jobs/JobManager.ts`

```typescript
cancelJob(jobId: string, reason?: string): boolean {
    // ... existing code ...

    // Enhanced orchestrator cancellation with retry
    if (activeJob.orchestrator) {
        // Try immediate cancellation
        activeJob.orchestrator.cancelExecution(jobId, reason || "Job cancelled")
            .catch(error => {
                this.logger.error(`Error cancelling orchestrator execution:`, error)
            })

        // Also set a flag for delayed cancellation if execution starts later
        this.markJobForCancellation(jobId, reason)
    }
}

private markJobForCancellation(jobId: string, reason: string) {
    // Store cancellation request for later processing
    this.pendingCancellations.set(jobId, reason)

    // Set timeout to retry cancellation
    setTimeout(() => {
        if (this.pendingCancellations.has(jobId)) {
            const activeJob = this.activeJobs.get(jobId)
            if (activeJob?.orchestrator) {
                activeJob.orchestrator.cancelExecution(jobId, reason)
                    .finally(() => {
                        this.pendingCancellations.delete(jobId)
                    })
            }
        }
    }, 1000) // Retry after 1 second
}
```

### 3. Improve TaskExecutionOrchestrator

**File**: `src/core/task/execution/TaskExecutionOrchestrator.ts`

```typescript
async executeTask(...): Promise<TaskExecutionResult> {
    const taskId = options.taskIdentifier || task.taskId || "unknown"

    // Check if this task was already marked for cancellation
    if (this.shouldCancelImmediately(taskId)) {
        throw new Error("Task cancelled before execution")
    }

    // Register execution immediately
    this.activeExecutions.set(taskId, state)

    // ... rest of execution logic
}

private shouldCancelImmediately(taskId: string): boolean {
    // Check with JobManager if this task should be cancelled
    // This handles the race condition case
}
```

### 4. Add Better Logging and Monitoring

**File**: `src/api/server/FastifyServer.ts`

```typescript
// Enhanced client disconnect handler
reply.raw.on("close", () => {
	console.log(`[FastifyServer] Client disconnected for job ${job.id}`)

	// Cancel job (with enhanced retry logic)
	const cancelled = this.jobManager.cancelJob(job.id, "Client disconnected")
	console.log(`[FastifyServer] Job cancellation result: ${cancelled}`)

	// Also try direct orchestrator cancellation as backup
	if (this.taskExecutionOrchestrator.canCancelExecution(job.id)) {
		this.taskExecutionOrchestrator.cancelExecution(job.id, "Client disconnected (direct)").then((result) => {
			console.log(`[FastifyServer] Direct orchestrator cancellation: ${result}`)
		})
	}

	this.streamManager.closeStream(job.id)
})
```

### 5. Add Cancellation State Tracking

**New Interface**: Track cancellation requests across components

```typescript
interface CancellationTracker {
	markForCancellation(taskId: string, reason: string): void
	isCancelled(taskId: string): boolean
	getCancellationReason(taskId: string): string | null
	clearCancellation(taskId: string): void
}
```

## Implementation Steps

### Phase 1: Immediate Fix (High Priority)

1. ✅ Add orchestrator reference to JobManager (DONE)
2. ✅ Enhance cancelExecution method (DONE)
3. 🔄 Fix race condition in FastifyServer
4. 🔄 Add retry logic to JobManager
5. 🔄 Add better logging

### Phase 2: Robust Solution (Medium Priority)

1. 🔄 Add cancellation state tracking
2. 🔄 Implement shouldCancelImmediately check
3. 🔄 Add comprehensive error handling
4. 🔄 Create integration tests

### Phase 3: Monitoring and Validation (Low Priority)

1. 🔄 Add metrics for cancellation success rate
2. 🔄 Add health checks for stuck tasks
3. 🔄 Performance monitoring

## Testing Strategy

### Manual Testing

```bash
# Start API server
./run-api.sh

# In another terminal, start a long-running task
./api-client.js --stream "create a large application with many files"

# Immediately press Ctrl+C
# Expected: Task should stop within 1-2 seconds
# Current: Task continues running
```

### Automated Testing

```typescript
describe('API Cancellation Integration', () => {
    it('should cancel task when client disconnects', async () => {
        // Start task
        const response = fetch('/execute/stream', { ... })

        // Simulate disconnect
        response.abort()

        // Verify task is cancelled
        expect(orchestrator.getActiveExecutionCount()).toBe(0)
    })
})
```

## Success Criteria

- [ ] Client Ctrl+C stops task execution within 2 seconds
- [ ] No memory leaks or hanging processes
- [ ] Proper cleanup of all resources (terminals, browsers, files)
- [ ] SSE stream sends cancellation events
- [ ] Works during all phases of task execution (startup, tool execution, LLM calls)
- [ ] Graceful handling of race conditions
- [ ] Comprehensive logging for debugging

## Risk Mitigation

1. **Backward Compatibility**: All changes are additive, existing functionality preserved
2. **Resource Cleanup**: Enhanced cleanup ensures no resource leaks
3. **Error Handling**: Multiple fallback mechanisms for cancellation
4. **Performance**: Minimal overhead added to normal execution
5. **Testing**: Comprehensive test coverage before deployment

## Next Steps

1. Switch to code mode
2. Implement Phase 1 fixes
3. Test manually with API server
4. Verify cancellation works in all scenarios
5. Add automated tests
6. Document the solution
