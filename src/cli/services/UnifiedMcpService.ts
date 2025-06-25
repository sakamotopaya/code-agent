import { CliMcpAdapter } from "../adapters/CliMcpAdapter"
import { getCLILogger } from "./CLILogger"

interface McpServiceOptions {
	mcpConfigPath?: string
	mcpAutoConnect?: boolean
	mcpTimeout?: number
	mcpRetries?: number
	verbose?: boolean
	workingDirectory?: string
}

/**
 * Unified MCP service for CLI - replaces GlobalCLIMcpService + CLIMcpService
 * Uses the new BaseMcpService architecture with simple cleanup
 */
class UnifiedMcpService {
	private static instance: UnifiedMcpService | null = null
	private mcpAdapter: CliMcpAdapter | null = null
	private initialized = false
	private options: McpServiceOptions = {}

	private constructor() {}

	static getInstance(): UnifiedMcpService {
		if (!UnifiedMcpService.instance) {
			UnifiedMcpService.instance = new UnifiedMcpService()
		}
		return UnifiedMcpService.instance
	}

	async initialize(options: McpServiceOptions = {}): Promise<void> {
		if (this.initialized) {
			getCLILogger().debug("[UnifiedMcpService] Already initialized")
			return
		}

		this.options = options
		const logger = getCLILogger()

		try {
			logger.debug("[UnifiedMcpService] Initializing MCP service...")

			// Create the CLI MCP adapter with options
			this.mcpAdapter = new CliMcpAdapter({
				workingDirectory: options.workingDirectory || process.cwd(),
				configPath: options.mcpConfigPath,
				verbose: options.verbose || false,
			})

			// Auto-connect if enabled
			if (options.mcpAutoConnect !== false) {
				logger.debug("[UnifiedMcpService] Auto-connecting to MCP servers...")
				await this.mcpAdapter.connectToServers()
				logger.debug("[UnifiedMcpService] MCP servers connected successfully")
			} else {
				logger.debug("[UnifiedMcpService] Auto-connect disabled")
			}

			this.initialized = true
			logger.debug("[UnifiedMcpService] MCP service initialized successfully")
		} catch (error) {
			logger.warn("[UnifiedMcpService] Failed to initialize MCP service:", error)
			if (options.verbose) {
				console.error("[UnifiedMcpService] MCP initialization error:", error)
			}
			// Don't throw - allow CLI to continue without MCP
		}
	}

	/**
	 * Get the MCP adapter instance
	 */
	getMcpAdapter(): CliMcpAdapter | null {
		return this.mcpAdapter
	}

	/**
	 * Execute a tool on a specific server
	 */
	async executeTool(serverId: string, toolName: string, args: any): Promise<any> {
		if (!this.mcpAdapter) {
			throw new Error("MCP service not initialized")
		}

		if (this.options.verbose) {
			console.log(`[UnifiedMcpService] Executing tool: ${serverId}/${toolName}`)
		}

		return await this.mcpAdapter.executeTool(serverId, toolName, args)
	}

	/**
	 * Access a resource on a specific server
	 */
	async accessResource(serverId: string, uri: string): Promise<any> {
		if (!this.mcpAdapter) {
			throw new Error("MCP service not initialized")
		}

		if (this.options.verbose) {
			console.log(`[UnifiedMcpService] Accessing resource: ${serverId}/${uri}`)
		}

		return await this.mcpAdapter.readResource(serverId, uri)
	}

	/**
	 * List all available tools from all connected servers
	 */
	async listAvailableTools(): Promise<Array<{ serverName: string; tools: any[] }>> {
		if (!this.mcpAdapter) {
			return []
		}

		return await this.mcpAdapter.getAllTools()
	}

	/**
	 * List all available resources from all connected servers
	 */
	async listAvailableResources(): Promise<Array<{ serverName: string; resources: any[] }>> {
		if (!this.mcpAdapter) {
			return []
		}

		return await this.mcpAdapter.getAllResources()
	}

	/**
	 * Get connected servers
	 */
	getConnectedServers(): Array<{ name: string; status: string; source?: string }> {
		if (!this.mcpAdapter) {
			return []
		}

		return this.mcpAdapter.getConnections().map((conn) => ({
			name: conn.server.name,
			status: conn.server.status,
			source: conn.server.source,
		}))
	}

	/**
	 * Check if service is initialized
	 */
	isInitialized(): boolean {
		return this.initialized
	}

	/**
	 * Simple disposal - uses BaseMcpService cleanup
	 */
	async dispose(): Promise<void> {
		const logger = getCLILogger()
		logger.debug("[UnifiedMcpService] Disposing MCP service...")

		try {
			if (this.mcpAdapter) {
				// Use the simple disposal from CliMcpAdapter -> BaseMcpService
				await this.mcpAdapter.dispose()
				this.mcpAdapter = null
				logger.debug("[UnifiedMcpService] MCP adapter disposed")
			}

			this.initialized = false
			logger.debug("[UnifiedMcpService] MCP service disposed successfully")
		} catch (error) {
			logger.debug("[UnifiedMcpService] Error disposing MCP service:", error)
		}

		// Reset singleton
		UnifiedMcpService.instance = null
	}

	/**
	 * Reset the instance (for testing)
	 */
	static reset(): void {
		UnifiedMcpService.instance = null
	}
}

export { UnifiedMcpService }
