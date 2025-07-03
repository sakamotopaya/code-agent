import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import ReconnectingEventSource from "reconnecting-eventsource"
import {
	CallToolResultSchema,
	ListResourcesResultSchema,
	ListResourceTemplatesResultSchema,
	ListToolsResultSchema,
	ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import deepEqual from "fast-deep-equal"
import { injectEnv } from "../../utils/config"
import type {
	IPlatformServices,
	IFileSystemService,
	IUserInterfaceService,
	IStateService,
	IFileWatcherService,
	IMcpNotificationService,
} from "./interfaces"

export type McpConnection = {
	server: McpServer
	client: Client
	transport: StdioClientTransport | SSEClientTransport
}

export interface McpServer {
	name: string
	status: "connecting" | "connected" | "disconnected" | "error"
	disabled?: boolean
	source?: "global" | "project"
	projectPath?: string
	timeout?: number
	errorHistory?: string[]
}

// Configuration schemas (extracted from McpHub)
const BaseConfigSchema = z.object({
	disabled: z.boolean().optional(),
	timeout: z.number().min(1).max(3600).optional().default(60),
	alwaysAllow: z.array(z.string()).default([]),
	watchPaths: z.array(z.string()).optional(),
})

const createServerTypeSchema = (getDefaultCwd: () => string) => {
	return z.union([
		// Stdio config (has command field)
		BaseConfigSchema.extend({
			type: z.enum(["stdio"]).optional(),
			command: z.string().min(1, "Command cannot be empty"),
			args: z.array(z.string()).optional(),
			cwd: z.string().default(getDefaultCwd),
			env: z.record(z.string()).optional(),
			// Ensure no SSE fields are present
			url: z.undefined().optional(),
			headers: z.undefined().optional(),
		})
			.transform((data) => ({
				...data,
				type: "stdio" as const,
			}))
			.refine((data) => data.type === undefined || data.type === "stdio", {
				message: "Server type must be either 'stdio' or 'sse'",
			}),
		// SSE config (has url field)
		BaseConfigSchema.extend({
			type: z.enum(["sse"]).optional(),
			url: z.string().url("URL must be a valid URL format"),
			headers: z.record(z.string()).optional(),
			// Ensure no stdio fields are present
			command: z.undefined().optional(),
			args: z.undefined().optional(),
			env: z.undefined().optional(),
		})
			.transform((data) => ({
				...data,
				type: "sse" as const,
			}))
			.refine((data) => data.type === undefined || data.type === "sse", {
				message: "Server type must be either 'stdio' or 'sse'",
			}),
	])
}

export type ServerConfig = {
	type: "stdio" | "sse"
	disabled?: boolean
	timeout?: number
	alwaysAllow?: string[]
	watchPaths?: string[]
	// stdio fields
	command?: string
	args?: string[]
	cwd?: string
	env?: Record<string, string>
	// sse fields
	url?: string
	headers?: Record<string, string>
}

/**
 * Base MCP service with core connection and tool execution logic.
 * Platform-specific functionality is injected via services.
 */
export abstract class BaseMcpService {
	protected connections: McpConnection[] = []
	protected isConnecting: boolean = false
	protected isDisposed: boolean = false
	protected services: IPlatformServices
	protected ServerConfigSchema: z.ZodSchema<any>

	constructor(services: IPlatformServices) {
		this.services = services
		this.ServerConfigSchema = createServerTypeSchema(
			() => this.services.fileSystem.getWorkspacePath() || process.cwd(),
		)
	}

	/**
	 * Core connection logic extracted from McpHub - uses simple cleanup
	 */
	async connectToServer(
		name: string,
		config: ServerConfig,
		source: "global" | "project" = "global",
	): Promise<McpConnection> {
		// Remove existing connection if it exists with the same source
		await this.deleteConnection(name, source)

		try {
			const client = new Client(
				{
					name: "Roo Code",
					version: "1.0.0", // Platform can override this
				},
				{
					capabilities: {},
				},
			)

			let transport: StdioClientTransport | SSEClientTransport

			// Inject environment variables to the config
			const configInjected = (await injectEnv(config)) as typeof config

			if (configInjected.type === "stdio") {
				if (!configInjected.command) {
					throw new Error("Command is required for stdio connection")
				}
				transport = new StdioClientTransport({
					command: configInjected.command,
					args: configInjected.args,
					cwd: configInjected.cwd,
					env: {
						...(configInjected.env || {}),
						...(process.env.PATH ? { PATH: process.env.PATH } : {}),
						...(process.env.HOME ? { HOME: process.env.HOME } : {}),
					},
					stderr: "pipe",
				})

				// Set up stdio specific error handling
				transport.onerror = async (error) => {
					console.error(`Transport error for "${name}":`, error)
					const connection = this.findConnection(name, source)
					if (connection) {
						connection.server.status = "disconnected"
						this.appendErrorMessage(connection, error instanceof Error ? error.message : `${error}`)
					}
					await this.services.notifications.notifyServerChanges()
				}

				transport.onclose = async () => {
					const connection = this.findConnection(name, source)
					if (connection) {
						connection.server.status = "disconnected"
					}
					await this.services.notifications.notifyServerChanges()
				}

				await transport.start()
				const stderrStream = transport.stderr
				if (stderrStream) {
					stderrStream.on("data", async (data: Buffer) => {
						const output = data.toString()
						const isInfoLog = /INFO/i.test(output)

						if (isInfoLog) {
							console.log(`Server "${name}" info:`, output)
						} else {
							console.error(`Server "${name}" stderr:`, output)
							const connection = this.findConnection(name, source)
							if (connection) {
								this.appendErrorMessage(connection, output)
							}
						}
					})
				}
				transport.start = () => Promise.resolve()
			} else {
				if (!configInjected.url) {
					throw new Error("URL is required for SSE connection")
				}
				// SSE transport requires global EventSource
				global.EventSource = ReconnectingEventSource
				transport = new SSEClientTransport(new URL(configInjected.url))
			}

			const server: McpServer = {
				name,
				status: "connecting",
				disabled: config.disabled,
				source,
				projectPath:
					source === "project" ? this.services.fileSystem.getWorkspacePath() || undefined : undefined,
				errorHistory: [],
				timeout: config.timeout,
			}

			const connection: McpConnection = {
				server,
				client,
				transport,
			}

			this.connections.push(connection)

			// Connect with timeout
			const connectPromise = client.connect(transport)
			const timeoutPromise = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("Connection timeout")), (config.timeout || 60) * 1000),
			)

			await Promise.race([connectPromise, timeoutPromise])

			server.status = "connected"
			await this.services.notifications.notifyServerChanges()

			return connection
		} catch (error) {
			this.services.userInterface.showError(`Failed to connect to MCP server "${name}": ${error}`)
			throw error
		}
	}

	/**
	 * Simple, clean connection deletion - same as VSCode extension
	 */
	async deleteConnection(name: string, source?: "global" | "project"): Promise<void> {
		const connections = source
			? this.connections.filter((conn) => conn.server.name === name && conn.server.source === source)
			: this.connections.filter((conn) => conn.server.name === name)

		for (const connection of connections) {
			try {
				// This is the key: simple cleanup that works in VSCode
				await connection.transport.close()
				await connection.client.close()
			} catch (error) {
				console.error(`Failed to close transport for ${name}:`, error)
			}
		}

		// Remove the connections from the array
		this.connections = this.connections.filter((conn) => {
			if (conn.server.name !== name) return true
			if (source && conn.server.source !== source) return true
			return false
		})
	}

	/**
	 * Tool execution
	 */
	async executeTool(serverName: string, toolName: string, args: any): Promise<any> {
		const connection = this.findConnection(serverName)
		if (!connection) {
			throw new Error(`No connection found for server: ${serverName}`)
		}

		if (connection.server.status !== "connected") {
			throw new Error(`Server ${serverName} is not connected`)
		}

		try {
			const result = await connection.client.callTool({
				name: toolName,
				arguments: args,
			})

			const parsed = CallToolResultSchema.parse(result)
			return parsed
		} catch (error) {
			this.services.userInterface.showError(`Tool execution failed: ${error}`)
			throw error
		}
	}

	/**
	 * List available tools
	 */
	async listTools(serverName: string): Promise<any[]> {
		const connection = this.findConnection(serverName)
		if (!connection) {
			throw new Error(`No connection found for server: ${serverName}`)
		}

		try {
			const result = await connection.client.listTools()
			const parsed = ListToolsResultSchema.parse(result)
			return parsed.tools || []
		} catch (error) {
			console.error(`Failed to list tools for ${serverName}:`, error)
			return []
		}
	}

	/**
	 * Resource access
	 */
	async readResource(serverName: string, uri: string): Promise<any> {
		const connection = this.findConnection(serverName)
		if (!connection) {
			throw new Error(`No connection found for server: ${serverName}`)
		}

		try {
			const result = await connection.client.readResource({ uri })
			const parsed = ReadResourceResultSchema.parse(result)
			return parsed
		} catch (error) {
			this.services.userInterface.showError(`Resource access failed: ${error}`)
			throw error
		}
	}

	/**
	 * List available resources
	 */
	async listResources(serverName: string): Promise<any[]> {
		const connection = this.findConnection(serverName)
		if (!connection) {
			throw new Error(`No connection found for server: ${serverName}`)
		}

		try {
			const result = await connection.client.listResources()
			const parsed = ListResourcesResultSchema.parse(result)
			return parsed.resources || []
		} catch (error) {
			console.error(`Failed to list resources for ${serverName}:`, error)
			return []
		}
	}

	/**
	 * Dispose all connections - simple cleanup like VSCode
	 */
	async dispose(): Promise<void> {
		if (this.isDisposed) {
			return
		}
		this.isDisposed = true

		// Simple cleanup for all connections
		for (const connection of this.connections) {
			try {
				await this.deleteConnection(connection.server.name, connection.server.source)
			} catch (error) {
				console.error(`Failed to close connection for ${connection.server.name}:`, error)
			}
		}
		this.connections = []
	}

	/**
	 * Helper methods
	 */
	protected findConnection(name: string, source?: "global" | "project"): McpConnection | undefined {
		return this.connections.find((conn) => {
			if (conn.server.name !== name) return false
			if (source && conn.server.source !== source) return false
			return true
		})
	}

	protected appendErrorMessage(connection: McpConnection, message: string): void {
		if (!connection.server.errorHistory) {
			connection.server.errorHistory = []
		}
		connection.server.errorHistory.push(message)
		// Keep only last 10 errors
		if (connection.server.errorHistory.length > 10) {
			connection.server.errorHistory = connection.server.errorHistory.slice(-10)
		}
	}

	/**
	 * Validate server configuration
	 */
	validateServerConfig(config: any, serverName?: string): ServerConfig {
		try {
			return this.ServerConfigSchema.parse(config)
		} catch (validationError) {
			if (validationError instanceof z.ZodError) {
				const errorMessages = validationError.errors
					.map((err) => `${err.path.join(".")}: ${err.message}`)
					.join("; ")
				throw new Error(
					serverName
						? `Invalid configuration for server "${serverName}": ${errorMessages}`
						: `Invalid server configuration: ${errorMessages}`,
				)
			}
			throw validationError
		}
	}

	/**
	 * Get all connections
	 */
	getConnections(): McpConnection[] {
		return [...this.connections]
	}
}
