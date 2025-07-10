import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import cors from "@fastify/cors"
import helmet from "@fastify/helmet"
import { ApiConfigManager } from "../config/ApiConfigManager"
import { LoggerConfigManager } from "../config/LoggerConfigManager"
import type { ApiServerOptions, ServerStatus, HealthCheck } from "../types/server"
import type { CoreInterfaces } from "../../core/interfaces"
import { JobManager } from "../jobs/JobManager"
import { StreamManager } from "../streaming/StreamManager"
import { SSEOutputAdapter } from "../streaming/SSEOutputAdapter"
import { ApiQuestionManager } from "../questions/ApiQuestionManager"
import { Task } from "../../core/task/Task"
import { createApiAdapters } from "../../core/adapters/api"
import { TaskExecutionOrchestrator, ApiTaskExecutionHandler } from "../../core/task/execution"
import { TimeoutValidator, ValidationError } from "../../core/task/execution/TimeoutValidator"
import { getStoragePath } from "../../shared/paths"
import { SharedContentProcessor } from "../../core/content/SharedContentProcessor"
import { SSEStreamingAdapter, SSEContentOutputAdapter } from "../../core/adapters/api/SSEOutputAdapters"
import { UnifiedCustomModesService } from "../../shared/services/UnifiedCustomModesService"
import { NodeFileWatcher } from "../../shared/services/watchers/NodeFileWatcher"
import type { ModeConfig } from "@roo-code/types"

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
	private customModesService: UnifiedCustomModesService

	constructor(config: ApiConfigManager, adapters: CoreInterfaces) {
		this.config = config
		this.adapters = adapters
		this.jobManager = new JobManager()
		this.streamManager = new StreamManager()
		this.questionManager = new ApiQuestionManager()
		this.taskExecutionOrchestrator = new TaskExecutionOrchestrator()

		// Initialize custom modes service with file watching for API context
		const storagePath = process.env.ROO_GLOBAL_STORAGE_PATH || getStoragePath()
		this.customModesService = new UnifiedCustomModesService({
			storagePath,
			fileWatcher: new NodeFileWatcher(), // File watching enabled for API
			enableProjectModes: false, // API typically doesn't have workspace context
		})

		this.app = fastify({
			logger: LoggerConfigManager.createLoggerConfig(config),
		})

		// Test log entry to verify logging is working
		this.app.log.info("🚀 FastifyServer logger initialized successfully")
		this.app.log.debug("🔧 Debug logging is enabled")
		this.app.log.error("🧪 Test error log entry for validation")
	}

	/**
	 * Initialize the server with middleware and routes
	 */
	async initialize(): Promise<void> {
		const serverConfig = this.config.getConfiguration()

		// Load custom modes
		try {
			await this.customModesService.loadCustomModes()
			this.app.log.info("Custom modes loaded for API server")
		} catch (error) {
			this.app.log.warn("Failed to load custom modes:", error)
		}

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
				const mode = body.mode || "code" // Default to code mode
				const logSystemPrompt = body.logSystemPrompt || false
				const logLlm = body.logLlm || false

				// Validate mode
				const selectedMode = await this.validateMode(mode)

				// For now, just return a simple response
				// In full implementation, this would delegate to the Task engine
				await this.adapters.userInterface.showInformation(`Received task: ${task} (mode: ${mode})`)

				return reply.send({
					success: true,
					message: "Task received",
					task,
					mode: selectedMode.slug,
					timestamp: new Date().toISOString(),
				})
			} catch (error) {
				this.app.log.error("Execute error:", error)

				// Handle mode validation errors
				if (error.message.includes("Invalid mode")) {
					return reply.status(400).send({
						success: false,
						error: "Invalid mode",
						message: error.message,
						timestamp: new Date().toISOString(),
					})
				}

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
				const logSystemPrompt = body.logSystemPrompt || false
				const logLlm = body.logLlm || false

				console.log(`[FastifyServer] /execute/stream request received`)
				console.log(`[FastifyServer] Mode parameter: ${mode}`)
				console.log(`[FastifyServer] Task: ${task}`)
				console.log(`[FastifyServer] Verbose: ${verbose}`)

				// Validate mode exists
				const selectedMode = await this.validateMode(mode)
				console.log(`[FastifyServer] Mode validation result:`, {
					requested: mode,
					selected: selectedMode.slug,
					name: selectedMode.name,
				})
				console.log(`[MODE-DEBUG] Custom mode validation result:`, {
					requested: mode,
					selected: selectedMode.slug,
					name: selectedMode.name,
					source: selectedMode.source || "unknown",
				})

				// Create job
				const job = this.jobManager.createJob(task, {
					mode: selectedMode.slug,
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

				console.log(`[API-CONFIG-DEBUG] API configuration loaded:`, {
					provider: apiConfiguration.apiProvider,
					hasApiKey: !!apiConfiguration.apiKey,
					model: apiConfiguration.apiModelId,
					keyPrefix: apiConfiguration.apiKey?.substring(0, 10),
				})

				const taskOptions = {
					apiConfiguration,
					task,
					mode: selectedMode.slug, // Pass the validated mode
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
					// Logging configuration
					logSystemPrompt,
					logLlm,
					// Custom modes service for unified tool execution
					customModesService: this.customModesService,
					// Disable new adapters for now - go back to existing working logic
					// streamingAdapter: sseStreamingAdapter,
					// contentProcessor: sharedContentProcessor,
					// contentOutputAdapter: sseContentOutputAdapter,
				}

				this.app.log.info(`Task options prepared for job ${job.id}`)
				console.log(`[FastifyServer] Task options for job ${job.id}:`, {
					mode: taskOptions.mode,
					task: taskOptions.task,
					customModesService: !!taskOptions.customModesService,
					startTask: taskOptions.startTask,
					logSystemPrompt: taskOptions.logSystemPrompt,
					logLlm: taskOptions.logLlm,
				})

				// Create and start the task - this returns [instance, promise]
				console.log(`[FastifyServer] About to call Task.create() for job ${job.id}`)
				const [taskInstance, taskPromise] = Task.create(taskOptions)
				console.log(`[FastifyServer] Task.create() completed for job ${job.id}`)
				console.log(`[FastifyServer] Task instance created:`, taskInstance ? "SUCCESS" : "FAILED")
				console.log(`[FastifyServer] Task instance mode:`, taskInstance?.mode)
				console.log(`[FastifyServer] Task instance customModesService:`, !!taskInstance?.customModesService)

				// Start job tracking (for job status management)
				await this.jobManager.startJob(job.id, taskInstance, this.taskExecutionOrchestrator)
				this.app.log.info(`JobManager.startJob() completed for job ${job.id}`)

				// Create API task execution handler
				const executionHandler = new ApiTaskExecutionHandler(
					sseAdapter,
					job.id,
					verbose || this.config.getConfiguration().debug || false,
				)

				// FIXED: Remove informational query detection to match VS Code extension behavior
				// All API tasks now use standard execution regardless of their phrasing
				// const isInfoQuery = this.isInformationalQuery(task)
				const isInfoQuery = false // Force standard execution for all API tasks

				console.log(`[FastifyServer] Informational query detection bypassed - using standard execution`)
				console.log(`[FastifyServer] Task will execute normally regardless of phrasing`)

				// Set up execution options with validated timeouts
				let validatedSlidingTimeoutMs: number | undefined
				try {
					if ((request.body as any)?.slidingTimeoutMs !== undefined) {
						validatedSlidingTimeoutMs = TimeoutValidator.validateSlidingTimeout(
							(request.body as any).slidingTimeoutMs,
							"api_request",
						)
					}
				} catch (error) {
					if (error instanceof ValidationError) {
						return reply.status(400).send({
							error: "Invalid timeout value",
							message: error.message,
							details: "Timeout values must be between 1 second (1000ms) and 24 hours (86400000ms)",
						})
					}
					throw error
				}

				const executionOptions = {
					isInfoQuery: false, // Force standard execution for all API tasks
					infoQueryTimeoutMs: 120000, // 2 minutes for info queries (unused since isInfoQuery is false)
					// emergencyTimeoutMs removed - now relies on sliding timeout for long-running tasks
					slidingTimeoutMs: validatedSlidingTimeoutMs, // Use validated timeout or undefined to fall back to defaults
					useSlidingTimeout: true, // Always use sliding timeout since isInfoQuery is false
					taskIdentifier: job.id,
				}

				console.log(`[FastifyServer] Starting task execution for job ${job.id}`)
				console.log(`[FastifyServer] Execution options:`, {
					isInfoQuery: false,
					mode: selectedMode.slug,
					taskIdentifier: job.id,
				})

				// Execute task with orchestrator (this replaces all the custom timeout/monitoring logic)
				this.taskExecutionOrchestrator
					.executeTask(taskInstance, taskPromise, executionHandler, executionOptions)
					.then(async (result) => {
						console.log(`[FastifyServer] Task execution completed for job ${job.id}:`, result.reason)
						console.log(`[FastifyServer] Task execution result:`, {
							success: result.success,
							reason: result.reason,
							durationMs: result.durationMs,
							mode: selectedMode.slug,
							tokenUsage: result.tokenUsage,
							toolUsage: result.toolUsage,
						})

						// ✅ REMOVED: No longer immediately close stream - SSEOutputAdapter handles closure
						// The orchestrator already handled completion/error events via the handler
						// Stream closure is now managed by SSEOutputAdapter.emitStreamEnd() after completion
						console.log(
							`[FastifyServer] Task execution finished - SSEOutputAdapter will handle stream closure`,
						)
					})
					.catch(async (error: any) => {
						// Handle cancellation gracefully
						if (
							error.message &&
							(error.message.includes("cancelled") || error.message.includes("aborted"))
						) {
							this.app.log.info(`Task execution cancelled for job ${job.id}: ${error.message}`)
						} else {
							this.app.log.error(`Task execution orchestrator failed for job ${job.id}:`, error)
							this.app.log.error(`Error details:`, {
								message: error?.message,
								stack: error?.stack,
								name: error?.name,
								code: error?.code,
							})
						}

						// Send error if not already sent by orchestrator
						try {
							await sseAdapter.emitError(error)
							// ✅ REMOVED: No longer immediately close stream - emitError() handles closure
							console.log(`[FastifyServer] Error sent - SSEOutputAdapter will handle stream closure`)
						} catch (emitError) {
							this.app.log.error(`Failed to emit error for job ${job.id}:`, emitError)
							// Fallback: close stream immediately if we can't emit error
							this.streamManager.closeStream(job.id)
						}
					})

				this.app.log.info(`Task execution orchestrator started for job ${job.id}`)
			} catch (error) {
				this.app.log.error("Stream execute error:", error)

				// Handle mode validation errors
				if (error.message.includes("Invalid mode")) {
					try {
						reply.raw.write(
							`data: ${JSON.stringify({
								type: "error",
								error: "Invalid mode",
								message: error.message,
								timestamp: new Date().toISOString(),
							})}\n\n`,
						)
					} catch (writeError) {
						this.app.log.error("Failed to write mode error to stream:", writeError)
					}
					reply.raw.end()
					return
				}

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

			// Log configuration information
			const loggingInfo = LoggerConfigManager.getLoggingInfo()
			if (loggingInfo.fileLoggingEnabled) {
				this.app.log.info(`📝 File logging: enabled → ${loggingInfo.logsDir}`)
				if (loggingInfo.rotationEnabled) {
					this.app.log.info(`🔄 Log rotation: enabled`)
				}
			} else {
				this.app.log.info(`📝 File logging: disabled (console only)`)
			}

			if (serverConfig.verbose) {
				this.app.log.info(`🔧 Debug mode: ${serverConfig.debug ? "enabled" : "disabled"}`)
				this.app.log.info(`🌐 CORS: ${serverConfig.cors ? "enabled" : "disabled"}`)
				this.app.log.info(`🛡️  Security: ${serverConfig.security?.enableHelmet ? "enabled" : "disabled"}`)
				this.app.log.info(`📊 Log level: ${loggingInfo.logLevel}`)
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

	/**
	 * Validate mode and return the mode config
	 */
	private async validateMode(mode: string): Promise<ModeConfig> {
		const allModes = await this.customModesService.getAllModes()
		const selectedMode = allModes.find((m) => m.slug === mode)

		if (!selectedMode) {
			const availableModes = allModes.map((m) => m.slug).join(", ")
			throw new Error(`Invalid mode: ${mode}. Available modes: ${availableModes}`)
		}

		return selectedMode
	}
}
