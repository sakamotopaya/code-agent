import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import {
	McpServerConfig,
	McpServerInfo,
	McpConnection,
	McpToolInfo,
	McpResourceInfo,
	McpExecutionResult,
	ValidationResult,
	McpConnectionError,
	McpToolExecutionError,
	McpConfigurationError,
} from "../types/mcp-types"
import { McpConfigFile, McpDefaults, DEFAULT_MCP_CONFIG, MCP_CONFIG_FILENAME } from "../types/mcp-config-types"
import { StdioMcpConnection } from "../connections/StdioMcpConnection"
import { SseMcpConnection } from "../connections/SseMcpConnection"

export interface ICLIMcpService {
	// Server management
	discoverServers(): Promise<McpServerInfo[]>
	connectToServer(config: McpServerConfig): Promise<McpConnection>
	disconnectFromServer(serverId: string): Promise<void>
	getConnectedServers(): McpConnection[]

	// Tool operations
	listAvailableTools(): Promise<McpToolInfo[]>
	executeTool(serverId: string, toolName: string, args: any): Promise<McpExecutionResult>
	validateToolParameters(serverId: string, toolName: string, args: any): boolean

	// Resource operations
	listAvailableResources(): Promise<McpResourceInfo[]>
	accessResource(serverId: string, uri: string): Promise<any>

	// Configuration
	loadServerConfigs(configPath?: string): Promise<McpServerConfig[]>
	validateServerConfig(config: McpServerConfig): ValidationResult

	// Lifecycle
	dispose(): Promise<void>
}

export class CLIMcpService implements ICLIMcpService {
	private connections = new Map<string, McpConnection>()
	private healthCheckers = new Map<string, NodeJS.Timeout>()
	private configPath?: string
	private defaults: McpDefaults = DEFAULT_MCP_CONFIG

	constructor(configPath?: string) {
		this.configPath = configPath
	}

	async discoverServers(): Promise<McpServerInfo[]> {
		const configs = await this.loadServerConfigs(this.configPath)
		const serverInfos: McpServerInfo[] = []

		for (const config of configs) {
			const connection = this.connections.get(config.id)
			const serverInfo: McpServerInfo = {
				id: config.id,
				name: config.name,
				capabilities: {
					tools: true,
					resources: true,
					prompts: false,
					logging: true,
				},
				status: connection?.status || "disconnected",
				tools: [],
				resources: [],
			}

			if (connection?.client) {
				try {
					// Get tools
					const toolsResult = await connection.client.listTools()
					serverInfo.tools = toolsResult.tools.map((tool: any) => ({
						name: tool.name,
						description: tool.description,
						inputSchema: tool.inputSchema,
						serverId: config.id,
					}))

					// Get resources
					const resourcesResult = await connection.client.listResources()
					serverInfo.resources = resourcesResult.resources.map((resource: any) => ({
						uri: resource.uri,
						name: resource.name,
						mimeType: resource.mimeType,
						description: resource.description,
						serverId: config.id,
					}))
				} catch (error) {
					console.error(`Error discovering capabilities for ${config.name}:`, error)
				}
			}

			serverInfos.push(serverInfo)
		}

		return serverInfos
	}

	async connectToServer(config: McpServerConfig): Promise<McpConnection> {
		// Validate configuration
		const validation = this.validateServerConfig(config)
		if (!validation.valid) {
			throw new McpConfigurationError(`Invalid server configuration: ${validation.errors.join(", ")}`)
		}

		// Disconnect existing connection if any
		await this.disconnectFromServer(config.id)

		let connection: McpConnection

		try {
			// Create appropriate connection type
			if (config.type === "stdio") {
				connection = new StdioMcpConnection(config)
			} else {
				connection = new SseMcpConnection(config)
			}

			// Connect
			await connection.connect()

			// Store connection
			this.connections.set(config.id, connection)

			// Start health checking
			this.startHealthCheck(config.id, config.healthCheckInterval)

			return connection
		} catch (error) {
			throw new McpConnectionError(`Failed to connect to ${config.name}: ${error.message}`, config.id)
		}
	}

	async disconnectFromServer(serverId: string): Promise<void> {
		const connection = this.connections.get(serverId)
		if (!connection) {
			return
		}

		// Stop health checking
		this.stopHealthCheck(serverId)

		// Disconnect
		await connection.disconnect()

		// Remove from connections
		this.connections.delete(serverId)
	}

	getConnectedServers(): McpConnection[] {
		return Array.from(this.connections.values()).filter((conn) => conn.status === "connected")
	}

	async listAvailableTools(): Promise<McpToolInfo[]> {
		const tools: McpToolInfo[] = []

		for (const connection of this.getConnectedServers()) {
			if (!connection.client) continue

			try {
				const result = await connection.client.listTools()
				const serverTools = result.tools.map((tool: any) => ({
					name: tool.name,
					description: tool.description,
					inputSchema: tool.inputSchema,
					serverId: connection.id,
				}))
				tools.push(...serverTools)
			} catch (error) {
				console.error(`Error listing tools for ${connection.config.name}:`, error)
			}
		}

		return tools
	}

	async executeTool(serverId: string, toolName: string, args: any): Promise<McpExecutionResult> {
		const connection = this.connections.get(serverId)
		if (!connection || !connection.client) {
			throw new McpToolExecutionError(`Server ${serverId} is not connected`, toolName, serverId)
		}

		try {
			const result = await connection.client.callTool({
				name: toolName,
				arguments: args,
			})

			connection.lastActivity = Date.now()

			return {
				success: !result.isError,
				result: result.content,
				metadata: result._meta,
			}
		} catch (error) {
			connection.errorCount++
			throw new McpToolExecutionError(`Tool execution failed: ${error.message}`, toolName, serverId)
		}
	}

	validateToolParameters(serverId: string, toolName: string, args: any): boolean {
		const connection = this.connections.get(serverId)
		if (!connection || !connection.client) {
			return false
		}

		// This is a simplified validation - in a real implementation,
		// you would validate against the tool's input schema
		try {
			// Basic validation - ensure args is an object
			return typeof args === "object" && args !== null
		} catch {
			return false
		}
	}

	async listAvailableResources(): Promise<McpResourceInfo[]> {
		const resources: McpResourceInfo[] = []

		for (const connection of this.getConnectedServers()) {
			if (!connection.client) continue

			try {
				const result = await connection.client.listResources()
				const serverResources = result.resources.map((resource: any) => ({
					uri: resource.uri,
					name: resource.name,
					mimeType: resource.mimeType,
					description: resource.description,
					serverId: connection.id,
				}))
				resources.push(...serverResources)
			} catch (error) {
				console.error(`Error listing resources for ${connection.config.name}:`, error)
			}
		}

		return resources
	}

	async accessResource(serverId: string, uri: string): Promise<any> {
		const connection = this.connections.get(serverId)
		if (!connection || !connection.client) {
			throw new McpConnectionError(`Server ${serverId} is not connected`, serverId)
		}

		try {
			const result = await connection.client.readResource({ uri })
			connection.lastActivity = Date.now()
			return result
		} catch (error) {
			connection.errorCount++
			throw new McpConnectionError(`Resource access failed: ${error.message}`, serverId)
		}
	}

	async loadServerConfigs(configPath?: string): Promise<McpServerConfig[]> {
		const resolvedPath = await this.resolveConfigPath(configPath)

		try {
			const configContent = await fs.readFile(resolvedPath, "utf-8")
			const configFile: McpConfigFile = JSON.parse(configContent)

			// Update defaults
			this.defaults = { ...DEFAULT_MCP_CONFIG, ...configFile.defaults }

			return configFile.servers.map((server) => ({
				...server,
				timeout: server.timeout || this.defaults.timeout,
				retryAttempts: server.retryAttempts || this.defaults.retryAttempts,
				retryDelay: server.retryDelay || this.defaults.retryDelay,
				healthCheckInterval: server.healthCheckInterval || this.defaults.healthCheckInterval,
			}))
		} catch (error) {
			if (error.code === "ENOENT") {
				// Config file doesn't exist, return empty array
				return []
			}
			throw new McpConfigurationError(`Failed to load configuration: ${error.message}`, resolvedPath)
		}
	}

	validateServerConfig(config: McpServerConfig): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		// Basic validation
		if (!config.id || config.id.trim() === "") {
			errors.push("Server ID is required")
		}

		if (!config.name || config.name.trim() === "") {
			errors.push("Server name is required")
		}

		if (!["stdio", "sse"].includes(config.type)) {
			errors.push('Server type must be either "stdio" or "sse"')
		}

		// Type-specific validation
		if (config.type === "stdio") {
			if (!config.command || config.command.trim() === "") {
				errors.push("Command is required for stdio servers")
			}
		} else if (config.type === "sse") {
			if (!config.url || config.url.trim() === "") {
				errors.push("URL is required for SSE servers")
			} else {
				try {
					new URL(config.url)
				} catch {
					errors.push("Invalid URL format")
				}
			}
		}

		// Timeout validation
		if (config.timeout <= 0) {
			warnings.push("Timeout should be greater than 0")
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		}
	}

	async dispose(): Promise<void> {
		// Stop all health checkers
		for (const [serverId] of this.healthCheckers) {
			this.stopHealthCheck(serverId)
		}

		// Disconnect all servers
		const disconnectPromises = Array.from(this.connections.keys()).map((serverId) =>
			this.disconnectFromServer(serverId),
		)

		await Promise.allSettled(disconnectPromises)
	}

	private async resolveConfigPath(configPath?: string): Promise<string> {
		if (configPath) {
			return path.resolve(configPath)
		}

		// Try current directory first
		const localPath = path.join(process.cwd(), MCP_CONFIG_FILENAME)
		try {
			await fs.access(localPath)
			return localPath
		} catch {
			// Fall back to home directory
			return path.join(os.homedir(), ".roo", MCP_CONFIG_FILENAME)
		}
	}

	private startHealthCheck(serverId: string, interval: number): void {
		this.stopHealthCheck(serverId) // Ensure no duplicate checkers

		const checker = setInterval(async () => {
			const connection = this.connections.get(serverId)
			if (!connection) {
				this.stopHealthCheck(serverId)
				return
			}

			try {
				const isHealthy = await connection.isHealthy()
				if (!isHealthy && connection.status === "connected") {
					console.warn(`Health check failed for ${connection.config.name}`)
					connection.status = "error"
				}
			} catch (error) {
				console.error(`Health check error for ${connection.config.name}:`, error)
				connection.status = "error"
				connection.errorCount++
			}
		}, interval)

		this.healthCheckers.set(serverId, checker)
	}

	private stopHealthCheck(serverId: string): void {
		const checker = this.healthCheckers.get(serverId)
		if (checker) {
			clearInterval(checker)
			this.healthCheckers.delete(serverId)
		}
	}
}
