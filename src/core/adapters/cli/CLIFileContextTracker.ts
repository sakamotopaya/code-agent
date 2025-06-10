import { IFileContextTracker } from "../../interfaces/IFileContextTracker"
import { RecordSource } from "../../context-tracking/FileContextTrackerTypes"
import { getCLILogger } from "../../../cli/services/CLILogger"

/**
 * CLI implementation of FileContextTracker that provides minimal tracking functionality
 * without VSCode-specific dependencies like file watchers.
 */
export class CLIFileContextTracker implements IFileContextTracker {
	private readonly taskId: string
	private readonly logger = getCLILogger()
	private recentlyModifiedFiles = new Set<string>()
	private checkpointPossibleFiles = new Set<string>()

	constructor(taskId: string) {
		this.taskId = taskId
	}

	/**
	 * Tracks a file operation in CLI mode.
	 * This is a simplified version that logs the operation but doesn't set up file watchers
	 * since those are VSCode-specific.
	 */
	async trackFileContext(filePath: string, operation: RecordSource): Promise<void> {
		try {
			this.logger.debug(`[FileContextTracker] Tracking file operation: ${filePath} (${operation})`)

			// Track files based on operation type
			switch (operation) {
				case "user_edited":
					this.recentlyModifiedFiles.add(filePath)
					break
				case "roo_edited":
					this.checkpointPossibleFiles.add(filePath)
					break
				// For CLI mode, we don't need file watchers or complex metadata tracking
				// but we maintain basic tracking for compatibility
			}
		} catch (error) {
			this.logger.error("Failed to track file operation:", error)
		}
	}

	/**
	 * Returns (and then clears) the set of recently modified files
	 */
	getAndClearRecentlyModifiedFiles(): string[] {
		const files = Array.from(this.recentlyModifiedFiles)
		this.recentlyModifiedFiles.clear()
		return files
	}

	/**
	 * Returns (and then clears) the set of checkpoint possible files
	 */
	getAndClearCheckpointPossibleFile(): string[] {
		const files = Array.from(this.checkpointPossibleFiles)
		this.checkpointPossibleFiles.clear()
		return files
	}

	/**
	 * Disposes of resources. In CLI mode, there are no file watchers to dispose.
	 */
	dispose(): void {
		this.logger.debug(`[FileContextTracker] Disposing CLI file context tracker for task ${this.taskId}`)
		this.recentlyModifiedFiles.clear()
		this.checkpointPossibleFiles.clear()
	}
}
