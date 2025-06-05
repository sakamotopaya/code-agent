import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import * as readline from "readline"
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
import { CLIEditorProvider } from "./CLIEditorProvider"

/**
 * CLI implementation of configuration interface
 * Uses JSON config files stored in user's home directory
 */
export class CliConfiguration implements IConfiguration {
	private configPath: string
	private config: Record<string, any> = {}
	private loaded = false

	constructor(
		private extensionName: string,
		customConfigPath?: string,
	) {
		if (customConfigPath) {
			this.configPath = customConfigPath
		} else {
			const configDir = path.join(os.homedir(), `.${extensionName}`)
			this.configPath = path.join(configDir, "config.json")
		}
	}

	private async loadConfig(): Promise<void> {
		if (this.loaded) return

		try {
			const configData = await fs.readFile(this.configPath, "utf8")
			this.config = JSON.parse(configData)
		} catch (error) {
			// Config file doesn't exist or is invalid, use empty config
			this.config = {}
		}
		this.loaded = true
	}

	private async saveConfig(): Promise<void> {
		await fs.mkdir(path.dirname(this.configPath), { recursive: true })
		await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), "utf8")
	}

	get<T>(key: string, defaultValue?: T): T | undefined {
		if (!this.loaded) {
			// Try synchronous load as fallback
			try {
				const configData = require("fs").readFileSync(this.configPath, "utf8")
				this.config = JSON.parse(configData)
				this.loaded = true
			} catch (error) {
				this.config = {}
				this.loaded = true
			}
		}
		const value = this.config[key]
		return value !== undefined ? value : defaultValue
	}

	// Async version for internal use
	async getAsync<T>(key: string, defaultValue?: T): Promise<T | undefined> {
		await this.loadConfig()
		const value = this.config[key]
		return value !== undefined ? value : defaultValue
	}

	async set(key: string, value: any, scope?: ConfigurationScope): Promise<void> {
		await this.loadConfig()
		this.config[key] = value
		await this.saveConfig()
	}

	has(key: string): boolean {
		this.get(key) // This will load config if needed
		return key in this.config
	}

	// Async version for internal use
	async hasAsync(key: string): Promise<boolean> {
		await this.loadConfig()
		return key in this.config
	}
}

/**
 * CLI implementation of user interface
 * Uses console input/output
 */
export class CliUserInterface implements IUserInterface {
	async showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
		console.log(`ℹ ${message}`)
		if (items.length > 0) {
			return await this.showQuickPick(items, { placeHolder: "Select an option:" })
		}
		return undefined
	}

	async showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
		console.error(`❌ ${message}`)
		if (items.length > 0) {
			return await this.showQuickPick(items, { placeHolder: "Select an option:" })
		}
		return undefined
	}

	async showInputBox(options: InputBoxOptions): Promise<string | undefined> {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})

		return new Promise((resolve) => {
			const prompt = options.prompt || options.placeHolder || "Enter value:"
			const defaultValue = options.value ? ` (${options.value})` : ""

			rl.question(`${prompt}${defaultValue}: `, (answer) => {
				rl.close()

				const input = answer.trim() || options.value || ""

				// Validate input if validator provided
				if (options.validateInput && input) {
					const error = options.validateInput(input)
					if (error) {
						console.error(`❌ ${error}`)
						resolve(undefined)
						return
					}
				}

				resolve(input || undefined)
			})
		})
	}

	async showQuickPick(items: string[], options?: QuickPickOptions): Promise<string | undefined> {
		if (items.length === 0) return undefined

		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})

		return new Promise((resolve) => {
			const prompt = options?.placeHolder || "Select an option:"
			console.log(`\n${prompt}`)

			items.forEach((item, index) => {
				console.log(`  ${index + 1}. ${item}`)
			})

			rl.question("\nEnter your choice (number): ", (answer) => {
				rl.close()

				const choice = parseInt(answer.trim(), 10)
				if (choice >= 1 && choice <= items.length) {
					resolve(items[choice - 1])
				} else {
					console.error("❌ Invalid choice")
					resolve(undefined)
				}
			})
		})
	}
}

/**
 * CLI implementation of clipboard
 * Uses system clipboard when available, otherwise logs warning
 */
export class CliClipboard implements IClipboard {
	async writeText(text: string): Promise<void> {
		try {
			// Try to use system clipboard
			const { exec } = require("child_process")
			const platform = process.platform

			let command: string
			if (platform === "darwin") {
				command = "pbcopy"
			} else if (platform === "win32") {
				command = "clip"
			} else {
				command = "xclip -selection clipboard"
			}

			await new Promise<void>((resolve, reject) => {
				const proc = exec(command, (error: any) => {
					if (error) reject(error)
					else resolve()
				})
				proc.stdin?.write(text)
				proc.stdin?.end()
			})
		} catch (error) {
			console.warn("⚠️ Clipboard not available. Text copied to console:")
			console.log("---")
			console.log(text)
			console.log("---")
		}
	}

	async readText(): Promise<string> {
		try {
			// Try to read from system clipboard
			const { exec } = require("child_process")
			const platform = process.platform

			let command: string
			if (platform === "darwin") {
				command = "pbpaste"
			} else if (platform === "win32") {
				command = "powershell Get-Clipboard"
			} else {
				command = "xclip -selection clipboard -o"
			}

			return await new Promise<string>((resolve, reject) => {
				exec(command, (error: any, stdout: any) => {
					if (error) reject(error)
					else resolve(stdout)
				})
			})
		} catch (error) {
			console.warn("⚠️ Clipboard not available")
			return ""
		}
	}
}

/**
 * CLI implementation of command executor
 * Maintains a registry of commands for CLI context
 */
export class CliCommandExecutor implements ICommandExecutor {
	private commands = new Map<string, (...args: any[]) => any>()

	async executeCommand(command: string, ...args: any[]): Promise<any> {
		const handler = this.commands.get(command)
		if (!handler) {
			console.warn(`⚠️ Command not available in CLI context: ${command}`)
			return undefined
		}
		return await handler(...args)
	}

	registerCommand(command: string, callback: (...args: any[]) => any): void {
		this.commands.set(command, callback)
	}
}

/**
 * CLI implementation of file system
 * Uses Node.js fs directly
 */
export class CliFileSystem implements IFileSystem {
	async readFile(filePath: string): Promise<string> {
		return await fs.readFile(filePath, "utf8")
	}

	async writeFile(filePath: string, content: string): Promise<void> {
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await fs.writeFile(filePath, content, "utf8")
	}

	async exists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath)
			return true
		} catch {
			return false
		}
	}

	async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
		await fs.mkdir(dirPath, options)
	}

	async remove(filePath: string): Promise<void> {
		await fs.rm(filePath, { recursive: true, force: true })
	}
}

/**
 * CLI platform services implementation
 */
export class CliPlatformServices implements IPlatformServices {
	public readonly configuration: CliConfiguration
	public readonly userInterface: IUserInterface
	public readonly clipboard: IClipboard
	public readonly commandExecutor: ICommandExecutor
	public readonly fileSystem: IFileSystem
	public readonly editorProvider: IEditorProvider

	constructor(extensionName: string = "roo-cline", configPath?: string) {
		this.configuration = new CliConfiguration(extensionName, configPath)
		this.userInterface = new CliUserInterface()
		this.clipboard = new CliClipboard()
		this.commandExecutor = new CliCommandExecutor()
		this.fileSystem = new CliFileSystem()
		this.editorProvider = new CLIEditorProvider()
	}
}
