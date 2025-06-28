#!/usr/bin/env node

import { Command } from "commander"
import chalk from "chalk"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { parse as parseYaml } from "yaml"

const program = new Command()

interface CliOptions {
	cwd: string
	config?: string
	batch?: string
	interactive: boolean
	color: boolean
	verbose: boolean
	generateConfig?: string
}

interface CliConfig {
	apiProvider: string
	apiKey?: string
	apiModelId: string
	autoApprovalEnabled: boolean
	alwaysAllowReadOnly: boolean
	alwaysAllowWrite: boolean
	alwaysAllowBrowser: boolean
	alwaysAllowExecute: boolean
	alwaysAllowMcp: boolean
	requestDelaySeconds: number
	allowedMaxRequests?: number
	verbose?: boolean
}

function getDefaultConfig(): CliConfig {
	return {
		apiProvider: "anthropic",
		apiModelId: "claude-3-5-sonnet-20241022",
		autoApprovalEnabled: false,
		alwaysAllowReadOnly: false,
		alwaysAllowWrite: false,
		alwaysAllowBrowser: false,
		alwaysAllowExecute: false,
		alwaysAllowMcp: false,
		requestDelaySeconds: 0,
		allowedMaxRequests: undefined,
		verbose: false,
	}
}

function loadConfiguration(options: CliOptions): CliConfig {
	let config = getDefaultConfig()

	// 1. Load from config file if specified or found
	const configPaths = []

	if (options.config) {
		configPaths.push(options.config)
	}

	// Look for project-level config
	configPaths.push(
		path.join(options.cwd, ".roo-cli.json"),
		path.join(options.cwd, ".roo-cli.yaml"),
		path.join(options.cwd, ".roo-cli.yml"),
	)

	// Look for user-level config
	const userConfigDir = path.join(os.homedir(), ".roo-cli")
	configPaths.push(
		path.join(userConfigDir, "config.json"),
		path.join(userConfigDir, "config.yaml"),
		path.join(userConfigDir, "config.yml"),
	)

	for (const configPath of configPaths) {
		if (fs.existsSync(configPath)) {
			try {
				const content = fs.readFileSync(configPath, "utf8")
				let fileConfig: any

				if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
					fileConfig = parseYaml(content)
				} else {
					fileConfig = JSON.parse(content)
				}

				config = { ...config, ...fileConfig }

				if (options.verbose) {
					console.log(chalk.gray(`Loaded configuration from: ${configPath}`))
				}
				break
			} catch (error) {
				console.error(
					chalk.red(`Failed to load config from ${configPath}:`),
					error instanceof Error ? error.message : String(error),
				)
			}
		}
	}

	// 2. Override with environment variables
	if (process.env.ROO_API_KEY) config.apiKey = process.env.ROO_API_KEY
	if (process.env.ROO_API_PROVIDER) config.apiProvider = process.env.ROO_API_PROVIDER
	if (process.env.ROO_MODEL) config.apiModelId = process.env.ROO_MODEL
	if (process.env.ROO_AUTO_APPROVAL === "true") config.autoApprovalEnabled = true
	if (process.env.ROO_AUTO_APPROVAL === "false") config.autoApprovalEnabled = false

	// 3. Override with CLI options
	if (options.verbose !== undefined) config.verbose = options.verbose

	return config
}

function generateConfig(configPath: string, verbose: boolean): void {
	const config = getDefaultConfig()
	const content = JSON.stringify(config, null, 2)

	// Ensure directory exists
	const dir = path.dirname(configPath)
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}

	fs.writeFileSync(configPath, content, "utf8")

	console.log(chalk.green(`✓ Generated default configuration at: ${configPath}`))
	console.log(chalk.gray("Edit the file to customize your settings."))
	console.log()
	console.log(chalk.cyan("Next steps:"))
	console.log("  1. Set your API key:")
	console.log(chalk.gray(`     export ROO_API_KEY=your_api_key_here`))
	console.log("  2. Or edit the config file and add your apiKey")
	console.log("  3. Run: roo-cli")
}

function showBanner(): void {
	console.log(chalk.cyan.bold("🤖 Roo Code Agent CLI"))
	console.log(chalk.gray("Interactive coding assistant for the command line"))
	console.log()
}

function showCurrentConfig(config: CliConfig): void {
	console.log(chalk.cyan.bold("Current Configuration:"))
	console.log(chalk.gray("=".repeat(50)))

	console.log(`  API Provider: ${chalk.white(config.apiProvider)}`)
	console.log(`  Model: ${chalk.white(config.apiModelId)}`)
	console.log(`  API Key: ${config.apiKey ? chalk.green("Set") : chalk.red("Not set")}`)
	console.log(`  Auto Approval: ${config.autoApprovalEnabled ? chalk.green("Enabled") : chalk.gray("Disabled")}`)
	console.log(`  Always Allow Read: ${config.alwaysAllowReadOnly ? chalk.green("Yes") : chalk.gray("No")}`)
	console.log(`  Always Allow Write: ${config.alwaysAllowWrite ? chalk.green("Yes") : chalk.gray("No")}`)
	console.log(`  Always Allow Browser: ${config.alwaysAllowBrowser ? chalk.green("Yes") : chalk.gray("No")}`)
	console.log(`  Always Allow Execute: ${config.alwaysAllowExecute ? chalk.green("Yes") : chalk.gray("No")}`)
	console.log(`  Always Allow MCP: ${config.alwaysAllowMcp ? chalk.green("Yes") : chalk.gray("No")}`)
	console.log(`  Request Delay: ${chalk.white(config.requestDelaySeconds + "s")}`)
	console.log(
		`  Max Requests: ${config.allowedMaxRequests ? chalk.white(String(config.allowedMaxRequests)) : chalk.gray("Unlimited")}`,
	)
	console.log()
}

function showHelp(): void {
	console.log()
	console.log(chalk.cyan.bold("Roo CLI Configuration Management"))
	console.log()
	console.log(chalk.white("Usage:"))
	console.log("  roo-cli [options]                     Start interactive mode")
	console.log('  roo-cli --batch "task description"    Run in batch mode')
	console.log("  roo-cli --generate-config <path>     Generate default config")
	console.log("  roo-cli config                       Show current configuration")
	console.log()
	console.log(chalk.white("Options:"))
	console.log("  -c, --cwd <path>              Working directory")
	console.log("  --config <path>               Configuration file path")
	console.log("  -b, --batch <task>            Run in batch mode")
	console.log("  -i, --interactive             Run in interactive mode (default)")
	console.log("  --no-color                    Disable colored output")
	console.log("  -v, --verbose                 Enable verbose logging")
	console.log("  --generate-config <path>      Generate default configuration")
	console.log("  -h, --help                    Show this help")
	console.log()
	console.log(chalk.white("Configuration:"))
	console.log("  Environment Variables:")
	console.log("    ROO_API_KEY         Set your API key")
	console.log("    ROO_API_PROVIDER    Set your preferred provider")
	console.log("    ROO_MODEL           Set your preferred model")
	console.log("    ROO_AUTO_APPROVAL   Enable auto-approval (true/false)")
	console.log()
	console.log("  Config Files (in order of priority):")
	console.log("    .roo-cli.json       Project-level configuration")
	console.log("    $HOME/.roo-cli/config.json  User-level configuration")
	console.log()
	console.log(chalk.white("Examples:"))
	console.log("  roo-cli --generate-config $HOME/.roo-cli/config.json")
	console.log("  export ROO_API_KEY=your_key && roo-cli")
	console.log('  roo-cli --batch "Create a hello world function"')
	console.log("  roo-cli --config ./my-config.json")
	console.log()
}

// CLI setup
program
	.name("roo-cli")
	.description("Roo Code Agent CLI - Interactive coding assistant for the command line")
	.version("1.0.0")
	.option("-c, --cwd <path>", "Working directory", process.cwd())
	.option("--config <path>", "Configuration file path")
	.option("-b, --batch <task>", "Run in batch mode with specified task")
	.option("-i, --interactive", "Run in interactive mode (default)", true)
	.option("--no-color", "Disable colored output")
	.option("-v, --verbose", "Enable verbose logging", false)
	.option("--generate-config <path>", "Generate default configuration file at specified path")
	.action(async (options: CliOptions) => {
		try {
			// Handle config generation
			if (options.generateConfig) {
				generateConfig(options.generateConfig, options.verbose)
				return
			}

			// Load configuration
			const config = loadConfiguration(options)

			// Show banner if in interactive mode
			if (!options.batch) {
				showBanner()
			}

			// Validate API key
			if (!config.apiKey) {
				console.log(chalk.yellow("⚠️ API configuration required."))
				console.log(chalk.gray("Set your API key using one of these methods:"))
				console.log(chalk.gray("  1. Environment variable: export ROO_API_KEY=your_api_key_here"))
				console.log(chalk.gray("  2. Config file: roo-cli --generate-config $HOME/.roo-cli/config.json"))
				console.log(chalk.gray("  3. Project config: Create .roo-cli.json in your project"))
				console.log()
				process.exit(1)
			}

			if (options.verbose) {
				console.log(chalk.gray(`Using ${config.apiProvider} with model ${config.apiModelId}`))
			}

			// For now, just show the configuration - full CLI implementation would go here
			if (options.batch) {
				console.log(chalk.blue(`Batch mode: ${options.batch}`))
				console.log(chalk.yellow("Full CLI implementation coming soon..."))
			} else {
				console.log(chalk.yellow("Interactive mode coming soon..."))
				console.log(chalk.gray("For now, showing current configuration:"))
				console.log()
				showCurrentConfig(config)
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (options.color) {
				console.error(chalk.red("Error:"), message)
			} else {
				console.error("Error:", message)
			}
			process.exit(1)
		}
	})

// Handle config command specifically
program
	.command("config")
	.description("Show current configuration")
	.option("-c, --cwd <path>", "Working directory", process.cwd())
	.option("--config <path>", "Configuration file path")
	.option("-v, --verbose", "Enable verbose logging", false)
	.action((cmdOptions) => {
		const options: CliOptions = {
			cwd: cmdOptions.cwd,
			config: cmdOptions.config,
			interactive: true,
			color: true,
			verbose: cmdOptions.verbose,
		}

		const config = loadConfiguration(options)
		showCurrentConfig(config)
	})

// Handle help command specifically
program
	.command("help")
	.description("Show detailed help information")
	.action(() => {
		showHelp()
	})

// Parse command line arguments
program.parse()

export type { CliOptions, CliConfig }
