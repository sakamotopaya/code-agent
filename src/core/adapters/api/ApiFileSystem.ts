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
 * Options for API FileSystem adapter
 */
export interface ApiFileSystemOptions {
	verbose?: boolean
}

/**
 * API implementation of the IFileSystem interface
 * Uses Node.js fs module for file system operations with API-specific logging
 */
export class ApiFileSystem implements IFileSystem {
	private workspaceRoot: string
	private currentWorkingDirectory: string
	private options: ApiFileSystemOptions

	constructor(workspaceRoot: string = process.cwd(), options: ApiFileSystemOptions = {}) {
		this.workspaceRoot = path.resolve(workspaceRoot)
		this.currentWorkingDirectory = this.workspaceRoot
		this.options = {
			verbose: false,
			...options,
		}
	}

	private log(message: string): void {
		if (this.options.verbose) {
			console.log(`[API FS] ${message}`)
		}
	}

	async readFile(filePath: string, encoding: BufferEncoding = "utf8"): Promise<string> {
		const fullPath = this.resolvePath(filePath)
		this.log(`Reading file: ${fullPath}`)
		const content = await fs.readFile(fullPath, encoding)
		return content as string
	}

	async writeFile(filePath: string, content: string, encoding: BufferEncoding = "utf8"): Promise<void> {
		const fullPath = this.resolvePath(filePath)
		this.log(`Writing file: ${fullPath}`)

		// Ensure directory exists
		const dir = path.dirname(fullPath)
		await this.ensureDir(dir)

		await fs.writeFile(fullPath, content, encoding)
	}

	async appendFile(filePath: string, content: string, encoding: BufferEncoding = "utf8"): Promise<void> {
		const fullPath = this.resolvePath(filePath)
		this.log(`Appending to file: ${fullPath}`)
		await fs.appendFile(fullPath, content, encoding)
	}

	async unlink(filePath: string): Promise<void> {
		const fullPath = this.resolvePath(filePath)
		this.log(`Unlinking file: ${fullPath}`)
		await fs.unlink(fullPath)
	}

	async exists(filePath: string): Promise<boolean> {
		const fullPath = this.resolvePath(filePath)
		try {
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
			isFile: stats.isFile(),
			isDirectory: stats.isDirectory(),
			isSymbolicLink: stats.isSymbolicLink(),
			size: stats.size,
			birthtime: stats.birthtime,
			mtime: stats.mtime,
			ctime: stats.ctime,
			atime: stats.atime,
			mode: stats.mode,
		}
	}

	async mkdir(dirPath: string, options?: MkdirOptions): Promise<void> {
		const fullPath = this.resolvePath(dirPath)
		this.log(`Creating directory: ${fullPath}`)
		await fs.mkdir(fullPath, { recursive: true, ...options })
	}

	async rmdir(dirPath: string, options?: RmdirOptions): Promise<void> {
		const fullPath = this.resolvePath(dirPath)
		this.log(`Removing directory: ${fullPath}`)
		await fs.rmdir(fullPath, { recursive: false, ...options })
	}

	async readdir(dirPath: string, options?: ReaddirOptions): Promise<DirectoryEntry[]> {
		const fullPath = this.resolvePath(dirPath)
		this.log(`Reading directory: ${fullPath}`)

		const entries = await fs.readdir(fullPath, { withFileTypes: true })

		return entries.map((entry) => ({
			name: entry.name,
			isFile: entry.isFile(),
			isDirectory: entry.isDirectory(),
			isSymbolicLink: entry.isSymbolicLink(),
		}))
	}

	async copy(src: string, dest: string, options?: CopyOptions): Promise<void> {
		const fullSrcPath = this.resolvePath(src)
		const fullDestPath = this.resolvePath(dest)
		this.log(`Copying: ${fullSrcPath} -> ${fullDestPath}`)

		// Ensure destination directory exists
		const destDir = path.dirname(fullDestPath)
		await this.ensureDir(destDir)

		await fs.copyFile(fullSrcPath, fullDestPath)
	}

	async move(src: string, dest: string): Promise<void> {
		const fullSrcPath = this.resolvePath(src)
		const fullDestPath = this.resolvePath(dest)
		this.log(`Moving: ${fullSrcPath} -> ${fullDestPath}`)

		// Ensure destination directory exists
		const destDir = path.dirname(fullDestPath)
		await this.ensureDir(destDir)

		await fs.rename(fullSrcPath, fullDestPath)
	}

	watch(filePath: string, options?: WatchOptions): FileWatcher {
		const fullPath = this.resolvePath(filePath)
		this.log(`Watching: ${fullPath}`)

		const watcher = watch(fullPath, {
			persistent: options?.persistent ?? true,
			...options,
		})

		return {
			onChange: (callback: (eventType: string, filename: string | null) => void) => {
				watcher.on("change", (path) => callback("change", path))
				watcher.on("add", (path) => callback("add", path))
				watcher.on("unlink", (path) => callback("unlink", path))
			},
			onError: (callback: (error: Error) => void) => {
				watcher.on("error", (err) => callback(err instanceof Error ? err : new Error(String(err))))
			},
			close: () => watcher.close(),
		}
	}

	async createReadStream(filePath: string): Promise<NodeJS.ReadableStream> {
		const fullPath = this.resolvePath(filePath)
		this.log(`Creating read stream: ${fullPath}`)
		return fsSync.createReadStream(fullPath)
	}

	async createWriteStream(filePath: string): Promise<NodeJS.WritableStream> {
		const fullPath = this.resolvePath(filePath)
		this.log(`Creating write stream: ${fullPath}`)

		// Ensure directory exists
		const dir = path.dirname(fullPath)
		await this.ensureDir(dir)

		return fsSync.createWriteStream(fullPath)
	}

	getWorkspaceRoot(): string {
		return this.workspaceRoot
	}

	getCurrentWorkingDirectory(): string {
		return this.currentWorkingDirectory
	}

	setCurrentWorkingDirectory(dirPath: string): void {
		const fullPath = this.resolvePath(dirPath)
		this.log(`Changing working directory: ${this.currentWorkingDirectory} -> ${fullPath}`)
		this.currentWorkingDirectory = fullPath
	}

	resolvePath(filePath: string): string {
		if (path.isAbsolute(filePath)) {
			return filePath
		}
		return path.resolve(this.currentWorkingDirectory, filePath)
	}

	relativePath(filePath: string): string {
		const fullPath = this.resolvePath(filePath)
		return path.relative(this.workspaceRoot, fullPath)
	}

	joinPath(...segments: string[]): string {
		return path.join(...segments)
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

	resolve(relativePath: string): string {
		return this.resolvePath(relativePath)
	}

	join(...paths: string[]): string {
		return path.join(...paths)
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
			await fs.access(dir)
		} catch {
			await fs.mkdir(dir, { recursive: true })
			// Note: In a real implementation, we'd track which directories were actually created
			createdDirs.push(dir)
		}

		return createdDirs
	}

	cwd(): string {
		return this.currentWorkingDirectory
	}

	chdir(dirPath: string): void {
		this.setCurrentWorkingDirectory(dirPath)
	}

	private async ensureDir(dirPath: string): Promise<void> {
		try {
			await fs.access(dirPath)
		} catch {
			await fs.mkdir(dirPath, { recursive: true })
		}
	}
}
