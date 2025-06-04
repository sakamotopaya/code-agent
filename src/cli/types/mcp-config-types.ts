import { McpServerConfig } from "./mcp-types"

export interface McpConfigFile {
	version: string
	servers: McpServerConfig[]
	defaults: McpDefaults
}

export interface McpDefaults {
	timeout: number
	retryAttempts: number
	retryDelay: number
	healthCheckInterval: number
	autoConnect: boolean
	enableLogging: boolean
}

export interface McpCliOptions {
	mcpConfig?: string // path to MCP configuration file
	mcpServer?: string[] // server IDs to connect to
	mcpTimeout?: number // timeout for MCP operations
	mcpRetries?: number // retry attempts for failed operations
	mcpAutoConnect?: boolean // automatically connect to enabled servers
	mcpLogLevel?: "error" | "warn" | "info" | "debug"
}

export const DEFAULT_MCP_CONFIG: McpDefaults = {
	timeout: 30000,
	retryAttempts: 3,
	retryDelay: 1000,
	healthCheckInterval: 60000,
	autoConnect: true,
	enableLogging: true,
}

export const MCP_CONFIG_FILENAME = "mcp-config.json"
export const MCP_LOGS_DIR = "mcp-logs"

// Example server configurations for documentation/testing
export const EXAMPLE_SERVERS: McpServerConfig[] = [
	{
		id: "github-server",
		name: "GitHub MCP Server",
		description: "Access GitHub repositories and operations",
		type: "stdio",
		enabled: true,
		command: "npx",
		args: ["-y", "@modelcontextprotocol/server-github"],
		env: {
			GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}",
		},
		timeout: 30000,
		retryAttempts: 3,
		retryDelay: 1000,
		healthCheckInterval: 60000,
	},
	{
		id: "filesystem-server",
		name: "Filesystem MCP Server",
		description: "Access local filesystem operations",
		type: "stdio",
		enabled: true,
		command: "npx",
		args: ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"],
		timeout: 15000,
		retryAttempts: 2,
		retryDelay: 500,
		healthCheckInterval: 30000,
	},
	{
		id: "custom-api-server",
		name: "Custom API Server",
		description: "Custom SSE-based MCP server",
		type: "sse",
		enabled: false,
		url: "https://api.example.com/mcp",
		headers: {
			Authorization: "Bearer ${API_TOKEN}",
			"Content-Type": "application/json",
		},
		timeout: 15000,
		retryAttempts: 2,
		retryDelay: 2000,
		healthCheckInterval: 30000,
	},
]
