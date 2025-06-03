import chalk from "chalk"
import { createCliAdapters, type CliAdapterOptions } from "../../core/adapters/cli"
import { Task } from "../../core/task/Task"
import { defaultModeSlug } from "../../shared/modes"
import type { ProviderSettings } from "@roo-code/types"

interface BatchOptions extends CliAdapterOptions {
	cwd: string
	config?: string
	verbose: boolean
	color: boolean
}

export class BatchProcessor {
	private options: BatchOptions

	constructor(options: BatchOptions) {
		this.options = options
	}

	async run(taskDescription: string): Promise<void> {
		try {
			if (this.options.verbose) {
				console.log(chalk.blue("Starting batch mode..."))
				console.log(chalk.gray(`Working directory: ${this.options.cwd}`))
				console.log(chalk.gray(`Task: ${taskDescription}`))
			}

			// Create CLI adapters
			const adapters = createCliAdapters({
				workspaceRoot: this.options.cwd,
				isInteractive: false,
				verbose: this.options.verbose,
			})

			// Load configuration
			const apiConfiguration = await this.loadConfiguration()

			// Create and execute task
			const task = new Task({
				apiConfiguration,
				task: taskDescription,
				fileSystem: adapters.fileSystem,
				terminal: adapters.terminal,
				browser: adapters.browser,
				workspacePath: this.options.cwd,
				globalStoragePath: process.env.HOME ? `${process.env.HOME}/.roo-code` : "/tmp/.roo-code",
			})

			if (this.options.verbose) {
				console.log(chalk.blue("Task created, starting execution..."))
			}

			// Execute the task
			await this.executeTask(task)

			if (this.options.verbose) {
				console.log(chalk.green("Task completed successfully"))
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (this.options.color) {
				console.error(chalk.red("Batch execution failed:"), message)
			} else {
				console.error("Batch execution failed:", message)
			}
			process.exit(1)
		}
	}

	private async loadConfiguration(): Promise<ProviderSettings> {
		// TODO: Implement configuration loading from file
		// For now, return a basic configuration that will need to be set up by the user
		const config: ProviderSettings = {
			apiProvider: "anthropic",
			apiKey: process.env.ANTHROPIC_API_KEY || "",
			apiModelId: "claude-3-5-sonnet-20241022",
		}

		if (!config.apiKey) {
			const message =
				"API configuration required. Please set ANTHROPIC_API_KEY environment variable or use --config option."
			if (this.options.color) {
				console.error(chalk.red("Configuration Error:"), message)
			} else {
				console.error("Configuration Error:", message)
			}
			process.exit(1)
		}

		return config
	}

	private async executeTask(task: Task): Promise<void> {
		return new Promise((resolve, reject) => {
			// Set up event handlers
			task.on("taskCompleted", () => {
				resolve()
			})

			task.on("taskAborted", () => {
				reject(new Error("Task was aborted"))
			})

			// Handle tool failures
			task.on("taskToolFailed", (taskId: string, tool: string, error: string) => {
				reject(new Error(`Tool ${tool} failed: ${error}`))
			})

			// Start the task - this should be done automatically if startTask is true (default)
			// The task should start automatically based on the constructor options
		})
	}
}
