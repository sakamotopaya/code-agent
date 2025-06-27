import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { getGlobalStoragePath } from "../../../shared/paths"
import { IProviderContext } from "../../interfaces/IProviderContext"

/**
 * CLI implementation of provider context
 * Handles file-based storage and configuration for CLI mode
 */
export class CLIProviderContext implements IProviderContext {
	private globalStoragePath: string
	private workspacePath: string
	private extensionPath: string
	private stateFile: string
	private configFile: string
	private state: Map<string, any> = new Map()
	private config: any = {}

	constructor(options: { globalStoragePath?: string; workspacePath?: string; extensionPath?: string }) {
		this.globalStoragePath = options.globalStoragePath || getGlobalStoragePath()
		this.workspacePath = options.workspacePath || process.cwd()
		this.extensionPath = options.extensionPath || __dirname
		this.stateFile = path.join(this.globalStoragePath, "global-state.json")
		this.configFile = path.join(this.globalStoragePath, "config.json")
	}

	// Path Methods
	getGlobalStoragePath(): string {
		return this.globalStoragePath
	}

	getWorkspacePath(): string {
		return this.workspacePath
	}

	getExtensionPath(): string {
		return this.extensionPath
	}

	// State Management
	getGlobalState<T>(key: string): T | undefined {
		return this.state.get(key) as T | undefined
	}

	async updateGlobalState(key: string, value: any): Promise<void> {
		this.state.set(key, value)
		await this.saveState()
	}

	// Configuration Management
	getConfiguration(): any {
		return this.config
	}

	async updateConfiguration(config: any): Promise<void> {
		this.config = { ...this.config, ...config }
		await this.saveConfiguration()
	}

	// Lifecycle
	async initialize(): Promise<void> {
		// Ensure storage directory exists
		await this.ensureStorageDirectory()

		// Load existing state and config
		await this.loadState()
		await this.loadConfiguration()
	}

	async dispose(): Promise<void> {
		// Save any pending state changes
		await this.saveState()
		await this.saveConfiguration()

		// Clear in-memory state
		this.state.clear()
		this.config = {}
	}

	// Private Helper Methods
	private async ensureStorageDirectory(): Promise<void> {
		try {
			await fs.mkdir(this.globalStoragePath, { recursive: true })
		} catch (error) {
			console.error(`Failed to create storage directory ${this.globalStoragePath}:`, error)
			throw error
		}
	}

	private async loadState(): Promise<void> {
		try {
			const stateContent = await fs.readFile(this.stateFile, "utf-8")
			const stateData = JSON.parse(stateContent)

			// Load state data into Map
			for (const [key, value] of Object.entries(stateData)) {
				this.state.set(key, value)
			}
		} catch (error) {
			// File doesn't exist yet, that's okay - start with empty state
			console.debug(`No existing state file found at ${this.stateFile}, starting with empty state`)
		}
	}

	private async saveState(): Promise<void> {
		try {
			// Convert Map to object for JSON serialization
			const stateData: Record<string, any> = {}
			for (const [key, value] of this.state.entries()) {
				stateData[key] = value
			}

			await fs.writeFile(this.stateFile, JSON.stringify(stateData, null, 2))
		} catch (error) {
			console.error(`Failed to save state to ${this.stateFile}:`, error)
			throw error
		}
	}

	private async loadConfiguration(): Promise<void> {
		try {
			const configContent = await fs.readFile(this.configFile, "utf-8")
			this.config = JSON.parse(configContent)
		} catch (error) {
			// File doesn't exist yet, that's okay - start with empty config
			console.debug(`No existing config file found at ${this.configFile}, starting with empty config`)
			this.config = {}
		}
	}

	private async saveConfiguration(): Promise<void> {
		try {
			await fs.writeFile(this.configFile, JSON.stringify(this.config, null, 2))
		} catch (error) {
			console.error(`Failed to save configuration to ${this.configFile}:`, error)
			throw error
		}
	}
}
