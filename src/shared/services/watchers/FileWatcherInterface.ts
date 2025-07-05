/**
 * Interface for file watching implementations across different contexts
 * Allows dependency injection of appropriate file watching strategy
 */
export interface FileWatcherInterface {
	/**
	 * Watch specified file paths for changes
	 * @param paths Array of file paths to watch
	 * @param callback Function to call when files change
	 */
	watch(paths: string[], callback: () => void): void

	/**
	 * Stop watching files and clean up resources
	 */
	dispose(): void
}
