# CLI Hanging Fix - Phase 3: Process Exit Enforcement

## Overview

Implement guaranteed process exit mechanisms to ensure the CLI terminates even when task completion detection and MCP disposal fail or hang, providing a reliable fallback exit strategy.

## Problem Statement

Even with improved task completion detection and MCP disposal, there may be edge cases where:

- Event loop items prevent Node.js from exiting naturally
- Cleanup operations hang indefinitely
- Unknown resources keep the process alive
- System-level issues prevent graceful shutdown

A guaranteed exit mechanism is needed as a final fallback.

## Current Behavior

- CLI relies entirely on natural Node.js exit when event loop is empty
- No forced exit mechanism if cleanup hangs
- No maximum execution time limits
- Process can hang indefinitely waiting for unknown resources

## Target Files

- `src/cli/index.ts` (primary changes)
- `src/cli/commands/batch.ts` (exit coordination)

## Implementation Details

### 1. Global Exit Enforcement System

Add a comprehensive exit enforcement system to the main CLI:

```typescript
// src/cli/index.ts

interface ExitManager {
	maxExecutionTime: number
	forceExitTimer?: NodeJS.Timeout
	cleanupPromises: Promise<void>[]
	exitRequested: boolean
	exitCode: number
}

class CLIExitManager {
	private config: ExitManager
	private logger: any

	constructor(logger: any, maxExecutionTime: number = 120000) {
		// 2 minutes default
		this.logger = logger
		this.config = {
			maxExecutionTime,
			cleanupPromises: [],
			exitRequested: false,
			exitCode: 0,
		}

		this.setupGlobalExitEnforcement()
		this.setupSignalHandlers()
	}

	private setupGlobalExitEnforcement(): void {
		// Maximum execution time enforcement
		this.config.forceExitTimer = setTimeout(() => {
			this.logger.warn(`Force exiting after ${this.config.maxExecutionTime}ms maximum execution time`)
			this.forceExit(1, "Maximum execution time exceeded")
		}, this.config.maxExecutionTime)

		// Clear timer on natural exit
		process.on("beforeExit", () => {
			this.clearForceExitTimer()
		})
	}

	private setupSignalHandlers(): void {
		const gracefulShutdown = async (signal: string) => {
			if (this.config.exitRequested) {
				this.logger.warn(`Received ${signal} again, forcing immediate exit`)
				process.exit(signal === "SIGINT" ? 130 : 143)
				return
			}

			this.config.exitRequested = true
			this.logger.info(`Received ${signal}, initiating graceful shutdown...`)

			try {
				await this.performGracefulShutdown()
				const exitCode = signal === "SIGINT" ? 130 : 143
				this.scheduleExit(exitCode, `Graceful shutdown after ${signal}`)
			} catch (error) {
				this.logger.error("Graceful shutdown failed:", error)
				this.forceExit(1, "Graceful shutdown failure")
			}
		}

		process.on("SIGINT", () => gracefulShutdown("SIGINT"))
		process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
	}

	async performGracefulShutdown(): Promise<void> {
		const shutdownTimeout = 15000 // 15 seconds for graceful shutdown
		const logger = this.logger

		logger.debug("Starting graceful shutdown sequence...")

		const shutdownTasks = [
			this.disposeMcpServices(),
			this.clearGlobalTimers(),
			this.removeEventListeners(),
			this.closeOpenHandles(),
		]

		try {
			await Promise.race([
				Promise.allSettled(shutdownTasks),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Graceful shutdown timeout")), shutdownTimeout),
				),
			])

			logger.debug("Graceful shutdown completed successfully")
		} catch (error) {
			logger.warn("Graceful shutdown timeout, some operations may be incomplete")
			throw error
		}
	}

	private async disposeMcpServices(): Promise<void> {
		try {
			const { GlobalCLIMcpService } = await import("../services/GlobalCLIMcpService")
			const globalMcpService = GlobalCLIMcpService.getInstance()

			if (globalMcpService.isInitialized()) {
				this.logger.debug("Disposing global MCP service...")
				await globalMcpService.dispose()
				this.logger.debug("Global MCP service disposed")
			}
		} catch (error) {
			this.logger.debug("Error disposing global MCP service:", error)
		}
	}

	private async clearGlobalTimers(): Promise<void> {
		// Clear any remaining timers (implementation depends on timer tracking)
		this.logger.debug("Clearing global timers...")
		// Note: Node.js doesn't provide a direct way to clear all timers
		// This would need to be implemented with timer tracking if needed
	}

	private async removeEventListeners(): Promise<void> {
		this.logger.debug("Removing event listeners...")
		// Remove any global event listeners that might prevent exit
		process.removeAllListeners("uncaughtException")
		process.removeAllListeners("unhandledRejection")
	}

	private async closeOpenHandles(): Promise<void> {
		this.logger.debug("Closing open handles...")
		// Close any remaining open handles
		// This is platform-specific and may require handle tracking
	}

	scheduleExit(exitCode: number, reason: string, delay: number = 1000): void {
		this.config.exitCode = exitCode

		this.logger.debug(`Scheduling exit with code ${exitCode}: ${reason} (delay: ${delay}ms)`)

		setTimeout(() => {
			this.logger.debug(`Exiting process: ${reason}`)
			process.exit(exitCode)
		}, delay)
	}

	forceExit(exitCode: number, reason: string): void {
		this.clearForceExitTimer()
		this.logger.warn(`Force exit with code ${exitCode}: ${reason}`)
		process.exit(exitCode)
	}

	private clearForceExitTimer(): void {
		if (this.config.forceExitTimer) {
			clearTimeout(this.config.forceExitTimer)
			this.config.forceExitTimer = undefined
		}
	}

	registerCleanupPromise(promise: Promise<void>): void {
		this.config.cleanupPromises.push(promise)
	}

	setExitCode(code: number): void {
		this.config.exitCode = code
	}
}
```

### 2. Integration with Main CLI Logic

Integrate the exit manager into the main CLI action:

```typescript
// src/cli/index.ts - Updated main action

.action(async (options: CliOptions) => {
    // Initialize logger first
    const logger = initializeCLILogger(options.verbose, options.quiet, options.color);

    // Initialize exit manager
    const exitManager = new CLIExitManager(logger, 120000); // 2 minutes max

    try {
        // ... existing initialization code ...

        // Handle batch mode with exit coordination
        if (options.batch || options.stdin || !options.interactive) {
            const nonInteractivePromise = executeNonInteractiveMode(options, configManager, logger);

            // Register for cleanup tracking
            exitManager.registerCleanupPromise(nonInteractivePromise);

            try {
                await nonInteractivePromise;
                exitManager.setExitCode(0);
                exitManager.scheduleExit(0, 'Non-interactive mode completed successfully');
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error("Non-interactive execution failed:", message);
                exitManager.setExitCode(1);
                exitManager.scheduleExit(1, 'Non-interactive mode failed');
            }
        } else {
            // Interactive mode - let REPL handle its own exit
            const repl = new CliRepl(options, configManager);
            await repl.start();

            // REPL completed normally
            exitManager.scheduleExit(0, 'Interactive mode completed');
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(message);

        exitManager.setExitCode(1);
        exitManager.scheduleExit(1, 'CLI execution failed');
    }
});

async function executeNonInteractiveMode(
    options: CliOptions,
    configManager: CliConfigManager,
    logger: any
): Promise<void> {
    // Consolidated non-interactive execution logic
    if (options.stdin) {
        const { NonInteractiveModeService } = await import("./services/NonInteractiveModeService");
        const service = new NonInteractiveModeService(options);
        await service.executeFromStdin();
    } else if (options.batch) {
        const fileExists = fs.existsSync(options.batch);

        if (fileExists) {
            const { NonInteractiveModeService } = await import("./services/NonInteractiveModeService");
            const service = new NonInteractiveModeService(options);
            await service.executeFromFile(options.batch);
        } else {
            // Direct command execution
            const batchProcessor = new BatchProcessor(options, configManager);
            await batchProcessor.run(options.batch);
        }
    }
}
```

### 3. Enhanced Batch Processor Exit Coordination

Update BatchProcessor to work with the exit management system:

```typescript
// src/cli/commands/batch.ts - Exit coordination

export class BatchProcessor {
	private exitRequested = false

	async run(taskDescription: string): Promise<void> {
		// Set up exit monitoring
		const executionTimeout = 60000 // 1 minute for batch operations
		const timeoutHandle = setTimeout(() => {
			if (!this.exitRequested) {
				this.logError("Batch execution timeout")
				throw new Error("Batch execution timeout")
			}
		}, executionTimeout)

		try {
			this.logDebug("[BatchProcessor] Starting batch mode...")

			// ... existing execution logic ...

			await this.executeTaskWithExitCoordination(task, taskPromise, isInfoQuery)

			this.logDebug("[BatchProcessor] Task completed successfully")
		} catch (error) {
			this.exitRequested = true
			throw error
		} finally {
			clearTimeout(timeoutHandle)
			this.exitRequested = true

			// Ensure cleanup happens
			await this.performBatchCleanup()
		}
	}

	private async executeTaskWithExitCoordination(
		task: Task,
		taskPromise: Promise<void>,
		isInfoQuery: boolean,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			let isCompleted = false

			const completeOnce = async (reason: string) => {
				if (isCompleted || this.exitRequested) return
				isCompleted = true
				this.exitRequested = true

				this.logDebug(`[BatchProcessor] Task completing: ${reason}`)

				try {
					// Cleanup task before resolving
					if (typeof task.dispose === "function") {
						await task.dispose()
					}
				} catch (error) {
					this.logDebug("[BatchProcessor] Error during task cleanup:", error)
				} finally {
					resolve()
				}
			}

			const rejectOnce = async (error: Error) => {
				if (isCompleted || this.exitRequested) return
				isCompleted = true
				this.exitRequested = true

				try {
					if (typeof task.dispose === "function") {
						await task.dispose()
					}
				} catch (cleanupError) {
					this.logDebug("[BatchProcessor] Error during cleanup after error:", cleanupError)
				} finally {
					reject(error)
				}
			}

			// Set up completion detection based on phases 1 and 2
			if (isInfoQuery) {
				this.setupResponseCompletionDetection(task, completeOnce)

				// Shorter timeout for info queries
				setTimeout(() => {
					completeOnce("Information query timeout")
				}, 30000)
			}

			// Set up standard event handlers
			this.setupStandardEventHandlers(task, completeOnce, rejectOnce)

			// Handle task promise
			taskPromise.catch(rejectOnce)

			// Emergency exit for batch mode
			setTimeout(() => {
				if (!isCompleted && !this.exitRequested) {
					rejectOnce(new Error("Batch mode emergency timeout"))
				}
			}, 45000) // 45 seconds emergency timeout
		})
	}

	private async performBatchCleanup(): Promise<void> {
		this.logDebug("[BatchProcessor] Performing batch cleanup...")

		const cleanupTimeout = 3000 // 3 seconds for cleanup

		try {
			await Promise.race([
				this.cleanupResources(),
				new Promise((_, reject) => setTimeout(() => reject(new Error("Cleanup timeout")), cleanupTimeout)),
			])
		} catch (error) {
			this.logDebug("[BatchProcessor] Cleanup timeout or error:", error)
		}
	}

	private async cleanupResources(): Promise<void> {
		// Clean up any remaining resources
		// This could include file handles, network connections, etc.
		this.logDebug("[BatchProcessor] Resource cleanup completed")
	}
}
```

### 4. Process State Monitoring

Add utilities to monitor process state and identify hanging resources:

```typescript
// src/cli/utils/process-monitor.ts

export class ProcessMonitor {
	static logActiveHandles(logger: any): void {
		if (process.env.NODE_ENV === "development") {
			// @ts-ignore - process._getActiveHandles is internal but useful for debugging
			const handles = process._getActiveHandles?.() || []
			// @ts-ignore - process._getActiveRequests is internal but useful for debugging
			const requests = process._getActiveRequests?.() || []

			logger.debug(`Active handles: ${handles.length}, Active requests: ${requests.length}`)

			if (handles.length > 0) {
				logger.debug(
					"Active handle types:",
					handles.map((h) => h.constructor.name),
				)
			}
		}
	}

	static forceGarbageCollection(): void {
		if (global.gc) {
			global.gc()
		}
	}
}
```

## Testing Requirements

### Unit Tests

- [ ] Test exit manager with various timeout scenarios
- [ ] Test signal handler behavior (SIGINT/SIGTERM)
- [ ] Test graceful shutdown sequence
- [ ] Test force exit mechanisms

### Integration Tests

- [ ] Test complete CLI execution with exit enforcement
- [ ] Test hanging scenarios with force exit
- [ ] Test cleanup coordination between phases
- [ ] Test resource leak prevention

### Stress Tests

- [ ] Test with deliberately hanging operations
- [ ] Test with resource exhaustion scenarios
- [ ] Test signal handling under load
- [ ] Test memory usage during extended operations

## Test Scenarios

```bash
# Test normal exit behavior
npm run start:cli -- --batch "what mcp servers do you have available?"

# Test maximum execution time (should exit after 2 minutes)
npm run start:cli -- --batch "perform a very long operation"

# Test signal handling
npm run start:cli -- --batch "long operation" &
PID=$!
sleep 5
kill -TERM $PID  # Should exit gracefully

# Test force kill scenario
npm run start:cli -- --batch "long operation" &
PID=$!
sleep 5
kill -TERM $PID
sleep 2
kill -TERM $PID  # Second signal should force immediate exit
```

## Acceptance Criteria

### Functional

- [ ] CLI exits within 2 minutes maximum under any conditions
- [ ] Graceful shutdown completes within 15 seconds when possible
- [ ] Signal handlers work correctly for both SIGINT and SIGTERM
- [ ] Exit codes reflect actual operation success/failure

### Performance

- [ ] Normal operations exit within 5 seconds of completion
- [ ] Graceful shutdown adds maximum 1 second to exit time
- [ ] Force exit triggers reliably when cleanup hangs

### Reliability

- [ ] 100% exit success rate regardless of hanging operations
- [ ] Proper exit codes for all scenarios
- [ ] No orphaned processes or zombie processes
- [ ] Comprehensive logging for debugging exit issues

## Risk Considerations

### Potential Issues

- Force exit might interrupt critical operations
- Aggressive timeouts might cut off legitimate long operations
- Platform differences in signal handling
- Resource cleanup might be incomplete under force exit

### Mitigation Strategies

- Reasonable timeout values that accommodate normal operations
- Graduated escalation: normal → graceful → force
- Platform-specific testing and adjustments
- Clear documentation of timeout behaviors
- Option to adjust timeouts via configuration

## Implementation Notes

### Key Features

1. **Maximum Execution Time**: Hard limit prevents infinite hangs
2. **Graceful Shutdown**: Proper cleanup when possible
3. **Signal Handling**: Responds to SIGINT/SIGTERM correctly
4. **Emergency Exit**: Guaranteed exit as final fallback
5. **Exit Coordination**: Integrates with task completion and MCP disposal

### Configuration Options

- Maximum execution time (default: 2 minutes)
- Graceful shutdown timeout (default: 15 seconds)
- Cleanup timeout (default: 3 seconds)
- Force exit delay (default: 1 second)

This phase provides the final safety net to ensure the CLI always exits, regardless of any issues in the previous phases or unexpected system conditions.
