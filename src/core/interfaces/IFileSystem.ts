/**
 * Buffer encoding types
 */
export type BufferEncoding =
	| "ascii"
	| "utf8"
	| "utf-8"
	| "utf16le"
	| "ucs2"
	| "ucs-2"
	| "base64"
	| "base64url"
	| "latin1"
	| "binary"
	| "hex"

/**
 * Interface for file system operations abstraction.
 * Provides methods for file and directory operations that work
 * in both VS Code extension and CLI environments.
 */
export interface IFileSystem {
	/**
	 * Read the contents of a file
	 * @param filePath The path to the file
	 * @param encoding The file encoding (default: utf8)
	 * @returns The file contents
	 */
	readFile(filePath: string, encoding?: BufferEncoding): Promise<string>

	/**
	 * Write content to a file
	 * @param filePath The path to the file
	 * @param content The content to write
	 * @param encoding The file encoding (default: utf8)
	 */
	writeFile(filePath: string, content: string, encoding?: BufferEncoding): Promise<void>

	/**
	 * Append content to a file
	 * @param filePath The path to the file
	 * @param content The content to append
	 * @param encoding The file encoding (default: utf8)
	 */
	appendFile(filePath: string, content: string, encoding?: BufferEncoding): Promise<void>

	/**
	 * Check if a file or directory exists
	 * @param path The path to check
	 * @returns True if the path exists, false otherwise
	 */
	exists(path: string): Promise<boolean>

	/**
	 * Get file or directory stats
	 * @param path The path to get stats for
	 * @returns File stats information
	 */
	stat(path: string): Promise<FileStats>

	/**
	 * Create a directory
	 * @param dirPath The directory path to create
	 * @param options Creation options
	 */
	mkdir(dirPath: string, options?: MkdirOptions): Promise<void>

	/**
	 * Remove a file
	 * @param filePath The file path to remove
	 */
	unlink(filePath: string): Promise<void>

	/**
	 * Remove a directory
	 * @param dirPath The directory path to remove
	 * @param options Removal options
	 */
	rmdir(dirPath: string, options?: RmdirOptions): Promise<void>

	/**
	 * List directory contents
	 * @param dirPath The directory path to list
	 * @param options Listing options
	 * @returns Array of directory entries
	 */
	readdir(dirPath: string, options?: ReaddirOptions): Promise<DirectoryEntry[]>

	/**
	 * Copy a file or directory
	 * @param source The source path
	 * @param destination The destination path
	 * @param options Copy options
	 */
	copy(source: string, destination: string, options?: CopyOptions): Promise<void>

	/**
	 * Move/rename a file or directory
	 * @param source The source path
	 * @param destination The destination path
	 */
	move(source: string, destination: string): Promise<void>

	/**
	 * Watch for file system changes
	 * @param path The path to watch
	 * @param options Watch options
	 * @returns A file watcher instance
	 */
	watch(path: string, options?: WatchOptions): FileWatcher

	/**
	 * Get the absolute path
	 * @param relativePath The relative path
	 * @returns The absolute path
	 */
	resolve(relativePath: string): string

	/**
	 * Join path segments
	 * @param paths The path segments to join
	 * @returns The joined path
	 */
	join(...paths: string[]): string

	/**
	 * Get the directory name of a path
	 * @param path The path
	 * @returns The directory name
	 */
	dirname(path: string): string

	/**
	 * Get the base name of a path
	 * @param path The path
	 * @param ext Optional extension to remove
	 * @returns The base name
	 */
	basename(path: string, ext?: string): string

	/**
	 * Get the extension of a path
	 * @param path The path
	 * @returns The extension
	 */
	extname(path: string): string

	/**
	 * Normalize a path
	 * @param path The path to normalize
	 * @returns The normalized path
	 */
	normalize(path: string): string

	/**
	 * Check if a path is absolute
	 * @param path The path to check
	 * @returns True if the path is absolute
	 */
	isAbsolute(path: string): boolean

	/**
	 * Get the relative path from one path to another
	 * @param from The from path
	 * @param to The to path
	 * @returns The relative path
	 */
	relative(from: string, to: string): string

	/**
	 * Create all necessary directories for a file path
	 * @param filePath The file path
	 * @returns Array of created directories
	 */
	createDirectoriesForFile(filePath: string): Promise<string[]>

	/**
	 * Get the current working directory
	 * @returns The current working directory
	 */
	cwd(): string

	/**
	 * Change the current working directory
	 * @param path The new working directory
	 */
	chdir(path: string): void
}

/**
 * File statistics information
 */
export interface FileStats {
	/** File size in bytes */
	size: number
	/** Whether the path is a file */
	isFile: boolean
	/** Whether the path is a directory */
	isDirectory: boolean
	/** Whether the path is a symbolic link */
	isSymbolicLink: boolean
	/** Creation time */
	birthtime: Date
	/** Last modification time */
	mtime: Date
	/** Last access time */
	atime: Date
	/** Last status change time */
	ctime: Date
	/** File mode/permissions */
	mode: number
}

/**
 * Options for creating directories
 */
export interface MkdirOptions {
	/** Create parent directories if they don't exist */
	recursive?: boolean
	/** Directory mode/permissions */
	mode?: number
}

/**
 * Options for removing directories
 */
export interface RmdirOptions {
	/** Remove directory and its contents recursively */
	recursive?: boolean
	/** Force removal even if directory is not empty */
	force?: boolean
}

/**
 * Options for reading directories
 */
export interface ReaddirOptions {
	/** Include file type information */
	withFileTypes?: boolean
	/** Encoding for file names */
	encoding?: BufferEncoding
}

/**
 * Directory entry information
 */
export interface DirectoryEntry {
	/** Entry name */
	name: string
	/** Whether the entry is a file */
	isFile: boolean
	/** Whether the entry is a directory */
	isDirectory: boolean
	/** Whether the entry is a symbolic link */
	isSymbolicLink: boolean
}

/**
 * Options for copying files/directories
 */
export interface CopyOptions {
	/** Overwrite existing files */
	overwrite?: boolean
	/** Copy recursively for directories */
	recursive?: boolean
	/** Preserve timestamps */
	preserveTimestamps?: boolean
}

/**
 * Options for watching files/directories
 */
export interface WatchOptions {
	/** Watch recursively for directories */
	recursive?: boolean
	/** Encoding for file names */
	encoding?: BufferEncoding
	/** Persistent watcher */
	persistent?: boolean
}

/**
 * File watcher interface
 */
export interface FileWatcher {
	/**
	 * Listen for change events
	 * @param callback The callback to handle change events
	 */
	onChange(callback: (eventType: string, filename: string | null) => void): void

	/**
	 * Listen for error events
	 * @param callback The callback to handle error events
	 */
	onError(callback: (error: Error) => void): void

	/**
	 * Close the watcher
	 */
	close(): void
}