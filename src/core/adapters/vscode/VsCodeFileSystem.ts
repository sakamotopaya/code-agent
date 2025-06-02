import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import {
	IFileSystem,
	BufferEncoding,
	FileStats,
	MkdirOptions,
	RmdirOptions,
	ReaddirOptions,
	DirectoryEntry,
	CopyOptions,
	WatchOptions,
	FileWatcher,
} from "../../interfaces/IFileSystem"

/**
 * VS Code implementation of the IFileSystem interface.
 * Provides file system operations using VS Code's workspace APIs and Node.js fs module.
 */
export class VsCodeFileSystem implements IFileSystem {
	constructor(private context: vscode.ExtensionContext) {}

	async readFile(filePath: string, encoding: BufferEncoding = "utf8"): Promise<string> {
		try {
			// Try to use VS Code's workspace API first if it's a workspace file
			const uri = vscode.Uri.file(filePath)
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)

			if (workspaceFolder) {
				const document = await vscode.workspace.openTextDocument(uri)
				return document.getText()
			}

			// Fall back to Node.js fs
			return await fs.readFile(filePath, encoding)
		} catch (error) {
			throw new Error(`Failed to read file ${filePath}: ${error}`)
		}
	}

	async writeFile(filePath: string, content: string, encoding: BufferEncoding = "utf8"): Promise<void> {
		try {
			// Ensure directory exists
			await this.mkdir(path.dirname(filePath), { recursive: true })

			// Use Node.js fs for writing
			await fs.writeFile(filePath, content, encoding)

			// Notify VS Code of file changes
			const uri = vscode.Uri.file(filePath)
			const edit = new vscode.WorkspaceEdit()
			edit.createFile(uri, { ignoreIfExists: true })
			await vscode.workspace.applyEdit(edit)
		} catch (error) {
			throw new Error(`Failed to write file ${filePath}: ${error}`)
		}
	}

	async appendFile(filePath: string, content: string, encoding: BufferEncoding = "utf8"): Promise<void> {
		try {
			await fs.appendFile(filePath, content, encoding)
		} catch (error) {
			throw new Error(`Failed to append to file ${filePath}: ${error}`)
		}
	}

	async exists(path: string): Promise<boolean> {
		try {
			await fs.access(path)
			return true
		} catch {
			return false
		}
	}

	async stat(path: string): Promise<FileStats> {
		try {
			const stats = await fs.stat(path)
			return {
				isFile: stats.isFile(),
				isDirectory: stats.isDirectory(),
				isSymbolicLink: stats.isSymbolicLink(),
				size: stats.size,
				mtime: stats.mtime,
				ctime: stats.ctime,
				atime: stats.atime,
				birthtime: stats.birthtime,
				mode: stats.mode,
			}
		} catch (error) {
			throw new Error(`Failed to get stats for ${path}: ${error}`)
		}
	}

	async mkdir(dirPath: string, options?: MkdirOptions): Promise<void> {
		try {
			await fs.mkdir(dirPath, options)
		} catch (error: any) {
			// Ignore error if directory already exists and recursive is true
			if (error.code === "EEXIST" && options?.recursive) {
				return
			}
			throw new Error(`Failed to create directory ${dirPath}: ${error}`)
		}
	}

	async rmdir(dirPath: string, options?: RmdirOptions): Promise<void> {
		try {
			await fs.rmdir(dirPath, options)
		} catch (error) {
			throw new Error(`Failed to remove directory ${dirPath}: ${error}`)
		}
	}

	async readdir(dirPath: string, options?: ReaddirOptions): Promise<DirectoryEntry[]> {
		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })

			return entries.map((entry) => ({
				name: entry.name,
				isFile: entry.isFile(),
				isDirectory: entry.isDirectory(),
				isSymbolicLink: entry.isSymbolicLink(),
			}))
		} catch (error) {
			throw new Error(`Failed to read directory ${dirPath}: ${error}`)
		}
	}

	async unlink(filePath: string): Promise<void> {
		try {
			await fs.unlink(filePath)

			// Notify VS Code of file deletion
			const uri = vscode.Uri.file(filePath)
			const edit = new vscode.WorkspaceEdit()
			edit.deleteFile(uri, { ignoreIfNotExists: true })
			await vscode.workspace.applyEdit(edit)
		} catch (error) {
			throw new Error(`Failed to delete file ${filePath}: ${error}`)
		}
	}

	async copy(src: string, dest: string, options?: CopyOptions): Promise<void> {
		try {
			// Ensure destination directory exists
			await this.mkdir(path.dirname(dest), { recursive: true })

			await fs.copyFile(src, dest)
		} catch (error) {
			throw new Error(`Failed to copy ${src} to ${dest}: ${error}`)
		}
	}

	async move(src: string, dest: string): Promise<void> {
		try {
			// Ensure destination directory exists
			await this.mkdir(path.dirname(dest), { recursive: true })

			await fs.rename(src, dest)

			// Notify VS Code of file move
			const srcUri = vscode.Uri.file(src)
			const destUri = vscode.Uri.file(dest)
			const edit = new vscode.WorkspaceEdit()
			edit.renameFile(srcUri, destUri)
			await vscode.workspace.applyEdit(edit)
		} catch (error) {
			throw new Error(`Failed to move ${src} to ${dest}: ${error}`)
		}
	}

	watch(path: string, options?: WatchOptions): FileWatcher {
		// Use VS Code's file system watcher
		const watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(path, "**/*"),
			false, // Don't ignore creates
			false, // Don't ignore changes
			false, // Don't ignore deletes
		)

		let changeCallback: ((eventType: string, filename: string | null) => void) | undefined
		let errorCallback: ((error: Error) => void) | undefined

		// Set up event handlers
		watcher.onDidChange((uri) => changeCallback?.("change", uri.fsPath))
		watcher.onDidCreate((uri) => changeCallback?.("rename", uri.fsPath))
		watcher.onDidDelete((uri) => changeCallback?.("rename", uri.fsPath))

		return {
			onChange: (callback: (eventType: string, filename: string | null) => void) => {
				changeCallback = callback
			},
			onError: (callback: (error: Error) => void) => {
				errorCallback = callback
			},
			close: () => {
				watcher.dispose()
			},
		}
	}

	resolve(relativePath: string): string {
		return path.resolve(relativePath)
	}

	join(...paths: string[]): string {
		return path.join(...paths)
	}

	normalize(filePath: string): string {
		return path.normalize(filePath)
	}

	async createDirectoriesForFile(filePath: string): Promise<string[]> {
		const dirPath = path.dirname(filePath)
		const createdDirs: string[] = []

		// Split the path into segments
		const segments = dirPath.split(path.sep).filter(Boolean)
		let currentPath = path.isAbsolute(dirPath) ? path.sep : ""

		for (const segment of segments) {
			currentPath = path.join(currentPath, segment)

			if (!(await this.exists(currentPath))) {
				await this.mkdir(currentPath)
				createdDirs.push(currentPath)
			}
		}

		return createdDirs
	}

	cwd(): string {
		return process.cwd()
	}

	chdir(path: string): void {
		process.chdir(path)
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

	isAbsolute(filePath: string): boolean {
		return path.isAbsolute(filePath)
	}

	relative(from: string, to: string): string {
		return path.relative(from, to)
	}
}
