import { Command } from "commander"
import { CliRepl } from "./repl"
import { BatchProcessor } from "./commands/batch"
import { showHelp } from "./commands/help"
import { SessionCommands } from "./commands/session-commands"
import { registerMcpCommands } from "./commands/mcp-commands"
import { registerExamplesCommands } from "./commands/ExamplesCommand"
import { showBanner } from "./utils/banner"
import { validateCliAdapterOptions } from "../core/adapters/cli/index"
import { CliConfigManager } from "./config/CliConfigManager"
import { validateBrowserViewport, validateTimeout } from "./utils/browser-config"
import { isValidFormat, getAvailableFormatsWithDescriptions } from "./utils/format-detection"
import { PlatformServiceFactory, PlatformContext } from "../core/adapters/PlatformServiceFactory"
import { PerformanceMonitoringService } from "./optimization/PerformanceMonitoringService"
import { StartupOptimizer } from "./optimization/StartupOptimizer"
import { MemoryOptimizer } from "./optimization/MemoryOptimizer"
import { PerformanceConfigManager } from "./config/performance-config"
import { initializeCLILogger, getCLILogger, formatDebugMessage } from "./services/CLILogger"
import { GlobalCLIMcpService } from "./services/GlobalCLIMcpService"
import chalk from "chalk"
import * as fs from "fs"

const packageJson = require("../package.json")

const program = new Command()

interface CliOptions {
	cwd: string
	config?: string
	model?: string
	mode?: string
	format?: string
	output?: string
	verbose: boolean
	color: boolean
	colorScheme?: string
	batch?: string
	interactive: boolean
	generateConfig?: string
	// Non-interactive mode options
	stdin?: boolean
	yes?: boolean
	no?: boolean
	timeout?: number
	parallel?: boolean
	continueOnError?: boolean
	dryRun?: boolean
	quiet?: boolean
	// Browser options
	headless: boolean
	browserViewport?: string
	browserTimeout?: number
	screenshotOutput?: string
	userAgent?: string
	// MCP options
	mcpConfig?: string
	mcpServer?: string[]
	mcpTimeout?: number
	mcpRetries?: number
	mcpAutoConnect?: boolean
	noMcpAutoConnect?: boolean
	mcpLogLevel?: string
	// Session options
	sessionDirectory?: string
}

// Validation functions
function validateMode(value: string): string {
	const validModes = [
		"code",
		"debug",
		"architect",
		"ask",
		"test",
		"design-engineer",
		"release-engineer",
		"translate",
		"product-owner",
		"orchestrator",
	]
	if (!validModes.includes(value)) {
		throw new Error(`Invalid mode: ${value}. Valid modes are: ${validModes.join(", ")}`)
	}
	return value
}

function validateFormat(value: string): string {
	// Normalize to lowercase for case-insensitive validation
	const normalizedValue = value.toLowerCase()
	if (!isValidFormat(normalizedValue)) {
		const availableFormats = getAvailableFormatsWithDescriptions()
			.map((f) => f.format)
			.join(", ")
		throw new Error(`Invalid format: ${value}. Valid formats are: ${availableFormats}`)
	}
	return normalizedValue
}

function validatePath(value: string): string {
	// Basic path validation - check if it's a reasonable path
	if (!value || value.trim().length === 0) {
		throw new Error("Path cannot be empty")
	}
	return value
}

function validateColorScheme(value: string): string {
	const validSchemes = ["default", "dark", "light", "high-contrast", "minimal"]
	if (!validSchemes.includes(value)) {
		throw new Error(`Invalid color scheme: ${value}. Valid schemes are: ${validSchemes.join(", ")}`)
	}
	return value
}

function validateMcpLogLevel(value: string): string {
	const validLevels = ["error", "warn", "info", "debug"]
	if (!validLevels.includes(value)) {
		throw new Error(`Invalid MCP log level: ${value}. Available levels: ${validLevels.join(", ")}`)
	}
	return value
}

function collectArray(value: string, previous: string[]): string[] {
	return previous.concat([value])
}

program
	.name("roo-cli")
	.description("Roo Code Agent CLI - Interactive coding assistant for the command line")
	.version(packageJson.version)
	.option("-c, --cwd <path>", "Working directory", validatePath, process.cwd())
	.option("--config <path>", "Configuration file path", validatePath)
	.option("-m, --model <name>", "AI model to use (overrides config)")
	.option(
		"--mode <mode>",
		"Agent mode (code, debug, architect, ask, test, design-engineer, release-engineer, translate, product-owner, orchestrator)",
		validateMode,
	)
	.option("-f, --format <format>", "Output format (json, plain, yaml, csv, markdown)", validateFormat)
	.option("-o, --output <file>", "Output file path")
	.option("-v, --verbose", "Enable verbose logging", false)
	.option("--no-color", "Disable colored output")
	.option(
		"--color-scheme <scheme>",
		"Color scheme (default, dark, light, high-contrast, minimal)",
		validateColorScheme,
	)
	.option("-b, --batch <task>", "Run in non-interactive mode with specified task")
	.option("-i, --interactive", "Run in interactive mode (default)", true)
	.option("--stdin", "Read commands from stdin (non-interactive mode)")
	.option("--yes", "Assume yes for all prompts (non-interactive mode)")
	.option("--no", "Assume no for all prompts (non-interactive mode)")
	.option("--timeout <ms>", "Global timeout in milliseconds", validateTimeout)
	.option("--parallel", "Execute commands in parallel (batch mode)")
	.option("--continue-on-error", "Continue execution on command failure")
	.option("--dry-run", "Show what would be executed without running commands")
	.option("--quiet", "Suppress non-essential output")
	.option("--generate-config <path>", "Generate default configuration file at specified path", validatePath)
	.option("--session-directory <path>", "Directory for storing session files (default: ~/.agentz)", validatePath)
	.option("--headless", "Run browser in headless mode (default: true)", true)
	.option("--no-headless", "Run browser in headed mode")
	.option("--browser-viewport <size>", "Browser viewport size (e.g., 1920x1080)", validateBrowserViewport)
	.option("--browser-timeout <ms>", "Browser operation timeout in milliseconds", validateTimeout)
	.option("--screenshot-output <dir>", "Directory for screenshot output", validatePath)
	.option("--user-agent <agent>", "Custom user agent string for browser")
	.option("--mcp-config <path>", "Path to MCP configuration file", validatePath)
	.option("--mcp-server <id>", "MCP server IDs to connect to (can be repeated)", collectArray, [])
	.option("--mcp-timeout <ms>", "Timeout for MCP operations in milliseconds", validateTimeout)
	.option("--mcp-retries <count>", "Number of retry attempts for MCP operations", (value) => parseInt(value, 10))
	.option("--mcp-auto-connect", "Automatically connect to enabled MCP servers")
	.option("--no-mcp-auto-connect", "Do not automatically connect to enabled MCP servers")
	.option("--mcp-log-level <level>", "MCP logging level (error, warn, info, debug)", validateMcpLogLevel)
	.action(async (options: CliOptions) => {
		// Set up global error handler to catch undefined startsWith errors
		process.on("uncaughtException", (error) => {
			console.error("Uncaught Exception:", error.message)
			console.error("Stack:", error.stack)
			if (error.message.includes("startsWith")) {
				console.error("This appears to be a startsWith on undefined error - debugging info:")
				console.error("Options:", JSON.stringify(options, null, 2))
			}
			process.exit(1)
		})

		process.on("unhandledRejection", (reason, promise) => {
			console.error("Unhandled Rejection at:", promise, "reason:", reason)
			if (
				reason &&
				typeof reason === "object" &&
				"message" in reason &&
				typeof reason.message === "string" &&
				reason.message.includes("startsWith")
			) {
				console.error("This appears to be a startsWith on undefined error in promise")
			}
			process.exit(1)
		})

		console.log(
			formatDebugMessage("CLI: Entered main action with options:", options.color),
			JSON.stringify(options, null, 2),
		)

		// Initialize CLI logger first
		const logger = initializeCLILogger(options.verbose, options.quiet, options.color)

		console.log(formatDebugMessage("CLI: Logger initialized", options.color))

		// Set up graceful shutdown handlers
		let isShuttingDown = false
		const gracefulShutdown = async (signal: string) => {
			if (isShuttingDown) return
			isShuttingDown = true

			if (options.verbose) {
				logger.debug(`Received ${signal}, initiating graceful shutdown...`)
			}

			// Dispose global MCP service
			try {
				const globalMcpService = GlobalCLIMcpService.getInstance()
				if (globalMcpService.isInitialized()) {
					if (options.verbose) {
						logger.debug("Disposing global MCP service...")
					}
					await globalMcpService.dispose()
					if (options.verbose) {
						logger.debug("Global MCP service disposed")
					}
				}
			} catch (error) {
				if (options.verbose) {
					logger.debug("Error disposing global MCP service:", error)
				}
			}

			// Set a timeout for forced exit
			setTimeout(() => {
				if (options.verbose) {
					logger.debug("Forcing process exit after timeout")
				}
				process.exit(signal === "SIGINT" ? 130 : 143)
			}, 10000) // 10 second timeout
		}

		process.on("SIGINT", () => gracefulShutdown("SIGINT"))
		process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))

		// Initialize performance monitoring and optimization
		const performanceMonitor = new PerformanceMonitoringService()
		const performanceConfig = new PerformanceConfigManager("standard")
		const startupOptimizer = new StartupOptimizer(performanceMonitor)
		const memoryOptimizer = new MemoryOptimizer(undefined, performanceMonitor)

		// Start performance monitoring
		const cliStartupTimer = performanceMonitor.startTimer("cli-startup")
		memoryOptimizer.startMonitoring()

		// Optimize startup
		try {
			await startupOptimizer.optimizeStartup()
		} catch (error) {
			logger.warn("Startup optimization failed:", error)
		}

		// Initialize platform services for CLI context
		await PlatformServiceFactory.initialize(PlatformContext.CLI, "roo-cline", options.config)

		// Initialize global MCP service once at startup
		console.log(
			formatDebugMessage("CLI: MCP auto-connect check:", options.color),
			options.mcpAutoConnect,
			"!== false =",
			options.mcpAutoConnect !== false,
		)
		if (options.mcpAutoConnect !== false) {
			console.log(formatDebugMessage("CLI: About to initialize global MCP service...", options.color))
			try {
				const { GlobalCLIMcpService } = await import("./services/GlobalCLIMcpService")
				console.log(formatDebugMessage("CLI: GlobalCLIMcpService imported successfully", options.color))
				const globalMcpService = GlobalCLIMcpService.getInstance()
				console.log(formatDebugMessage("CLI: GlobalCLIMcpService instance obtained", options.color))
				await globalMcpService.initialize({
					mcpConfigPath: options.mcpConfig,
					mcpAutoConnect: options.mcpAutoConnect,
					mcpTimeout: options.mcpTimeout,
					mcpRetries: options.mcpRetries,
				})
				console.log(formatDebugMessage("CLI: GlobalCLIMcpService.initialize() completed", options.color))
				if (options.verbose) {
					logger.debug("Global MCP service initialized successfully")
				}
			} catch (error) {
				console.error(formatDebugMessage("CLI: Failed to initialize global MCP service:", options.color), error)
				logger.warn("Failed to initialize global MCP service:", error)
			}
		} else {
			console.log(
				formatDebugMessage("CLI: MCP auto-connect disabled, skipping MCP initialization", options.color),
			)
		}

		// Handle MCP auto-connect logic: default to true, but allow explicit override
		if (options.mcpAutoConnect === undefined && options.noMcpAutoConnect === undefined) {
			options.mcpAutoConnect = true // Default behavior
		} else if (options.noMcpAutoConnect) {
			options.mcpAutoConnect = false
		} else if (options.mcpAutoConnect) {
			options.mcpAutoConnect = true
		}

		try {
			// Handle config generation
			if (options.generateConfig) {
				const configManager = new CliConfigManager({ verbose: options.verbose })
				await configManager.generateDefaultConfig(options.generateConfig)
				logger.success(`Generated default configuration at: ${options.generateConfig}`)
				logger.info("Edit the file to customize your settings.")
				return
			}

			// Initialize configuration manager with CLI overrides
			const cliOverrides: Record<string, any> = {}

			// Apply CLI overrides for model and mode
			if (options.model) {
				cliOverrides.model = options.model
			}
			if (options.mode) {
				cliOverrides.mode = options.mode
			}

			// Apply session directory configuration override
			if (options.sessionDirectory) {
				cliOverrides.sessionDirectory = options.sessionDirectory
			}

			// Apply browser configuration overrides
			if (options.headless !== undefined) {
				cliOverrides.browser = cliOverrides.browser || {}
				cliOverrides.browser.headless = options.headless
			}
			if (options.browserViewport) {
				cliOverrides.browser = cliOverrides.browser || {}
				cliOverrides.browser.viewport = options.browserViewport
			}
			if (options.browserTimeout) {
				cliOverrides.browser = cliOverrides.browser || {}
				cliOverrides.browser.timeout = options.browserTimeout
			}
			if (options.screenshotOutput) {
				cliOverrides.browser = cliOverrides.browser || {}
				cliOverrides.browser.screenshotOutput = options.screenshotOutput
			}
			if (options.userAgent) {
				cliOverrides.browser = cliOverrides.browser || {}
				cliOverrides.browser.userAgent = options.userAgent
			}

			const configManager = new CliConfigManager({
				cwd: options.cwd,
				configPath: options.config,
				verbose: options.verbose,
				cliOverrides,
			})

			// Load configuration
			const config = await configManager.loadConfiguration()

			// Validate CLI adapter options with the loaded configuration
			validateCliAdapterOptions({
				workspaceRoot: options.cwd,
				verbose: options.verbose,
			})

			// Show banner if in interactive mode and not quiet
			if (!options.batch && !options.quiet) {
				showBanner()
			}

			// Log configuration details if verbose
			if (options.verbose) {
				logger.debug("Configuration loaded:")
				logger.debug(`  Working Directory: ${options.cwd}`)
				if (options.config) {
					logger.debug(`  Config File: ${options.config}`)
				}
				if (options.model) {
					logger.debug(`  Model Override: ${options.model}`)
				}
				if (options.mode) {
					logger.debug(`  Mode Override: ${options.mode}`)
				}
				if (options.format) {
					logger.debug(`  Output Format: ${options.format}`)
				}
				if (options.output) {
					logger.debug(`  Output File: ${options.output}`)
				}
			}

			// Pass configuration to processors
			if (options.batch || options.stdin || !options.interactive) {
				// Use NonInteractiveModeService for non-interactive operations
				const { NonInteractiveModeService } = await import("./services/NonInteractiveModeService")
				const nonInteractiveService = new NonInteractiveModeService({
					batch: options.batch,
					stdin: options.stdin,
					yes: options.yes,
					no: options.no,
					timeout: options.timeout,
					parallel: options.parallel,
					continueOnError: options.continueOnError,
					dryRun: options.dryRun,
					quiet: options.quiet,
					verbose: options.verbose,
				})

				try {
					if (options.stdin) {
						logger.info("Executing from stdin...")
						await nonInteractiveService.executeFromStdin()
					} else if (options.batch) {
						logger.debug(`Batch option provided: "${options.batch}"`)
						// Check if batch is a file path or a direct command
						// First check if it exists as a file
						const fileExists = fs.existsSync(options.batch)
						logger.debug(`File exists check for "${options.batch}": ${fileExists}`)

						if (fileExists) {
							logger.debug("Treating as file path, using NonInteractiveModeService")
							await nonInteractiveService.executeFromFile(options.batch)
						} else {
							logger.debug("Treating as direct command, using BatchProcessor")
							// Treat as direct command - use existing BatchProcessor
							const batchProcessor = new BatchProcessor(options, configManager)
							await batchProcessor.run(options.batch)
						}
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)
					logger.error("Non-interactive execution failed:", message)
					process.exit(1)
				}
			} else {
				// Pass MCP options to REPL
				const replOptions = {
					...options,
					mcpConfig: options.mcpConfig,
					mcpAutoConnect: options.mcpAutoConnect,
					mcpTimeout: options.mcpTimeout,
					mcpRetries: options.mcpRetries,
					noMcpAutoConnect: options.noMcpAutoConnect,
				}
				const repl = new CliRepl(replOptions, configManager)
				await repl.start()
			}

			// Stop performance monitoring and report if verbose
			const startupDuration = cliStartupTimer.stop()
			memoryOptimizer.stopMonitoring()

			if (options.verbose) {
				logger.debug(`CLI startup completed in ${Math.round(startupDuration)}ms`)

				const performanceReport = performanceMonitor.generateReport()
				if (performanceReport.summary.totalOperations > 0) {
					logger.debug(
						`Performance: ${performanceReport.summary.totalOperations} operations, avg ${Math.round(performanceReport.summary.averageExecutionTime)}ms`,
					)
				}
			}

			// Ensure process exits automatically for non-interactive modes
			if (options.batch || options.stdin || !options.interactive) {
				if (options.verbose) {
					logger.debug("Non-interactive mode completed, scheduling exit...")
				}
				// Schedule exit to allow any remaining async operations to complete
				setTimeout(async () => {
					try {
						// Dispose global MCP service before exit
						const globalMcpService = GlobalCLIMcpService.getInstance()
						if (globalMcpService.isInitialized()) {
							if (options.verbose) {
								logger.debug("Disposing global MCP service before exit...")
							}
							await globalMcpService.dispose()
							if (options.verbose) {
								logger.debug("Global MCP service disposed")
							}
						}
					} catch (error) {
						if (options.verbose) {
							logger.debug("Error disposing global MCP service:", error)
						}
					}

					if (options.verbose) {
						logger.debug("Exiting process after completion")
					}
					process.exit(0)
				}, 1000) // 1 second delay to allow cleanup
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			logger.error(message)

			// Show help for validation errors
			if (error instanceof Error && error.message.includes("Invalid")) {
				logger.error("Use --help for usage information")
			}

			// Clean up performance monitoring
			try {
				memoryOptimizer.stopMonitoring()
			} catch (cleanupError) {
				// Ignore cleanup errors
			}

			process.exit(1)
		}
	})

// Add subcommands for future extensibility
program
	.command("config")
	.description("Configuration management commands")
	.option("--show", "Show current configuration")
	.option("--validate <path>", "Validate configuration file", validatePath)
	.option("--generate <path>", "Generate default configuration", validatePath)
	.action(async (options) => {
		const configManager = new CliConfigManager({ verbose: program.opts().verbose })

		if (options.show) {
			try {
				const config = await configManager.loadConfiguration()
				if (program.opts().format === "json") {
					console.log(JSON.stringify(config, null, 2))
				} else {
					console.log(chalk.cyan("Current Configuration:"))
					console.log(JSON.stringify(config, null, 2))
				}
			} catch (error) {
				console.error(
					chalk.red("Failed to load configuration:"),
					error instanceof Error ? error.message : String(error),
				)
				process.exit(1)
			}
		} else if (options.validate) {
			try {
				await configManager.validateConfigFile(options.validate)
				console.log(chalk.green(`✓ Configuration file ${options.validate} is valid`))
			} catch (error) {
				console.error(
					chalk.red(`❌ Configuration file ${options.validate} is invalid:`),
					error instanceof Error ? error.message : String(error),
				)
				process.exit(1)
			}
		} else if (options.generate) {
			try {
				await configManager.generateDefaultConfig(options.generate)
				console.log(chalk.green(`✓ Generated default configuration at: ${options.generate}`))
			} catch (error) {
				console.error(
					chalk.red("Failed to generate configuration:"),
					error instanceof Error ? error.message : String(error),
				)
				process.exit(1)
			}
		} else {
			console.log("Use --show, --validate <path>, or --generate <path> with the config command")
			process.exit(1)
		}
	})

program
	.command("help")
	.description("Show detailed help information")
	.argument("[topic]", "Help topic (command, config, tools, search)")
	.argument("[subtopic]", "Subtopic or search query")
	.action((topic, subtopic) => {
		showHelp(topic, subtopic)
	})

// Add version command with more details
program
	.command("version")
	.description("Show version information")
	.option("--json", "Output version information as JSON")
	.action((options) => {
		const version = packageJson.version
		const nodeVersion = process.version
		const platform = process.platform
		const arch = process.arch

		if (options.json || program.opts().format === "json") {
			console.log(
				JSON.stringify(
					{
						version,
						nodeVersion,
						platform,
						arch,
					},
					null,
					2,
				),
			)
		} else {
			console.log(chalk.cyan("Roo CLI Version Information:"))
			console.log(`  Version: ${chalk.white(version)}`)
			console.log(`  Node.js: ${chalk.white(nodeVersion)}`)
			console.log(`  Platform: ${chalk.white(platform)}`)
			console.log(`  Architecture: ${chalk.white(arch)}`)
		}
	})

// Register session commands
try {
	const sessionCommands = new SessionCommands()
	sessionCommands.registerCommands(program)
} catch (error) {
	console.warn(
		chalk.yellow("Warning: Session management not available:"),
		error instanceof Error ? error.message : String(error),
	)
}

// Register MCP commands
try {
	registerMcpCommands(program)
} catch (error) {
	console.warn(
		chalk.yellow("Warning: MCP functionality not available:"),
		error instanceof Error ? error.message : String(error),
	)
}

// Register examples commands
try {
	registerExamplesCommands(program)
} catch (error) {
	console.warn(
		chalk.yellow("Warning: Examples functionality not available:"),
		error instanceof Error ? error.message : String(error),
	)
}

// Enhanced error handling for unknown commands
program.on("command:*", function (operands) {
	console.error(chalk.red(`❌ Unknown command: ${operands[0]}`))
	console.error("See --help for a list of available commands.")
	process.exit(1)
})

// Custom help event to show our enhanced help
program.on("--help", () => {
	console.log()
	console.log("Interactive Mode Examples:")
	console.log("  $ roo-cli                                    # Start interactive mode")
	console.log("  Then simply type your prompts:")
	console.log("    🤖 Roo> Create a React todo app with TypeScript")
	console.log("    🤖 Roo> Debug the memory leak in my auth code")
	console.log("    🤖 Roo> Add unit tests for the Calculator class")
	console.log("    🤖 Roo> Refactor getUserData to use async/await")
	console.log("  Multi-line prompts (use ``` to start/end):")
	console.log("    🤖 Roo> ```")
	console.log("    Create a user registration form with:")
	console.log("    - Email validation")
	console.log("    - Password strength checker")
	console.log("    - Error handling")
	console.log("    ```")
	console.log("  Built-in commands:")
	console.log("    🤖 Roo> help      # Show help")
	console.log("    🤖 Roo> exit      # Exit CLI")
	console.log("    🤖 Roo> clear     # Clear screen")
	console.log("    🤖 Roo> status    # Show task status")
	console.log("    🤖 Roo> abort     # Abort current task")
	console.log()
	console.log("Batch Mode Examples:")
	console.log('  $ roo-cli --batch "Create a hello function" # Run single task')
	console.log('  $ echo "Fix bug in user.js" | roo-cli --stdin # Pipe input')
	console.log("  $ roo-cli --batch commands.json             # Run batch file")
	console.log("  $ roo-cli --batch script.yaml --parallel    # Run in parallel")
	console.log("  $ roo-cli --batch tasks.txt --dry-run       # Preview execution")
	console.log()
	console.log("Configuration Examples:")
	console.log("  $ roo-cli config --show                     # Show current config")
	console.log("  $ roo-cli config --generate ~/.roo-cli/config.json")
	console.log("  $ roo-cli --cwd /path/to/project            # Start in specific directory")
	console.log("  $ roo-cli --model gpt-4                     # Use specific model")
	console.log("  $ roo-cli --mode debug                      # Start in debug mode")
	console.log("  $ roo-cli --format json                     # Output as JSON")
	console.log("  $ roo-cli --format yaml --output result.yml # Save as YAML file")
	console.log("  $ ROO_OUTPUT_FORMAT=json roo-cli            # Use environment variable")
	console.log()
	console.log("Advanced Examples:")
	console.log("  $ roo-cli --no-headless                     # Run browser in headed mode")
	console.log("  $ roo-cli --browser-viewport 1280x720      # Set browser viewport")
	console.log("  $ roo-cli --screenshot-output ./screenshots # Set screenshot directory")
	console.log("  $ roo-cli session list                      # List all sessions")
	console.log("  $ roo-cli session save 'My Project'         # Save current session")
	console.log("  $ roo-cli session load <session-id>         # Load a session")
	console.log("  $ roo-cli session cleanup --max-age 30      # Cleanup old sessions")
	console.log("  $ roo-cli mcp list                          # List MCP servers")
	console.log("  $ roo-cli mcp connect github-server         # Connect to an MCP server")
	console.log("  $ roo-cli mcp tools                         # List available MCP tools")
	console.log("  $ roo-cli mcp execute github-server get_repo owner=user repo=project")
	console.log("  $ roo-cli mcp config init                   # Initialize MCP configuration")
	console.log("  $ roo-cli examples                          # Browse usage examples")
	console.log("  $ roo-cli examples show basic               # Show basic examples")
	console.log("  $ roo-cli examples search 'web dev'         # Search examples")
	console.log("  $ roo-cli examples run hello-world          # Run specific example")
	console.log()
	console.log("Output Format Options:")
	console.log("  --format json         Structured JSON output")
	console.log("  --format plain        Human-readable plain text (default)")
	console.log("  --format yaml         YAML configuration format")
	console.log("  --format csv          Comma-separated values (tabular data)")
	console.log("  --format markdown     Markdown documentation format")
	console.log("  --output <file>       Write output to file (format auto-detected)")
	console.log("  ROO_OUTPUT_FORMAT     Environment variable for default format")
	console.log()
	console.log("Non-Interactive Mode Options:")
	console.log("  --batch <file|task>   Run batch file or single task")
	console.log("  --stdin               Read commands from stdin")
	console.log("  --yes                 Assume yes for all prompts")
	console.log("  --no                  Assume no for all prompts")
	console.log("  --timeout <ms>        Global timeout for operations")
	console.log("  --parallel            Execute batch commands in parallel")
	console.log("  --continue-on-error   Continue execution on command failure")
	console.log("  --dry-run             Show what would be executed")
	console.log("  --quiet               Suppress non-essential output")
	console.log()
	console.log("Browser Options:")
	console.log("  --headless/--no-headless     Run browser in headless or headed mode")
	console.log("  --browser-viewport <size>    Set browser viewport (e.g., 1920x1080)")
	console.log("  --browser-timeout <ms>       Set browser timeout in milliseconds")
	console.log("  --screenshot-output <dir>    Directory for saving screenshots")
	console.log("  --user-agent <agent>         Custom user agent string")
	console.log()
	console.log("MCP (Model Context Protocol) Options:")
	console.log("  --mcp-config <path>          Path to MCP configuration file")
	console.log("  --mcp-server <id>            MCP server IDs to connect to (repeatable)")
	console.log("  --mcp-timeout <ms>           Timeout for MCP operations")
	console.log("  --mcp-retries <count>        Number of retry attempts for MCP operations")
	console.log("  --mcp-auto-connect           Automatically connect to enabled servers")
	console.log("  --mcp-log-level <level>      MCP logging level (error, warn, info, debug)")
	console.log()
	console.log("For more information, visit: https://docs.roocode.com/cli")
})

// Parse command line arguments
program.parse()

export type { CliOptions }
