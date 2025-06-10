export interface McpServerConfig {
	id: string
	name: string
	description?: string
	type: "stdio" | "sse"
	enabled: boolean

	// Stdio configuration
	command?: string
	args?: string[]
	env?: Record<string, string>
	cwd?: string

	// SSE configuration
	url?: string
	headers?: Record<string, string>

	// Connection settings
	timeout: number
	retryAttempts: number
	retryDelay: number
	healthCheckInterval: number
}

export interface McpServerInfo {
	id: string
	name: string
	version?: string
	capabilities: McpCapabilities
	status: ServerStatus
	tools: McpToolInfo[]
	resources: McpResourceInfo[]
	lastConnected?: number
	errorHistory?: McpErrorEntry[]
}

export interface McpCapabilities {
	tools: boolean
	resources: boolean
	prompts: boolean
	logging: boolean
}

export interface McpToolInfo {
	name: string
	description?: string
	inputSchema?: any
	serverId: string
	alwaysAllow?: boolean
}

export interface McpResourceInfo {
	uri: string
	name: string
	mimeType?: string
	description?: string
	serverId: string
}

export interface McpErrorEntry {
	message: string
	timestamp: number
	level: "error" | "warn" | "info"
	serverId?: string
}

export type ServerStatus = "connected" | "connecting" | "handshaking" | "disconnected" | "error" | "retrying"

export interface McpConnection {
	id: string
	config: McpServerConfig
	client?: any // MCP Client instance
	transport?: any // Transport instance
	status: ServerStatus
	lastActivity: number
	errorCount: number
	isReady: boolean // Whether handshake is complete and ready for capability requests

	// Connection methods
	connect(): Promise<void>
	disconnect(): Promise<void>
	isHealthy(): Promise<boolean>

	// Handshake methods
	waitForReady(timeout?: number): Promise<void>
	isCapabilityReady(): boolean
}

export interface ValidationResult {
	valid: boolean
	errors: string[]
	warnings: string[]
}

export interface McpExecutionResult {
	success: boolean
	result?: any
	error?: string
	metadata?: Record<string, any>
}

export class McpConnectionError extends Error {
	constructor(
		message: string,
		public serverId?: string,
	) {
		super(message)
		this.name = "McpConnectionError"
	}
}

export class McpToolExecutionError extends Error {
	constructor(
		message: string,
		public toolName?: string,
		public serverId?: string,
	) {
		super(message)
		this.name = "McpToolExecutionError"
	}
}

export class McpConfigurationError extends Error {
	constructor(
		message: string,
		public configPath?: string,
	) {
		super(message)
		this.name = "McpConfigurationError"
	}
}
