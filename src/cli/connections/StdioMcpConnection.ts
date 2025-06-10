import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { McpServerConfig, McpConnectionError } from "../types/mcp-types"
import { BaseMcpConnection } from "./BaseMcpConnection"
import { ChildProcess } from "child_process"

export class StdioMcpConnection extends BaseMcpConnection {
	private childProcess?: ChildProcess

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

		// Store reference to child process for cleanup
		this.childProcess = (this.transport as any).process
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

	/**
	 * Force terminate the child process with escalating signals - aggressive CLI mode
	 */
	async forceTerminateProcess(): Promise<void> {
		if (!this.childProcess || this.childProcess.killed) {
			return
		}

		console.log(`[StdioMcp] Force terminating process ${this.childProcess.pid} for ${this.config.name}`)

		return new Promise<void>((resolve) => {
			const pid = this.childProcess!.pid
			let terminated = false

			const onExit = () => {
				if (!terminated) {
					terminated = true
					console.log(`[StdioMcp] Process ${pid} terminated for ${this.config.name}`)
					resolve()
				}
			}

			// Listen for process exit
			this.childProcess!.on("exit", onExit)

			// In CLI batch mode, be more aggressive - try SIGTERM briefly then SIGKILL
			try {
				this.childProcess!.kill("SIGTERM")
				console.log(`[StdioMcp] Sent SIGTERM to process ${pid}`)
			} catch (error) {
				console.log(`[StdioMcp] Error sending SIGTERM: ${error}`)
			}

			// Much shorter wait before SIGKILL in CLI mode (500ms instead of 2000ms)
			setTimeout(() => {
				if (!terminated && !this.childProcess!.killed) {
					try {
						this.childProcess!.kill("SIGKILL")
						console.log(`[StdioMcp] Sent SIGKILL to process ${pid}`)
					} catch (error) {
						console.log(`[StdioMcp] Error sending SIGKILL: ${error}`)
					}
				}

				// Quick resolution after force kill (250ms instead of 1000ms)
				setTimeout(() => {
					if (!terminated) {
						terminated = true
						console.log(`[StdioMcp] Force termination completed for ${this.config.name}`)
						resolve()
					}
				}, 250)
			}, 500)
		})
	}

	/**
	 * Enhanced disconnect with force process termination
	 */
	override async disconnect(): Promise<void> {
		// Call parent disconnect method with aggressive timeout for CLI mode
		const parentDisconnectPromise = super.disconnect()

		try {
			// Wait for parent disconnect with shorter timeout for CLI batch mode
			await Promise.race([
				parentDisconnectPromise,
				new Promise(
					(_, reject) => setTimeout(() => reject(new Error("Parent disconnect timeout")), 1000), // Reduced from 3000ms to 1000ms
				),
			])
		} catch (error) {
			console.warn(`Parent disconnect timeout for ${this.config.name}, proceeding with force termination:`, error)
		}

		// Always attempt force termination to ensure child process is killed
		await this.forceTerminateProcess()
	}
}
