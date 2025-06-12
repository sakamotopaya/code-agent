import { getCLILogger } from "./CLILogger"

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

		try {
			// Execute all cleanup tasks with timeout
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
	 * Reset the instance (mainly for testing)
	 */
	static reset(): void {
		CleanupManager.instance = null
	}
}
