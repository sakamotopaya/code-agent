import { FileWatcherInterface } from "./FileWatcherInterface"

/**
 * No-operation file watcher for CLI context
 * Provides file watching interface without actual watching to avoid overhead
 */
export class NoOpFileWatcher implements FileWatcherInterface {
	/**
	 * No-op implementation - does not actually watch files
	 * @param paths File paths (ignored)
	 * @param callback Callback function (ignored)
	 */
	watch(paths: string[], callback: () => void): void {
		// No-op for CLI context - no file watching needed
	}

	/**
	 * No-op implementation - nothing to dispose
	 */
	dispose(): void {
		// No-op - no resources to clean up
	}
}
