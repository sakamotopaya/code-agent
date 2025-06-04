import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { McpServerConfig, McpConnection, ServerStatus, McpConnectionError } from "../types/mcp-types"

export class StdioMcpConnection implements McpConnection {
	public id: string
	public config: McpServerConfig
	public client?: Client
	public transport?: StdioClientTransport
	public status: ServerStatus = "disconnected"
	public lastActivity: number = Date.now()
	public errorCount: number = 0

	private isConnecting: boolean = false
	private isDisconnecting: boolean = false

	constructor(config: McpServerConfig) {
		this.id = config.id
		this.config = config
	}

	async connect(): Promise<void> {
		if (this.isConnecting || this.status === "connected") {
			return
		}

		if (!this.config.command) {
			throw new McpConnectionError("Command is required for stdio connection", this.id)
		}

		this.isConnecting = true
		this.status = "connecting"

		try {
			// Create transport and client
			this.transport = new StdioClientTransport({
				command: this.config.command,
				args: this.config.args || [],
				cwd: this.config.cwd,
				env: {
					...(Object.fromEntries(
						Object.entries(process.env).filter(([, value]) => value !== undefined),
					) as Record<string, string>),
					...this.config.env,
				},
				stderr: "pipe",
			})

			this.client = new Client(
				{
					name: `cli-client-${this.id}`,
					version: "1.0.0",
				},
				{
					capabilities: {
						tools: {},
						resources: {},
					},
				},
			)

			// Set up error handlers
			this.setupErrorHandlers()

			// Start transport and connect client
			await this.transport.start()
			await this.client.connect(this.transport)

			this.status = "connected"
			this.lastActivity = Date.now()
			this.errorCount = 0
		} catch (error) {
			this.status = "error"
			this.errorCount++
			throw new McpConnectionError(`Failed to connect to ${this.config.name}: ${error.message}`, this.id)
		} finally {
			this.isConnecting = false
		}
	}

	async disconnect(): Promise<void> {
		if (this.isDisconnecting || this.status === "disconnected") {
			return
		}

		this.isDisconnecting = true

		try {
			// Close client connection
			if (this.client) {
				await this.client.close()
			}

			// Close transport
			if (this.transport) {
				await this.transport.close()
			}

			this.status = "disconnected"
		} catch (error) {
			console.error(`Error disconnecting from ${this.config.name}:`, error)
		} finally {
			this.isDisconnecting = false
		}
	}

	async isHealthy(): Promise<boolean> {
		try {
			if (this.status !== "connected" || !this.client) {
				return false
			}

			// Try to ping the server by listing tools
			await this.client.listTools()
			this.lastActivity = Date.now()
			return true
		} catch (error) {
			this.errorCount++
			return false
		}
	}

	private setupErrorHandlers(): void {
		if (this.transport) {
			this.transport.onclose = () => {
				if (this.status !== "disconnected") {
					this.status = "disconnected"
				}
			}

			this.transport.onerror = (error) => {
				console.error(`Transport error for ${this.config.name}:`, error)
				this.status = "error"
				this.errorCount++
			}
		}
	}
}
