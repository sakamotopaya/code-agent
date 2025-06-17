# CLI Hanging Fix - Revised Plan (Leverage Existing Cleanup)

## Overview

**Problem:** CLI hangs for 10 seconds after completing tasks in batch mode when processing queries like "list your mcp servers" that trigger LLM tool execution.

**Root Cause:** Child processes spawned by `execute_command` tools are not being cleaned up properly, leaving active handles that prevent Node.js event loop exit.

**Solution:** Leverage existing cleanup mechanisms from the original VSCode extension instead of modifying shared code.

## Existing Cleanup Mechanisms (Already Available)

### 1. TerminalRegistry.cleanup()

- Already exists and called in `extension.ts` during VSCode deactivation
- Cleans up shell integration temporary directories
- Disposes terminal event listeners

### 2. TerminalRegistry.releaseTerminalsForTask(taskId)

- Already exists and called in `Task.dispose()`
- Releases terminals associated with a specific task
- Clears taskId references

### 3. Task.dispose()

- Already exists with comprehensive cleanup:
    - `TerminalRegistry.releaseTerminalsForTask(this.taskId)`
    - `this.browserSession.closeBrowser()`
    - `this.rooIgnoreController?.dispose()`
    - `this.fileContextTracker.dispose()`

## Revised Solution: Integrate Existing Cleanup into CleanupManager

### Story 1: Add Terminal Cleanup to CleanupManager

**As a** CLI user  
**I want** the CLI to properly cleanup terminal processes using existing mechanisms  
**So that** no active handles remain after task completion

**Acceptance Criteria:**

- [ ] CleanupManager calls `TerminalRegistry.cleanup()` during shutdown
- [ ] Task disposal is properly awaited before process exit
- [ ] CLI exits within 1 second of task completion

**Technical Implementation:**

```typescript
// In CleanupManager.ts - Add new cleanup method
private async cleanupTerminalResources(): Promise<void> {
    const debugTimer = DebugTimer.getInstance()
    debugTimer.debug("[CleanupManager] Starting terminal cleanup using existing mechanisms...")

    try {
        // Use existing TerminalRegistry cleanup (same as VSCode extension deactivation)
        const { TerminalRegistry } = await import('../../integrations/terminal/TerminalRegistry')
        TerminalRegistry.cleanup()

        debugTimer.debug("[CleanupManager] TerminalRegistry cleanup completed")
    } catch (error) {
        debugTimer.debug(`[CleanupManager] Terminal cleanup error: ${error}`)
    }
}

// Update cleanup sequence in performShutdown()
private async performCleanup(): Promise<void> {
    // 1. Terminal cleanup (NEW - using existing mechanisms)
    await this.cleanupTerminalResources()

    // 2. MCP services (existing)
    await this.cleanupMcpServices()

    // 3. Other cleanup tasks...
}
```

### Story 2: Ensure Task.dispose() is Called Before Exit

**As a** CLI system  
**I want** Task instances to be properly disposed using existing disposal methods  
**So that** all task-related resources are cleaned up

**Acceptance Criteria:**

- [ ] Task disposal is registered as cleanup task during task execution
- [ ] Task.dispose() is called before TerminalRegistry.cleanup()
- [ ] All task-associated terminals are released via existing mechanisms

**Technical Implementation:**

```typescript
// In batch.ts or task execution - Register task disposal as cleanup task
private async executeTaskWithCleanup(task: Task): Promise<any> {
    // Register task cleanup using existing Task.dispose() method
    const cleanupManager = CleanupManager.getInstance()

    cleanupManager.registerCleanupTask(async () => {
        try {
            debugTimer.debug(`[CleanupManager] Disposing task ${task.taskId} using existing Task.dispose()`)
            await task.dispose() // This already calls TerminalRegistry.releaseTerminalsForTask()
            debugTimer.debug(`[CleanupManager] Task ${task.taskId} disposed successfully`)
        } catch (error) {
            debugTimer.debug(`[CleanupManager] Task disposal error: ${error}`)
        }
    })

    // Execute task normally
    return await task.execute()
}
```

### Story 3: Add Process Handle Diagnostics (Non-Intrusive)

**As a** CLI developer  
**I want** visibility into remaining active handles after cleanup  
**So that** I can verify cleanup effectiveness and debug future issues

**Acceptance Criteria:**

- [ ] Enhanced diagnostic logging shows handle cleanup progress
- [ ] Before/after handle counts are logged
- [ ] No modifications to shared terminal/process code

**Technical Implementation:**

```typescript
// In CleanupManager.ts - Enhanced diagnostics without modifying core code
private logActiveHandles(stage: string): void {
    const debugTimer = DebugTimer.getInstance()

    try {
        const activeHandles = (process as any)._getActiveHandles?.() || []
        const activeRequests = (process as any)._getActiveRequests?.() || []

        debugTimer.debug(`[CleanupManager] ${stage} - Active handles: ${activeHandles.length}, Active requests: ${activeRequests.length}`)

        // Log handle types for debugging (non-intrusive)
        const handleTypes = activeHandles.map(handle => handle.constructor.name)
        const handleCounts = handleTypes.reduce((acc, type) => {
            acc[type] = (acc[type] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        if (Object.keys(handleCounts).length > 0) {
            debugTimer.debug(`[CleanupManager] ${stage} - Handle types:`, JSON.stringify(handleCounts))
        }
    } catch (error) {
        debugTimer.debug(`[CleanupManager] Handle diagnostic error: ${error}`)
    }
}

// Use in cleanup sequence
private async performCleanup(): Promise<void> {
    this.logActiveHandles("Before cleanup")

    // ... existing cleanup tasks

    this.logActiveHandles("After cleanup")
}
```

### Story 4: Simple Query Prevention (CLI-Specific)

**As a** CLI user asking simple questions  
**I want** queries like "list your mcp servers" to get direct responses  
**So that** no unnecessary terminal processes are spawned

**Acceptance Criteria:**

- [ ] Simple MCP queries bypass LLM tool execution
- [ ] Direct responses are faster and don't spawn child processes
- [ ] Complex queries still use full LLM capabilities
- [ ] Only CLI-specific code is modified (no shared code changes)

**Technical Implementation:**

```typescript
// In batch.ts - Add simple query detection (CLI-specific)
private async handleSimpleQueries(message: string): Promise<string | null> {
    const debugTimer = DebugTimer.getInstance()

    // Simple patterns that don't need LLM tool execution
    const simplePatterns = [
        {
            pattern: /list.*mcp.*server/i,
            handler: () => this.listMcpServersDirectly()
        },
        {
            pattern: /what.*mcp.*(available|do you have)/i,
            handler: () => this.listMcpServersDirectly()
        }
    ]

    for (const { pattern, handler } of simplePatterns) {
        if (pattern.test(message)) {
            debugTimer.debug("[BatchProcessor] Handling simple query directly (no tool execution)")
            return await handler()
        }
    }

    return null // Not a simple query, use full LLM processing
}

private async listMcpServersDirectly(): Promise<string> {
    try {
        const globalMcpService = GlobalCLIMcpService.getInstance()
        const servers = await globalMcpService.listConnectedServers()

        if (servers.length === 0) {
            return "No MCP servers are currently connected."
        }

        return servers.map(server =>
            `- ${server.name}: ${server.tools?.length || 0} tools, ${server.resources?.length || 0} resources`
        ).join('\n')
    } catch (error) {
        return `Error listing MCP servers: ${error}`
    }
}

// Update main message processing
private async processMessage(message: string): Promise<void> {
    // Try simple query first
    const simpleResponse = await this.handleSimpleQueries(message)
    if (simpleResponse) {
        console.log(simpleResponse)
        return
    }

    // Fall back to full LLM processing
    return this.processWithLLM(message)
}
```

## Implementation Priority

1. **Story 1** (Critical) - Add TerminalRegistry.cleanup() to CleanupManager
2. **Story 2** (Critical) - Ensure Task.dispose() is called properly
3. **Story 4** (High) - Simple query prevention for common cases
4. **Story 3** (Medium) - Enhanced diagnostics

## Key Benefits of This Approach

✅ **No modifications to shared VSCode extension code**  
✅ **Leverages existing, proven cleanup mechanisms**  
✅ **Uses same cleanup path as VSCode extension deactivation**  
✅ **CLI-specific optimizations only**  
✅ **Maintains compatibility with future extension updates**

## Expected Results

- CLI exits within 1 second of completion
- No active ChildProcess or Socket handles after cleanup
- Simple MCP queries avoid spawning any child processes
- Diagnostic logs confirm successful cleanup using existing mechanisms
