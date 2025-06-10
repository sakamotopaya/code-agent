# CLI Hanging Fix - Phase 2: MCP Disposal Enhancement

## Overview

Enhance MCP server disposal to properly terminate stdio child processes and clean up resources, preventing hanging connections from keeping the CLI process alive.

## Problem Statement

The current MCP disposal logic doesn't properly terminate stdio child processes (`dotnet` and `npx` commands), which continue running and prevent the CLI from exiting. The 3-second timeout is insufficient and there's no force-kill mechanism for stubborn processes.

## Current Behavior

- Stdio MCP servers spawn child processes (`dotnet` for mssql-dpsp, `npx` for github)
- `disconnect()` calls `client.close()` and `transport.close()` but doesn't force-kill processes
- Child processes may not respond to graceful shutdown signals
- Disposal timeout of 3 seconds often exceeded
- No monitoring of which processes are hanging

## Target Files

- `src/cli/services/CLIMcpService.ts` (primary changes)
- `src/cli/connections/BaseMcpConnection.ts` (disposal enhancements)
- `src/cli/connections/StdioMcpConnection.ts` (stdio-specific cleanup)
- `src/cli/services/GlobalCLIMcpService.ts` (disposal coordination)

## Implementation Details

### 1. Enhanced Stdio Connection Disposal

Add force termination capabilities to `StdioMcpConnection`:

```typescript
// src/cli/connections/StdioMcpConnection.ts

import { spawn, ChildProcess } from "child_process"

export class StdioMcpConnection extends BaseMcpConnection {
	private childProcess?: ChildProcess

	async setupTransport(): Promise<void> {
		if (!this.config.command) {
			throw new McpConnectionError("Command is required for stdio connection", this.id)
		}

		this.transport = new StdioClientTransport({
			command: this.config.command,
			args: this.config.args || [],
			cwd: this.config.cwd,
			env: {
				...(Object.fromEntries(
					Object.entries(process.env).filter(([, value]) => value !== undefined),
				) as Record<string, string>),
				...this.config.env,
			},
			stderr: "pipe",
		})

		// Store reference to child process for cleanup
		this.childProcess = (this.transport as any).process
	}

	async forceTerminateProcess(): Promise<void> {
		if (!this.childProcess || this.childProcess.killed) {
			return
		}

		console.log(`[StdioMcp] Force terminating process ${this.childProcess.pid} for ${this.config.name}`)

		return new Promise<void>((resolve) => {
			const pid = this.childProcess!.pid
			let terminated = false

			const onExit = () => {
				if (!terminated) {
					terminated = true
					console.log(`[StdioMcp] Process ${pid} terminated for ${this.config.name}`)
					resolve()
				}
			}

			// Listen for process exit
			this.childProcess!.on("exit", onExit)

			// Try graceful termination first
			try {
				this.childProcess!.kill("SIGTERM")
				console.log(`[StdioMcp] Sent SIGTERM to process ${pid}`)
			} catch (error) {
				console.log(`[StdioMcp] Error sending SIGTERM: ${error}`)
			}

			// Force kill after 2 seconds
			setTimeout(() => {
				if (!terminated && !this.childProcess!.killed) {
					try {
						this.childProcess!.kill("SIGKILL")
						console.log(`[StdioMcp] Sent SIGKILL to process ${pid}`)
					} catch (error) {
						console.log(`[StdioMcp] Error sending SIGKILL: ${error}`)
					}
				}

				// Always resolve after force kill attempt
				setTimeout(() => {
					if (!terminated) {
						terminated = true
						console.log(`[StdioMcp] Force termination completed for ${this.config.name}`)
						resolve()
					}
				}, 1000)
			}, 2000)
		})
	}

	async disconnect(): Promise<void> {
		if (this.isDisconnecting || this.status === "disconnected") {
			return
		}

		this.isDisconnecting = true
		this.isReady = false

		try {
			// Clear any pending timeouts
			if (this.handshakeTimeout) {
				clearTimeout(this.handshakeTimeout)
				this.handshakeTimeout = undefined
			}

			// Close client connection first
			if (this.client) {
				await this.client.close()
			}

			// Close transport
			if (this.transport) {
				await this.transport.close()
			}

			// Force terminate the underlying process
			await this.forceTerminateProcess()

			this.status = "disconnected"
		} catch (error) {
			console.error(`Error disconnecting from ${this.config.name}:`, error)
		} finally {
			this.isDisconnecting = false
		}
	}
}
```

### 2. Enhanced Base Connection Disposal

Improve the base disposal logic with better timeout handling:

```typescript
// src/cli/connections/BaseMcpConnection.ts

export abstract class BaseMcpConnection implements McpConnection {
	private disposalPromise?: Promise<void>

	async disconnect(): Promise<void> {
		// Prevent multiple simultaneous disconnect attempts
		if (this.disposalPromise) {
			return this.disposalPromise
		}

		if (this.isDisconnecting || this.status === "disconnected") {
			return
		}

		this.disposalPromise = this._disconnectInternal()
		try {
			await this.disposalPromise
		} finally {
			this.disposalPromise = undefined
		}
	}

	private async _disconnectInternal(): Promise<void> {
		this.isDisconnecting = true
		this.isReady = false

		const disconnectTimeout = 5000 // 5 seconds total timeout
		const steps = []

		try {
			// Step 1: Clear timeouts
			if (this.handshakeTimeout) {
				clearTimeout(this.handshakeTimeout)
				this.handshakeTimeout = undefined
			}

			// Step 2: Close client
			if (this.client) {
				steps.push(
					Promise.race([
						this.client.close(),
						new Promise((_, reject) => setTimeout(() => reject(new Error("Client close timeout")), 2000)),
					]).catch((error) => {
						console.warn(`Client close error for ${this.config.name}:`, error)
					}),
				)
			}

			// Step 3: Close transport
			if (this.transport) {
				steps.push(
					Promise.race([
						this.transport.close(),
						new Promise((_, reject) =>
							setTimeout(() => reject(new Error("Transport close timeout")), 2000),
						),
					]).catch((error) => {
						console.warn(`Transport close error for ${this.config.name}:`, error)
					}),
				)
			}

			// Step 4: Force termination (stdio connections only)
			if ("forceTerminateProcess" in this) {
				steps.push(
					(this as any).forceTerminateProcess().catch((error) => {
						console.warn(`Force termination error for ${this.config.name}:`, error)
					}),
				)
			}

			// Execute all steps with overall timeout
			await Promise.race([
				Promise.allSettled(steps),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Overall disconnect timeout")), disconnectTimeout),
				),
			])

			this.status = "disconnected"
		} catch (error) {
			console.error(`Error disconnecting from ${this.config.name}:`, error)
			this.status = "error"
		} finally {
			this.isDisconnecting = false
		}
	}
}
```

### 3. Enhanced CLIMcpService Disposal

Improve the service-level disposal with better monitoring and force cleanup:

```typescript
// src/cli/services/CLIMcpService.ts

export class CLIMcpService implements ICLIMcpService {
	private disposalInProgress = false

	async dispose(): Promise<void> {
		if (this.isDisposed || this.disposalInProgress) {
			return
		}

		this.disposalInProgress = true
		const logger = getCLILogger()

		logger.debug("CLIMcpService: Starting comprehensive disposal...")

		try {
			// Step 1: Stop all health checkers
			await this.stopAllHealthCheckers()

			// Step 2: Disconnect all servers with monitoring
			await this.disconnectAllServersWithMonitoring()

			// Step 3: Final cleanup
			this.performFinalCleanup()

			this.isDisposed = true
			logger.debug("CLIMcpService: Disposal completed successfully")
		} catch (error) {
			logger.warn("CLIMcpService: Disposal completed with errors:", error)
			// Mark as disposed even if there were errors
			this.isDisposed = true
		} finally {
			this.disposalInProgress = false
		}
	}

	private async stopAllHealthCheckers(): Promise<void> {
		const logger = getCLILogger()

		for (const [serverId] of this.healthCheckers) {
			try {
				this.stopHealthCheck(serverId)
				logger.debug(`CLIMcpService: Stopped health checker for ${serverId}`)
			} catch (error) {
				logger.debug(`CLIMcpService: Error stopping health checker for ${serverId}:`, error)
			}
		}
	}

	private async disconnectAllServersWithMonitoring(): Promise<void> {
		const logger = getCLILogger()
		const disconnectTimeout = 8000 // 8 seconds total for all disconnections

		const serverIds = Array.from(this.connections.keys())
		logger.debug(`CLIMcpService: Disconnecting ${serverIds.length} servers...`)

		const disconnectPromises = serverIds.map(async (serverId) => {
			const startTime = Date.now()
			try {
				logger.debug(`CLIMcpService: Starting disconnect for ${serverId}`)

				await Promise.race([
					this.disconnectFromServer(serverId),
					new Promise((_, reject) =>
						setTimeout(() => reject(new Error("Individual disconnect timeout")), 4000),
					),
				])

				const duration = Date.now() - startTime
				logger.debug(`CLIMcpService: Disconnected ${serverId} in ${duration}ms`)
			} catch (error) {
				const duration = Date.now() - startTime
				logger.debug(`CLIMcpService: Force disconnect ${serverId} after ${duration}ms:`, error)

				// Force remove connection
				this.connections.delete(serverId)
			}
		})

		// Wait for all disconnections with overall timeout
		try {
			await Promise.race([
				Promise.allSettled(disconnectPromises),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Overall disconnect timeout")), disconnectTimeout),
				),
			])
		} catch (error) {
			logger.warn("CLIMcpService: Disconnect timeout, performing force cleanup")
			// Force cleanup will happen in performFinalCleanup
		}
	}

	private performFinalCleanup(): void {
		const logger = getCLILogger()

		// Clear all remaining connections
		const remainingConnections = this.connections.size
		if (remainingConnections > 0) {
			logger.debug(`CLIMcpService: Force clearing ${remainingConnections} remaining connections`)
			this.connections.clear()
		}

		// Clear all health checkers
		const remainingCheckers = this.healthCheckers.size
		if (remainingCheckers > 0) {
			logger.debug(`CLIMcpService: Force clearing ${remainingCheckers} remaining health checkers`)
			for (const [serverId, checker] of this.healthCheckers) {
				try {
					clearInterval(checker)
				} catch (error) {
					// Ignore cleanup errors
				}
			}
			this.healthCheckers.clear()
		}

		logger.debug("CLIMcpService: Final cleanup completed")
	}
}
```

### 4. Enhanced Global Service Disposal

Improve the global service disposal coordination:

```typescript
// src/cli/services/GlobalCLIMcpService.ts

class GlobalCLIMcpService {
	async dispose(): Promise<void> {
		const logger = getCLILogger()

		if (this.mcpService) {
			try {
				logger.debug("[GlobalCLIMcpService] Starting MCP service disposal...")

				// Set a firm timeout for disposal
				const disposalPromise = this.mcpService.dispose()
				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Global disposal timeout")), 10000),
				)

				await Promise.race([disposalPromise, timeoutPromise])

				logger.debug("[GlobalCLIMcpService] MCP service disposed successfully")
			} catch (error) {
				logger.warn("[GlobalCLIMcpService] MCP service disposal error:", error)
				// Continue with cleanup even on error
			}

			this.mcpService = null
		}

		// Reset all state
		this.initialized = false
		this.initializationPromise = null

		// Clear singleton instance to allow fresh start
		GlobalCLIMcpService.instance = null

		logger.debug("[GlobalCLIMcpService] Global disposal completed")
	}
}
```

## Testing Requirements

### Unit Tests

- [ ] Test stdio process force termination with mock child processes
- [ ] Test disposal timeout handling with slow-to-close connections
- [ ] Test parallel disposal of multiple connections
- [ ] Test cleanup when disposal operations fail

### Integration Tests

- [ ] Test disposal with real dotnet and npx processes
- [ ] Test hanging process scenarios (blocked processes)
- [ ] Test disposal during active MCP operations
- [ ] Test memory and resource cleanup verification

### Performance Tests

- [ ] Measure disposal time with various numbers of connections
- [ ] Test disposal under high load conditions
- [ ] Verify no resource leaks after disposal

## Test Scenarios

```bash
# Test disposal after MCP operations
npm run start:cli -- --batch "what mcp servers do you have available?" --verbose

# Test disposal with server errors
# (manually kill dotnet process during operation)

# Test rapid start/stop cycles
for i in {1..5}; do npm run start:cli -- --batch "list mcp servers"; done

# Test disposal timeout scenarios
# (add artificial delays in test environment)
```

## Acceptance Criteria

### Functional

- [ ] All stdio child processes terminate within 5 seconds of disposal start
- [ ] Disposal completes successfully even when processes don't respond to SIGTERM
- [ ] No zombie or orphaned processes remain after CLI exit
- [ ] Disposal works correctly with 0, 1, or multiple MCP servers

### Performance

- [ ] Disposal completes within 8 seconds for up to 5 servers
- [ ] Force termination triggers within 2 seconds of graceful failure
- [ ] No memory leaks or handle leaks after disposal

### Reliability

- [ ] 100% success rate for process cleanup
- [ ] Graceful handling of already-terminated processes
- [ ] Proper cleanup even when individual steps fail
- [ ] Comprehensive logging for debugging disposal issues

## Risk Considerations

### Potential Issues

- Force-killing processes may interrupt important operations
- Aggressive timeouts might interrupt legitimate slow operations
- Platform differences in process termination behavior

### Mitigation Strategies

- Graduated escalation: graceful close → SIGTERM → SIGKILL
- Reasonable timeouts that allow for legitimate operations
- Platform-specific process handling where necessary
- Comprehensive error handling and logging

## Implementation Notes

### Key Improvements

1. **Force Process Termination**: SIGTERM followed by SIGKILL for stubborn processes
2. **Timeout Management**: Graduated timeouts at multiple levels
3. **Disposal Monitoring**: Detailed logging and progress tracking
4. **Parallel Cleanup**: Concurrent disposal of multiple connections
5. **Guaranteed Cleanup**: Final cleanup even when individual steps fail

### Platform Considerations

- Windows: Process termination using `taskkill` if needed
- Unix/Linux: Standard signal handling (SIGTERM/SIGKILL)
- macOS: Standard signal handling with potential permission considerations

This phase ensures that MCP server disposal is robust, fast, and reliable, preventing hanging child processes from keeping the CLI alive.
