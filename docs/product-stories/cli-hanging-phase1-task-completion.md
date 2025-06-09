# CLI Hanging Fix - Phase 1: Task Completion Enhancement

## Overview

Enhance task completion detection in BatchProcessor to properly identify when simple Q&A tasks are complete, reducing reliance on event-driven completion for information queries.

## Problem Statement

The current BatchProcessor waits for `taskCompleted` or `taskAborted` events that may not fire for simple information queries like "what MCP servers do you have available?". This causes the CLI to hang even though a complete response has been generated.

## Current Behavior

- BatchProcessor sets up complex event handlers waiting for task completion events
- Simple Q&A responses generate answers but don't trigger completion events
- Sliding timeout logic doesn't handle non-tool responses correctly
- Process hangs indefinitely waiting for events that never come

## Target Files

- `src/cli/commands/batch.ts` (primary changes)

## Implementation Details

### 1. Response-Based Completion Detection

Add logic to detect when a meaningful response has been generated for information queries:

```typescript
private detectResponseCompletion(response: string): boolean {
    // Detect complete responses for information queries
    const informationIndicators = [
        'available mcp servers',
        'connected mcp servers',
        'no mcp servers',
        'i have access to',
        'mcp servers:',
        'the following mcp servers',
        'these servers provide'
    ];

    const lowerResponse = response.toLowerCase();
    return informationIndicators.some(indicator =>
        lowerResponse.includes(indicator)
    );
}

private isInformationalQuery(taskDescription: string): boolean {
    const infoPatterns = [
        /what.*(mcp|servers?).*(available|do you have)/i,
        /list.*(mcp|servers?)/i,
        /which.*(mcp|servers?)/i,
        /show.*(mcp|servers?)/i,
        /tell me about.*(mcp|servers?)/i
    ];

    return infoPatterns.some(pattern => pattern.test(taskDescription));
}
```

### 2. Enhanced Message Event Handling

Improve message event handling to capture response content and detect completion:

```typescript
private setupResponseCompletionDetection(task: Task): void {
    let responseBuffer = '';
    let lastResponseTime = Date.now();
    let responseCompletionTimer: NodeJS.Timeout | null = null;

    task.on('message', (event: any) => {
        this.logDebug(`[BatchProcessor] Message event: ${event.action}`);

        // Capture response content
        if (event.action === 'response' || event.action === 'say') {
            const content = event.message?.text || event.content || '';
            responseBuffer += content;
            lastResponseTime = Date.now();

            // Clear existing timer
            if (responseCompletionTimer) {
                clearTimeout(responseCompletionTimer);
            }

            // Check for immediate completion indicators
            if (this.detectResponseCompletion(responseBuffer)) {
                this.logDebug('[BatchProcessor] Response completion detected immediately');
                responseCompletionTimer = setTimeout(() => {
                    this.completeTaskWithResponse('Response completion detected');
                }, 1000); // 1 second delay to ensure response is complete
            } else {
                // Set timer for response completion detection
                responseCompletionTimer = setTimeout(() => {
                    const timeSinceLastResponse = Date.now() - lastResponseTime;
                    if (timeSinceLastResponse >= 2000 && responseBuffer.length > 50) {
                        this.logDebug('[BatchProcessor] Response completion by timeout and content length');
                        this.completeTaskWithResponse('Response timeout completion');
                    }
                }, 3000); // 3 seconds of no new content
            }
        }
    });
}
```

### 3. Task Type-Aware Execution

Modify the execution logic to handle informational queries differently:

```typescript
async run(taskDescription: string): Promise<void> {
    try {
        this.logDebug("[BatchProcessor] Starting batch mode...");

        // Detect if this is an informational query
        const isInfoQuery = this.isInformationalQuery(taskDescription);
        this.logDebug(`[BatchProcessor] Task type - Informational query: ${isInfoQuery}`);

        // ... existing setup code ...

        // Execute the task with type-aware handling
        await this.executeTaskWithCompletionDetection(task, taskPromise, isInfoQuery);

        this.logDebug("[BatchProcessor] Task completed successfully");
    } catch (error) {
        // ... existing error handling ...
    }
}

private async executeTaskWithCompletionDetection(
    task: Task,
    taskPromise: Promise<void>,
    isInfoQuery: boolean
): Promise<void> {
    return new Promise((resolve, reject) => {
        let isCompleted = false;

        const completeOnce = (reason: string) => {
            if (isCompleted) return;
            isCompleted = true;

            this.logDebug(`[BatchProcessor] Task completing: ${reason}`);
            resolve();
        };

        // Set up response completion detection for info queries
        if (isInfoQuery) {
            this.setupResponseCompletionDetection(task);
            // Shorter timeout for info queries
            setTimeout(() => {
                completeOnce('Information query timeout');
            }, 30000); // 30 seconds max for info queries
        }

        // Set up standard event handlers
        this.setupStandardEventHandlers(task, completeOnce, reject);

        // Handle task promise
        taskPromise.catch((error) => {
            this.logDebug(`[BatchProcessor] Task promise rejected:`, error);
            if (!isCompleted) {
                reject(error);
            }
        });
    });
}
```

### 4. Completion Handler Consolidation

Create a unified completion handler to avoid race conditions:

```typescript
private completeTaskWithResponse(reason: string): void {
    this.logDebug(`[BatchProcessor] Triggering completion: ${reason}`);

    // Emit completion event that the event handlers will catch
    if (this.currentTask) {
        this.currentTask.emit('taskCompleted', this.currentTask.taskId, {}, {});
    }
}

private setupStandardEventHandlers(
    task: Task,
    completeCallback: (reason: string) => void,
    rejectCallback: (error: Error) => void
): void {
    // Store reference for completion triggering
    this.currentTask = task;

    task.on("taskCompleted", async (taskId: string, tokenUsage: any, toolUsage: any) => {
        this.logDebug(`[BatchProcessor] Task completed: ${taskId}`);

        // Cleanup
        try {
            if (typeof task.dispose === "function") {
                await task.dispose();
            }
        } catch (error) {
            this.logDebug("[BatchProcessor] Error during cleanup:", error);
        }

        completeCallback('Standard task completion');
    });

    task.on("taskAborted", async () => {
        this.logDebug("[BatchProcessor] Task was aborted");

        // Cleanup
        try {
            if (typeof task.dispose === "function") {
                await task.dispose();
            }
        } catch (error) {
            this.logDebug("[BatchProcessor] Error during cleanup:", error);
        }

        rejectCallback(new Error("Task was aborted"));
    });

    // Keep existing event handlers for activity detection
    this.setupActivityEventHandlers(task);
}
```

### 5. Simplified Timeout Logic

Replace complex sliding timeout with simpler, type-aware timeouts:

```typescript
private setupActivityEventHandlers(task: Task): void {
    // Simplified activity tracking without complex timeout logic
    task.on("taskStarted", () => {
        this.logDebug("[BatchProcessor] Task started");
    });

    task.on("taskModeSwitched", (taskId: string, mode: string) => {
        this.logDebug(`[BatchProcessor] Task mode switched to: ${mode}`);
    });

    // Remove complex sliding timeout logic - let type-aware timeouts handle it
}
```

## Testing Requirements

### Unit Tests

- [ ] Test response completion detection with various MCP server response formats
- [ ] Test informational query detection with different question phrasings
- [ ] Test timeout behavior for both info queries and regular tasks
- [ ] Test completion handler race condition prevention

### Integration Tests

- [ ] Test the original hanging scenario: "what mcp servers do you have available?"
- [ ] Test other informational queries about MCP servers
- [ ] Test that regular tool-using tasks still work correctly
- [ ] Test error scenarios and proper cleanup

### Test Cases

```bash
# Information queries that should complete quickly
npm run start:cli -- --batch "what mcp servers do you have available?"
npm run start:cli -- --batch "list the connected MCP servers"
npm run start:cli -- --batch "which servers can I use?"

# Regular tasks that should use standard completion
npm run start:cli -- --batch "create a simple hello world script"
npm run start:cli -- --batch "read the package.json file"
```

## Acceptance Criteria

### Functional

- [ ] Information queries about MCP servers complete and exit within 10 seconds
- [ ] Response content is fully captured before completion
- [ ] Regular tool-using tasks continue to work as before
- [ ] No race conditions between completion detection methods

### Performance

- [ ] Information queries complete within 5 seconds typically
- [ ] No hanging behavior for any supported query types
- [ ] Memory usage remains stable during response capture

### Reliability

- [ ] 100% completion rate for information queries
- [ ] Graceful handling when response detection fails
- [ ] Proper cleanup in all completion scenarios

## Implementation Notes

### Key Changes

1. **Response Content Tracking**: Capture and analyze response content in real-time
2. **Query Type Detection**: Identify informational queries vs tool-using tasks
3. **Multiple Completion Triggers**: Response-based, timeout-based, and event-based
4. **Unified Completion**: Single completion handler prevents race conditions
5. **Simplified Timeouts**: Type-aware timeouts replace complex sliding logic

### Backwards Compatibility

- All existing functionality remains intact
- Regular tasks use existing event-driven completion
- Only informational queries get enhanced completion detection
- No breaking changes to Task or CLI interfaces

This phase focuses specifically on fixing the task completion detection issue while maintaining full compatibility with existing functionality.
