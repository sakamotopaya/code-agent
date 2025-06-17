# CLI Hanging Fix - Product Stories

## Overview

**Problem:** CLI hangs for 10 seconds after completing tasks in batch mode, specifically when processing queries like "list your mcp servers" that trigger LLM tool execution.

**Root Cause Analysis:**

- "list your mcp servers" is processed as an LLM task (not a simple command)
- LLM executes `execute_command` tools to gather system information
- Each `execute_command` spawns a fresh child process via `ExecaTerminalProcess`
- Terminal instances are reused, but child processes are always newly spawned
- Completed processes are stored in `completedProcesses[]` array for output retrieval
- These process references and their socket/stream handles prevent Node.js event loop exit
- CleanupManager diagnostics show "2 ChildProcess handles and 6 Socket handles" remain active

## Technical Context

### Process Lifecycle Flow

1. `executeCommandTool` → `TerminalRegistry.getOrCreateTerminal()`
2. Reuses existing `ExecaTerminal` instance (if available)
3. `ExecaTerminal.runCommand()` → creates NEW `ExecaTerminalProcess`
4. `ExecaTerminalProcess.run()` → spawns fresh child process via `execa()`
5. On completion → process moved to `terminal.completedProcesses[]` array
6. Process references kept alive for output retrieval

### Key Files

- `src/integrations/terminal/ExecaTerminalProcess.ts` - Spawns child processes
- `src/integrations/terminal/BaseTerminal.ts` - Manages `completedProcesses[]`
- `src/integrations/terminal/TerminalRegistry.ts` - Terminal lifecycle management
- `src/cli/services/CleanupManager.ts` - Process cleanup coordination

## Product Stories

### Story 1: Terminal Process Reference Cleanup

**As a** CLI user  
**I want** the CLI to exit immediately after task completion  
**So that** I don't experience 10-second hangs in batch mode

**Acceptance Criteria:**

- [ ] `completedProcesses[]` array is cleared during cleanup
- [ ] All process references are removed to allow garbage collection
- [ ] Terminal cleanup properly disposes of all process handles
- [ ] CLI exits immediately after showing completion message

**Technical Implementation:**

```typescript
// In BaseTerminal.ts
public forceCleanupAllProcesses(): void {
    // Clear active process
    if (this.process) {
        this.process.abort()
        this.process = undefined
    }

    // Clear completed processes array that holds references
    this.completedProcesses.forEach(process => {
        if (typeof process.forceCleanup === 'function') {
            process.forceCleanup()
        }
    })
    this.completedProcesses = []
}

// In TerminalRegistry.ts
public static async forceCleanupAllTerminals(): Promise<void> {
    const cleanupPromises = this.terminals.map(async (terminal) => {
        terminal.forceCleanupAllProcesses()
    })
    await Promise.all(cleanupPromises)
}
```

**Integration Points:**

- CleanupManager calls TerminalRegistry.forceCleanupAllTerminals()
- Add terminal cleanup before MCP cleanup in shutdown sequence

---

### Story 2: ExecaTerminalProcess Handle Cleanup

**As a** CLI developer  
**I want** ExecaTerminalProcess to properly clean up all handles and streams  
**So that** no child processes or sockets remain active after completion

**Acceptance Criteria:**

- [ ] `execa` subprocess and all streams are destroyed on cleanup
- [ ] Process tree killing includes all child processes
- [ ] Socket handles are explicitly closed
- [ ] Event listeners are removed to prevent memory leaks

**Technical Implementation:**

```typescript
// In ExecaTerminalProcess.ts
private subprocess?: ExecaChildProcess

public async forceCleanup(): Promise<void> {
    this.aborted = true

    if (this.subprocess) {
        try {
            // Kill process tree with escalating signals
            await this.killProcessTreeGracefully(this.subprocess.pid)

            // Destroy all streams explicitly
            this.subprocess.stdout?.destroy()
            this.subprocess.stderr?.destroy()
            this.subprocess.stdin?.destroy()

            // Remove all event listeners
            this.subprocess.removeAllListeners()

            // Force kill if still running
            this.subprocess.kill('SIGKILL')
        } catch (error) {
            console.error(`[ExecaTerminalProcess] Cleanup error:`, error)
        } finally {
            this.subprocess = undefined
        }
    }
}

private async killProcessTreeGracefully(pid: number): Promise<void> {
    return new Promise((resolve) => {
        psTree(pid, (err, children) => {
            if (!err) {
                const pids = children.map(p => parseInt(p.PID))
                pids.forEach(childPid => {
                    try {
                        process.kill(childPid, 'SIGTERM')
                    } catch (e) {
                        try {
                            process.kill(childPid, 'SIGKILL')
                        } catch (e2) {
                            // Process already dead
                        }
                    }
                })
            }

            // Kill main process
            try {
                process.kill(pid, 'SIGTERM')
                setTimeout(() => {
                    try {
                        process.kill(pid, 'SIGKILL')
                    } catch (e) {
                        // Process already dead
                    }
                    resolve()
                }, 1000)
            } catch (e) {
                resolve()
            }
        })
    })
}
```

---

### Story 3: Enhanced Cleanup Manager Integration

**As a** CLI system  
**I want** CleanupManager to properly coordinate terminal process cleanup  
**So that** all active handles are closed before process exit

**Acceptance Criteria:**

- [ ] Terminal process cleanup runs before MCP cleanup
- [ ] Cleanup includes both active and completed processes
- [ ] Diagnostic logging shows successful process cleanup
- [ ] Cleanup waits for graceful termination before forcing

**Technical Implementation:**

```typescript
// In CleanupManager.ts
private async cleanupTerminalProcesses(): Promise<void> {
    const debugTimer = DebugTimer.getInstance()
    debugTimer.debug("[CleanupManager] Starting terminal process cleanup...")

    try {
        // Import dynamically to avoid circular dependencies
        const { TerminalRegistry } = await import('../../integrations/terminal/TerminalRegistry')

        // Force cleanup all terminals and their processes
        await TerminalRegistry.forceCleanupAllTerminals()

        debugTimer.debug("[CleanupManager] Terminal process cleanup completed")
    } catch (error) {
        debugTimer.debug(`[CleanupManager] Terminal cleanup error: ${error}`)
    }
}

// Update cleanup sequence
private async performCleanup(): Promise<void> {
    // 1. Terminal processes (NEW - runs first)
    await this.cleanupTerminalProcesses()

    // 2. MCP services (existing)
    await this.cleanupMcpServices()

    // 3. Other cleanup...
}
```

---

### Story 4: Batch Mode Tool Execution Prevention

**As a** CLI user executing simple queries  
**I want** simple queries like "list your mcp servers" to get direct responses  
**So that** no unnecessary child processes are spawned

**Acceptance Criteria:**

- [ ] Simple queries bypass LLM tool execution
- [ ] MCP server listing returns direct response without spawning processes
- [ ] Complex queries still use full LLM capabilities
- [ ] Performance improvement for common batch operations

**Technical Implementation:**

```typescript
// In batch command processing
const SIMPLE_QUERIES = {
    'list.*mcp.*server': () => this.listMcpServersDirectly(),
    'what.*mcp.*available': () => this.listMcpServersDirectly(),
    'show.*mcp.*capabilities': () => this.showMcpCapabilities()
}

private async handleBatchMessage(message: string): Promise<void> {
    // Check for simple queries first
    for (const [pattern, handler] of Object.entries(SIMPLE_QUERIES)) {
        if (new RegExp(pattern, 'i').test(message)) {
            const response = await (handler as Function)()
            console.log(response)
            return
        }
    }

    // Fall back to full LLM processing
    return this.processWithLLM(message)
}

private async listMcpServersDirectly(): Promise<string> {
    const servers = await this.mcpService.listConnectedServers()
    return servers.map(server => `- ${server.name}: ${server.tools.length} tools`).join('\n')
}
```

---

### Story 5: Process Lifecycle Diagnostic Enhancement

**As a** CLI developer debugging process issues  
**I want** detailed logging of process lifecycle events  
**So that** I can identify future cleanup issues quickly

**Acceptance Criteria:**

- [ ] Process creation, completion, and cleanup events are logged
- [ ] PIDs and command details are tracked throughout lifecycle
- [ ] Cleanup attempts and results are logged with timing
- [ ] Remaining handle diagnostics show specific process sources

**Technical Implementation:**

```typescript
// Enhanced diagnostic logging
private static processLifecycleLog = new Map<number, ProcessLifecycle>()

interface ProcessLifecycle {
    pid: number
    command: string
    startTime: number
    endTime?: number
    cleanupAttempts: number
    cleanupSuccess?: boolean
}

// In ExecaTerminalProcess
public override async run(command: string) {
    const subprocess = execa(...)
    this.pid = subprocess.pid

    // Log process creation
    ExecaTerminalProcess.processLifecycleLog.set(this.pid!, {
        pid: this.pid!,
        command,
        startTime: Date.now(),
        cleanupAttempts: 0
    })

    debugTimer.debug(`[PROCESS_LIFECYCLE] Created PID ${this.pid} for: ${command}`)
    // ... existing code
}

public async forceCleanup(): Promise<void> {
    if (this.pid) {
        const lifecycle = ExecaTerminalProcess.processLifecycleLog.get(this.pid)
        if (lifecycle) {
            lifecycle.cleanupAttempts++
            lifecycle.endTime = Date.now()
        }

        debugTimer.debug(`[PROCESS_LIFECYCLE] Cleaning up PID ${this.pid} (attempt ${lifecycle?.cleanupAttempts})`)

        // ... cleanup code

        if (lifecycle) {
            lifecycle.cleanupSuccess = true
        }
        debugTimer.debug(`[PROCESS_LIFECYCLE] Cleanup completed for PID ${this.pid}`)
    }
}
```

## Implementation Priority

1. **Story 1 & 2** (High Priority) - Core cleanup mechanism
2. **Story 3** (High Priority) - CleanupManager integration
3. **Story 4** (Medium Priority) - Prevention for common cases
4. **Story 5** (Low Priority) - Enhanced diagnostics

## Success Metrics

- [ ] CLI exits within 1 second of task completion in batch mode
- [ ] No remaining ChildProcess or Socket handles after cleanup
- [ ] "list your mcp servers" completes without spawning child processes
- [ ] Diagnostic logs show successful cleanup of all tracked processes
