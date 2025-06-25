/**
 * Platform abstraction for file system operations
 */
export interface IFileSystemService {
	/**
	 * Read file contents
	 */
	readFile(path: string): Promise<string>

	/**
	 * Write file contents
	 */
	writeFile(path: string, content: string): Promise<void>

	/**
	 * Check if file exists
	 */
	exists(path: string): Promise<boolean>

	/**
	 * Get primary workspace/working directory path
	 */
	getWorkspacePath(): string | null

	/**
	 * Get global storage path for configuration
	 */
	getGlobalStoragePath(): string

	/**
	 * Join paths in platform-appropriate way
	 */
	joinPath(...segments: string[]): string

	/**
	 * Get directory name from path
	 */
	dirname(path: string): string
}
