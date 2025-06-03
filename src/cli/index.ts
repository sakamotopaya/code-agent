import { Command } from "commander"
import { CliRepl } from "./repl"
import { BatchProcessor } from "./commands/batch"
import { showHelp } from "./commands/help"
import { showBanner } from "./utils/banner"
import { validateCliAdapterOptions } from "../core/adapters/cli"
import { CliConfigManager } from "./config/CliConfigManager"
import chalk from "chalk"
import * as fs from "fs"

const program = new Command()

interface CliOptions {
	cwd: string
	config?: string
	model?: string
	mode?: string
	output?: "text" | "json"
	verbose: boolean
	color: boolean
	batch?: string
	interactive: boolean
	generateConfig?: string
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

function validateOutput(value: string): "text" | "json" {
	if (value !== "text" && value !== "json") {
		throw new Error(`Invalid output format: ${value}. Valid formats are: text, json`)
	}
	return value
}

function validatePath(value: string): string {
	// Basic path validation - check if it's a reasonable path
	if (!value || value.trim().length === 0) {
		throw new Error("Path cannot be empty")
	}
	return value
}

program
	.name("roo-cli")
	.description("Roo Code Agent CLI - Interactive coding assistant for the command line")
	.version("1.0.0")
	.option("-c, --cwd <path>", "Working directory", validatePath, process.cwd())
	.option("--config <path>", "Configuration file path", validatePath)
	.option("-m, --model <name>", "AI model to use (overrides config)")
	.option(
		"--mode <mode>",
		"Agent mode (code, debug, architect, ask, test, design-engineer, release-engineer, translate, product-owner, orchestrator)",
		validateMode,
	)
	.option("-o, --output <format>", "Output format (text, json)", validateOutput, "text")
	.option("-v, --verbose", "Enable verbose logging", false)
	.option("--no-color", "Disable colored output")
	.option("-b, --batch <task>", "Run in non-interactive mode with specified task")
	.option("-i, --interactive", "Run in interactive mode (default)", true)
	.option("--generate-config <path>", "Generate default configuration file at specified path", validatePath)
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
				console.log(chalk.gray(`  Output Format: ${options.output}`))
				console.log()
			}

			// Pass configuration to processors
			if (options.batch) {
				const batchProcessor = new BatchProcessor(options, configManager)
				await batchProcessor.run(options.batch)
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
				if (program.opts().output === "json") {
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
		const version = "1.0.0" // TODO: Read from package.json
		const nodeVersion = process.version
		const platform = process.platform
		const arch = process.arch

		if (options.json || program.opts().output === "json") {
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
	console.log("  $ roo-cli --model gpt-4                     # Use specific model")
	console.log("  $ roo-cli --mode debug                      # Start in debug mode")
	console.log("  $ roo-cli config --show                     # Show current configuration")
	console.log("  $ roo-cli config --generate ~/.roo-cli/config.json")
	console.log()
	console.log("For more information, visit: https://docs.roocode.com/cli")
})

// Parse command line arguments
program.parse()

export type { CliOptions }
