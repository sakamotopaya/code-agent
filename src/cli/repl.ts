import * as readline from "readline"
import chalk from "chalk"
import { createCliAdapters, type CliAdapterOptions } from "../core/adapters/cli"
import { Task } from "../core/task/Task"
import type { ProviderSettings, RooCodeSettings } from "@roo-code/types"
import { CliConfigManager } from "./config/CliConfigManager"
import { CLIUIService } from "./services/CLIUIService"

interface ReplOptions extends CliAdapterOptions {
	cwd: string
	config?: string
	verbose: boolean
	color: boolean
	colorScheme?: string
}

interface ReplConstructorOptions {
	options: ReplOptions
	configManager?: CliConfigManager
}

export class CliRepl {
	private rl: readline.Interface
	private options: ReplOptions
	private currentTask: Task | null = null
	private multiLineMode = false
	private multiLineBuffer: string[] = []
	private apiConfiguration?: ProviderSettings
	private configManager?: CliConfigManager
	private fullConfiguration?: RooCodeSettings
	private uiService: CLIUIService

	constructor(options: ReplOptions, configManager?: CliConfigManager) {
		this.options = options
		this.configManager = configManager

		// Get color scheme from options
		let colorScheme
		if (options.colorScheme) {
			const { PREDEFINED_COLOR_SCHEMES } = require("./types/ui-types")
			colorScheme = PREDEFINED_COLOR_SCHEMES[options.colorScheme]
		}

		this.uiService = new CLIUIService(options.color, colorScheme)
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
			// Load configuration using the config manager
			await this.loadConfiguration()

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

	private async loadConfiguration(): Promise<void> {
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
			this.fullConfiguration = await this.configManager.loadConfiguration()

			// Extract provider settings for the API configuration
			this.apiConfiguration = {
				apiProvider: this.fullConfiguration.apiProvider,
				apiKey: this.fullConfiguration.apiKey,
				apiModelId: this.fullConfiguration.apiModelId,
				openAiBaseUrl: this.fullConfiguration.openAiBaseUrl,
				// Add other provider-specific settings as needed
				anthropicBaseUrl: this.fullConfiguration.anthropicBaseUrl,
				openAiApiKey: this.fullConfiguration.openAiApiKey,
				openAiModelId: this.fullConfiguration.openAiModelId,
				glamaModelId: this.fullConfiguration.glamaModelId,
				openRouterApiKey: this.fullConfiguration.openRouterApiKey,
				openRouterModelId: this.fullConfiguration.openRouterModelId,
				// ... other provider settings
			} as ProviderSettings

			// Validate configuration
			if (!this.apiConfiguration.apiKey) {
				console.log(chalk.yellow("⚠️ API configuration required."))
				console.log(chalk.gray("Set your API key using one of these methods:"))
				console.log(chalk.gray(`  1. Environment variable: export ROO_API_KEY=your_api_key_here`))
				console.log(chalk.gray(`  2. Config file: roo-cli --generate-config ~/.roo-cli/config.json`))
				console.log(chalk.gray(`  3. Project config: Create .roo-cli.json in your project`))
				console.log()
			}

			if (this.options.verbose) {
				console.log(
					chalk.gray(
						`Configuration loaded - Provider: ${this.apiConfiguration.apiProvider}, Model: ${this.apiConfiguration.apiModelId}`,
					),
				)
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.error(chalk.red("Failed to load configuration:"), message)

			// Fallback to basic configuration for both fullConfiguration and apiConfiguration
			this.fullConfiguration = {
				apiProvider: "anthropic",
				apiKey: process.env.ANTHROPIC_API_KEY || process.env.ROO_API_KEY || "",
				apiModelId: "claude-3-5-sonnet-20241022",
				openAiBaseUrl: "",
				anthropicBaseUrl: "",
				openAiApiKey: "",
				openAiModelId: "",
				glamaModelId: "",
				openRouterApiKey: "",
				openRouterModelId: "",
				autoApprovalEnabled: false,
				alwaysAllowReadOnly: false,
				alwaysAllowWrite: false,
				alwaysAllowBrowser: false,
				alwaysAllowExecute: false,
				alwaysAllowMcp: false,
				requestDelaySeconds: 0,
				allowedMaxRequests: undefined,
			} as RooCodeSettings

			this.apiConfiguration = {
				apiProvider: this.fullConfiguration.apiProvider,
				apiKey: this.fullConfiguration.apiKey,
				apiModelId: this.fullConfiguration.apiModelId,
				openAiBaseUrl: this.fullConfiguration.openAiBaseUrl,
				anthropicBaseUrl: this.fullConfiguration.anthropicBaseUrl,
				openAiApiKey: this.fullConfiguration.openAiApiKey,
				openAiModelId: this.fullConfiguration.openAiModelId,
				glamaModelId: this.fullConfiguration.glamaModelId,
				openRouterApiKey: this.fullConfiguration.openRouterApiKey,
				openRouterModelId: this.fullConfiguration.openRouterModelId,
			} as ProviderSettings
		}
	}

	private async handleConfigCommand(args: string[]): Promise<void> {
		const [subcommand, ...subArgs] = args

		switch (subcommand) {
			case "show":
			case undefined:
				this.showCurrentConfig()
				break

			case "generate": {
				const configPath = subArgs[0] || CliConfigManager.getDefaultUserConfigPath()
				try {
					if (!this.configManager) {
						this.configManager = new CliConfigManager({ verbose: this.options.verbose })
					}
					await this.configManager.generateDefaultConfig(configPath)
					console.log(chalk.green(`✓ Generated default configuration at: ${configPath}`))
					console.log(chalk.gray("Edit the file to customize your settings."))
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)
					console.error(chalk.red("Failed to generate config:"), message)
				}
				break
			}

			case "reload":
				console.log(chalk.blue("Reloading configuration..."))
				await this.loadConfiguration()
				console.log(chalk.green("✓ Configuration reloaded"))
				break

			case "validate":
				if (this.configManager) {
					const validation = this.configManager.validateConfiguration(this.fullConfiguration || {})
					if (validation.valid) {
						console.log(chalk.green("✓ Configuration is valid"))
					} else {
						console.log(chalk.red("❌ Configuration validation failed:"))
						validation.errors?.forEach((error) => console.log(chalk.red(`  ${error}`)))
					}
				} else {
					console.log(chalk.red("No configuration manager available"))
				}
				break

			default:
				console.log(chalk.yellow(`Unknown config command: ${subcommand}`))
				console.log(chalk.gray("Available commands: show, generate [path], reload, validate"))
		}
	}

	private showCurrentConfig(): void {
		console.log(chalk.cyan.bold("Current Configuration:"))
		console.log(chalk.gray("=".repeat(50)))

		// Basic settings
		console.log(`  Working Directory: ${chalk.white(this.options.cwd)}`)
		console.log(`  Verbose Mode: ${this.options.verbose ? chalk.green("Yes") : chalk.gray("No")}`)
		console.log()

		// API Configuration
		console.log(chalk.cyan.bold("API Configuration:"))
		console.log(`  Provider: ${chalk.white(this.apiConfiguration?.apiProvider || "Not set")}`)
		console.log(`  Model: ${chalk.white(this.apiConfiguration?.apiModelId || "Not set")}`)
		console.log(`  API Key: ${this.apiConfiguration?.apiKey ? chalk.green("Set") : chalk.red("Not set")}`)

		if (this.apiConfiguration?.openAiBaseUrl) {
			console.log(`  Base URL: ${chalk.white(this.apiConfiguration.openAiBaseUrl)}`)
		}
		console.log()

		// Behavioral Settings
		if (this.fullConfiguration) {
			console.log(chalk.cyan.bold("Behavioral Settings:"))
			console.log(
				`  Auto Approval: ${this.fullConfiguration.autoApprovalEnabled ? chalk.green("Enabled") : chalk.gray("Disabled")}`,
			)
			console.log(
				`  Always Allow Read: ${this.fullConfiguration.alwaysAllowReadOnly ? chalk.green("Yes") : chalk.gray("No")}`,
			)
			console.log(
				`  Always Allow Write: ${this.fullConfiguration.alwaysAllowWrite ? chalk.green("Yes") : chalk.gray("No")}`,
			)
			console.log(
				`  Always Allow Browser: ${this.fullConfiguration.alwaysAllowBrowser ? chalk.green("Yes") : chalk.gray("No")}`,
			)
			console.log(
				`  Always Allow Execute: ${this.fullConfiguration.alwaysAllowExecute ? chalk.green("Yes") : chalk.gray("No")}`,
			)
			console.log(`  Max Requests: ${this.fullConfiguration.allowedMaxRequests ?? chalk.gray("Unlimited")}`)
			console.log()
		}

		// Configuration file paths
		console.log(chalk.cyan.bold("Configuration Sources:"))
		console.log(`  User Config: ${chalk.white(CliConfigManager.getDefaultUserConfigPath())}`)
		console.log(`  Project Config: ${chalk.white(this.options.cwd + "/.roo-cli.json")}`)
		if (this.options.config) {
			console.log(`  Explicit Config: ${chalk.white(this.options.config)}`)
		}
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
		console.log("  config [show]       Show current configuration")
		console.log("  config generate     Generate default config file")
		console.log("  config reload       Reload configuration from files")
		console.log("  config validate     Validate current configuration")
		console.log("  abort               Abort current running task")
		console.log("  exit, quit          Exit the CLI")
		console.log()
		console.log(chalk.cyan.bold("Multi-line Input:"))
		console.log("  ```                 Start/end multi-line input mode")
		console.log('  ""                  Alternative start/end for multi-line input')
		console.log()
		console.log(chalk.cyan.bold("Configuration:"))
		console.log("  Environment Variables:")
		console.log("    ROO_API_KEY       Set your API key")
		console.log("    ROO_API_PROVIDER  Set your preferred provider")
		console.log("    ROO_MODEL         Set your preferred model")
		console.log("    ROO_AUTO_APPROVAL Enable auto-approval (true/false)")
		console.log()
		console.log("  Config Files (in order of priority):")
		console.log("    .roo-cli.json     Project-level configuration")
		console.log("    ~/.roo-cli/config.json  User-level configuration")
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
