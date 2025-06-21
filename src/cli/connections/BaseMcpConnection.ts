import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js"
import { McpServerConfig, McpConnection, ServerStatus, McpConnectionError } from "../types/mcp-types"

export abstract class BaseMcpConnection implements McpConnection {
	public id: string
	public config: McpServerConfig
	public client?: Client
	public transport?: any
	public status: ServerStatus = "disconnected"
	public lastActivity: number = Date.now()
	public errorCount: number = 0
	public isReady: boolean = false

	private isConnecting: boolean = false
	private isDisconnecting: boolean = false
	private handshakeTimeout?: NodeJS.Timeout

	constructor(config: McpServerConfig) {
		this.id = config.id
		this.config = config
	}

	abstract setupTransport(): Promise<void>
	abstract createClient(): Client
	abstract setupErrorHandlers(): void

	async connect(): Promise<void> {
		if (this.isConnecting || this.status === "connected") {
			return
		}

		this.isConnecting = true
		this.status = "connecting"
		this.isReady = false

		try {
			// Step 1: Setup transport
			await this.setupTransport()

			// Step 2: Create and setup client
			this.client = this.createClient()
			this.setupErrorHandlers()

			// Step 3: Connect client to transport
			if (!this.transport || !this.client) {
				throw new Error("Transport or client not properly initialized")
			}

			await this.client.connect(this.transport)

			// Step 4: Perform MCP handshake
			this.status = "handshaking"
			await this.initializeHandshake()

			// Step 5: Wait for server to be ready
			await this.waitForReady(this.config.timeout * 1000)

			this.status = "connected"
			this.isReady = true
			this.lastActivity = Date.now()
			this.errorCount = 0
		} catch (error) {
			this.status = "error"
			this.isReady = false
			this.errorCount++
			throw new McpConnectionError(`Failed to connect to ${this.config.name}: ${error.message}`, this.id)
		} finally {
			this.isConnecting = false
			if (this.handshakeTimeout) {
				clearTimeout(this.handshakeTimeout)
				this.handshakeTimeout = undefined
			}
		}
	}

	async disconnect(): Promise<void> {
		if (this.isDisconnecting || this.status === "disconnected") {
			return
		}

		this.isDisconnecting = true
		this.isReady = false

		try {
			// Clear any pending timeouts
			if (this.handshakeTimeout) {
				clearTimeout(this.handshakeTimeout)
				this.handshakeTimeout = undefined
			}

			// Close client connection
			if (this.client) {
				console.log(`[BaseMcp] About to call client.close() for ${this.config.name}`)
				const clientCloseStartTime = Date.now()
				try {
					await this.client.close()
					const clientCloseDuration = Date.now() - clientCloseStartTime
					console.log(
						`[BaseMcp] client.close() completed for ${this.config.name} in ${clientCloseDuration}ms`,
					)
				} catch (error) {
					const clientCloseDuration = Date.now() - clientCloseStartTime
					console.log(
						`[BaseMcp] client.close() failed for ${this.config.name} after ${clientCloseDuration}ms:`,
						error,
					)
					throw error
				}
			}

			// Close transport
			if (this.transport) {
				console.log(`[BaseMcp] About to call transport.close() for ${this.config.name}`)
				const transportCloseStartTime = Date.now()
				try {
					await this.transport.close()
					const transportCloseDuration = Date.now() - transportCloseStartTime
					console.log(
						`[BaseMcp] transport.close() completed for ${this.config.name} in ${transportCloseDuration}ms`,
					)
				} catch (error) {
					const transportCloseDuration = Date.now() - transportCloseStartTime
					console.log(
						`[BaseMcp] transport.close() failed for ${this.config.name} after ${transportCloseDuration}ms:`,
						error,
					)
					throw error
				}
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
			if (this.status !== "connected" || !this.client || !this.isReady) {
				return false
			}

			// Try to ping the server by listing tools using correct MCP protocol
			const result = await this.client.request({ method: "tools/list" }, ListToolsResultSchema)
			this.lastActivity = Date.now()
			return true
		} catch (error) {
			// Log specific error codes for debugging
			if (error.code === -32601) {
				console.debug(
					`Health check method not found for ${this.config.name} - server may not support tools/list`,
				)
				// If server doesn't support tools/list, it might still be healthy
				// We'll consider it healthy if we're in connected state
				return this.status === "connected" && this.isReady
			}
			this.errorCount++
			return false
		}
	}

	async waitForReady(timeout: number = 30000): Promise<void> {
		if (this.isReady) {
			return
		}

		return new Promise((resolve, reject) => {
			const startTime = Date.now()

			this.handshakeTimeout = setTimeout(() => {
				reject(new McpConnectionError(`Handshake timeout after ${timeout}ms for ${this.config.name}`, this.id))
			}, timeout)

			// Poll for readiness
			const checkReady = async () => {
				try {
					if (this.status === "error" || this.status === "disconnected") {
						reject(
							new McpConnectionError(
								`Connection failed during handshake for ${this.config.name}`,
								this.id,
							),
						)
						return
					}

					// Try a simple capability check to see if server is ready
					if (this.client && this.status === "handshaking") {
						try {
							// Test if server responds to basic MCP requests
							await this.client.request({ method: "tools/list" }, ListToolsResultSchema)
							this.isReady = true
							if (this.handshakeTimeout) {
								clearTimeout(this.handshakeTimeout)
								this.handshakeTimeout = undefined
							}
							resolve()
							return
						} catch (error) {
							// If method not found, the server might not support tools but could still be ready
							if (error.code === -32601) {
								// Try a different approach - consider ready if we get method not found
								// This means the server is responding to MCP protocol
								this.isReady = true
								if (this.handshakeTimeout) {
									clearTimeout(this.handshakeTimeout)
									this.handshakeTimeout = undefined
								}
								resolve()
								return
							}
							// For other errors, continue polling
						}
					}

					// Continue polling if not ready yet
					if (Date.now() - startTime < timeout) {
						setTimeout(checkReady, 100) // Check every 100ms
					}
				} catch (error) {
					console.debug(`Readiness check error for ${this.config.name}:`, error)
					// Continue polling unless we've timed out
					if (Date.now() - startTime < timeout) {
						setTimeout(checkReady, 100)
					}
				}
			}

			// Start checking immediately
			checkReady()
		})
	}

	isCapabilityReady(): boolean {
		return this.status === "connected" && this.isReady
	}

	private async initializeHandshake(): Promise<void> {
		// Basic MCP handshake is handled by the client.connect() call
		// Additional handshake logic can be added here if needed

		// Give the server a moment to fully initialize after transport connection
		await new Promise((resolve) => setTimeout(resolve, 100))
	}
}
