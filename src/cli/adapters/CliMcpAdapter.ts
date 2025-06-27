import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { getGlobalStoragePath as getSharedGlobalStoragePath } from "../../shared/paths"
import { BaseMcpService, ServerConfig, McpConnection } from "../../services/mcp/BaseMcpService"
import type {
	IPlatformServices,
	IFileSystemService,
	IUserInterfaceService,
	IStateService,
	IFileWatcherService,
	IDisposable,
	IMcpNotificationService,
} from "../../services/mcp/interfaces"
import { getCLILogger } from "../services/CLILogger"

/**
 * CLI implementation of file system service
 */
class CliFileSystemService implements IFileSystemService {
	constructor(private workingDirectory: string) {}

	async readFile(filePath: string): Promise<string> {
		return await fs.readFile(filePath, "utf-8")
	}

	async writeFile(filePath: string, content: string): Promise<void> {
		await fs.writeFile(filePath, content, "utf-8")
	}

	async exists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath)
			return true
		} catch {
			return false
		}
	}

	getWorkspacePath(): string | null {
		return this.workingDirectory || process.cwd()
	}

	getGlobalStoragePath(): string {
		return getSharedGlobalStoragePath()
	}

	joinPath(...segments: string[]): string {
		return path.join(...segments)
	}

	dirname(filePath: string): string {
		return path.dirname(filePath)
	}
}

/**
 * CLI implementation of user interface service
 */
class CliUserInterfaceService implements IUserInterfaceService {
	constructor(private verbose: boolean = false) {}

	showError(message: string): void {
		console.error(`❌ ${message}`)
		getCLILogger().error(message)
	}

	showInfo(message: string): void {
		console.log(`ℹ️  ${message}`)
		getCLILogger().info(message)
	}

	showWarning(message: string): void {
		console.warn(`⚠️  ${message}`)
		getCLILogger().warn(message)
	}

	logDebug(message: string): void {
		if (this.verbose) {
			console.log(`🔍 ${message}`)
		}
		getCLILogger().debug(message)
	}
}

/**
 * CLI implementation of state service (simple file-based storage)
 */
class CliStateService implements IStateService {
	private stateFile: string

	constructor(globalStoragePath: string) {
		this.stateFile = path.join(globalStoragePath, "cli-mcp-state.json")
	}

	async get<T>(key: string): Promise<T | undefined> {
		try {
			const content = await fs.readFile(this.stateFile, "utf-8")
			const state = JSON.parse(content)
			return state[key]
		} catch {
			return undefined
		}
	}

	async update(key: string, value: any): Promise<void> {
		let state: Record<string, any> = {}
		try {
			const content = await fs.readFile(this.stateFile, "utf-8")
			state = JSON.parse(content)
		} catch {
			// File doesn't exist or is invalid, start with empty state
		}

		state[key] = value

		// Ensure directory exists
		await fs.mkdir(path.dirname(this.stateFile), { recursive: true })
		await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2))
	}

	async remove(key: string): Promise<void> {
		try {
			const content = await fs.readFile(this.stateFile, "utf-8")
			const state = JSON.parse(content)
			delete state[key]
			await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2))
		} catch {
			// File doesn't exist, nothing to remove
		}
	}

	async clear(): Promise<void> {
		try {
			await fs.unlink(this.stateFile)
		} catch {
			// File doesn't exist, already cleared
		}
	}
}

/**
 * CLI implementation of file watcher service (polling-based)
 */
class CliFileWatcherService implements IFileWatcherService {
	private watchers: Set<NodeJS.Timeout> = new Set()

	watchFile(filePath: string, callback: () => void): IDisposable {
		let lastMtime = 0

		const checkFile = async () => {
			try {
				const stats = await fs.stat(filePath)
				if (stats.mtime.getTime() !== lastMtime) {
					lastMtime = stats.mtime.getTime()
					callback()
				}
			} catch {
				// File doesn't exist or error reading
			}
		}

		// Initial check
		checkFile()

		// Poll every 1 second
		const timer = setInterval(checkFile, 1000)
		this.watchers.add(timer)

		return {
			dispose: () => {
				clearInterval(timer)
				this.watchers.delete(timer)
			},
		}
	}

	watchWorkspace(callback: () => void): IDisposable {
		// For CLI, workspace watching is minimal
		return {
			dispose: () => {
				// No-op
			},
		}
	}

	watchFiles(patterns: string[], callback: (filePath: string) => void): IDisposable {
		// Simplified implementation - watch individual files
		const disposables = patterns.map((pattern) => this.watchFile(pattern, () => callback(pattern)))

		return {
			dispose: () => {
				disposables.forEach((d) => d.dispose())
			},
		}
	}

	disposeAll(): void {
		this.watchers.forEach((timer) => clearInterval(timer))
		this.watchers.clear()
	}
}

/**
 * CLI implementation of notification service (no-op for CLI)
 */
class CliMcpNotificationService implements IMcpNotificationService {
	async notifyServerChanges(): Promise<void> {
		// CLI doesn't need webview notifications
	}

	async notifyToolUpdate(toolName: string): Promise<void> {
		// CLI doesn't need webview notifications
	}

	async notifyResourceUpdate(resourceUri: string): Promise<void> {
		// CLI doesn't need webview notifications
	}

	async notifyConfigurationChange(): Promise<void> {
		// CLI doesn't need webview notifications
	}
}

/**
 * CLI MCP Adapter - replaces the complex CLIMcpService with simple BaseMcpService + CLI adapters
 */
export class CliMcpAdapter extends BaseMcpService {
	private configPath?: string
	private verbose: boolean

	constructor(
		options: {
			workingDirectory?: string
			configPath?: string
			verbose?: boolean
		} = {},
	) {
		const workingDirectory = options.workingDirectory || process.cwd()
		const verbose = options.verbose || false

		const fileSystem = new CliFileSystemService(workingDirectory)
		const services: IPlatformServices = {
			fileSystem,
			userInterface: new CliUserInterfaceService(verbose),
			state: new CliStateService(fileSystem.getGlobalStoragePath()),
			fileWatcher: new CliFileWatcherService(),
			notifications: new CliMcpNotificationService(),
		}

		super(services)
		this.configPath = options.configPath
		this.verbose = verbose
	}

	/**
	 * Load server configurations from file
	 */
	async loadServerConfigs(): Promise<Record<string, ServerConfig>> {
		if (!this.configPath) {
			return {}
		}

		try {
			const configExists = await this.services.fileSystem.exists(this.configPath)
			if (!configExists) {
				if (this.verbose) {
					console.log(`MCP config file not found: ${this.configPath}`)
				}
				return {}
			}

			const content = await this.services.fileSystem.readFile(this.configPath)
			const config = JSON.parse(content)

			// Extract mcpServers section if it exists
			const mcpServers = config.mcpServers || config

			if (this.verbose) {
				console.log(`Loaded MCP config from ${this.configPath}:`, Object.keys(mcpServers))
			}

			return mcpServers
		} catch (error) {
			this.services.userInterface.showError(`Failed to load MCP config: ${error}`)
			return {}
		}
	}

	/**
	 * Connect to multiple servers from configuration
	 */
	async connectToServers(): Promise<void> {
		const configs = await this.loadServerConfigs()

		for (const [name, config] of Object.entries(configs)) {
			if (config.disabled) {
				if (this.verbose) {
					console.log(`Skipping disabled server: ${name}`)
				}
				continue
			}

			try {
				if (this.verbose) {
					console.log(`Connecting to MCP server: ${name}`)
				}

				// Validate config before connecting
				const validatedConfig = this.validateServerConfig(config, name)
				await this.connectToServer(name, validatedConfig, "global")

				if (this.verbose) {
					console.log(`✅ Connected to MCP server: ${name}`)
				}
			} catch (error) {
				this.services.userInterface.showError(`Failed to connect to MCP server "${name}": ${error}`)
			}
		}
	}

	/**
	 * Get all available tools from all connected servers
	 */
	async getAllTools(): Promise<Array<{ serverName: string; tools: any[] }>> {
		const results = []

		for (const connection of this.getConnections()) {
			if (connection.server.status === "connected") {
				try {
					const tools = await this.listTools(connection.server.name)
					results.push({
						serverName: connection.server.name,
						tools,
					})
				} catch (error) {
					if (this.verbose) {
						console.error(`Failed to list tools for ${connection.server.name}:`, error)
					}
				}
			}
		}

		return results
	}

	/**
	 * Get all available resources from all connected servers
	 */
	async getAllResources(): Promise<Array<{ serverName: string; resources: any[] }>> {
		const results = []

		for (const connection of this.getConnections()) {
			if (connection.server.status === "connected") {
				try {
					const resources = await this.listResources(connection.server.name)
					results.push({
						serverName: connection.server.name,
						resources,
					})
				} catch (error) {
					if (this.verbose) {
						console.error(`Failed to list resources for ${connection.server.name}:`, error)
					}
				}
			}
		}

		return results
	}

	/**
	 * Override dispose to include CLI-specific cleanup
	 */
	override async dispose(): Promise<void> {
		if (this.verbose) {
			console.log("🧹 Disposing CLI MCP adapter...")
		}

		// Use the simple disposal from BaseMcpService
		await super.dispose()

		// Clean up CLI-specific watchers
		this.services.fileWatcher.disposeAll()

		if (this.verbose) {
			console.log("✅ CLI MCP adapter disposed")
		}
	}
}
