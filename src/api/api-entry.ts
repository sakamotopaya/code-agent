/**
 * API Entry Point
 *
 * Main entry point for running the coding agent as an API server.
 * This file provides the HTTP REST API interface similar to the CLI REPL experience.
 */

import { FastifyServer } from "./server/FastifyServer"
import { ApiConfigManager } from "./config/ApiConfigManager"
import { createApiAdapters } from "../core/adapters/api"
import { PlatformServiceFactory, PlatformContext } from "../core/adapters/PlatformServiceFactory"
import type { ApiServerOptions } from "./types/server"

/**
 * Start the API server with the specified options
 *
 * @param options Server configuration options
 * @returns Promise resolving to the server instance
 */
export async function startApiServer(options: ApiServerOptions = {}): Promise<FastifyServer> {
	const config = new ApiConfigManager({ overrides: options })

	// Load configuration before using it
	await config.loadConfiguration()

	// Get the final merged configuration
	const finalConfig = config.getConfiguration()

	// Initialize platform services for API context - force CLI context to avoid VSCode detection issues
	await PlatformServiceFactory.initialize(PlatformContext.CLI, "roo-cline-api")

	// Initialize MCP service following CLI pattern (default to auto-connect)
	const mcpAutoConnect = finalConfig.mcpAutoConnect !== false
	if (mcpAutoConnect) {
		try {
			console.log("[API] Initializing GlobalCLIMcpService...")
			const { GlobalCLIMcpService } = await import("../cli/services/GlobalCLIMcpService")
			const globalMcpService = GlobalCLIMcpService.getInstance()

			// Initialize with MCP-specific options (same as CLI)
			await globalMcpService.initialize({
				mcpConfigPath: finalConfig.mcpConfigPath,
				mcpAutoConnect: mcpAutoConnect,
				mcpTimeout: finalConfig.mcpTimeout || 30000,
				mcpRetries: finalConfig.mcpRetries || 3,
			})
			console.log("[API] GlobalCLIMcpService initialized successfully")
		} catch (error) {
			console.warn("[API] Failed to initialize GlobalCLIMcpService:", error)
		}
	}

	// Create API adapters
	const adapters = await createApiAdapters({
		workspaceRoot: finalConfig.workspaceRoot,
		verbose: finalConfig.verbose || false,
	})

	// Create and configure the Fastify server
	const server = new FastifyServer(config, adapters)

	// Initialize the server
	await server.initialize()

	// Start listening
	await server.start()

	return server
}

/**
 * Stop the API server gracefully
 *
 * @param server The server instance to stop
 */
export async function stopApiServer(server: FastifyServer): Promise<void> {
	await server.stop()
}

/**
 * Main function for CLI usage
 */
export async function main(): Promise<void> {
	try {
		const options: ApiServerOptions = {
			port: parseInt(process.env.API_PORT || process.env.PORT || "3000"),
			host: process.env.API_HOST || process.env.HOST || "localhost",
			workspaceRoot: process.env.API_WORKSPACE_ROOT || process.env.WORKSPACE_ROOT || process.cwd(),
			verbose: process.env.API_VERBOSE === "true" || process.env.VERBOSE === "true",
		}

		const server = await startApiServer(options)

		// Handle graceful shutdown
		const shutdown = async () => {
			console.log("\nShutting down API server...")
			await stopApiServer(server)
			process.exit(0)
		}

		process.on("SIGINT", shutdown)
		process.on("SIGTERM", shutdown)

		console.log(`API server started successfully`)
		console.log(`Server: http://${options.host}:${options.port}`)
		console.log(`Workspace: ${options.workspaceRoot}`)
		console.log("Press Ctrl+C to stop")
	} catch (error) {
		console.error("Failed to start API server:", error)
		process.exit(1)
	}
}

// Run main if this file is executed directly
if (require.main === module) {
	main()
}
