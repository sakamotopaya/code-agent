import chalk from "chalk"
import { createCliAdapters, type CliAdapterOptions } from "../../core/adapters/cli"
import { Task } from "../../core/task/Task"
import { defaultModeSlug } from "../../shared/modes"
import type { ProviderSettings, RooCodeSettings } from "@roo-code/types"
import { CliConfigManager } from "../config/CliConfigManager"
import { getCLILogger } from "../services/CLILogger"
import { CLIUIService } from "../services/CLIUIService"

interface BatchOptions extends CliAdapterOptions {
	cwd: string
	config?: string
	verbose: boolean
	color: boolean
	colorScheme?: string
	// MCP options
	mcpConfig?: string
	mcpServer?: string[]
	mcpTimeout?: number
	mcpRetries?: number
	mcpAutoConnect?: boolean
	noMcpAutoConnect?: boolean
}

export class BatchProcessor {
	private options: BatchOptions
	private configManager?: CliConfigManager
	private currentTask?: Task

	constructor(options: BatchOptions, configManager?: CliConfigManager) {
		this.options = options
		this.configManager = configManager
	}

	private logDebug(message: string, ...args: any[]): void {
		getCLILogger().debug(message, ...args)
	}

	private logInfo(message: string, ...args: any[]): void {
		getCLILogger().info(message, ...args)
	}

	private logError(message: string, ...args: any[]): void {
		getCLILogger().error(message, ...args)
	}

	/**
	 * Detect if this is an informational query that should complete quickly
	 */
	private isInformationalQuery(taskDescription: string): boolean {
		const infoPatterns = [
			/what.*(mcp|servers?).*(available|do you have)/i,
			/list.*(mcp|servers?)/i,
			/which.*(mcp|servers?)/i,
			/show.*(mcp|servers?)/i,
			/tell me about.*(mcp|servers?)/i,
		]

		return infoPatterns.some((pattern) => pattern.test(taskDescription))
	}

	/**
	 * Detect when a meaningful response has been generated for information queries
	 */
	private detectResponseCompletion(response: string): boolean {
		const informationIndicators = [
			"available mcp servers",
			"connected mcp servers",
			"no mcp servers",
			"i have access to",
			"mcp servers:",
			"the following mcp servers",
			"these servers provide",
			"based on the mcp servers",
			"## connected mcp servers",
		]

		const lowerResponse = response.toLowerCase()
		return informationIndicators.some((indicator) => lowerResponse.includes(indicator))
	}

	/**
	 * Trigger task completion manually
	 */
	private completeTaskWithResponse(reason: string): void {
		this.logDebug(`[BatchProcessor] Triggering completion: ${reason}`)

		// Emit completion event that the event handlers will catch
		if (this.currentTask) {
			const defaultTokenUsage = {
				totalTokensIn: 0,
				totalTokensOut: 0,
				totalCost: 0,
				contextTokens: 0,
			}
			const defaultToolUsage = {}
			this.currentTask.emit("taskCompleted", this.currentTask.taskId, defaultTokenUsage, defaultToolUsage)
		}
	}

	async run(taskDescription: string): Promise<void> {
		try {
			this.logDebug("[BatchProcessor] Starting batch mode...")
			this.logDebug(`[BatchProcessor] Working directory: ${this.options.cwd}`)
			this.logDebug(`[BatchProcessor] Task: ${taskDescription}`)

			// Detect if this is an informational query
			const isInfoQuery = this.isInformationalQuery(taskDescription)
			this.logDebug(`[BatchProcessor] Task type - Informational query: ${isInfoQuery}`)

			// Create CLI adapters
			this.logDebug("[BatchProcessor] Creating CLI adapters...")
			const adapters = createCliAdapters({
				workspaceRoot: this.options.cwd,
				isInteractive: false,
				verbose: this.options.verbose,
			})
			this.logDebug("[BatchProcessor] CLI adapters created")

			// Load configuration
			this.logDebug("[BatchProcessor] Loading configuration...")
			const { apiConfiguration } = await this.loadConfiguration()
			this.logDebug("[BatchProcessor] Configuration loaded")

			// Create CLI UI service for question handling
			this.logDebug("[BatchProcessor] Creating CLI UI service...")
			const cliUIService = new CLIUIService(this.options.color)

			// Create and execute task
			this.logDebug("[BatchProcessor] Creating task...")

			// Use Task.create() to get both the instance and the promise
			const [task, taskPromise] = Task.create({
				apiConfiguration,
				task: taskDescription,
				fileSystem: adapters.fileSystem,
				terminal: adapters.terminal,
				browser: adapters.browser,
				telemetry: adapters.telemetry,
				workspacePath: this.options.cwd,
				globalStoragePath: process.env.HOME ? `${process.env.HOME}/.agentz` : "/tmp/.agentz",
				startTask: true,
				verbose: this.options.verbose,
				cliUIService: cliUIService,
				// MCP configuration options
				mcpConfigPath: this.options.mcpConfig,
				mcpAutoConnect: this.options.mcpAutoConnect !== false && !this.options.noMcpAutoConnect,
				mcpTimeout: this.options.mcpTimeout,
				mcpRetries: this.options.mcpRetries,
			})

			// Store task reference for completion detection
			this.currentTask = task

			this.logDebug("[BatchProcessor] Task created, starting execution...")

			// Execute the task with enhanced completion detection
			this.logDebug("[BatchProcessor] About to call executeTaskWithCompletionDetection...")
			await this.executeTaskWithCompletionDetection(task, taskPromise, isInfoQuery)
			this.logDebug("[BatchProcessor] executeTaskWithCompletionDetection returned")

			// Immediately dispose of MCP connections to allow process exit
			this.logDebug("[BatchProcessor] Disposing MCP connections...")
			await this.disposeMcpConnections()
			this.logDebug("[BatchProcessor] MCP connections disposed")

			this.logDebug("[BatchProcessor] Task completed successfully")
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.logError("Batch execution failed:", message)

			// Cleanup MCP connections even on error
			try {
				await this.disposeMcpConnections()
			} catch (mcpError) {
				this.logDebug("Error disposing MCP connections after error:", mcpError)
			}

			process.exit(1)
		}
	}

	private async loadConfiguration(): Promise<{
		apiConfiguration: ProviderSettings
		fullConfiguration: RooCodeSettings
	}> {
		try {
			// Use existing config manager or create a new one
			if (!this.configManager) {
				this.configManager = new CliConfigManager({
					cwd: this.options.cwd,
					configPath: this.options.config,
					verbose: this.options.verbose,
				})
			}

			// Load the full configuration
			const fullConfiguration = await this.configManager.loadConfiguration()

			// Extract provider settings for the API configuration
			const apiConfiguration: ProviderSettings = {
				apiProvider: fullConfiguration.apiProvider,
				apiKey: fullConfiguration.apiKey,
				apiModelId: fullConfiguration.apiModelId,
				openAiBaseUrl: fullConfiguration.openAiBaseUrl,
				// Add other provider-specific settings as needed
				anthropicBaseUrl: fullConfiguration.anthropicBaseUrl,
				openAiApiKey: fullConfiguration.openAiApiKey,
				openAiModelId: fullConfiguration.openAiModelId,
				glamaModelId: fullConfiguration.glamaModelId,
				openRouterApiKey: fullConfiguration.openRouterApiKey,
				openRouterModelId: fullConfiguration.openRouterModelId,
			} as ProviderSettings

			// Validate configuration
			if (!apiConfiguration.apiKey) {
				const message = [
					"API configuration required. Set your API key using one of these methods:",
					"  1. Environment variable: export ROO_API_KEY=your_api_key_here",
					"  2. Config file: roo-cli --generate-config ~/.roo-cli/config.json",
					"  3. Project config: Create .roo-cli.json in your project",
				].join("\n")

				if (this.options.color) {
					console.error(chalk.red("Configuration Error:"), message)
				} else {
					console.error("Configuration Error:", message)
				}
				process.exit(1)
			}

			if (this.options.verbose) {
				console.log(
					chalk.gray(
						`Configuration loaded - Provider: ${apiConfiguration.apiProvider}, Model: ${apiConfiguration.apiModelId}`,
					),
				)
			}

			return { apiConfiguration, fullConfiguration }
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (this.options.color) {
				console.error(chalk.red("Failed to load configuration:"), message)
			} else {
				console.error("Failed to load configuration:", message)
			}

			// Fallback to environment variables
			const apiConfiguration: ProviderSettings = {
				apiProvider: "anthropic",
				apiKey: process.env.ANTHROPIC_API_KEY || process.env.ROO_API_KEY || "",
				apiModelId: "claude-3-5-sonnet-20241022",
			} as ProviderSettings

			if (!apiConfiguration.apiKey) {
				process.exit(1)
			}

			const fullConfiguration = {
				...apiConfiguration,
				autoApprovalEnabled: false,
				alwaysAllowReadOnly: false,
				alwaysAllowWrite: false,
			} as RooCodeSettings

			return { apiConfiguration, fullConfiguration }
		}
	}

	/**
	 * Enhanced task execution with response completion detection
	 */
	private async executeTaskWithCompletionDetection(
		task: Task,
		taskPromise: Promise<void>,
		isInfoQuery: boolean,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			let isCompleted = false
			let infoQueryTimeout: NodeJS.Timeout | null = null
			let emergencyTimeout: NodeJS.Timeout | null = null

			const cleanupTimers = () => {
				if (infoQueryTimeout) {
					clearTimeout(infoQueryTimeout)
					infoQueryTimeout = null
					this.logDebug("[BatchProcessor] Info query timeout cleared")
				}
				if (emergencyTimeout) {
					clearTimeout(emergencyTimeout)
					emergencyTimeout = null
					this.logDebug("[BatchProcessor] Emergency timeout cleared")
				}
			}

			const completeOnce = async (reason: string) => {
				if (isCompleted) return
				isCompleted = true

				this.logDebug(`[BatchProcessor] Task completing: ${reason}`)

				// Clean up timers first
				cleanupTimers()

				// Cleanup task before resolving
				try {
					if (typeof task.dispose === "function") {
						await task.dispose()
						this.logDebug("[BatchProcessor] Task cleanup completed")
					}
				} catch (error) {
					this.logDebug("[BatchProcessor] Error during task cleanup:", error)
				} finally {
					resolve()
				}
			}

			const rejectOnce = async (error: Error) => {
				if (isCompleted) return
				isCompleted = true

				this.logDebug(`[BatchProcessor] Task rejecting: ${error.message}`)

				// Clean up timers first
				cleanupTimers()

				try {
					if (typeof task.dispose === "function") {
						await task.dispose()
						this.logDebug("[BatchProcessor] Task cleanup completed after error")
					}
				} catch (cleanupError) {
					this.logDebug("[BatchProcessor] Error during cleanup after error:", cleanupError)
				} finally {
					reject(error)
				}
			}

			// Set up response completion detection for info queries
			if (isInfoQuery) {
				this.setupResponseCompletionDetection(task, completeOnce)
				// Shorter timeout for info queries
				infoQueryTimeout = setTimeout(() => {
					if (!isCompleted) {
						completeOnce("Information query timeout (30s)")
					}
				}, 30000) // 30 seconds max for info queries
			}

			// Set up standard event handlers
			this.setupStandardEventHandlers(task, completeOnce, rejectOnce)

			// Handle task promise
			taskPromise.catch((error) => {
				this.logDebug(`[BatchProcessor] Task promise rejected:`, error)
				if (!isCompleted) {
					rejectOnce(error)
				}
			})

			// Emergency timeout for all tasks
			emergencyTimeout = setTimeout(() => {
				if (!isCompleted) {
					rejectOnce(new Error("Emergency timeout after 60 seconds"))
				}
			}, 60000) // 60 seconds emergency timeout
		})
	}

	/**
	 * Setup response monitoring for informational queries
	 */
	private setupResponseCompletionDetection(task: Task, complete: (reason: string) => void): void {
		let responseBuffer = ""
		let lastResponseTime = Date.now()
		let completionTimer: NodeJS.Timeout | null = null
		let isCompleted = false

		const cleanupCompletionTimer = () => {
			if (completionTimer) {
				clearTimeout(completionTimer)
				completionTimer = null
				this.logDebug("[BatchProcessor] Response completion timer cleared")
			}
		}

		const safeComplete = (reason: string) => {
			if (isCompleted) return
			isCompleted = true
			cleanupCompletionTimer()
			complete(reason)
		}

		task.on("message", (event: any) => {
			if (isCompleted) return

			if (event.action === "response" || event.action === "say") {
				const content = event.message?.text || event.content || ""
				responseBuffer += content
				lastResponseTime = Date.now()

				this.logDebug(`[BatchProcessor] Response content captured: ${content.substring(0, 100)}...`)

				// Clear existing timer
				cleanupCompletionTimer()

				// Check for immediate completion indicators
				if (this.detectResponseCompletion(responseBuffer)) {
					this.logDebug("[BatchProcessor] Response completion detected immediately")
					completionTimer = setTimeout(() => {
						safeComplete("Response completion detected")
					}, 1000) // 1 second delay to ensure response is complete
				} else {
					// Set timer for response completion by timeout
					completionTimer = setTimeout(() => {
						const timeSinceLastResponse = Date.now() - lastResponseTime
						if (timeSinceLastResponse >= 2000 && responseBuffer.length > 50) {
							this.logDebug("[BatchProcessor] Response completion by timeout and content length")
							safeComplete("Response timeout completion")
						}
					}, 3000) // 3 seconds of no new content
				}
			}
		})

		// Clean up timer when task completes via other means
		task.on("taskCompleted", () => {
			this.logDebug("[BatchProcessor] Task completed, cleaning up response completion timer")
			cleanupCompletionTimer()
		})

		task.on("taskAborted", () => {
			this.logDebug("[BatchProcessor] Task aborted, cleaning up response completion timer")
			cleanupCompletionTimer()
		})
	}

	/**
	 * Setup standard event handlers for task lifecycle
	 */
	private setupStandardEventHandlers(
		task: Task,
		complete: (reason: string) => void,
		reject: (error: Error) => void,
	): void {
		task.on("taskCompleted", (taskId: string, tokenUsage: any, toolUsage: any) => {
			this.logDebug(`[BatchProcessor] Standard task completed: ${taskId}`)
			complete("Standard task completion")
		})

		task.on("taskAborted", () => {
			this.logDebug("[BatchProcessor] Task was aborted")
			reject(new Error("Task was aborted"))
		})

		task.on("taskToolFailed", (taskId: string, tool: string, error: string) => {
			this.logDebug(`[BatchProcessor] Tool ${tool} failed: ${error}`)
			reject(new Error(`Tool ${tool} failed: ${error}`))
		})

		// Activity tracking for debugging
		task.on("taskStarted", () => {
			this.logDebug("[BatchProcessor] Task started")
		})

		task.on("taskModeSwitched", (taskId: string, mode: string) => {
			this.logDebug(`[BatchProcessor] Task mode switched to: ${mode}`)
		})
	}

	/**
	 * Dispose MCP connections to allow clean process exit
	 */
	private async disposeMcpConnections(): Promise<void> {
		try {
			const { GlobalCLIMcpService } = await import("../services/GlobalCLIMcpService")
			const globalMcpService = GlobalCLIMcpService.getInstance()

			if (globalMcpService.isInitialized()) {
				this.logDebug("[BatchProcessor] Disposing global MCP service...")
				await globalMcpService.dispose()
				this.logDebug("[BatchProcessor] Global MCP service disposed successfully")
			} else {
				this.logDebug("[BatchProcessor] Global MCP service not initialized, nothing to dispose")
			}
		} catch (error) {
			this.logDebug("[BatchProcessor] Error disposing MCP connections:", error)
		}
	}

	private async executeTask(task: Task, taskPromise: Promise<void>): Promise<void> {
		return new Promise((resolve, reject) => {
			this.logDebug("[BatchProcessor] Setting up task event handlers...")

			// Sliding timeout implementation - much longer for batch mode since it includes user interaction
			const timeoutMs = 600000 // 10 minutes for batch mode to allow for user questions
			let timeout: NodeJS.Timeout
			let isWaitingForUserInput = false
			let lastActivityTime = Date.now()

			const resetTimeout = () => {
				lastActivityTime = Date.now()
				if (timeout) {
					clearTimeout(timeout)
				}
				if (isWaitingForUserInput) {
					this.logDebug("[BatchProcessor] Not setting new timeout - waiting for user input")
					return
				}
				timeout = setTimeout(() => {
					const timeSinceLastActivity = Date.now() - lastActivityTime
					this.logDebug(
						`[BatchProcessor] Checking timeout: ${timeSinceLastActivity}ms since last activity, waiting for input: ${isWaitingForUserInput}`,
					)

					if (isWaitingForUserInput) {
						this.logDebug("[BatchProcessor] Timeout fired but waiting for user input - extending timeout")
						resetTimeout() // Reset for another cycle
						return
					}
					this.logDebug(`[BatchProcessor] Task execution timeout after ${timeoutMs}ms of inactivity`)
					reject(new Error(`Task execution timeout after ${timeoutMs}ms of inactivity`))
				}, timeoutMs)
				this.logDebug(
					`[BatchProcessor] Timeout reset - task has ${timeoutMs / 1000} seconds of inactivity before timeout`,
				)
			}

			const pauseTimeout = () => {
				if (timeout) {
					clearTimeout(timeout)
					this.logDebug("[BatchProcessor] Timeout paused - waiting for user input")
				}
				isWaitingForUserInput = true
			}

			const resumeTimeout = () => {
				this.logDebug("[BatchProcessor] Resuming timeout after user input")
				isWaitingForUserInput = false
				// Always reset timeout after user responds, regardless of previous state
				if (timeout) {
					clearTimeout(timeout)
				}
				timeout = setTimeout(() => {
					this.logDebug(`[BatchProcessor] Task execution timeout after ${timeoutMs}ms of inactivity`)
					reject(new Error(`Task execution timeout after ${timeoutMs}ms of inactivity`))
				}, timeoutMs)
				this.logDebug(
					`[BatchProcessor] Timeout RESET after user response - task has ${timeoutMs}ms of inactivity before timeout`,
				)
			}

			const clearSlidingTimeout = () => {
				if (timeout) {
					clearTimeout(timeout)
					this.logDebug("[BatchProcessor] Sliding timeout cleared")
				}
				isWaitingForUserInput = false
			}

			// Start the initial timeout
			resetTimeout()

			// Intercept the ask method to pause timeout during user input
			const originalAsk = task.ask.bind(task)
			task.ask = async (type: any, text?: string, partial?: boolean, progressStatus?: any) => {
				this.logDebug("[BatchProcessor] Question asked via task.ask() - pausing timeout")
				pauseTimeout()
				try {
					const result = await originalAsk(type, text, partial, progressStatus)
					return result
				} finally {
					// Don't resume here - wait for taskAskResponded event
				}
			}

			// Detect questions via message events - be very liberal in detection
			task.on("message", (messageEvent: any) => {
				this.logDebug(`[BatchProcessor] Message event: ${messageEvent.action}`)

				// Check for any indication this is a question
				const message = messageEvent.message
				const isQuestion =
					message &&
					(message.ask ||
						message.type === "ask" ||
						(message.text &&
							(message.text.includes("ask_followup_question") ||
								message.text.includes("<question>") ||
								message.text.includes("?") ||
								message.text.includes("choose") ||
								message.text.includes("select"))))

				if (isQuestion) {
					this.logDebug("[BatchProcessor] *** QUESTION DETECTED - pausing timeout ***")
					pauseTimeout()
				} else {
					// Regular message activity should reset timeout only if not waiting for input
					this.logDebug("[BatchProcessor] Regular message activity")
					resetTimeout()
				}
			})

			// Set up event handlers
			task.on("taskCompleted", async (taskId: string, tokenUsage: any, toolUsage: any) => {
				this.logDebug(`[BatchProcessor] Task completed: ${taskId}`)
				this.logDebug(`[BatchProcessor] Token usage:`, tokenUsage)
				this.logDebug(`[BatchProcessor] Tool usage:`, toolUsage)

				clearSlidingTimeout()

				// Ensure cleanup before resolving
				try {
					if (typeof task.dispose === "function") {
						await task.dispose()
						this.logDebug("[BatchProcessor] Task cleanup completed")
					}
				} catch (error) {
					this.logDebug("[BatchProcessor] Error during cleanup:", error)
				}

				resolve()
			})

			task.on("taskAborted", async () => {
				this.logDebug("[BatchProcessor] Task was aborted")

				clearSlidingTimeout()

				// Ensure cleanup before rejecting
				try {
					if (typeof task.dispose === "function") {
						await task.dispose()
						this.logDebug("[BatchProcessor] Task cleanup completed after abort")
					}
				} catch (error) {
					this.logDebug("[BatchProcessor] Error during cleanup:", error)
				}

				reject(new Error("Task was aborted"))
			})

			// Reset timeout on activity events
			task.on("taskStarted", () => {
				this.logDebug("[BatchProcessor] Task started")
				resetTimeout()
			})

			task.on("taskModeSwitched", (taskId: string, mode: string) => {
				this.logDebug(`[BatchProcessor] Task mode switched to: ${mode}`)
				resetTimeout()
			})

			task.on("taskPaused", () => {
				this.logDebug("[BatchProcessor] Task paused")
				resetTimeout()
			})

			task.on("taskUnpaused", () => {
				this.logDebug("[BatchProcessor] Task unpaused")
				resetTimeout()
			})

			task.on("taskAskResponded", () => {
				this.logDebug(
					"[BatchProcessor] *** CRITICAL: User answered question - resuming timeout with fresh 60 seconds ***",
				)
				resumeTimeout()
			})

			task.on("taskSpawned", (taskId: string) => {
				this.logDebug(`[BatchProcessor] Task spawned: ${taskId}`)
				resetTimeout()
			})

			task.on("taskTokenUsageUpdated", (taskId: string, tokenUsage: any) => {
				this.logDebug(`[BatchProcessor] Token usage updated for task: ${taskId}`)
				resetTimeout()
			})

			// Handle tool failures - don't reset timeout, but clear it since we're rejecting
			task.on("taskToolFailed", (taskId: string, tool: string, error: string) => {
				this.logDebug(`[BatchProcessor] Tool ${tool} failed: ${error}`)
				clearSlidingTimeout()
				reject(new Error(`Tool ${tool} failed: ${error}`))
			})

			this.logDebug("[BatchProcessor] Event handlers set up, waiting for task execution...")
			this.logDebug(`[BatchProcessor] Task ID: ${task.taskId}`)
			this.logDebug(`[BatchProcessor] Task initialized: ${task.isInitialized}`)
			this.logDebug(`[BatchProcessor] Task aborted: ${task.abort}`)

			// Wait for the task promise and handle errors
			taskPromise.catch((error) => {
				this.logDebug(`[BatchProcessor] Task promise rejected:`, error)
				clearSlidingTimeout()
				reject(error)
			})
		})
	}
}
