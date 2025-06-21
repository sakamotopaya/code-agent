import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import cors from "@fastify/cors"
import helmet from "@fastify/helmet"
import { ApiConfigManager } from "../config/ApiConfigManager"
import type { ApiServerOptions, ServerStatus, HealthCheck } from "../types/server"
import type { CoreInterfaces } from "../../core/interfaces"
import { JobManager } from "../jobs/JobManager"
import { StreamManager } from "../streaming/StreamManager"
import { SSEOutputAdapter } from "../streaming/SSEOutputAdapter"
import { ApiQuestionManager } from "../questions/ApiQuestionManager"
import { Task } from "../../core/task/Task"
import { createApiAdapters } from "../../core/adapters/api"
import { TaskExecutionOrchestrator, ApiTaskExecutionHandler } from "../../core/task/execution"
import { getStoragePath } from "../../shared/paths"
import { SharedContentProcessor } from "../../core/content/SharedContentProcessor"
import { SSEStreamingAdapter, SSEContentOutputAdapter } from "../../core/adapters/api/SSEOutputAdapters"

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
	private questionManager: ApiQuestionManager
	private taskExecutionOrchestrator: TaskExecutionOrchestrator

	constructor(config: ApiConfigManager, adapters: CoreInterfaces) {
		this.config = config
		this.adapters = adapters
		this.jobManager = new JobManager()
		this.streamManager = new StreamManager()
		this.questionManager = new ApiQuestionManager()
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
				this.app.log.info(`[${new Date().toISOString()}] ${request.method} ${request.url}`)
			}
		})

		// Register routes
		await this.registerRoutes()

		// Add global error handler
		this.app.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
			this.app.log.error("API Error:", error)

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
				this.app.log.error("Execute error:", error)
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
				const verbose = body.verbose || false // Extract verbose flag from request

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

				// Disable TCP buffering for immediate streaming
				if ((reply.raw as any).socket) {
					;(reply.raw as any).socket.setNoDelay(true)
				}

				// Create SSE stream
				const stream = this.streamManager.createStream(reply.raw, job.id)

				// Create SSE adapter for this job with verbose flag and shared question manager
				const sseAdapter = new SSEOutputAdapter(this.streamManager, job.id, verbose, this.questionManager)

				// Create shared content processing components for SSE
				const sharedContentProcessor = new SharedContentProcessor()
				const sseStreamingAdapter = new SSEStreamingAdapter(sseAdapter)
				const sseContentOutputAdapter = new SSEContentOutputAdapter(sseAdapter)

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
				this.app.log.info(`Creating Task for job ${job.id} with task: "${task}"`)

				// Load CLI configuration from API_CLI_CONFIG_PATH
				let apiConfiguration: any
				try {
					const { CliConfigManager } = await import("../../cli/config/CliConfigManager")
					const cliConfigPath = process.env.API_CLI_CONFIG_PATH

					if (cliConfigPath) {
						this.app.log.info(`Loading CLI configuration from: ${cliConfigPath}`)
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

						this.app.log.info(
							`Configuration loaded - Provider: ${config.apiProvider}, Model: ${config.apiModelId}`,
						)
						if (config.apiKey) {
							this.app.log.info(`API key loaded: ${config.apiKey.substring(0, 10)}...`)
						}
					} else {
						this.app.log.warn(`No API_CLI_CONFIG_PATH found, falling back to environment variables`)
						apiConfiguration = {
							apiProvider: "anthropic" as const,
							apiKey: process.env.ANTHROPIC_API_KEY || "",
							apiModelId: "claude-3-5-sonnet-20241022",
						}
					}
				} catch (error) {
					this.app.log.error(`Failed to load CLI configuration:`, error)
					this.app.log.warn(`Falling back to environment variables`)
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
					// Disable new adapters for now - go back to existing working logic
					// streamingAdapter: sseStreamingAdapter,
					// contentProcessor: sharedContentProcessor,
					// contentOutputAdapter: sseContentOutputAdapter,
				}

				this.app.log.info(`Task options prepared for job ${job.id}`)

				// Create and start the task - this returns [instance, promise]
				const [taskInstance, taskPromise] = Task.create(taskOptions)
				this.app.log.info(`Task.create() completed for job ${job.id}`)
				this.app.log.info(`Task instance created:`, taskInstance ? "SUCCESS" : "FAILED")

				// Start job tracking (for job status management)
				await this.jobManager.startJob(job.id, taskInstance)
				this.app.log.info(`JobManager.startJob() completed for job ${job.id}`)

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
					infoQueryTimeoutMs: 120000, // 2 minutes for info queries
					emergencyTimeoutMs: 60000, // 60 seconds emergency timeout
					slidingTimeoutMs: 600000, // 10 minutes for regular tasks
					useSlidingTimeout: !isInfoQuery,
					taskIdentifier: job.id,
				}

				this.app.log.info(`Starting task execution for job ${job.id}, isInfoQuery: ${isInfoQuery}`)

				// Execute task with orchestrator (this replaces all the custom timeout/monitoring logic)
				this.taskExecutionOrchestrator
					.executeTask(taskInstance, taskPromise, executionHandler, executionOptions)
					.then(async (result) => {
						this.app.log.info(`Task execution completed for job ${job.id}:`, result.reason)
						this.app.log.info(`Task execution result:`, {
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
						this.app.log.error(`Task execution orchestrator failed for job ${job.id}:`, error)
						this.app.log.error(`Error details:`, {
							message: error?.message,
							stack: error?.stack,
							name: error?.name,
							code: error?.code,
						})

						// Send error if not already sent by orchestrator
						try {
							await sseAdapter.emitError(error)
						} catch (emitError) {
							this.app.log.error(`Failed to emit error for job ${job.id}:`, emitError)
						}

						this.streamManager.closeStream(job.id)
					})

				this.app.log.info(`Task execution orchestrator started for job ${job.id}`)
			} catch (error) {
				this.app.log.error("Stream execute error:", error)

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
					this.app.log.error("Failed to write error to stream:", writeError)
				}

				reply.raw.end()
			}
		})

		// Question API endpoints
		this.app.post("/api/questions/:questionId/answer", async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				const { questionId } = request.params as { questionId: string }
				const body = request.body as { answer: string }

				if (!body.answer) {
					return reply.status(400).send({
						error: "Bad Request",
						message: "Answer is required",
						timestamp: new Date().toISOString(),
					})
				}

				const success = await this.questionManager.submitAnswer(questionId, body.answer)

				if (!success) {
					return reply.status(404).send({
						error: "Not Found",
						message: "Question not found or not pending",
						timestamp: new Date().toISOString(),
					})
				}

				return reply.send({
					success: true,
					message: "Answer submitted successfully",
					questionId,
					timestamp: new Date().toISOString(),
				})
			} catch (error) {
				this.app.log.error("Answer submission error:", error)
				return reply.status(500).send({
					error: "Internal Server Error",
					message: error instanceof Error ? error.message : "Unknown error",
					timestamp: new Date().toISOString(),
				})
			}
		})

		// Get question status
		this.app.get("/api/questions/:questionId", async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				const { questionId } = request.params as { questionId: string }
				const question = this.questionManager.getQuestion(questionId)

				if (!question) {
					return reply.status(404).send({
						error: "Not Found",
						message: "Question not found",
						timestamp: new Date().toISOString(),
					})
				}

				return reply.send({
					id: question.id,
					jobId: question.jobId,
					question: question.question,
					suggestions: question.suggestions,
					state: question.state,
					createdAt: question.createdAt,
					answeredAt: question.answeredAt,
					answer: question.answer,
				})
			} catch (error) {
				this.app.log.error("Get question error:", error)
				return reply.status(500).send({
					error: "Internal Server Error",
					message: error instanceof Error ? error.message : "Unknown error",
					timestamp: new Date().toISOString(),
				})
			}
		})

		// List questions for a job
		this.app.get("/api/questions", async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				const { jobId, state } = request.query as { jobId?: string; state?: string }

				if (!jobId) {
					return reply.status(400).send({
						error: "Bad Request",
						message: "jobId query parameter is required",
						timestamp: new Date().toISOString(),
					})
				}

				let questions = this.questionManager.getJobQuestions(jobId)

				// Filter by state if provided
				if (state) {
					questions = questions.filter((q) => q.state === state)
				}

				return reply.send({
					questions: questions.map((q) => ({
						id: q.id,
						jobId: q.jobId,
						question: q.question,
						suggestions: q.suggestions,
						state: q.state,
						createdAt: q.createdAt,
						answeredAt: q.answeredAt,
						answer: q.answer,
					})),
					total: questions.length,
					timestamp: new Date().toISOString(),
				})
			} catch (error) {
				this.app.log.error("List questions error:", error)
				return reply.status(500).send({
					error: "Internal Server Error",
					message: error instanceof Error ? error.message : "Unknown error",
					timestamp: new Date().toISOString(),
				})
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

			this.app.log.info(`🚀 API Server started at ${address}`)
			this.app.log.info(`📁 Workspace: ${serverConfig.workspaceRoot}`)

			if (serverConfig.verbose) {
				this.app.log.info(`🔧 Debug mode: ${serverConfig.debug ? "enabled" : "disabled"}`)
				this.app.log.info(`🌐 CORS: ${serverConfig.cors ? "enabled" : "disabled"}`)
				this.app.log.info(`🛡️  Security: ${serverConfig.security?.enableHelmet ? "enabled" : "disabled"}`)
			}
		} catch (error) {
			this.app.log.error("Failed to start server:", error)
			throw error
		}
	}

	/**
	 * Stop the server
	 */
	async stop(): Promise<void> {
		if (this.isRunning) {
			// Shutdown question manager first
			await this.questionManager.shutdown()

			await this.app.close()
			this.isRunning = false
			this.app.log.info("🛑 API Server stopped")
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
			this.app.log.error(`Task execution error for job ${jobId}:`, error)
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
