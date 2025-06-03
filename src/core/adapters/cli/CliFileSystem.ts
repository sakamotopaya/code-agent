import * as fs from "fs/promises"
import * as fsSync from "fs"
import * as path from "path"
import { watch, FSWatcher } from "chokidar"
import {
	IFileSystem,
	FileStats,
	MkdirOptions,
	RmdirOptions,
	ReaddirOptions,
	DirectoryEntry,
	CopyOptions,
	WatchOptions,
	FileWatcher,
} from "../../interfaces"

// BufferEncoding type from Node.js
type BufferEncoding =
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
 * CLI implementation of the IFileSystem interface
 * Uses Node.js fs module for file system operations
 */
export class CliFileSystem implements IFileSystem {
	private workspaceRoot: string
	private currentWorkingDirectory: string

	constructor(workspaceRoot: string = process.cwd()) {
		this.workspaceRoot = path.resolve(workspaceRoot)
		this.currentWorkingDirectory = this.workspaceRoot
	}

	async readFile(filePath: string, encoding: BufferEncoding = "utf8"): Promise<string> {
		const fullPath = this.resolvePath(filePath)
		const content = await fs.readFile(fullPath, encoding)
		return content as string
	}

	async writeFile(filePath: string, content: string, encoding: BufferEncoding = "utf8"): Promise<void> {
		const fullPath = this.resolvePath(filePath)
		await this.createDirectoriesForFile(fullPath)
		await fs.writeFile(fullPath, content, encoding)
	}

	async appendFile(filePath: string, content: string, encoding: BufferEncoding = "utf8"): Promise<void> {
		const fullPath = this.resolvePath(filePath)
		await this.createDirectoriesForFile(fullPath)
		await fs.appendFile(fullPath, content, encoding)
	}

	async exists(filePath: string): Promise<boolean> {
		try {
			const fullPath = this.resolvePath(filePath)
			await fs.access(fullPath)
			return true
		} catch {
			return false
		}
	}

	async stat(filePath: string): Promise<FileStats> {
		const fullPath = this.resolvePath(filePath)
		const stats = await fs.stat(fullPath)

		return {
			size: stats.size,
			isFile: stats.isFile(),
			isDirectory: stats.isDirectory(),
			isSymbolicLink: stats.isSymbolicLink(),
			birthtime: stats.birthtime,
			mtime: stats.mtime,
			atime: stats.atime,
			ctime: stats.ctime,
			mode: stats.mode,
		}
	}

	async mkdir(dirPath: string, options?: MkdirOptions): Promise<void> {
		const fullPath = this.resolvePath(dirPath)
		await fs.mkdir(fullPath, {
			recursive: options?.recursive ?? true,
			mode: options?.mode,
		})
	}

	async unlink(filePath: string): Promise<void> {
		const fullPath = this.resolvePath(filePath)
		await fs.unlink(fullPath)
	}

	async rmdir(dirPath: string, options?: RmdirOptions): Promise<void> {
		const fullPath = this.resolvePath(dirPath)
		await fs.rm(fullPath, {
			recursive: options?.recursive ?? false,
			force: options?.force ?? false,
		})
	}

	async readdir(dirPath: string, options?: ReaddirOptions): Promise<DirectoryEntry[]> {
		const fullPath = this.resolvePath(dirPath)

		if (options?.withFileTypes) {
			const dirents = await fs.readdir(fullPath, { withFileTypes: true })
			return dirents.map((dirent) => ({
				name: dirent.name,
				isFile: dirent.isFile(),
				isDirectory: dirent.isDirectory(),
				isSymbolicLink: dirent.isSymbolicLink(),
			}))
		} else {
			const names = await fs.readdir(fullPath)
			const entries: DirectoryEntry[] = []

			for (const name of names) {
				const entryPath = path.join(fullPath, name)
				const stats = await this.stat(entryPath)
				entries.push({
					name,
					isFile: stats.isFile,
					isDirectory: stats.isDirectory,
					isSymbolicLink: stats.isSymbolicLink,
				})
			}

			return entries
		}
	}

	async copy(source: string, destination: string, options?: CopyOptions): Promise<void> {
		const sourcePath = this.resolvePath(source)
		const destPath = this.resolvePath(destination)

		await this.createDirectoriesForFile(destPath)

		const sourceStats = await this.stat(sourcePath)

		if (sourceStats.isDirectory) {
			if (!options?.recursive) {
				throw new Error("Cannot copy directory without recursive option")
			}

			await this.mkdir(destPath, { recursive: true })
			const entries = await this.readdir(sourcePath)

			for (const entry of entries) {
				const srcEntry = path.join(sourcePath, entry.name)
				const destEntry = path.join(destPath, entry.name)
				await this.copy(srcEntry, destEntry, options)
			}
		} else {
			const copyFlags = options?.overwrite === false ? fsSync.constants.COPYFILE_EXCL : 0
			await fs.copyFile(sourcePath, destPath, copyFlags)

			if (options?.preserveTimestamps) {
				const stats = await fs.stat(sourcePath)
				await fs.utimes(destPath, stats.atime, stats.mtime)
			}
		}
	}

	async move(source: string, destination: string): Promise<void> {
		const sourcePath = this.resolvePath(source)
		const destPath = this.resolvePath(destination)

		await this.createDirectoriesForFile(destPath)
		await fs.rename(sourcePath, destPath)
	}

	watch(filePath: string, options?: WatchOptions): FileWatcher {
		const fullPath = this.resolvePath(filePath)

		const watcher = watch(fullPath, {
			persistent: options?.persistent ?? true,
			// Note: chokidar handles recursive watching automatically for directories
			ignoreInitial: false,
		})

		return new CliFileWatcher(watcher)
	}

	// Path utility methods
	resolve(relativePath: string): string {
		return this.resolvePath(relativePath)
	}

	join(...paths: string[]): string {
		return path.join(...paths)
	}

	dirname(filePath: string): string {
		return path.dirname(filePath)
	}

	basename(filePath: string, ext?: string): string {
		return path.basename(filePath, ext)
	}

	extname(filePath: string): string {
		return path.extname(filePath)
	}

	normalize(filePath: string): string {
		return path.normalize(filePath)
	}

	isAbsolute(filePath: string): boolean {
		return path.isAbsolute(filePath)
	}

	relative(from: string, to: string): string {
		return path.relative(from, to)
	}

	async createDirectoriesForFile(filePath: string): Promise<string[]> {
		const dir = path.dirname(filePath)
		const createdDirs: string[] = []

		try {
			await fs.mkdir(dir, { recursive: true })
			// Note: fs.mkdir with recursive doesn't return created directories
			// We would need to implement custom logic to track which dirs were created
			// For now, we'll return the parent directory
			createdDirs.push(dir)
		} catch (error) {
			// Directory might already exist, which is fine
		}

		return createdDirs
	}

	cwd(): string {
		return this.currentWorkingDirectory
	}

	chdir(newPath: string): void {
		const fullPath = this.resolvePath(newPath)
		this.currentWorkingDirectory = fullPath
		process.chdir(fullPath)
	}

	/**
	 * Resolve a path relative to the current working directory
	 * @param filePath The path to resolve
	 * @returns The absolute path
	 */
	private resolvePath(filePath: string): string {
		if (path.isAbsolute(filePath)) {
			return filePath
		}
		return path.resolve(this.currentWorkingDirectory, filePath)
	}

	/**
	 * Get the workspace root directory
	 * @returns The workspace root directory
	 */
	getWorkspaceRoot(): string {
		return this.workspaceRoot
	}
}

/**
 * CLI implementation of FileWatcher using chokidar
 */
class CliFileWatcher implements FileWatcher {
	private watcher: FSWatcher
	private changeCallbacks: ((eventType: string, filename: string | null) => void)[] = []
	private errorCallbacks: ((error: Error) => void)[] = []

	constructor(watcher: FSWatcher) {
		this.watcher = watcher
		this.setupEventHandlers()
	}

	onChange(callback: (eventType: string, filename: string | null) => void): void {
		this.changeCallbacks.push(callback)
	}

	onError(callback: (error: Error) => void): void {
		this.errorCallbacks.push(callback)
	}

	close(): void {
		this.watcher.close()
	}

	private setupEventHandlers(): void {
		this.watcher.on("all", (eventType: string, path: string) => {
			this.changeCallbacks.forEach((callback) => {
				callback(eventType, path)
			})
		})

		this.watcher.on("error", (err: unknown) => {
			const error = err instanceof Error ? err : new Error(String(err))
			this.errorCallbacks.forEach((callback) => {
				callback(error)
			})
		})
	}
}
