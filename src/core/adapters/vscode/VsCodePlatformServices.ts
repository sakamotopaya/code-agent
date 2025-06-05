import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import {
	IPlatformServices,
	IConfiguration,
	IUserInterface,
	IClipboard,
	ICommandExecutor,
	IFileSystem,
	ConfigurationScope,
	InputBoxOptions,
	QuickPickOptions,
} from "../../interfaces/platform"
import { IEditorProvider } from "../interfaces/IEditorProvider"
import { VSCodeEditorProvider } from "./VSCodeEditorProvider"

/**
 * VSCode implementation of configuration interface
 */
export class VsCodeConfiguration implements IConfiguration {
	constructor(private extensionName: string) {}

	get<T>(key: string, defaultValue?: T): T | undefined {
		const config = vscode.workspace.getConfiguration(this.extensionName)
		return config.get<T>(key, defaultValue as T)
	}

	async set(key: string, value: any, scope?: ConfigurationScope): Promise<void> {
		const config = vscode.workspace.getConfiguration(this.extensionName)
		const vsCodeScope = this.mapScope(scope)
		await config.update(key, value, vsCodeScope)
	}

	has(key: string): boolean {
		const config = vscode.workspace.getConfiguration(this.extensionName)
		return config.has(key)
	}

	private mapScope(scope?: ConfigurationScope): vscode.ConfigurationTarget {
		switch (scope) {
			case ConfigurationScope.Global:
				return vscode.ConfigurationTarget.Global
			case ConfigurationScope.Workspace:
				return vscode.ConfigurationTarget.Workspace
			case ConfigurationScope.WorkspaceFolder:
				return vscode.ConfigurationTarget.WorkspaceFolder
			default:
				return vscode.ConfigurationTarget.Global
		}
	}
}

/**
 * VSCode implementation of user interface
 */
export class VsCodeUserInterface implements IUserInterface {
	async showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
		return await vscode.window.showInformationMessage(message, ...items)
	}

	async showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
		return await vscode.window.showErrorMessage(message, ...items)
	}

	async showInputBox(options: InputBoxOptions): Promise<string | undefined> {
		const vsCodeOptions: vscode.InputBoxOptions = {
			value: options.value,
			placeHolder: options.placeHolder,
			prompt: options.prompt,
			validateInput: options.validateInput || undefined,
		}
		return await vscode.window.showInputBox(vsCodeOptions)
	}

	async showQuickPick(items: string[], options?: QuickPickOptions): Promise<string | undefined> {
		const vsCodeOptions: vscode.QuickPickOptions = {
			placeHolder: options?.placeHolder,
			canPickMany: options?.canPickMany,
		}
		return await vscode.window.showQuickPick(items, vsCodeOptions)
	}
}

/**
 * VSCode implementation of clipboard
 */
export class VsCodeClipboard implements IClipboard {
	async writeText(text: string): Promise<void> {
		await vscode.env.clipboard.writeText(text)
	}

	async readText(): Promise<string> {
		return await vscode.env.clipboard.readText()
	}
}

/**
 * VSCode implementation of command executor
 */
export class VsCodeCommandExecutor implements ICommandExecutor {
	private disposables: vscode.Disposable[] = []

	async executeCommand(command: string, ...args: any[]): Promise<any> {
		return await vscode.commands.executeCommand(command, ...args)
	}

	registerCommand(command: string, callback: (...args: any[]) => any): void {
		const disposable = vscode.commands.registerCommand(command, callback)
		this.disposables.push(disposable)
	}

	dispose(): void {
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}
}

/**
 * VSCode implementation of file system
 */
export class VsCodeFileSystem implements IFileSystem {
	async readFile(filePath: string): Promise<string> {
		try {
			// Try VSCode workspace file system first
			const uri = vscode.Uri.file(filePath)
			const bytes = await vscode.workspace.fs.readFile(uri)
			return Buffer.from(bytes).toString("utf8")
		} catch (error) {
			// Fallback to Node.js fs
			return await fs.readFile(filePath, "utf8")
		}
	}

	async writeFile(filePath: string, content: string): Promise<void> {
		try {
			// Try VSCode workspace file system first
			const uri = vscode.Uri.file(filePath)
			const bytes = Buffer.from(content, "utf8")
			await vscode.workspace.fs.writeFile(uri, bytes)
		} catch (error) {
			// Fallback to Node.js fs
			await fs.mkdir(path.dirname(filePath), { recursive: true })
			await fs.writeFile(filePath, content, "utf8")
		}
	}

	async exists(filePath: string): Promise<boolean> {
		try {
			const uri = vscode.Uri.file(filePath)
			await vscode.workspace.fs.stat(uri)
			return true
		} catch (error) {
			return false
		}
	}

	async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
		try {
			const uri = vscode.Uri.file(dirPath)
			await vscode.workspace.fs.createDirectory(uri)
		} catch (error) {
			// Fallback to Node.js fs
			await fs.mkdir(dirPath, options)
		}
	}

	async remove(filePath: string): Promise<void> {
		try {
			const uri = vscode.Uri.file(filePath)
			await vscode.workspace.fs.delete(uri, { recursive: true })
		} catch (error) {
			// Fallback to Node.js fs
			await fs.rm(filePath, { recursive: true, force: true })
		}
	}
}

/**
 * VSCode platform services implementation
 */
export class VsCodePlatformServices implements IPlatformServices {
	public readonly configuration: IConfiguration
	public readonly userInterface: IUserInterface
	public readonly clipboard: IClipboard
	public readonly commandExecutor: ICommandExecutor
	public readonly fileSystem: IFileSystem
	public readonly editorProvider: IEditorProvider

	constructor(extensionName: string = "roo-cline") {
		this.configuration = new VsCodeConfiguration(extensionName)
		this.userInterface = new VsCodeUserInterface()
		this.clipboard = new VsCodeClipboard()
		this.commandExecutor = new VsCodeCommandExecutor()
		this.fileSystem = new VsCodeFileSystem()
		this.editorProvider = new VSCodeEditorProvider()
	}

	dispose(): void {
		if (this.commandExecutor instanceof VsCodeCommandExecutor) {
			this.commandExecutor.dispose()
		}
	}
}
