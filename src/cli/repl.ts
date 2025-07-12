import * as readline from "readline"
import chalk from "chalk"
import { createCliAdapters, type CliAdapterOptions } from "../core/adapters/cli"
import { Task } from "../core/task/Task"
import type { ProviderSettings, RooCodeSettings } from "@roo-code/types"
import { CliConfigManager } from "./config/CliConfigManager"
import { CLIUIService } from "./services/CLIUIService"
import { SessionManager } from "./services/SessionManager"
import type { Session } from "./types/session-types"
import { LoggerFactory } from "../core/services/LoggerFactory"
import { getGlobalStoragePath } from "../shared/paths"
import { ReplHistoryService } from "../shared/services/ReplHistoryService"

interface ReplOptions extends CliAdapterOptions {
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
	private sessionManager: SessionManager
	private currentSession: Session | null = null
	private historyService: ReplHistoryService

	constructor(options: ReplOptions, configManager?: CliConfigManager) {
		this.options = options
		this.configManager = configManager

		// Initialize session management with configured storage directory
		const storageConfig = configManager ? this.getStorageConfigFromManager(configManager) : {}
		this.sessionManager = new SessionManager(storageConfig)
		this.currentSession = null

		// Initialize history service
		this.historyService = new ReplHistoryService({
			storageDir: getGlobalStoragePath(),
			historyFile: "cli-repl-history.json",
			maxHistorySize: 100,
			context: "cli",
			deduplication: true,
			autoSave: true,
		})

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

	private getStorageConfigFromManager(configManager: CliConfigManager): { sessionDirectory?: string } {
		try {
			const config = configManager.getConfiguration()
			return {
				sessionDirectory: (config as any).sessionDirectory,
			}
		} catch {
			// Configuration not loaded yet, return empty config
			return {}
		}
	}

	async start(): Promise<void> {
		try {
			// Load configuration using the config manager
			await this.loadConfiguration()

			// Initialize session management
			await this.sessionManager.initialize()

			// Initialize and load history
			await this.loadHistory()

			// Try to create or resume a session
			await this.initializeSession()

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
					// Save to history after successful execution
					await this.historyService.addEntry(fullInput, {
						context: "cli",
						timestamp: new Date(),
					})
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

		// Execute as task and save to history
		await this.executeTask(trimmedInput)
		await this.historyService.addEntry(trimmedInput, {
			context: "cli",
			timestamp: new Date(),
		})
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

			case "session":
				await this.handleSessionCommand(args)
				return true

			case "history":
				await this.handleHistoryCommand(args)
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
			// Record user message in session
			if (this.currentSession) {
				await this.sessionManager.addMessage(userInput, "user")
			}

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
				telemetry: adapters.telemetry,
				workspacePath: this.options.cwd,
				globalStoragePath: getGlobalStoragePath(),
				logger: LoggerFactory.getInstance().createLogger({ verbose: this.options.verbose }),
				cliUIService: this.uiService,
				// MCP configuration options (will use global service)
				mcpConfigPath: this.options.mcpConfig,
				mcpAutoConnect: this.options.mcpAutoConnect !== false && !this.options.noMcpAutoConnect,
				mcpTimeout: this.options.mcpTimeout,
				mcpRetries: this.options.mcpRetries,
			})

			// Set up task event handlers
			this.currentTask.on("taskCompleted", async () => {
				console.log(chalk.green("✅ Task completed!"))

				// Record task completion in session
				if (this.currentSession) {
					await this.sessionManager.addMessage("Task completed successfully", "system")
				}

				this.currentTask = null
			})

			this.currentTask.on("taskAborted", async () => {
				console.log(chalk.yellow("⚠️ Task aborted"))

				// Record task abortion in session
				if (this.currentSession) {
					await this.sessionManager.addMessage("Task was aborted", "system")
				}

				this.currentTask = null
			})

			this.currentTask.on("taskToolFailed", async (taskId: string, tool: string, error: string) => {
				console.log(chalk.red(`❌ Tool ${tool} failed: ${error}`))

				// Record tool failure in session
				if (this.currentSession) {
					await this.sessionManager.addMessage(`Tool ${tool} failed: ${error}`, "system", {
						tool,
						error,
						taskId,
					})
				}
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.error(chalk.red("Task execution failed:"), message)

			// Record execution failure in session
			if (this.currentSession) {
				await this.sessionManager.addMessage(`Task execution failed: ${message}`, "system", { error: message })
			}

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
		console.log("  history [show] [n]  Show recent command history (default: 20)")
		console.log("  history clear       Clear all command history")
		console.log("  history search <p>  Search command history for pattern")
		console.log("  history stats       Show command history statistics")
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
	private async initializeSession(): Promise<void> {
		try {
			// Create a new session for this REPL instance
			const sessionName = `CLI Session ${new Date().toISOString().split("T")[0]}`
			this.currentSession = await this.sessionManager.createSession(sessionName, "Interactive CLI session")

			if (this.options.verbose) {
				console.log(chalk.gray(`Session created: ${this.currentSession.name} (${this.currentSession.id})`))
			}
		} catch (error) {
			console.warn(
				chalk.yellow("Warning: Could not initialize session:"),
				error instanceof Error ? error.message : String(error),
			)
		}
	}

	private async handleSessionCommand(args: string[]): Promise<void> {
		const [subcommand, ...subArgs] = args

		switch (subcommand) {
			case "save":
				await this.saveCurrentSession(subArgs[0])
				break

			case "list":
				await this.listSessions()
				break

			case "load":
				if (subArgs[0]) {
					await this.loadSession(subArgs[0])
				} else {
					console.log(chalk.red("Session ID required"))
				}
				break

			case "info":
				await this.showCurrentSessionInfo()
				break

			case "checkpoint":
				if (subArgs[0]) {
					await this.createCheckpoint(subArgs.join(" "))
				} else {
					console.log(chalk.red("Checkpoint description required"))
				}
				break

			case undefined:
			case "show":
				await this.showCurrentSessionInfo()
				break

			default:
				console.log(chalk.yellow(`Unknown session command: ${subcommand}`))
				console.log(
					chalk.gray("Available commands: save [name], list, load <id>, info, checkpoint <description>"),
				)
		}
	}

	private async saveCurrentSession(name?: string): Promise<void> {
		if (!this.currentSession) {
			console.log(chalk.yellow("No active session to save"))
			return
		}

		try {
			if (name) {
				this.currentSession.name = name
			}

			await this.sessionManager.saveSession(this.currentSession.id)
			console.log(chalk.green(`✓ Session saved: ${this.currentSession.name}`))
		} catch (error) {
			console.error(chalk.red("Failed to save session:"), error instanceof Error ? error.message : String(error))
		}
	}

	private async listSessions(): Promise<void> {
		try {
			const sessions = await this.sessionManager.listSessions({ limit: 10 })

			if (sessions.length === 0) {
				console.log(chalk.gray("No sessions found"))
				return
			}

			console.log(chalk.cyan.bold("Recent Sessions:"))
			for (const session of sessions) {
				const isActive = this.currentSession?.id === session.id
				const marker = isActive ? chalk.green("●") : chalk.gray("○")
				const name = isActive ? chalk.green(session.name) : session.name
				console.log(`  ${marker} ${name} (${session.id.substring(0, 8)}) - ${session.messageCount} messages`)
			}
		} catch (error) {
			console.error(chalk.red("Failed to list sessions:"), error instanceof Error ? error.message : String(error))
		}
	}

	private async loadSession(sessionId: string): Promise<void> {
		try {
			this.currentSession = await this.sessionManager.loadSession(sessionId)
			console.log(chalk.green(`✓ Session loaded: ${this.currentSession.name}`))

			// Update the prompt to reflect the loaded session
			this.rl.setPrompt(this.getPrompt())
		} catch (error) {
			console.error(chalk.red("Failed to load session:"), error instanceof Error ? error.message : String(error))
		}
	}

	private async showCurrentSessionInfo(): Promise<void> {
		if (!this.currentSession) {
			console.log(chalk.gray("No active session"))
			return
		}

		console.log(chalk.cyan.bold("Current Session:"))
		console.log(`  Name: ${this.currentSession.name}`)
		console.log(`  ID: ${this.currentSession.id}`)
		console.log(`  Created: ${this.currentSession.metadata.createdAt.toLocaleString()}`)
		console.log(`  Updated: ${this.currentSession.metadata.updatedAt.toLocaleString()}`)
		console.log(`  Messages: ${this.currentSession.history.messages.length}`)
		console.log(`  Working Directory: ${this.currentSession.state.workingDirectory}`)
		console.log(`  Status: ${this.currentSession.metadata.status}`)

		if (this.currentSession.metadata.tags.length > 0) {
			console.log(`  Tags: ${this.currentSession.metadata.tags.join(", ")}`)
		}
	}

	private async createCheckpoint(description: string): Promise<void> {
		if (!this.currentSession) {
			console.log(chalk.yellow("No active session for checkpoint"))
			return
		}

		try {
			await this.sessionManager.createCheckpoint(description)
			console.log(chalk.green(`✓ Checkpoint created: ${description}`))
		} catch (error) {
			console.error(
				chalk.red("Failed to create checkpoint:"),
				error instanceof Error ? error.message : String(error),
			)
		}
	}

	private async loadHistory(): Promise<void> {
		try {
			await this.historyService.initialize()
			const history = this.historyService.getHistory()

			// Apply history to readline interface
			// Note: readline history is in reverse order (newest first)
			const commands = history.map((entry) => entry.command).reverse()

			// Clear existing history and add loaded entries
			;(this.rl as any).history = commands.slice(0, 100)

			if (this.options.verbose) {
				console.log(chalk.gray(`Loaded ${history.length} history entries`))
			}
		} catch (error) {
			if (this.options.verbose) {
				console.log(
					chalk.yellow(`Could not load history: ${error instanceof Error ? error.message : String(error)}`),
				)
			}
		}
	}

	private async handleHistoryCommand(args: string[]): Promise<void> {
		const [subcommand, ...subArgs] = args

		switch (subcommand) {
			case "show":
			case undefined:
				this.showHistory(parseInt(subArgs[0]) || 20)
				break

			case "clear":
				await this.clearHistory()
				break

			case "search":
				this.searchHistory(subArgs.join(" "))
				break

			case "stats":
				this.showHistoryStats()
				break

			default:
				console.log(chalk.yellow(`Unknown history command: ${subcommand}`))
				console.log(chalk.gray("Available commands: show [n], clear, search <pattern>, stats"))
		}
	}

	private showHistory(limit: number = 20): void {
		const history = this.historyService.getHistory(limit)

		if (history.length === 0) {
			console.log(chalk.gray("No history entries found"))
			return
		}

		console.log(chalk.cyan.bold(`Recent History (${history.length} entries):`))
		console.log(chalk.gray("=".repeat(50)))

		history.forEach((entry, index) => {
			const timeStr = entry.timestamp.toLocaleTimeString()
			const successIcon = entry.success !== false ? "✓" : "✗"
			console.log(
				`${chalk.gray(`${index + 1}.`)} ${chalk.green(successIcon)} ${chalk.white(entry.command)} ${chalk.gray(`(${timeStr})`)}`,
			)
		})
	}

	private async clearHistory(): Promise<void> {
		await this.historyService.clearHistory()
		;(this.rl as any).history = []
		console.log(chalk.green("✓ History cleared"))
	}

	private searchHistory(pattern: string): void {
		if (!pattern) {
			console.log(chalk.yellow("Please provide a search pattern"))
			return
		}

		const results = this.historyService.searchHistory(new RegExp(pattern, "i"))

		if (results.length === 0) {
			console.log(chalk.gray(`No history entries found matching: ${pattern}`))
			return
		}

		console.log(chalk.cyan.bold(`Search Results (${results.length} entries):`))
		results.forEach((entry, index) => {
			const timeStr = entry.timestamp.toLocaleString()
			console.log(`${chalk.gray(`${index + 1}.`)} ${chalk.white(entry.command)} ${chalk.gray(`(${timeStr})`)}`)
		})
	}

	private showHistoryStats(): void {
		const stats = this.historyService.getStatistics()

		console.log(chalk.cyan.bold("History Statistics:"))
		console.log(chalk.gray("=".repeat(30)))
		console.log(`Total entries: ${stats.totalEntries}`)
		console.log(`Unique commands: ${stats.uniqueCommands}`)
		console.log(`Average command length: ${stats.averageCommandLength.toFixed(1)} characters`)

		if (stats.oldestEntry) {
			console.log(`Oldest entry: ${stats.oldestEntry.toLocaleString()}`)
		}

		if (stats.newestEntry) {
			console.log(`Newest entry: ${stats.newestEntry.toLocaleString()}`)
		}

		if (stats.mostUsedCommands.length > 0) {
			console.log("\nMost used commands:")
			stats.mostUsedCommands.slice(0, 5).forEach((cmd, index) => {
				console.log(`  ${index + 1}. ${cmd.command} (${cmd.count} times)`)
			})
		}
	}

	private isBuiltinCommand(input: string): boolean {
		const command = input.split(" ")[0].toLowerCase()
		return ["exit", "quit", "clear", "help", "status", "abort", "config", "session", "history"].includes(command)
	}

	private completer(line: string): [string[], string] {
		const completions = [
			"help",
			"clear",
			"status",
			"config",
			"session",
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
