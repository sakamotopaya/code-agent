import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { McpServerConfig, McpConnectionError } from "../types/mcp-types"
import { BaseMcpConnection } from "./BaseMcpConnection"

export class StdioMcpConnection extends BaseMcpConnection {
	constructor(config: McpServerConfig) {
		super(config)
	}

	async setupTransport(): Promise<void> {
		if (!this.config.command) {
			throw new McpConnectionError("Command is required for stdio connection", this.id)
		}

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
	}

	createClient(): Client {
		return new Client(
			{
				name: "Roo CLI",
				version: "1.0.0",
			},
			{
				capabilities: {},
			},
		)
	}

	setupErrorHandlers(): void {
		const stdioTransport = this.transport as StdioClientTransport
		if (stdioTransport) {
			stdioTransport.onclose = () => {
				if (this.status !== "disconnected") {
					this.status = "disconnected"
					this.isReady = false
				}
			}

			stdioTransport.onerror = (error) => {
				console.error(`Transport error for ${this.config.name}:`, error)
				this.status = "error"
				this.isReady = false
				this.errorCount++
			}
		}
	}
}
