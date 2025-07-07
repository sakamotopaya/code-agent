import { BaseProvider, IProvider, ProviderType, ProviderState, ProviderSettingsEntry } from "./IProvider"
import type { ProviderSettings } from "@roo-code/types"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

/**
 * File system-based provider for CLI usage
 */
export class FileSystemProvider extends BaseProvider {
	private configPath: string
	private statePath: string
	private state: ProviderState
	private apiConfigurations: Map<string, ProviderSettingsEntry>
	private modeHistory: string[]

	constructor(configPath?: string) {
		super(ProviderType.FileSystem)

		// Set up configuration paths
		const configDir = path.join(os.homedir(), ".agentz")
		this.configPath = configPath || path.join(configDir, "config.json")
		this.statePath = path.join(path.dirname(this.configPath), "state.json")

		// Initialize state
		this.state = this.createDefaultState()
		this.apiConfigurations = new Map()
		this.modeHistory = [this.state.mode]
	}

	async initialize(): Promise<void> {
		try {
			// Ensure config directory exists
			await this.ensureConfigDirectory()

			// Load existing configuration
			await this.loadConfiguration()

			this._isInitialized = true
			this.emit("initialized")
		} catch (error) {
			console.error("Failed to initialize FileSystemProvider:", error)
			throw error
		}
	}

	async dispose(): Promise<void> {
		try {
			// Save current state
			await this.saveConfiguration()

			this._isInitialized = false
			this.emit("disposed")
		} catch (error) {
			console.error("Failed to dispose FileSystemProvider:", error)
			throw error
		}
	}

	async getState(): Promise<ProviderState> {
		return { ...this.state }
	}

	async updateState(key: keyof ProviderState, value: any): Promise<void> {
		;(this.state as any)[key] = value
		this.state.lastUsed = new Date()

		await this.saveConfiguration()
		this.emitStateChanged(key, value)
	}

	async setState(state: Partial<ProviderState>): Promise<void> {
		this.state = { ...this.state, ...state }
		this.state.lastUsed = new Date()

		await this.saveConfiguration()
		this.emit("stateChanged", state)
	}

	async getCurrentMode(): Promise<string> {
		return this.state.mode
	}

	async setMode(mode: string): Promise<void> {
		const oldMode = this.state.mode
		await this.updateState("mode", mode)

		// Update mode history
		if (!this.modeHistory.includes(mode)) {
			this.modeHistory.push(mode)
			// Keep only last 10 modes
			if (this.modeHistory.length > 10) {
				this.modeHistory = this.modeHistory.slice(-10)
			}
		}

		this.emitModeChanged(oldMode, mode)
	}

	async getModeHistory(): Promise<string[]> {
		return [...this.modeHistory]
	}

	async getApiConfiguration(): Promise<ProviderSettings> {
		return this.state.apiConfiguration
	}

	async setApiConfiguration(config: ProviderSettings): Promise<void> {
		await this.updateState("apiConfiguration", config)
		this.emit("configurationChanged", config)
	}

	async listApiConfigurations(): Promise<ProviderSettingsEntry[]> {
		return Array.from(this.apiConfigurations.values())
	}

	getStoragePath(): string {
		return process.env.AGENTZ_STORAGE_PATH || path.join(os.homedir(), ".agentz", "storage")
	}

	getGlobalStoragePath(): string {
		return process.env.AGENTZ_GLOBAL_STORAGE_PATH || path.join(os.homedir(), ".agentz", "global")
	}

	createUrlContentFetcher(): any {
		// Import and create UrlContentFetcher with null context for CLI runtime
		const { UrlContentFetcher } = require("../../services/browser/UrlContentFetcher")
		return new UrlContentFetcher(null)
	}

	createBrowserSession(): any {
		// Import and create BrowserSession with null context for CLI runtime
		const { BrowserSession } = require("../../services/browser/BrowserSession")
		return new BrowserSession(null)
	}

	createFileContextTracker(taskId: string): any {
		// CLI doesn't need file system watching as per user feedback
		// Return a no-op implementation
		return {
			taskId,

			watchFile(filePath: string) {
				// No-op for CLI
			},

			unwatchFile(filePath: string) {
				// No-op for CLI
			},

			dispose() {
				// No-op for CLI
			},
		}
	}

	/**
	 * Ensure configuration directory exists
	 */
	private async ensureConfigDirectory(): Promise<void> {
		const configDir = path.dirname(this.configPath)
		try {
			await fs.access(configDir)
		} catch {
			await fs.mkdir(configDir, { recursive: true })
		}
	}

	/**
	 * Load configuration from file
	 */
	private async loadConfiguration(): Promise<void> {
		try {
			const configExists = await this.fileExists(this.configPath)
			if (configExists) {
				const configData = await fs.readFile(this.configPath, "utf-8")
				const config = JSON.parse(configData)

				if (config.state) {
					this.state = { ...this.state, ...config.state }
				}

				if (config.modeHistory) {
					this.modeHistory = config.modeHistory
				}

				if (config.apiConfigurations) {
					this.apiConfigurations = new Map(Object.entries(config.apiConfigurations))
				}
			}
		} catch (error) {
			console.warn("Failed to load configuration, using defaults:", error)
		}
	}

	/**
	 * Save configuration to file
	 */
	private async saveConfiguration(): Promise<void> {
		try {
			const config = {
				version: "1.0.0",
				lastUpdated: new Date().toISOString(),
				state: this.state,
				modeHistory: this.modeHistory,
				apiConfigurations: Object.fromEntries(this.apiConfigurations),
			}

			await this.writeJsonFileAtomic(this.configPath, config)
		} catch (error) {
			console.error("Failed to save configuration:", error)
		}
	}

	/**
	 * Check if file exists
	 */
	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Write JSON file atomically
	 */
	private async writeJsonFileAtomic(filePath: string, data: any): Promise<void> {
		const tempPath = `${filePath}.tmp`
		await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8")
		await fs.rename(tempPath, filePath)
	}
}
