import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { McpServerConfig, McpConnectionError } from "../types/mcp-types"
import { BaseMcpConnection } from "./BaseMcpConnection"

export class SseMcpConnection extends BaseMcpConnection {
	constructor(config: McpServerConfig) {
		super(config)
	}

	async setupTransport(): Promise<void> {
		if (!this.config.url) {
			throw new McpConnectionError("URL is required for SSE connection", this.id)
		}

		this.transport = new SSEClientTransport(new URL(this.config.url), this.config.headers || {})
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
		const sseTransport = this.transport as SSEClientTransport
		if (sseTransport) {
			sseTransport.onclose = () => {
				if (this.status !== "disconnected") {
					this.status = "disconnected"
					this.isReady = false
				}
			}

			sseTransport.onerror = (error) => {
				console.error(`Transport error for ${this.config.name}:`, error)
				this.status = "error"
				this.isReady = false
				this.errorCount++
			}
		}
	}
}
