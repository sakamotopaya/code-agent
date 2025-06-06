import chalk from "chalk"
import { createCliAdapters, type CliAdapterOptions } from "../../core/adapters/cli"
import { Task } from "../../core/task/Task"
import { defaultModeSlug } from "../../shared/modes"
import type { ProviderSettings, RooCodeSettings } from "@roo-code/types"
import { CliConfigManager } from "../config/CliConfigManager"
import { getCLILogger } from "../services/CLILogger"

interface BatchOptions extends CliAdapterOptions {
	cwd: string
	config?: string
	verbose: boolean
	color: boolean
	colorScheme?: string
}

export class BatchProcessor {
	private options: BatchOptions
	private configManager?: CliConfigManager

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

	async run(taskDescription: string): Promise<void> {
		try {
			this.logDebug("[BatchProcessor] Starting batch mode...")
			this.logDebug(`[BatchProcessor] Working directory: ${this.options.cwd}`)
			this.logDebug(`[BatchProcessor] Task: ${taskDescription}`)

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
			//const { apiConfiguration } = await this.loadConfiguration()
			const { apiConfiguration } = await this.loadConfiguration()
			this.logDebug("[BatchProcessor] Configuration loaded")

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
			})

			this.logDebug("[BatchProcessor] Task created, starting execution...")

			// Execute the task with proper promise handling
			await this.executeTask(task, taskPromise)

			this.logDebug("[BatchProcessor] Task completed successfully")
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.logError("Batch execution failed:", message)
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

	private async executeTask(task: Task, taskPromise: Promise<void>): Promise<void> {
		return new Promise((resolve, reject) => {
			this.logDebug("[BatchProcessor] Setting up task event handlers...")

			// Set up event handlers
			task.on("taskCompleted", (taskId: string, tokenUsage: any, toolUsage: any) => {
				this.logDebug(`[BatchProcessor] Task completed: ${taskId}`)
				this.logDebug(`[BatchProcessor] Token usage:`, tokenUsage)
				this.logDebug(`[BatchProcessor] Tool usage:`, toolUsage)
				resolve()
			})

			task.on("taskAborted", () => {
				this.logDebug("[BatchProcessor] Task was aborted")
				reject(new Error("Task was aborted"))
			})

			task.on("taskStarted", () => {
				this.logDebug("[BatchProcessor] Task started")
			})

			task.on("taskPaused", () => {
				this.logDebug("[BatchProcessor] Task paused")
			})

			task.on("taskUnpaused", () => {
				this.logDebug("[BatchProcessor] Task unpaused")
			})

			// Handle tool failures
			task.on("taskToolFailed", (taskId: string, tool: string, error: string) => {
				this.logDebug(`[BatchProcessor] Tool ${tool} failed: ${error}`)
				reject(new Error(`Tool ${tool} failed: ${error}`))
			})

			console.log(chalk.gray("[BatchProcessor] Event handlers set up, waiting for task execution..."))
			console.log(chalk.gray(`[BatchProcessor] Task ID: ${task.taskId}`))
			console.log(chalk.gray(`[BatchProcessor] Task initialized: ${task.isInitialized}`))
			console.log(chalk.gray(`[BatchProcessor] Task aborted: ${task.abort}`))

			// Wait for the task promise and handle errors
			taskPromise.catch((error) => {
				console.log(chalk.red(`[BatchProcessor] Task promise rejected:`, error))
				reject(error)
			})

			// Add a timeout to prevent hanging - increased for complex tasks
			const timeoutMs = 60000 // 60 seconds
			const timeout = setTimeout(() => {
				console.log(chalk.red(`[BatchProcessor] Task execution timeout after ${timeoutMs}ms`))
				reject(new Error(`Task execution timeout after ${timeoutMs}ms`))
			}, timeoutMs)

			// Clear timeout when task completes
			task.on("taskCompleted", () => clearTimeout(timeout))
			task.on("taskAborted", () => clearTimeout(timeout))
		})
	}
}
