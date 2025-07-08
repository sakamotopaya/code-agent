import * as fs from "fs"
import * as path from "path"
import { FileWatcherInterface } from "./FileWatcherInterface"

/**
 * Node.js file watcher for API/Docker contexts
 * Uses fs.watch to monitor file changes for hot-reloading
 */
export class NodeFileWatcher implements FileWatcherInterface {
	private watchers: fs.FSWatcher[] = []
	private watchedPaths: Set<string> = new Set()

	/**
	 * Watch specified file paths for changes
	 * @param paths Array of file paths to watch
	 * @param callback Function to call when files change
	 */
	watch(paths: string[], callback: () => void): void {
		paths.forEach((filePath) => {
			// Avoid watching the same path multiple times
			if (this.watchedPaths.has(filePath)) {
				return
			}

			try {
				// Check if file/directory exists before watching
				if (fs.existsSync(filePath)) {
					const watcher = fs.watch(filePath, (eventType, filename) => {
						// Call callback on any file change
						callback()
					})

					this.watchers.push(watcher)
					this.watchedPaths.add(filePath)
				} else {
					// Watch parent directory for file creation
					const parentDir = path.dirname(filePath)
					const fileName = path.basename(filePath)

					if (fs.existsSync(parentDir) && !this.watchedPaths.has(parentDir)) {
						const watcher = fs.watch(parentDir, (eventType, changedFile) => {
							// Only trigger callback if the specific file we're interested in changed
							if (changedFile === fileName) {
								callback()
							}
						})

						this.watchers.push(watcher)
						this.watchedPaths.add(parentDir)
					}
				}
			} catch (error) {
				// Log error but don't throw - file watching is optional
				console.warn(`Failed to watch file ${filePath}:`, error)
			}
		})
	}

	/**
	 * Stop watching files and clean up resources
	 */
	dispose(): void {
		this.watchers.forEach((watcher) => {
			try {
				watcher.close()
			} catch (error) {
				// Ignore errors during cleanup
				console.warn("Error closing file watcher:", error)
			}
		})
		this.watchers = []
		this.watchedPaths.clear()
	}
}
