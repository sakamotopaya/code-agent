/**
 * Platform abstraction for file watching operations
 */
export interface IDisposable {
	dispose(): void
}

export interface IFileWatcherService {
	/**
	 * Watch a specific file for changes
	 */
	watchFile(path: string, callback: () => void): IDisposable

	/**
	 * Watch workspace/working directory for changes
	 */
	watchWorkspace(callback: () => void): IDisposable

	/**
	 * Watch multiple files/patterns
	 */
	watchFiles(patterns: string[], callback: (path: string) => void): IDisposable

	/**
	 * Dispose all watchers (cleanup)
	 */
	disposeAll(): void
}
