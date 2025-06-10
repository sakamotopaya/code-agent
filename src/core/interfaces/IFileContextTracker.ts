import { RecordSource } from "../context-tracking/FileContextTrackerTypes"

export interface IFileContextTracker {
	/**
	 * Tracks a file operation in metadata and sets up a watcher for the file (if applicable).
	 * This is the main entry point for FileContextTracker and is called when a file is passed to Roo via a tool, mention, or edit.
	 */
	trackFileContext(filePath: string, operation: RecordSource): Promise<void>

	/**
	 * Returns (and then clears) the set of recently modified files
	 */
	getAndClearRecentlyModifiedFiles(): string[]

	/**
	 * Returns (and then clears) the set of checkpoint possible files
	 */
	getAndClearCheckpointPossibleFile(): string[]

	/**
	 * Disposes of all file watchers and cleans up resources
	 */
	dispose(): void
}
