import { Command } from "commander"
import { CliRepl } from "./repl"
import { BatchProcessor } from "./commands/batch"
import { showHelp } from "./commands/help"
import { SessionCommands } from "./commands/session-commands"
import { registerMcpCommands } from "./commands/mcp-commands"
import { showBanner } from "./utils/banner"
import { validateCliAdapterOptions } from "../core/adapters/cli"
import { CliConfigManager } from "./config/CliConfigManager"
import { validateBrowserViewport, validateTimeout } from "./utils/browser-config"
import { isValidFormat, getAvailableFormatsWithDescriptions } from "./utils/format-detection"
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
	mcpLogLevel?: string
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
	.option("--headless", "Run browser in headless mode (default: true)", true)
	.option("--no-headless", "Run browser in headed mode")
	.option("--browser-viewport <size>", "Browser viewport size (e.g., 1920x1080)", validateBrowserViewport)
	.option("--browser-timeout <ms>", "Browser operation timeout in milliseconds", validateTimeout)
	.option("--screenshot-output <dir>", "Directory for screenshot output", validatePath)
	.option("--user-agent <agent>", "Custom user agent string for browser")
	.option("--mcp-config <path>", "Path to MCP configuration file", validatePath)
	.option("--mcp-server <id>", "MCP server IDs to connect to (can be repeated)", collectArray, [])
	.option("--mcp-timeout <ms>", "Timeout for MCP operations in milliseconds", validateTimeout)
	.option("--mcp-retries <count>", "Number of retry attempts for MCP operations", parseInt)
	.option("--mcp-auto-connect", "Automatically connect to enabled MCP servers", true)
	.option("--mcp-log-level <level>", "MCP logging level (error, warn, info, debug)", validateMcpLogLevel)
	.action(async (options: CliOptions) => {
		try {
			// Handle config generation
			if (options.generateConfig) {
				const configManager = new CliConfigManager({ verbose: options.verbose })
				await configManager.generateDefaultConfig(options.generateConfig)
				console.log(chalk.green(`✓ Generated default configuration at: ${options.generateConfig}`))
				console.log(chalk.gray("Edit the file to customize your settings."))
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

			// Show banner if in interactive mode
			if (!options.batch) {
				showBanner()
			}

			// Log configuration details if verbose
			if (options.verbose) {
				console.log(chalk.gray("Configuration loaded:"))
				console.log(chalk.gray(`  Working Directory: ${options.cwd}`))
				if (options.config) {
					console.log(chalk.gray(`  Config File: ${options.config}`))
				}
				if (options.model) {
					console.log(chalk.gray(`  Model Override: ${options.model}`))
				}
				if (options.mode) {
					console.log(chalk.gray(`  Mode Override: ${options.mode}`))
				}
				if (options.format) {
					console.log(chalk.gray(`  Output Format: ${options.format}`))
				}
				if (options.output) {
					console.log(chalk.gray(`  Output File: ${options.output}`))
				}
				console.log()
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
						await nonInteractiveService.executeFromStdin()
					} else if (options.batch) {
						// Check if batch is a file path or a direct command
						if (
							options.batch.includes(".") ||
							options.batch.startsWith("/") ||
							options.batch.startsWith("./")
						) {
							await nonInteractiveService.executeFromFile(options.batch)
						} else {
							// Treat as direct command - use existing BatchProcessor
							const batchProcessor = new BatchProcessor(options, configManager)
							await batchProcessor.run(options.batch)
						}
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)
					if (options.color) {
						console.error(chalk.red("❌ Non-interactive execution failed:"), message)
					} else {
						console.error("Non-interactive execution failed:", message)
					}
					process.exit(1)
				}
			} else {
				const repl = new CliRepl(options, configManager)
				await repl.start()
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (options.color) {
				console.error(chalk.red("❌ Error:"), message)
			} else {
				console.error("Error:", message)
			}

			// Show help for validation errors
			if (error instanceof Error && error.message.includes("Invalid")) {
				console.error()
				console.error("Use --help for usage information")
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
	.action(() => {
		showHelp()
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

// Enhanced error handling for unknown commands
program.on("command:*", function (operands) {
	console.error(chalk.red(`❌ Unknown command: ${operands[0]}`))
	console.error("See --help for a list of available commands.")
	process.exit(1)
})

// Custom help event to show our enhanced help
program.on("--help", () => {
	console.log()
	console.log("Examples:")
	console.log("  $ roo-cli                                    # Start interactive mode")
	console.log("  $ roo-cli --cwd /path/to/project            # Start in specific directory")
	console.log('  $ roo-cli --batch "Create a hello function" # Run single task')
	console.log("  $ roo-cli --batch commands.json             # Run batch file")
	console.log("  $ roo-cli --stdin --yes                     # Read from stdin, auto-confirm")
	console.log("  $ echo 'npm test' | roo-cli --stdin         # Pipe commands")
	console.log("  $ roo-cli --batch script.yaml --parallel    # Run batch in parallel")
	console.log("  $ roo-cli --batch tasks.txt --dry-run       # Preview batch execution")
	console.log("  $ roo-cli --model gpt-4                     # Use specific model")
	console.log("  $ roo-cli --mode debug                      # Start in debug mode")
	console.log("  $ roo-cli --format json                     # Output as JSON")
	console.log("  $ roo-cli --format yaml --output result.yml # Save as YAML file")
	console.log("  $ ROO_OUTPUT_FORMAT=json roo-cli            # Use environment variable")
	console.log("  $ roo-cli --no-headless                     # Run browser in headed mode")
	console.log("  $ roo-cli --browser-viewport 1280x720      # Set browser viewport")
	console.log("  $ roo-cli --screenshot-output ./screenshots # Set screenshot directory")
	console.log("  $ roo-cli config --show                     # Show current configuration")
	console.log("  $ roo-cli config --generate ~/.roo-cli/config.json")
	console.log("  $ roo-cli session list                      # List all sessions")
	console.log("  $ roo-cli session save 'My Project'         # Save current session")
	console.log("  $ roo-cli session load <session-id>         # Load a session")
	console.log("  $ roo-cli session cleanup --max-age 30      # Cleanup old sessions")
	console.log("  $ roo-cli mcp list                          # List MCP servers")
	console.log("  $ roo-cli mcp connect github-server         # Connect to an MCP server")
	console.log("  $ roo-cli mcp tools                         # List available MCP tools")
	console.log("  $ roo-cli mcp execute github-server get_repo owner=user repo=project")
	console.log("  $ roo-cli mcp config init                   # Initialize MCP configuration")
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
