import { getCLILogger } from "./CLILogger"
import { DebugTimer } from "./CLILogger"

/**
 * Centralized cleanup manager for CLI process exit.
 * Replaces the band-aid process.exit(0) solution with proper resource cleanup.
 */
export class CleanupManager {
	private static instance: CleanupManager | null = null
	private cleanupTasks: Array<() => Promise<void>> = []
	private isShuttingDown = false
	private isDisposed = false

	private constructor() {}

	static getInstance(): CleanupManager {
		if (!CleanupManager.instance) {
			CleanupManager.instance = new CleanupManager()
		}
		return CleanupManager.instance
	}

	/**
	 * Register a cleanup task to be executed during shutdown
	 */
	registerCleanupTask(task: () => Promise<void>): void {
		if (this.isDisposed) {
			getCLILogger().warn("[CleanupManager] Cannot register cleanup task - manager is disposed")
			return
		}
		this.cleanupTasks.push(task)
		getCLILogger().debug(`[CleanupManager] Registered cleanup task (total: ${this.cleanupTasks.length})`)
	}

	/**
	 * Clear all registered cleanup tasks
	 */
	clearCleanupTasks(): void {
		this.cleanupTasks = []
		getCLILogger().debug("[CleanupManager] Cleared all cleanup tasks")
	}

	/**
	 * Perform graceful shutdown with proper resource cleanup
	 */
	async performShutdown(timeoutMs: number = 10000): Promise<void> {
		if (this.isShuttingDown) {
			getCLILogger().debug("[CleanupManager] Shutdown already in progress")
			return
		}

		if (this.isDisposed) {
			getCLILogger().debug("[CleanupManager] Manager already disposed")
			return
		}

		this.isShuttingDown = true
		const logger = getCLILogger()

		logger.debug(`[CleanupManager] Starting graceful shutdown with ${this.cleanupTasks.length} cleanup tasks...`)

		// Log active handles before cleanup
		this.logActiveHandles("Before cleanup")

		try {
			// First, run terminal cleanup using existing mechanisms
			await this.cleanupTerminalResources()

			// Then execute all other cleanup tasks with timeout
			const cleanupPromise = Promise.allSettled(
				this.cleanupTasks.map(async (task, index) => {
					try {
						const taskTimer = Date.now()
						await task()
						const duration = Date.now() - taskTimer
						logger.debug(`[CleanupManager] Cleanup task ${index + 1} completed in ${duration}ms`)
					} catch (error) {
						logger.warn(`[CleanupManager] Cleanup task ${index + 1} failed:`, error)
						// Don't rethrow - we want all tasks to attempt cleanup
					}
				}),
			)

			const timeoutPromise = new Promise((_, reject) =>
				setTimeout(() => reject(new Error("Cleanup timeout")), timeoutMs),
			)

			await Promise.race([cleanupPromise, timeoutPromise])

			// Log active handles after cleanup
			this.logActiveHandles("After cleanup")

			logger.debug("[CleanupManager] Graceful shutdown completed successfully")

			// Mark as disposed
			this.isDisposed = true

			// Allow event loop to drain naturally by using setImmediate
			// This ensures any remaining microtasks are processed
			setImmediate(() => {
				if (!process.exitCode) {
					process.exitCode = 0
				}
				logger.debug("[CleanupManager] Process exit code set, allowing natural exit")

				// Option 2: Unref standard streams to allow natural exit with remaining handles
				try {
					if (process.stdout && typeof process.stdout.unref === "function") {
						process.stdout.unref()
						logger.debug("[CleanupManager] Unreferenced stdout")
					}
					if (process.stderr && typeof process.stderr.unref === "function") {
						process.stderr.unref()
						logger.debug("[CleanupManager] Unreferenced stderr")
					}
					if (process.stdin && typeof process.stdin.unref === "function") {
						process.stdin.unref()
						logger.debug("[CleanupManager] Unreferenced stdin")
					}
					logger.debug("[CleanupManager] Standard streams unreferenced - allowing natural exit")
				} catch (error) {
					logger.debug("[CleanupManager] Error unreferencing streams:", error)
				}

				// Wait briefly for natural exit, then use Option 3 as fallback
				setTimeout(() => {
					logger.debug("[CleanupManager] Natural exit timeout reached, forcing clean exit")
					process.exit(process.exitCode || 0)
				}, 1000) // 1 second fallback timeout

				// Diagnostic logging to identify what's keeping the process alive
				const activeHandles = (process as any)._getActiveHandles?.() || []
				const activeRequests = (process as any)._getActiveRequests?.() || []

				logger.debug(`[CleanupManager] Active handles: ${activeHandles.length}`)
				logger.debug(`[CleanupManager] Active requests: ${activeRequests.length}`)

				if (activeHandles.length > 0) {
					logger.debug(
						`[CleanupManager] Handle types: ${activeHandles.map((h: any) => h.constructor?.name || "Unknown").join(", ")}`,
					)
				}

				if (activeRequests.length > 0) {
					logger.debug(
						`[CleanupManager] Request types: ${activeRequests.map((r: any) => r.constructor?.name || "Unknown").join(", ")}`,
					)
				}

				// Log detailed handle information for debugging and FORCE KILL any child processes
				activeHandles.forEach((handle: any, index: number) => {
					try {
						const handleInfo = {
							type: handle.constructor?.name || "Unknown",
							ref: handle._ref !== undefined ? handle._ref : "unknown",
							destroyed: handle.destroyed || false,
						}

						// Add specific details for common handle types
						if (handle.constructor?.name === "Timer") {
							handleInfo.ref = handle._idleTimeout || "unknown timeout"
						} else if (handle.constructor?.name === "ChildProcess") {
							handleInfo.ref = `pid:${handle.pid || "unknown"}`
							// FORCE KILL any remaining child processes
							logger.debug(
								`[CleanupManager] Found child process - PID: ${handle.pid}, killed: ${handle.killed}`,
							)
							if (handle.pid) {
								logger.debug(`[CleanupManager] Force killing untracked child process ${handle.pid}`)
								try {
									const killResult = handle.kill("SIGKILL")
									logger.debug(
										`[CleanupManager] SIGKILL result: ${killResult} for process ${handle.pid}`,
									)

									// Try to disconnect if it's connected
									if (typeof handle.disconnect === "function" && handle.connected) {
										handle.disconnect()
										logger.debug(`[CleanupManager] Disconnected process ${handle.pid}`)
									}

									// Remove all event listeners to fully release the handle
									if (typeof handle.removeAllListeners === "function") {
										handle.removeAllListeners()
										logger.debug(`[CleanupManager] Removed all listeners for process ${handle.pid}`)
									}

									handle.unref()
									logger.debug(`[CleanupManager] Unref completed for process ${handle.pid}`)

									// Also destroy stdio streams
									if (handle.stdin) {
										handle.stdin.destroy()
										if (typeof handle.stdin.removeAllListeners === "function") {
											handle.stdin.removeAllListeners()
										}
										logger.debug(`[CleanupManager] Destroyed stdin for process ${handle.pid}`)
									}
									if (handle.stdout) {
										handle.stdout.destroy()
										if (typeof handle.stdout.removeAllListeners === "function") {
											handle.stdout.removeAllListeners()
										}
										logger.debug(`[CleanupManager] Destroyed stdout for process ${handle.pid}`)
									}
									if (handle.stderr) {
										handle.stderr.destroy()
										if (typeof handle.stderr.removeAllListeners === "function") {
											handle.stderr.removeAllListeners()
										}
										logger.debug(`[CleanupManager] Destroyed stderr for process ${handle.pid}`)
									}
									logger.debug(`[CleanupManager] Killed and cleaned up process ${handle.pid}`)
								} catch (killError) {
									logger.debug(`[CleanupManager] Error killing process ${handle.pid}: ${killError}`)
								}
							} else {
								logger.debug(`[CleanupManager] Child process has no PID, skipping kill`)
							}
						} else if (handle.constructor?.name === "Socket") {
							handleInfo.ref = `${handle.remoteAddress || "unknown"}:${handle.remotePort || "unknown"}`
							// Try to close socket handles
							logger.debug(`[CleanupManager] Found socket - attempting to close`)
							try {
								if (typeof handle.destroy === "function") {
									handle.destroy()
									logger.debug(`[CleanupManager] Destroyed socket`)
								}
								if (typeof handle.removeAllListeners === "function") {
									handle.removeAllListeners()
									logger.debug(`[CleanupManager] Removed all socket listeners`)
								}
								if (typeof handle.unref === "function") {
									handle.unref()
									logger.debug(`[CleanupManager] Unref socket`)
								}
							} catch (socketError) {
								logger.debug(`[CleanupManager] Error closing socket: ${socketError}`)
							}
						}

						logger.debug(`[CleanupManager] Handle ${index + 1}: ${JSON.stringify(handleInfo)}`)
					} catch (error) {
						logger.debug(`[CleanupManager] Handle ${index + 1}: Error inspecting handle - ${error}`)
					}
				})
			})
		} catch (error) {
			logger.warn("[CleanupManager] Cleanup timeout or error, using fallback exit:", error)

			// Mark as disposed even if cleanup failed
			this.isDisposed = true

			// Last resort - but with proper logging and a brief delay to allow logs to flush
			setTimeout(() => {
				logger.debug("[CleanupManager] Forcing process exit after cleanup timeout")
				process.exit(process.exitCode || 0)
			}, 1000)
		}
	}

	/**
	 * Emergency shutdown - forces immediate cleanup and exit
	 */
	async emergencyShutdown(): Promise<void> {
		const logger = getCLILogger()
		logger.warn("[CleanupManager] Emergency shutdown initiated")

		this.isShuttingDown = true
		this.isDisposed = true

		// Try to run critical cleanup tasks with very short timeout
		try {
			await Promise.race([
				Promise.allSettled(this.cleanupTasks.map((task) => task())),
				new Promise((_, reject) => setTimeout(() => reject(new Error("Emergency timeout")), 2000)),
			])
		} catch (error) {
			logger.warn("[CleanupManager] Emergency cleanup failed:", error)
		}

		// Force exit immediately
		process.exit(process.exitCode || 1)
	}

	/**
	 * Check if shutdown is in progress
	 */
	isShutdownInProgress(): boolean {
		return this.isShuttingDown
	}

	/**
	 * Check if manager is disposed
	 */
	getIsDisposed(): boolean {
		return this.isDisposed
	}

	/**
	 * Get the number of registered cleanup tasks
	 */
	getCleanupTaskCount(): number {
		return this.cleanupTasks.length
	}

	/**
	 * Cleanup terminal resources using existing TerminalRegistry.cleanup()
	 * This leverages the same cleanup mechanism used in VSCode extension deactivation
	 */
	private async cleanupTerminalResources(): Promise<void> {
		const logger = getCLILogger()
		logger.debug("[CleanupManager] Starting terminal cleanup using existing mechanisms...")

		try {
			// Use existing TerminalRegistry cleanup (same as VSCode extension deactivation)
			const { TerminalRegistry } = await import("../../integrations/terminal/TerminalRegistry")
			TerminalRegistry.cleanup()

			logger.debug("[CleanupManager] TerminalRegistry cleanup completed")
		} catch (error) {
			logger.debug(`[CleanupManager] Terminal cleanup error: ${error}`)
		}
	}

	/**
	 * Log active handles for diagnostic purposes (non-intrusive)
	 */
	private logActiveHandles(stage: string): void {
		const logger = getCLILogger()

		try {
			const activeHandles = (process as any)._getActiveHandles?.() || []
			const activeRequests = (process as any)._getActiveRequests?.() || []

			logger.debug(
				`[CleanupManager] ${stage} - Active handles: ${activeHandles.length}, Active requests: ${activeRequests.length}`,
			)

			// Log handle types for debugging (non-intrusive)
			const handleTypes = activeHandles.map((handle: any) => handle.constructor.name)
			const handleCounts = handleTypes.reduce(
				(acc: any, type: any) => {
					acc[type] = (acc[type] || 0) + 1
					return acc
				},
				{} as Record<string, number>,
			)

			if (Object.keys(handleCounts).length > 0) {
				logger.debug(`[CleanupManager] ${stage} - Handle types:`, JSON.stringify(handleCounts))
			}
		} catch (error) {
			logger.debug(`[CleanupManager] Handle diagnostic error: ${error}`)
		}
	}

	/**
	 * Reset the instance (mainly for testing)
	 */
	static reset(): void {
		CleanupManager.instance = null
	}
}
