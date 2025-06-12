import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import cors from "@fastify/cors"
import helmet from "@fastify/helmet"
import { ApiConfigManager } from "../config/ApiConfigManager"
import type { ApiServerOptions, ServerStatus, HealthCheck } from "../types/server"
import type { CoreInterfaces } from "../../core/interfaces"

/**
 * Fastify-based API server implementation
 */
export class FastifyServer {
	private app: FastifyInstance
	private config: ApiConfigManager
	private adapters: CoreInterfaces
	private isRunning = false
	private startTime?: Date
	private requestCount = 0

	constructor(config: ApiConfigManager, adapters: CoreInterfaces) {
		this.config = config
		this.adapters = adapters
		this.app = fastify({
			logger: {
				level: config.getConfiguration().debug ? "debug" : "info",
			},
		})
	}

	/**
	 * Initialize the server with middleware and routes
	 */
	async initialize(): Promise<void> {
		const serverConfig = this.config.getConfiguration()

		// Register CORS
		if (serverConfig.cors) {
			await this.app.register(cors, {
				origin: serverConfig.cors.origin,
				credentials: serverConfig.cors.credentials,
				methods: serverConfig.cors.methods,
			})
		}

		// Register Helmet for security
		if (serverConfig.security?.enableHelmet) {
			await this.app.register(helmet)
		}

		// Add request logging middleware
		this.app.addHook("onRequest", async (request: FastifyRequest) => {
			this.requestCount++
			if (serverConfig.verbose) {
				console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`)
			}
		})

		// Register routes
		await this.registerRoutes()

		// Add global error handler
		this.app.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
			console.error("API Error:", error)

			await reply.status(500).send({
				error: "Internal Server Error",
				message: error.message,
				timestamp: new Date().toISOString(),
			})
		})
	}

	/**
	 * Register API routes
	 */
	private async registerRoutes(): Promise<void> {
		// Health check endpoint
		this.app.get("/health", async (request: FastifyRequest, reply: FastifyReply) => {
			const health = await this.getHealthCheck()
			const statusCode = health.status === "healthy" ? 200 : 503
			return reply.status(statusCode).send(health)
		})

		// Status endpoint
		this.app.get("/status", async (request: FastifyRequest, reply: FastifyReply) => {
			const status = await this.getServerStatus()
			return reply.send(status)
		})

		// Basic execute endpoint (simplified for now)
		this.app.post("/execute", async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				const body = request.body as any
				const task = body.task || "No task specified"

				// For now, just return a simple response
				// In full implementation, this would delegate to the Task engine
				await this.adapters.userInterface.showInformation(`Received task: ${task}`)

				return reply.send({
					success: true,
					message: "Task received",
					task,
					timestamp: new Date().toISOString(),
				})
			} catch (error) {
				console.error("Execute error:", error)
				return reply.status(500).send({
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
					timestamp: new Date().toISOString(),
				})
			}
		})

		// SSE streaming execute endpoint
		this.app.post("/execute/stream", async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				const body = request.body as any
				const task = body.task || "No task specified"

				// Set SSE headers
				reply.raw.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Headers": "Cache-Control",
				})

				// Send initial message
				reply.raw.write(
					`data: ${JSON.stringify({
						type: "start",
						message: "Task started",
						task,
						timestamp: new Date().toISOString(),
					})}\n\n`,
				)

				// Simulate processing with progress updates
				const steps = [
					"Analyzing task...",
					"Planning approach...",
					"Executing steps...",
					"Verifying results...",
					"Task completed!",
				]

				for (let i = 0; i < steps.length; i++) {
					await new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second delay

					reply.raw.write(
						`data: ${JSON.stringify({
							type: "progress",
							step: i + 1,
							total: steps.length,
							message: steps[i],
							timestamp: new Date().toISOString(),
						})}\n\n`,
					)
				}

				// Send completion message
				reply.raw.write(
					`data: ${JSON.stringify({
						type: "complete",
						message: "Task completed successfully",
						result: `Processed task: "${task}"`,
						timestamp: new Date().toISOString(),
					})}\n\n`,
				)

				reply.raw.end()
			} catch (error) {
				console.error("Stream execute error:", error)
				reply.raw.write(
					`data: ${JSON.stringify({
						type: "error",
						error: error instanceof Error ? error.message : "Unknown error",
						timestamp: new Date().toISOString(),
					})}\n\n`,
				)
				reply.raw.end()
			}
		})

		// Catch-all for undefined routes (excluding OPTIONS which is handled by CORS)
		this.app.get("*", async (request: FastifyRequest, reply: FastifyReply) => {
			return reply.status(404).send({
				error: "Not Found",
				message: `Route ${request.method} ${request.url} not found`,
				timestamp: new Date().toISOString(),
			})
		})

		this.app.post("*", async (request: FastifyRequest, reply: FastifyReply) => {
			return reply.status(404).send({
				error: "Not Found",
				message: `Route ${request.method} ${request.url} not found`,
				timestamp: new Date().toISOString(),
			})
		})

		this.app.put("*", async (request: FastifyRequest, reply: FastifyReply) => {
			return reply.status(404).send({
				error: "Not Found",
				message: `Route ${request.method} ${request.url} not found`,
				timestamp: new Date().toISOString(),
			})
		})

		this.app.delete("*", async (request: FastifyRequest, reply: FastifyReply) => {
			return reply.status(404).send({
				error: "Not Found",
				message: `Route ${request.method} ${request.url} not found`,
				timestamp: new Date().toISOString(),
			})
		})
	}

	/**
	 * Start the server
	 */
	async start(): Promise<void> {
		const serverConfig = this.config.getConfiguration()

		try {
			const address = await this.app.listen({
				port: serverConfig.port || 3000,
				host: serverConfig.host || "localhost",
			})

			this.isRunning = true
			this.startTime = new Date()

			console.log(`🚀 API Server started at ${address}`)
			console.log(`📁 Workspace: ${serverConfig.workspaceRoot}`)

			if (serverConfig.verbose) {
				console.log(`🔧 Debug mode: ${serverConfig.debug ? "enabled" : "disabled"}`)
				console.log(`🌐 CORS: ${serverConfig.cors ? "enabled" : "disabled"}`)
				console.log(`🛡️  Security: ${serverConfig.security?.enableHelmet ? "enabled" : "disabled"}`)
			}
		} catch (error) {
			console.error("Failed to start server:", error)
			throw error
		}
	}

	/**
	 * Stop the server
	 */
	async stop(): Promise<void> {
		if (this.isRunning) {
			await this.app.close()
			this.isRunning = false
			console.log("🛑 API Server stopped")
		}
	}

	/**
	 * Get server status information
	 */
	async getServerStatus(): Promise<ServerStatus> {
		const config = this.config.getConfiguration()
		const memoryUsage = process.memoryUsage()
		const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0

		return {
			running: this.isRunning,
			startTime: this.startTime,
			config,
			stats: {
				totalRequests: this.requestCount,
				activeConnections: 0, // Would need to track this
				activeJobs: 0, // Would need job manager integration
				memoryUsage,
				uptime,
			},
		}
	}

	/**
	 * Get health check information
	 */
	async getHealthCheck(): Promise<HealthCheck> {
		const now = new Date()

		// Basic health checks
		const filesystemHealth = await this.checkFilesystemHealth()
		const memoryHealth = await this.checkMemoryHealth()

		const allHealthy = filesystemHealth.status === "healthy" && memoryHealth.status === "healthy"

		return {
			status: allHealthy ? "healthy" : "degraded",
			timestamp: now,
			checks: {
				filesystem: filesystemHealth,
				mcp: { status: "healthy", lastChecked: now }, // Simplified
				memory: memoryHealth,
				jobManager: { status: "healthy", lastChecked: now }, // Simplified
			},
		}
	}

	private async checkFilesystemHealth() {
		const now = new Date()
		const startTime = Date.now()

		try {
			const config = this.config.getConfiguration()
			const exists = await this.adapters.fileSystem.exists(config.workspaceRoot || process.cwd())
			const responseTime = Date.now() - startTime

			return {
				status: exists ? ("healthy" as const) : ("unhealthy" as const),
				message: exists ? "Workspace accessible" : "Workspace not accessible",
				responseTime,
				lastChecked: now,
			}
		} catch (error) {
			return {
				status: "unhealthy" as const,
				message: `Filesystem error: ${error instanceof Error ? error.message : "Unknown error"}`,
				responseTime: Date.now() - startTime,
				lastChecked: now,
			}
		}
	}

	private async checkMemoryHealth() {
		const now = new Date()
		const memoryUsage = process.memoryUsage()
		const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024
		const memoryLimitMB = 1024 // 1GB limit as example

		const status = memoryUsedMB < memoryLimitMB * 0.8 ? ("healthy" as const) : ("degraded" as const)

		return {
			status,
			message: `Memory usage: ${memoryUsedMB.toFixed(2)}MB`,
			lastChecked: now,
		}
	}

	/**
	 * Get the Fastify instance (for testing or advanced configuration)
	 */
	getApp(): FastifyInstance {
		return this.app
	}

	/**
	 * Check if server is running
	 */
	isServerRunning(): boolean {
		return this.isRunning
	}
}
