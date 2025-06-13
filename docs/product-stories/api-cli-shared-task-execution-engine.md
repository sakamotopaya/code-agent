# API/CLI Shared Task Execution Engine

## Problem Statement

The API and CLI currently have completely different task execution implementations, with the API missing critical task lifecycle management that the CLI has. This causes the API to create Task instances but not properly execute them, leading to tasks that appear to hang without any actual processing.

**Current State:**

- **CLI**: Has sophisticated task execution with completion detection, event handling, timeouts, and proper cleanup in `BatchProcessor.executeTaskWithCompletionDetection()`
- **API**: Simply creates a Task instance and waits on the promise with no event handling or lifecycle management
- **Result**: API tasks don't actually execute the task loop, leading to hanging behavior

**Evidence from Logs:**

- CLI shows detailed task lifecycle: `[TaskLifecycle] Starting task`, `[Task] Initiating task loop`, `[BatchProcessor] executeTaskWithCompletionDetection`
- API shows only: `Task.create() completed`, `Started job`, then nothing - no task loop initiation

## Root Cause Analysis

The [`Task.create()`](src/core/task/Task.ts:592) method creates a Task instance and returns a promise, but the promise only represents the initial task setup, not the complete execution. The actual task execution requires:

1. **Event Handling**: Listening for `taskCompleted`, `taskAborted`, `message` events
2. **Completion Detection**: Detecting when informational queries are complete
3. **Timeout Management**: Emergency timeouts and query-specific timeouts
4. **Resource Cleanup**: Proper disposal of Task resources
5. **Response Monitoring**: For informational queries, detecting when responses are complete

The CLI's [`BatchProcessor.executeTaskWithCompletionDetection()`](src/cli/commands/batch.ts:274) implements all of this, while the API has none of it.

## Solution: Extract Shared Task Execution Orchestrator

### Architecture Overview

```mermaid
graph TB
    subgraph "Current State"
        CLI1[CLI BatchProcessor] --> TaskExec1[executeTaskWithCompletionDetection]
        API1[API FastifyServer] --> TaskCreate1[Task.create() + wait promise]
        TaskExec1 --> Task1[Task Instance]
        TaskCreate1 --> Task2[Task Instance]
    end

    subgraph "Proposed State"
        CLI2[CLI BatchProcessor] --> SharedOrch[TaskExecutionOrchestrator]
        API2[API FastifyServer] --> SharedOrch
        SharedOrch --> Task3[Task Instance]
        SharedOrch --> EventHandling[Event Handling]
        SharedOrch --> TimeoutMgmt[Timeout Management]
        SharedOrch --> CompletionDetection[Completion Detection]
        SharedOrch --> Cleanup[Resource Cleanup]
    end
```

### Implementation Plan

#### Phase 1: Extract Core Execution Logic

**Story 1.1: Create TaskExecutionOrchestrator**

- Extract [`executeTaskWithCompletionDetection`](src/cli/commands/batch.ts:274) logic from CLI BatchProcessor
- Create `src/core/task/TaskExecutionOrchestrator.ts`
- Abstract output/interaction handlers via interfaces
- Maintain all existing completion detection and timeout logic

**Story 1.2: Create Execution Interfaces**

- `ITaskExecutionHandler` interface for output/interaction
- `TaskExecutionOptions` for timeout and completion settings
- `TaskExecutionResult` for standardized results

#### Phase 2: API Integration

**Story 2.1: Implement API Task Execution Handler**

- Create `ApiTaskExecutionHandler` that implements `ITaskExecutionHandler`
- Integrate with SSE streaming for real-time output
- Handle user interactions via SSE question/response flow
- Map Task events to SSE events

**Story 2.2: Update API FastifyServer**

- Replace current task promise waiting with `TaskExecutionOrchestrator`
- Remove custom timeout/monitoring code (use orchestrator's)
- Ensure proper resource cleanup on client disconnect

#### Phase 3: CLI Migration

**Story 3.1: Implement CLI Task Execution Handler**

- Create `CliTaskExecutionHandler` that implements `ITaskExecutionHandler`
- Maintain current console output behavior
- Handle user interactions via CLI prompts

**Story 3.2: Update CLI BatchProcessor**

- Replace `executeTaskWithCompletionDetection` with `TaskExecutionOrchestrator`
- Remove duplicated logic
- Ensure backward compatibility

#### Phase 4: Testing & Validation

**Story 4.1: Integration Testing**

- Verify API now properly executes tasks (shows task loop initiation)
- Verify CLI maintains existing behavior
- Test timeout and completion detection in both contexts

**Story 4.2: Performance & Reliability**

- Ensure no performance regression
- Test resource cleanup under various scenarios
- Validate event handling consistency

### Key Components

#### TaskExecutionOrchestrator

```typescript
class TaskExecutionOrchestrator {
	async executeTask(
		task: Task,
		taskPromise: Promise<void>,
		handler: ITaskExecutionHandler,
		options: TaskExecutionOptions,
	): Promise<TaskExecutionResult>

	private setupEventHandlers(task: Task, handler: ITaskExecutionHandler)
	private setupTimeouts(options: TaskExecutionOptions)
	private setupCompletionDetection(task: Task, isInfoQuery: boolean)
	private cleanup(task: Task)
}
```

#### ITaskExecutionHandler

```typescript
interface ITaskExecutionHandler {
	onTaskStarted(taskId: string): Promise<void>
	onTaskCompleted(taskId: string, result: string): Promise<void>
	onTaskFailed(taskId: string, error: Error): Promise<void>
	onTaskMessage(message: any): Promise<void>
	onTaskProgress(progress: number, message: string): Promise<void>
}
```

### Benefits

1. **Consistency**: Both API and CLI use identical task execution logic
2. **Maintainability**: Single source of truth for task lifecycle management
3. **Reliability**: Proven CLI logic extends to API
4. **Feature Parity**: API gains all CLI completion detection and timeout features
5. **Testability**: Shared logic can be thoroughly tested once

### Migration Strategy

1. **Phase 1**: Extract and test orchestrator in isolation
2. **Phase 2**: Integrate with API first (high impact, easier to test)
3. **Phase 3**: Migrate CLI (lower risk, maintains compatibility)
4. **Phase 4**: Remove duplicate code and optimize

### Success Criteria

- API logs show same detailed task execution as CLI: `[Task] Initiating task loop`, event handling, completion detection
- Both API and CLI can execute the test query "list your MCP servers" successfully
- No performance regression in either interface
- Consistent behavior between CLI batch mode and API streaming mode
- Proper resource cleanup and timeout handling in both contexts

## Technical Details

### Current CLI Flow (Working)

1. `Task.create()` → returns [instance, promise]
2. `BatchProcessor.executeTaskWithCompletionDetection()` → sets up event handlers
3. Task events (`taskCompleted`, `message`) → trigger completion logic
4. `task.dispose()` → cleanup

### Current API Flow (Broken)

1. `Task.create()` → returns [instance, promise]
2. Wait on promise directly → **missing event handling**
3. No completion detection → **tasks appear to hang**
4. No proper cleanup → **resource leaks**

### Proposed Shared Flow

1. `Task.create()` → returns [instance, promise]
2. `TaskExecutionOrchestrator.executeTask()` → unified event handling
3. Handler-specific output (console vs SSE) → **abstracted interface**
4. Consistent completion detection and cleanup → **shared logic**

This approach reuses the existing, proven task execution logic rather than creating duplicate implementations.
