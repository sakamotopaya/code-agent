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
		console.log(`[StdioMcp] forceTerminateProcess called for ${this.config.name}`)
		console.log(`[StdioMcp] childProcess exists: ${!!this.childProcess}`)
		console.log(`[StdioMcp] childProcess.killed: ${this.childProcess?.killed}`)
		console.log(`[StdioMcp] childProcess.pid: ${this.childProcess?.pid}`)

		if (!this.childProcess || this.childProcess.killed) {
			console.log(`[StdioMcp] Early return - no child process or already killed for ${this.config.name}`)
			return
		}

		console.log(`[StdioMcp] Force terminating process ${this.childProcess.pid} for ${this.config.name}`)

		// Immediately unref and destroy streams to prevent event loop blocking
		console.log(`[StdioMcp] About to unref process ${this.childProcess.pid}`)
		this.childProcess.unref()
		console.log(`[StdioMcp] Unref completed for process ${this.childProcess.pid}`)

		// Force close stdio streams first
		try {
			console.log(`[StdioMcp] About to destroy stdio streams for ${this.childProcess.pid}`)
			this.childProcess.stdin?.destroy()
			console.log(`[StdioMcp] Destroyed stdin for ${this.childProcess.pid}`)
			this.childProcess.stdout?.destroy()
			console.log(`[StdioMcp] Destroyed stdout for ${this.childProcess.pid}`)
			this.childProcess.stderr?.destroy()
			console.log(`[StdioMcp] Destroyed stderr for ${this.childProcess.pid}`)
			console.log(`[StdioMcp] All stdio streams destroyed for ${this.childProcess.pid}`)
		} catch (error) {
			console.log(`[StdioMcp] Error destroying stdio streams: ${error}`)
		}

		// Kill process immediately with SIGKILL (no graceful SIGTERM in CLI mode)
		try {
			console.log(`[StdioMcp] About to send SIGKILL to process ${this.childProcess.pid}`)
			const killResult = this.childProcess.kill("SIGKILL")
			console.log(`[StdioMcp] SIGKILL result: ${killResult} for process ${this.childProcess.pid}`)
		} catch (error) {
			console.log(`[StdioMcp] Error sending SIGKILL: ${error}`)
		}

		// Don't wait for process exit - just resolve immediately after cleanup
		// The unref() and stream destruction should be enough to prevent event loop blocking
		console.log(`[StdioMcp] Force termination cleanup completed for ${this.config.name}`)
	}

	/**
	 * Enhanced disconnect with force process termination
	 */
	override async disconnect(): Promise<void> {
		console.log(`[StdioMcp] Starting disconnect for ${this.config.name}`)

		// Call parent disconnect method with aggressive timeout for CLI mode
		const parentDisconnectPromise = super.disconnect()

		try {
			console.log(`[StdioMcp] Waiting for parent disconnect for ${this.config.name}`)
			// Wait for parent disconnect with shorter timeout for CLI batch mode
			await Promise.race([
				parentDisconnectPromise,
				new Promise(
					(_, reject) => setTimeout(() => reject(new Error("Parent disconnect timeout")), 1000), // Reduced from 3000ms to 1000ms
				),
			])
			console.log(`[StdioMcp] Parent disconnect completed for ${this.config.name}`)
		} catch (error) {
			console.warn(`Parent disconnect timeout for ${this.config.name}, proceeding with force termination:`, error)
		}

		// Always attempt force termination to ensure child process is killed
		console.log(`[StdioMcp] Starting force termination for ${this.config.name}`)
		await this.forceTerminateProcess()
		console.log(`[StdioMcp] Force termination completed for ${this.config.name}`)
	}
}
