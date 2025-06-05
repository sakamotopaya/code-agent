/**
 * Platform abstraction interfaces for VSCode extension and CLI environments
 */

import { IEditorProvider } from "../adapters/interfaces/IEditorProvider"

export interface IConfiguration {
	/**
	 * Get a configuration value (synchronous)
	 */
	get<T>(key: string, defaultValue?: T): T | undefined

	/**
	 * Set a configuration value
	 */
	set(key: string, value: any, scope?: ConfigurationScope): Promise<void>

	/**
	 * Check if a configuration key exists (synchronous)
	 */
	has(key: string): boolean
}

export interface IUserInterface {
	/**
	 * Show an information message
	 */
	showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>

	/**
	 * Show an error message
	 */
	showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>

	/**
	 * Show an input box
	 */
	showInputBox(options: InputBoxOptions): Promise<string | undefined>

	/**
	 * Show a quick pick
	 */
	showQuickPick(items: string[], options?: QuickPickOptions): Promise<string | undefined>
}

export interface IClipboard {
	/**
	 * Write text to clipboard
	 */
	writeText(text: string): Promise<void>

	/**
	 * Read text from clipboard
	 */
	readText(): Promise<string>
}

export interface ICommandExecutor {
	/**
	 * Execute a command
	 */
	executeCommand(command: string, ...args: any[]): Promise<any>

	/**
	 * Register a command
	 */
	registerCommand(command: string, callback: (...args: any[]) => any): void
}

export interface IFileSystem {
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
	 * Create directory
	 */
	mkdir(path: string, options?: { recursive?: boolean }): Promise<void>

	/**
	 * Remove file or directory
	 */
	remove(path: string): Promise<void>
}

// Supporting types
export enum ConfigurationScope {
	Global = "global",
	Workspace = "workspace",
	WorkspaceFolder = "workspaceFolder",
}

export interface InputBoxOptions {
	value?: string
	placeHolder?: string
	prompt?: string
	validateInput?: (input: string) => string | null
}

export interface QuickPickOptions {
	placeHolder?: string
	canPickMany?: boolean
}

/**
 * Platform services container
 */
export interface IPlatformServices {
	configuration: IConfiguration
	userInterface: IUserInterface
	clipboard: IClipboard
	commandExecutor: ICommandExecutor
	fileSystem: IFileSystem
	editorProvider: IEditorProvider
}

/**
 * Platform context types
 */
export enum PlatformContext {
	VSCode = "vscode",
	CLI = "cli",
}
