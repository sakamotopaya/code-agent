import { CLIMcpService, ICLIMcpService } from "./CLIMcpService"
import { McpServerConfig } from "../types/mcp-types"
import { getCLILogger } from "./CLILogger"
import { McpDebugLogger } from "../../shared/mcp/McpDebugLogger"

/**
 * Global singleton MCP service for CLI mode.
 * Initializes MCP servers once at startup and shares them across all tasks.
 */
class GlobalCLIMcpService {
	private static instance: GlobalCLIMcpService | null = null
	private mcpService: CLIMcpService | null = null
	private initialized = false
	private initializationPromise: Promise<void> | null = null
	private configPath?: string
	private mcpAutoConnect = true
	private mcpTimeout?: number
	private mcpRetries?: number
	private verbose = false
	private serverCapabilities: Map<string, any> = new Map()

	private constructor() {}

	static getInstance(): GlobalCLIMcpService {
		if (!GlobalCLIMcpService.instance) {
			GlobalCLIMcpService.instance = new GlobalCLIMcpService()
		}
		return GlobalCLIMcpService.instance
	}

	/**
	 * Initialize the global MCP service once at CLI startup
	 */
	async initialize(options: {
		mcpConfigPath?: string
		mcpAutoConnect?: boolean
		mcpTimeout?: number
		mcpRetries?: number
		verbose?: boolean
	}): Promise<void> {
		// If already initialized or initializing, return the existing promise
		if (this.initialized) {
			return
		}
		if (this.initializationPromise) {
			return this.initializationPromise
		}

		this.configPath = options.mcpConfigPath
		this.mcpAutoConnect = options.mcpAutoConnect ?? true
		this.mcpTimeout = options.mcpTimeout
		this.mcpRetries = options.mcpRetries
		this.verbose = options.verbose ?? false

		this.initializationPromise = this._initializeInternal()
		await this.initializationPromise
	}

	private async _initializeInternal(): Promise<void> {
		const logger = getCLILogger()

		try {
			if (this.verbose) {
				console.log("[GlobalCLIMcpService] DEBUG: Starting MCP service initialization...")
				console.log("[GlobalCLIMcpService] DEBUG: Config path:", this.configPath || "undefined")
				console.log("[GlobalCLIMcpService] DEBUG: Auto-connect:", this.mcpAutoConnect)
			}

			logger.debug("[GlobalCLIMcpService] Initializing MCP service...")

			this.mcpService = new CLIMcpService(this.configPath, this.verbose)

			// Load and connect to configured servers
			if (this.verbose) {
				console.log("[GlobalCLIMcpService] DEBUG: About to load server configs...")
			}
			const serverConfigs = await this.mcpService.loadServerConfigs()
			if (this.verbose) {
				console.log(`Loading Roo Code MCP configuration from: ${this.configPath || "default locations"}`)
				console.log(`Found ${serverConfigs.length} enabled MCP servers`)

				// Debug: log server details
				serverConfigs.forEach((config) => {
					console.log(`  - Server: ${config.name} (${config.id}) - enabled: ${config.enabled !== false}`)
				})
			}

			if (this.mcpAutoConnect && serverConfigs.length > 0) {
				if (this.verbose) {
					console.log("[GlobalCLIMcpService] DEBUG: Starting server connections...")
				}
				for (const config of serverConfigs) {
					try {
						if (this.verbose) {
							console.log(`CLI MCP: Connecting to server ${config.name}...`)
						}
						await this.mcpService.connectToServer(config)
						if (this.verbose) {
							console.log(`CLI MCP: Successfully connected to ${config.name}`)
						}
					} catch (error) {
						console.warn(`CLI MCP: Failed to connect to server ${config.name}:`, error)
					}
				}
			} else if (!this.mcpAutoConnect) {
				if (this.verbose) {
					console.log("[GlobalCLIMcpService] DEBUG: Auto-connect disabled, servers loaded but not connected")
				}
				logger.debug("CLI MCP: Auto-connect disabled, servers loaded but not connected")
			} else {
				if (this.verbose) {
					console.log("[GlobalCLIMcpService] DEBUG: No servers to connect to")
				}
			}

			this.initialized = true
			if (this.verbose) {
				console.log("[GlobalCLIMcpService] DEBUG: MCP service initialization completed successfully")
			}
			logger.debug("[GlobalCLIMcpService] MCP service initialized successfully")
		} catch (error) {
			if (this.verbose) {
				console.error("[GlobalCLIMcpService] ERROR: Failed to initialize MCP service:", error)
			}
			logger.warn(`[GlobalCLIMcpService] Failed to initialize MCP service:`, error)
			// Don't throw - allow CLI to continue without MCP
		}
	}

	/**
	 * Get the shared MCP service instance
	 */
	getMcpService(): CLIMcpService | null {
		return this.mcpService
	}

	/**
	 * Check if MCP service is initialized and ready
	 */
	isInitialized(): boolean {
		return this.initialized && this.mcpService !== null
	}

	/**
	 * Create a compatible mcpHub interface for existing code
	 */
	createMcpHub(): any {
		if (!this.mcpService) {
			return null
		}

		return {
			getServers: () => {
				return this.mcpService!.getConnectedServers().map((conn: any) => {
					const capabilities = this.serverCapabilities.get(conn.config.name) || {
						tools: [],
						resources: [],
						resourceTemplates: [],
					}

					return {
						name: conn.config.name,
						status: conn.status,
						config: JSON.stringify(conn.config),
						tools: capabilities.tools,
						resources: capabilities.resources,
						resourceTemplates: capabilities.resourceTemplates,
					}
				})
			},
			isConnecting: false,
		}
	}

	/**
	 * Populate tools and resources for servers in the mcpHub
	 */
	async populateServerCapabilities(mcpHub: any): Promise<void> {
		McpDebugLogger.section("populateServerCapabilities", "Starting capability population")

		if (!this.mcpService || !mcpHub) {
			McpDebugLogger.section("populateServerCapabilities", "Missing mcpService or mcpHub")
			return
		}

		const servers = mcpHub.getServers()
		McpDebugLogger.section("populateServerCapabilities", `Processing ${servers.length} servers`)

		for (const server of servers) {
			McpDebugLogger.section("populateServerCapabilities", `Processing server: ${server.name}`)
			try {
				const connection = this.mcpService
					.getConnectedServers()
					.find((conn: any) => conn.config.name === server.name)

				McpDebugLogger.section(
					"populateServerCapabilities",
					`Connection found for ${server.name}:`,
					!!connection,
				)
				McpDebugLogger.section(
					"populateServerCapabilities",
					`Connection ready for ${server.name}:`,
					connection?.isCapabilityReady(),
				)

				if (connection?.client && connection.isCapabilityReady()) {
					// Import MCP types for proper request format
					const { ListToolsResultSchema, ListResourcesResultSchema } = await import(
						"@modelcontextprotocol/sdk/types.js"
					)

					try {
						McpDebugLogger.section("populateServerCapabilities", `Requesting tools for ${server.name}`)
						// Get tools using correct MCP protocol method
						const toolsResult = await connection.client.request(
							{ method: "tools/list" },
							ListToolsResultSchema,
						)
						McpDebugLogger.section(
							"populateServerCapabilities",
							`Tools result for ${server.name}:`,
							toolsResult.tools.length,
							"tools",
						)
						McpDebugLogger.section(
							"populateServerCapabilities",
							`Tool names for ${server.name}:`,
							toolsResult.tools.map((t: any) => t.name),
						)

						const tools = toolsResult.tools.map((tool: any) => ({
							name: tool.name,
							description: tool.description,
							inputSchema: tool.inputSchema,
						}))
						server.tools = tools
						McpDebugLogger.section(
							"populateServerCapabilities",
							`Server ${server.name} now has ${server.tools.length} tools`,
						)

						// Store tools persistently for createMcpHub to access
						const existingCapabilities = this.serverCapabilities.get(server.name) || {}
						this.serverCapabilities.set(server.name, {
							...existingCapabilities,
							tools: tools,
						})
					} catch (error: any) {
						McpDebugLogger.section(
							"populateServerCapabilities",
							`Error getting tools for ${server.name}:`,
							error.message,
						)
						if (error.code !== -32601) {
							getCLILogger().debug(`Error getting tools for ${server.name}:`, error)
						}
						// Tools not supported, use empty array
						server.tools = []
					}

					try {
						// Get resources using correct MCP protocol method
						const resourcesResult = await connection.client.request(
							{ method: "resources/list" },
							ListResourcesResultSchema,
						)
						const resources = resourcesResult.resources.map((resource: any) => ({
							uri: resource.uri,
							name: resource.name,
							description: resource.description,
						}))
						server.resources = resources

						// Store resources persistently for createMcpHub to access
						const existingCapabilities = this.serverCapabilities.get(server.name) || {}
						this.serverCapabilities.set(server.name, {
							...existingCapabilities,
							resources: resources,
						})
					} catch (error: any) {
						if (error.code !== -32601) {
							getCLILogger().debug(`Error getting resources for ${server.name}:`, error)
						}
						// Resources not supported, use empty array
						server.resources = []
					}
				} else if (connection && !connection.isCapabilityReady()) {
					getCLILogger().debug(`Server ${server.name} is not ready for capability discovery yet`)
				}
			} catch (error) {
				getCLILogger().warn(`Failed to get capabilities for ${server.name}:`, error)
			}
		}
	}

	/**
	 * Dispose of the global MCP service
	 */
	async dispose(): Promise<void> {
		const logger = getCLILogger()

		if (this.mcpService) {
			try {
				logger.debug("[GlobalCLIMcpService] Disposing MCP service...")
				await this.mcpService.dispose()
				logger.debug("[GlobalCLIMcpService] MCP service disposed")
			} catch (error) {
				logger.debug("[GlobalCLIMcpService] Error disposing MCP service:", error)
			}
			this.mcpService = null
		}

		this.initialized = false
		this.initializationPromise = null
		GlobalCLIMcpService.instance = null
	}
}

export { GlobalCLIMcpService }
