import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import cors from "@fastify/cors"
import helmet from "@fastify/helmet"
import { ApiConfigManager } from "../config/ApiConfigManager"
import type { ApiServerOptions, ServerStatus, HealthCheck } from "../types/server"
import type { CoreInterfaces } from "../../core/interfaces"
import { JobManager } from "../jobs/JobManager"
import { StreamManager } from "../streaming/StreamManager"
import { SSEOutputAdapter } from "../streaming/SSEOutputAdapter"
import { Task } from "../../core/task/Task"
import { createApiAdapters } from "../../core/adapters/api"
import { TaskExecutionOrchestrator, ApiTaskExecutionHandler } from "../../core/task/execution"
import { getStoragePath } from "../../shared/paths"

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
	private jobManager: JobManager
	private streamManager: StreamManager
	private taskExecutionOrchestrator: TaskExecutionOrchestrator

	constructor(config: ApiConfigManager, adapters: CoreInterfaces) {
		this.config = config
		this.adapters = adapters
		this.jobManager = new JobManager()
		this.streamManager = new StreamManager()
		this.taskExecutionOrchestrator = new TaskExecutionOrchestrator()
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

		// SSE streaming execute endpoint with real Task integration
		this.app.post("/execute/stream", async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				const body = request.body as any
				const task = body.task || "No task specified"
				const mode = body.mode || "code"

				// Create job
				const job = this.jobManager.createJob(task, {
					mode,
					clientInfo: {
						userAgent: request.headers["user-agent"],
						ip: request.ip,
					},
				})

				// Set SSE headers
				reply.raw.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Headers": "Cache-Control",
				})

				// Create SSE stream
				const stream = this.streamManager.createStream(reply.raw, job.id)

				// Create SSE adapter for this job
				const sseAdapter = new SSEOutputAdapter(this.streamManager, job.id)

				// Send initial start event
				await sseAdapter.emitStart("Task started", task)

				// Handle client disconnect
				reply.raw.on("close", () => {
					this.jobManager.cancelJob(job.id, "Client disconnected")
					this.streamManager.closeStream(job.id)
				})

				// Use the existing API adapters and replace user interface with SSE adapter
				const taskAdapters = {
					...this.adapters,
					userInterface: sseAdapter,
				}

				// Create Task instance with proper configuration
				console.log(`Creating Task for job ${job.id} with task: "${task}"`)

				// Load CLI configuration from API_CLI_CONFIG_PATH
				let apiConfiguration: any
				try {
					const { CliConfigManager } = await import("../../cli/config/CliConfigManager")
					const cliConfigPath = process.env.API_CLI_CONFIG_PATH

					if (cliConfigPath) {
						console.log(`Loading CLI configuration from: ${cliConfigPath}`)
						const configManager = new CliConfigManager({ configPath: cliConfigPath })
						const config = await configManager.loadConfiguration()

						apiConfiguration = {
							apiProvider: config.apiProvider,
							apiKey: config.apiKey,
							apiModelId: config.apiModelId,
							openAiBaseUrl: config.openAiBaseUrl,
							anthropicBaseUrl: config.anthropicBaseUrl,
							openAiApiKey: config.openAiApiKey,
							openAiModelId: config.openAiModelId,
							glamaModelId: config.glamaModelId,
							openRouterApiKey: config.openRouterApiKey,
							openRouterModelId: config.openRouterModelId,
						}

						console.log(
							`Configuration loaded - Provider: ${config.apiProvider}, Model: ${config.apiModelId}`,
						)
						if (config.apiKey) {
							console.log(`API key loaded: ${config.apiKey.substring(0, 10)}...`)
						}
					} else {
						console.warn(`No API_CLI_CONFIG_PATH found, falling back to environment variables`)
						apiConfiguration = {
							apiProvider: "anthropic" as const,
							apiKey: process.env.ANTHROPIC_API_KEY || "",
							apiModelId: "claude-3-5-sonnet-20241022",
						}
					}
				} catch (error) {
					console.error(`Failed to load CLI configuration:`, error)
					console.warn(`Falling back to environment variables`)
					apiConfiguration = {
						apiProvider: "anthropic" as const,
						apiKey: process.env.ANTHROPIC_API_KEY || "",
						apiModelId: "claude-3-5-sonnet-20241022",
					}
				}

				const taskOptions = {
					apiConfiguration,
					task,
					startTask: true, // This will start the task automatically
					fileSystem: taskAdapters.fileSystem,
					terminal: taskAdapters.terminal,
					browser: taskAdapters.browser,
					telemetry: taskAdapters.telemetry,
					workspacePath: this.config.getConfiguration().workspaceRoot || process.cwd(),
					verbose: this.config.getConfiguration().debug,
					userInterface: sseAdapter, // Use SSE adapter as the user interface
					globalStoragePath: getStoragePath(),
					// MCP configuration following CLI pattern
					mcpConfigPath: this.config.getConfiguration().mcpConfigPath,
					mcpAutoConnect: this.config.getConfiguration().mcpAutoConnect !== false,
					mcpTimeout: this.config.getConfiguration().mcpTimeout || 30000,
					mcpRetries: this.config.getConfiguration().mcpRetries || 3,
					// Use SSE adapter as CLI UI service equivalent for question handling
					cliUIService: sseAdapter,
				}

				console.log(`Task options prepared for job ${job.id}`)

				// Create and start the task - this returns [instance, promise]
				const [taskInstance, taskPromise] = Task.create(taskOptions)
				console.log(`Task.create() completed for job ${job.id}`)
				console.log(`Task instance created:`, taskInstance ? "SUCCESS" : "FAILED")

				// Start job tracking (for job status management)
				await this.jobManager.startJob(job.id, taskInstance)
				console.log(`JobManager.startJob() completed for job ${job.id}`)

				// Create API task execution handler
				const executionHandler = new ApiTaskExecutionHandler(
					sseAdapter,
					job.id,
					this.config.getConfiguration().debug || false,
				)

				// Determine if this is an informational query
				const isInfoQuery = this.isInformationalQuery(task)

				// Set up execution options
				const executionOptions = {
					isInfoQuery,
					infoQueryTimeoutMs: 30000, // 30 seconds for info queries
					emergencyTimeoutMs: 60000, // 60 seconds emergency timeout
					slidingTimeoutMs: 600000, // 10 minutes for regular tasks
					useSlidingTimeout: !isInfoQuery,
					taskIdentifier: job.id,
				}

				console.log(`Starting task execution for job ${job.id}, isInfoQuery: ${isInfoQuery}`)

				// Execute task with orchestrator (this replaces all the custom timeout/monitoring logic)
				this.taskExecutionOrchestrator
					.executeTask(taskInstance, taskPromise, executionHandler, executionOptions)
					.then(async (result) => {
						console.log(`Task execution completed for job ${job.id}:`, result.reason)
						console.log(`Task execution result:`, {
							success: result.success,
							reason: result.reason,
							durationMs: result.durationMs,
							tokenUsage: result.tokenUsage,
							toolUsage: result.toolUsage,
						})

						// The orchestrator already handled completion/error events via the handler
						// Just clean up the stream
						this.streamManager.closeStream(job.id)
					})
					.catch(async (error: any) => {
						console.error(`Task execution orchestrator failed for job ${job.id}:`, error)
						console.error(`Error details:`, {
							message: error?.message,
							stack: error?.stack,
							name: error?.name,
							code: error?.code,
						})

						// Send error if not already sent by orchestrator
						try {
							await sseAdapter.emitError(error)
						} catch (emitError) {
							console.error(`Failed to emit error for job ${job.id}:`, emitError)
						}

						this.streamManager.closeStream(job.id)
					})

				console.log(`Task execution orchestrator started for job ${job.id}`)
			} catch (error) {
				console.error("Stream execute error:", error)

				// Try to send error through SSE if possible
				try {
					reply.raw.write(
						`data: ${JSON.stringify({
							type: "error",
							error: error instanceof Error ? error.message : "Unknown error",
							timestamp: new Date().toISOString(),
						})}\n\n`,
					)
				} catch (writeError) {
					console.error("Failed to write error to stream:", writeError)
				}

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

	/**
	 * Execute a Task with SSE streaming
	 */
	private async executeTaskWithSSE(taskInstance: Task, sseAdapter: SSEOutputAdapter, jobId: string): Promise<void> {
		try {
			// Send initial progress
			await sseAdapter.showProgress("Initializing task execution...", 0)

			// The JobManager will handle job lifecycle and task execution
			// The Task will communicate through the sseAdapter (userInterface)
			// which will automatically stream events to the client

			// Note: JobManager.startJob() already handles the execution
			// This method is just for setup and monitoring
		} catch (error) {
			console.error(`Task execution error for job ${jobId}:`, error)
			await sseAdapter.emitError(error instanceof Error ? error : new Error(String(error)))
		}
		// Note: Don't close the stream here - let JobManager handle it
	}

	/**
	 * Determine if a task is an informational query that should use response completion detection
	 */
	private isInformationalQuery(task: string): boolean {
		const lowerTask = task.toLowerCase().trim()

		// Common informational query patterns
		const infoPatterns = [
			/^(list|show|display|get|what|where|how|which|who|when)\b/,
			/\b(list|show|display)\b.*\b(servers?|services?|tools?|files?|directories?)\b/,
			/\bmcp\s+servers?\b/,
			/\bhelp\b/,
			/\bstatus\b/,
			/\binfo(rmation)?\b/,
			/^explain\b/,
			/^describe\b/,
			/^tell me\b/,
			/\?$/, // Ends with question mark
		]

		return infoPatterns.some((pattern) => pattern.test(lowerTask))
	}
}
