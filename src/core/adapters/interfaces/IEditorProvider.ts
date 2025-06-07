/**
 * Interface for accessing editor and window information across different platforms (VSCode vs CLI)
 */
export interface IEditorProvider {
	/**
	 * Get paths of currently visible files
	 */
	getVisibleFilePaths(cwd: string, maxFiles?: number): string[]

	/**
	 * Get paths of currently open tabs
	 */
	getOpenTabPaths(cwd: string, maxTabs?: number): string[]
}
