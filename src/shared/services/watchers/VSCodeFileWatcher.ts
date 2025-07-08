import * as vscode from "vscode"
import { FileWatcherInterface } from "./FileWatcherInterface"
import { arePathsEqual } from "../../../utils/path"

/**
 * VSCode file watcher for extension context
 * Uses vscode.workspace file system watchers for file change detection
 */
export class VSCodeFileWatcher implements FileWatcherInterface {
	private disposables: vscode.Disposable[] = []
	private watchedPaths: Set<string> = new Set()

	constructor(private context: vscode.ExtensionContext) {}

	/**
	 * Watch specified file paths for changes using VSCode's file system watcher
	 * @param paths Array of file paths to watch
	 * @param callback Function to call when files change
	 */
	watch(paths: string[], callback: () => void): void {
		// Add new paths to watched set
		paths.forEach((path) => this.watchedPaths.add(path))

		// Create watchers for file changes, creation, and deletion
		const changeWatcher = vscode.workspace.onDidChangeTextDocument((event) => {
			const filePath = event.document.uri.fsPath
			if (Array.from(this.watchedPaths).some((watchedPath) => arePathsEqual(filePath, watchedPath))) {
				callback()
			}
		})

		const createWatcher = vscode.workspace.onDidCreateFiles((event) => {
			const hasMatchingFile = event.files.some((file) =>
				Array.from(this.watchedPaths).some((watchedPath) => arePathsEqual(file.fsPath, watchedPath)),
			)
			if (hasMatchingFile) {
				callback()
			}
		})

		const deleteWatcher = vscode.workspace.onDidDeleteFiles((event) => {
			const hasMatchingFile = event.files.some((file) =>
				Array.from(this.watchedPaths).some((watchedPath) => arePathsEqual(file.fsPath, watchedPath)),
			)
			if (hasMatchingFile) {
				callback()
			}
		})

		this.disposables.push(changeWatcher, createWatcher, deleteWatcher)
	}

	/**
	 * Stop watching files and clean up VSCode disposables
	 */
	dispose(): void {
		this.disposables.forEach((disposable) => {
			try {
				disposable.dispose()
			} catch (error) {
				// Log error but don't throw during cleanup
				console.warn("Error disposing VSCode file watcher:", error)
			}
		})
		this.disposables = []
		this.watchedPaths.clear()
	}
}
