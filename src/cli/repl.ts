import * as readline from "readline"
import chalk from "chalk"
import { createCliAdapters, type CliAdapterOptions } from "../core/adapters/cli"
import { Task } from "../core/task/Task"
import type { ProviderSettings } from "@roo-code/types"

interface ReplOptions extends CliAdapterOptions {
	cwd: string
	config?: string
	verbose: boolean
	color: boolean
}

export class CliRepl {
	private rl: readline.Interface
	private options: ReplOptions
	private currentTask: Task | null = null
	private multiLineMode = false
	private multiLineBuffer: string[] = []
	private apiConfiguration?: ProviderSettings

	constructor(options: ReplOptions) {
		this.options = options
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			prompt: this.getPrompt(),
			historySize: 100,
			completer: this.completer.bind(this),
		})
	}

	async start(): Promise<void> {
		try {
			// Load configuration
			this.apiConfiguration = await this.loadConfiguration()

			this.setupEventHandlers()
			this.showWelcome()
			this.rl.prompt()

			return new Promise((resolve) => {
				this.rl.on("close", resolve)
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (this.options.color) {
				console.error(chalk.red("REPL startup failed:"), message)
			} else {
				console.error("REPL startup failed:", message)
			}
			process.exit(1)
		}
	}

	private setupEventHandlers(): void {
		this.rl.on("line", async (input) => {
			await this.handleInput(input)
			this.rl.setPrompt(this.getPrompt())
			this.rl.prompt()
		})

		this.rl.on("SIGINT", () => {
			if (this.currentTask) {
				console.log(chalk.yellow("\nAborting current task..."))
				this.currentTask.abort = true
				this.currentTask = null
			} else if (this.multiLineMode) {
				console.log(chalk.yellow("\nCancelling multi-line input"))
				this.multiLineMode = false
				this.multiLineBuffer = []
			} else {
				console.log(chalk.yellow('\nPress Ctrl+C again to exit, or type "exit"'))
			}
			this.rl.setPrompt(this.getPrompt())
			this.rl.prompt()
		})

		// Handle process exit
		process.on("SIGINT", () => {
			if (this.currentTask) {
				this.currentTask.abort = true
			}
			process.exit(0)
		})
	}

	private async handleInput(input: string): Promise<void> {
		const trimmedInput = input.trim()

		// Handle multi-line mode
		if (this.multiLineMode) {
			if (trimmedInput === "```" || trimmedInput === '""') {
				// End multi-line mode
				this.multiLineMode = false
				const fullInput = this.multiLineBuffer.join("\n")
				this.multiLineBuffer = []

				if (fullInput.trim()) {
					await this.executeTask(fullInput)
				}
				return
			} else {
				this.multiLineBuffer.push(input)
				return
			}
		}

		// Handle empty input
		if (!trimmedInput) return

		// Handle built-in commands
		if (await this.handleBuiltinCommand(trimmedInput)) {
			return
		}

		// Check for multi-line input start
		if (trimmedInput === "```" || trimmedInput === '""') {
			this.multiLineMode = true
			this.multiLineBuffer = []
			console.log(chalk.gray('Multi-line mode enabled. Type ``` or "" to finish.'))
			return
		}

		// Execute as task
		await this.executeTask(trimmedInput)
	}

	private async handleBuiltinCommand(input: string): Promise<boolean> {
		const [command, ...args] = input.split(" ")

		switch (command.toLowerCase()) {
			case "exit":
			case "quit":
				console.log(chalk.cyan("Goodbye! 👋"))
				this.rl.close()
				return true

			case "clear":
				console.clear()
				this.showWelcome()
				return true

			case "help":
				this.showHelp()
				return true

			case "status":
				this.showStatus()
				return true

			case "abort":
				if (this.currentTask) {
					console.log(chalk.yellow("Aborting current task..."))
					this.currentTask.abort = true
					this.currentTask = null
				} else {
					console.log(chalk.gray("No task is currently running."))
				}
				return true

			case "config":
				await this.handleConfigCommand(args)
				return true

			default:
				return false
		}
	}

	private async executeTask(userInput: string): Promise<void> {
		if (!this.apiConfiguration) {
			console.error(chalk.red("Configuration not loaded. Please check your API settings."))
			return
		}

		try {
			const adapters = createCliAdapters({
				workspaceRoot: this.options.cwd,
				isInteractive: true,
				verbose: this.options.verbose,
			})

			console.log(chalk.blue("🤖 Starting task..."))

			this.currentTask = new Task({
				apiConfiguration: this.apiConfiguration,
				task: userInput,
				fileSystem: adapters.fileSystem,
				terminal: adapters.terminal,
				browser: adapters.browser,
				workspacePath: this.options.cwd,
				globalStoragePath: process.env.HOME ? `${process.env.HOME}/.roo-code` : "/tmp/.roo-code",
			})

			// Set up task event handlers
			this.currentTask.on("taskCompleted", () => {
				console.log(chalk.green("✅ Task completed!"))
				this.currentTask = null
			})

			this.currentTask.on("taskAborted", () => {
				console.log(chalk.yellow("⚠️ Task aborted"))
				this.currentTask = null
			})

			this.currentTask.on("taskToolFailed", (taskId: string, tool: string, error: string) => {
				console.log(chalk.red(`❌ Tool ${tool} failed: ${error}`))
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.error(chalk.red("Task execution failed:"), message)
			this.currentTask = null
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
			console.log(chalk.yellow("⚠️ API configuration required."))
			console.log(chalk.gray("Please set ANTHROPIC_API_KEY environment variable or use --config option."))
			console.log(chalk.gray("You can also run: export ANTHROPIC_API_KEY=your_api_key_here"))
			console.log()
		}

		return config
	}

	private async handleConfigCommand(args: string[]): Promise<void> {
		if (args.length === 0) {
			this.showCurrentConfig()
		} else {
			console.log(chalk.gray("Configuration management coming soon..."))
		}
	}

	private showCurrentConfig(): void {
		console.log(chalk.cyan.bold("Current Configuration:"))
		console.log(`  Working Directory: ${chalk.white(this.options.cwd)}`)
		console.log(`  API Provider: ${chalk.white(this.apiConfiguration?.apiProvider || "Not set")}`)
		console.log(`  Model: ${chalk.white(this.apiConfiguration?.apiModelId || "Not set")}`)
		console.log(`  API Key: ${this.apiConfiguration?.apiKey ? chalk.green("Set") : chalk.red("Not set")}`)
		console.log(`  Verbose: ${this.options.verbose ? chalk.green("Yes") : chalk.gray("No")}`)
		console.log()
	}

	private showWelcome(): void {
		console.log(chalk.gray("Welcome to Roo Code Agent CLI! Type your coding requests below."))
		console.log(chalk.gray("For multi-line input, start with ``` and end with ```"))
		console.log()
	}

	private showHelp(): void {
		console.log()
		console.log(chalk.cyan.bold("Available Commands:"))
		console.log("  help                Show this help message")
		console.log("  clear               Clear the terminal screen")
		console.log("  status              Show current status")
		console.log("  config              Show current configuration")
		console.log("  abort               Abort current running task")
		console.log("  exit, quit          Exit the CLI")
		console.log()
		console.log(chalk.cyan.bold("Multi-line Input:"))
		console.log("  ```                 Start/end multi-line input mode")
		console.log('  ""                  Alternative start/end for multi-line input')
		console.log()
		console.log(chalk.cyan.bold("Examples:"))
		console.log("  Create a hello world function in Python")
		console.log("  Fix the bug in my React component")
		console.log("  Add TypeScript types to my existing JavaScript code")
		console.log()
	}

	private showStatus(): void {
		console.log(chalk.cyan.bold("Status:"))
		console.log(`  Current Task: ${this.currentTask ? chalk.yellow("Running") : chalk.gray("None")}`)
		console.log(`  Multi-line Mode: ${this.multiLineMode ? chalk.yellow("Active") : chalk.gray("Inactive")}`)
		console.log(`  Working Directory: ${chalk.white(this.options.cwd)}`)
		console.log()
	}

	private getPrompt(): string {
		if (this.multiLineMode) {
			return chalk.gray("... ")
		}
		return this.currentTask ? chalk.yellow("roo (busy)> ") : chalk.cyan("roo> ")
	}

	private completer(line: string): [string[], string] {
		const completions = [
			"help",
			"clear",
			"status",
			"config",
			"abort",
			"exit",
			"quit",
			"Create a",
			"Fix the",
			"Add",
			"Implement",
			"Debug",
			"Refactor",
			"Write tests for",
			"Document",
			"Optimize",
		]

		const hits = completions.filter((c) => c.startsWith(line))
		return [hits.length ? hits : completions, line]
	}
}
