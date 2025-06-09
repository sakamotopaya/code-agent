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
import { ListToolsResultSchema, ListResourcesResultSchema } from "@modelcontextprotocol/sdk/types.js"

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

			if (connection?.client && connection.status === "connected" && connection.isCapabilityReady()) {
				try {
					// Get tools using correct MCP protocol method
					const toolsResult = await connection.client.request({ method: "tools/list" }, ListToolsResultSchema)
					if (toolsResult && toolsResult.tools) {
						serverInfo.tools = toolsResult.tools.map((tool: any) => ({
							name: tool.name,
							description: tool.description,
							inputSchema: tool.inputSchema,
							serverId: config.id,
						}))
					}
				} catch (error) {
					// Log more specific error information
					if (error.code === -32601) {
						console.debug(`Tools not supported by ${config.name} - this is normal for some servers`)
					} else {
						console.error(`Error discovering tools for ${config.name}:`, error.message || error)
					}
				}

				try {
					// Get resources using correct MCP protocol method
					const resourcesResult = await connection.client.request(
						{ method: "resources/list" },
						ListResourcesResultSchema,
					)
					if (resourcesResult && resourcesResult.resources) {
						serverInfo.resources = resourcesResult.resources.map((resource: any) => ({
							uri: resource.uri,
							name: resource.name,
							mimeType: resource.mimeType,
							description: resource.description,
							serverId: config.id,
						}))
					}
				} catch (error) {
					// Log more specific error information
					if (error.code === -32601) {
						console.debug(`Resources not supported by ${config.name} - this is normal for some servers`)
					} else {
						console.error(`Error discovering resources for ${config.name}:`, error.message || error)
					}
				}
			} else if (connection?.status === "connecting" || connection?.status === "handshaking") {
				console.log(`Server ${config.name} is still connecting/handshaking...`)
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
			if (!connection.client || connection.status !== "connected" || !connection.isCapabilityReady()) continue

			try {
				const result = await connection.client.request({ method: "tools/list" }, ListToolsResultSchema)
				if (result && result.tools && Array.isArray(result.tools)) {
					const serverTools = result.tools.map((tool: any) => ({
						name: tool.name,
						description: tool.description,
						inputSchema: tool.inputSchema,
						serverId: connection.id,
					}))
					tools.push(...serverTools)
				}
			} catch (error) {
				if (error.code === -32601) {
					console.debug(
						`Method 'tools/list' not found for ${connection.config.name}. Server may not support this capability.`,
					)
				} else {
					console.error(`Error listing tools for ${connection.config.name}:`, error.message || error)
				}
			}
		}

		return tools
	}

	async executeTool(serverId: string, toolName: string, args: any): Promise<McpExecutionResult> {
		const connection = this.connections.get(serverId)
		if (!connection || !connection.client || connection.status !== "connected" || !connection.isCapabilityReady()) {
			throw new McpToolExecutionError(`Server ${serverId} is not ready for tool execution`, toolName, serverId)
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
			if (error.code === -32601) {
				throw new McpToolExecutionError(
					`Tool '${toolName}' not found on server ${serverId}. Server may not support this tool.`,
					toolName,
					serverId,
				)
			}
			throw new McpToolExecutionError(`Tool execution failed: ${error.message || error}`, toolName, serverId)
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
			if (!connection.client || connection.status !== "connected" || !connection.isCapabilityReady()) continue

			try {
				const result = await connection.client.request({ method: "resources/list" }, ListResourcesResultSchema)
				if (result && result.resources && Array.isArray(result.resources)) {
					const serverResources = result.resources.map((resource: any) => ({
						uri: resource.uri,
						name: resource.name,
						mimeType: resource.mimeType,
						description: resource.description,
						serverId: connection.id,
					}))
					resources.push(...serverResources)
				}
			} catch (error) {
				if (error.code === -32601) {
					console.debug(
						`Method 'resources/list' not found for ${connection.config.name}. Server may not support this capability.`,
					)
				} else {
					console.error(`Error listing resources for ${connection.config.name}:`, error.message || error)
				}
			}
		}

		return resources
	}

	async accessResource(serverId: string, uri: string): Promise<any> {
		const connection = this.connections.get(serverId)
		if (!connection || !connection.client || !connection.isCapabilityReady()) {
			throw new McpConnectionError(`Server ${serverId} is not ready for resource access`, serverId)
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
			const configData = JSON.parse(configContent)

			// Handle both CLI format (McpConfigFile) and Roo Code format (mcpServers object)
			let servers: any[] = []

			if (configData.mcpServers) {
				// Roo Code format: convert mcpServers object to array
				console.log(`Loading Roo Code MCP configuration from: ${resolvedPath}`)
				servers = Object.entries(configData.mcpServers).map(([id, config]: [string, any]) => ({
					id,
					name: config.name || id,
					description: config.description || `MCP Server: ${id}`,
					type: config.type || config.transportType || "stdio",
					enabled: config.enabled !== false && !config.disabled,
					command: config.command,
					args: config.args || [],
					cwd: config.cwd || process.cwd(),
					env: config.env || {},
					url: config.url,
					headers: config.headers || {},
					timeout: config.timeout,
					retryAttempts: config.retryAttempts,
					retryDelay: config.retryDelay,
					healthCheckInterval: config.healthCheckInterval,
					alwaysAllow: config.alwaysAllow || [],
					autoApprove: config.autoApprove || [],
				}))

				// Update defaults from Roo format if available, otherwise use CLI defaults
				if (configData.defaults) {
					this.defaults = { ...DEFAULT_MCP_CONFIG, ...configData.defaults }
				}
			} else if (configData.servers) {
				// CLI format: use servers array directly
				console.log(`Loading CLI MCP configuration from: ${resolvedPath}`)
				servers = configData.servers
				this.defaults = { ...DEFAULT_MCP_CONFIG, ...configData.defaults }
			} else {
				// Empty or invalid configuration
				console.log(`No MCP servers found in configuration: ${resolvedPath}`)
				return []
			}

			// Apply defaults and filter enabled servers
			const configuredServers = servers
				.map((server) => ({
					...server,
					timeout: server.timeout ?? this.defaults.timeout,
					retryAttempts: server.retryAttempts ?? this.defaults.retryAttempts,
					retryDelay: server.retryDelay ?? this.defaults.retryDelay,
					healthCheckInterval: server.healthCheckInterval ?? this.defaults.healthCheckInterval,
				}))
				.filter((server) => server.enabled !== false)

			console.log(`Found ${configuredServers.length} enabled MCP servers`)
			return configuredServers
		} catch (error) {
			if (error.code === "ENOENT") {
				// Config file doesn't exist, return empty array
				console.log(`No MCP configuration file found at: ${resolvedPath}`)
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
		const { getCLILogger } = await import("../services/CLILogger")
		const logger = getCLILogger()

		if (this.isDisposed) {
			return // Already disposed
		}

		logger.debug("CLIMcpService: Starting disposal...")

		// Stop all health checkers first
		for (const [serverId] of this.healthCheckers) {
			try {
				this.stopHealthCheck(serverId)
				logger.debug(`CLIMcpService: Stopped health checker for ${serverId}`)
			} catch (error) {
				logger.debug(`CLIMcpService: Error stopping health checker for ${serverId}:`, error)
			}
		}

		// Disconnect all servers with timeout handling
		const disconnectPromises = Array.from(this.connections.keys()).map(async (serverId) => {
			try {
				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Disconnect timeout")), 3000),
				)

				await Promise.race([this.disconnectFromServer(serverId), timeoutPromise])

				logger.debug(`CLIMcpService: Disconnected from ${serverId}`)
			} catch (error) {
				logger.debug(`CLIMcpService: Force disconnect ${serverId}:`, error)
				// Force remove connection
				this.connections.delete(serverId)
			}
		})

		await Promise.allSettled(disconnectPromises)

		this.isDisposed = true
		logger.debug("CLIMcpService: Disposal complete")
	}

	private isDisposed = false

	private async resolveConfigPath(configPath?: string): Promise<string> {
		if (configPath) {
			return path.resolve(configPath)
		}

		// Priority order for configuration files:
		const configPaths = [
			// 1. Local CLI config
			path.join(process.cwd(), MCP_CONFIG_FILENAME),
			// 2. Project Roo config
			path.join(process.cwd(), ".agentz", "mcp_settings.json"),
			// 3. Global Roo config
			path.join(os.homedir(), ".agentz", "mcp_settings.json"),
			// 4. Global CLI config
			path.join(os.homedir(), ".agentz", MCP_CONFIG_FILENAME),
		]

		// Try each path in order
		for (const configPath of configPaths) {
			try {
				await fs.access(configPath)
				return configPath
			} catch {
				// Continue to next path
			}
		}

		// If no config found, return the global CLI config path (will be created if needed)
		return path.join(os.homedir(), ".agentz", MCP_CONFIG_FILENAME)
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
