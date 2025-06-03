#!/usr/bin/env node

import { Command } from "commander"
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
					console.log(`✓ Loaded configuration from: ${configPath}`)
				}
				break
			} catch (error) {
				console.error(
					`✗ Failed to load config from ${configPath}:`,
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

	console.log(`✓ Generated default configuration at: ${configPath}`)
	console.log("Edit the file to customize your settings.")
	console.log()
	console.log("Configuration options:")
	console.log("  apiProvider: Set your AI provider (anthropic, openai, etc.)")
	console.log("  apiKey: Set your API key (or use ROO_API_KEY environment variable)")
	console.log("  apiModelId: Set your preferred model")
	console.log("  autoApprovalEnabled: Enable automatic approval of actions")
	console.log("  alwaysAllowReadOnly: Allow read-only operations without prompting")
	console.log("  alwaysAllowWrite: Allow write operations without prompting")
	console.log("  alwaysAllowBrowser: Allow browser operations without prompting")
	console.log("  alwaysAllowExecute: Allow command execution without prompting")
	console.log("  alwaysAllowMcp: Allow MCP operations without prompting")
	console.log()
	console.log("Environment variables:")
	console.log("  ROO_API_KEY: Set your API key")
	console.log("  ROO_API_PROVIDER: Set your preferred provider")
	console.log("  ROO_MODEL: Set your preferred model")
	console.log("  ROO_AUTO_APPROVAL: Enable auto-approval (true/false)")
	console.log()
}

function showBanner(): void {
	console.log("🤖 Roo Code Agent CLI")
	console.log("Interactive coding assistant for the command line")
	console.log()
}

function showCurrentConfig(config: CliConfig): void {
	console.log("Current Configuration:")
	console.log("=".repeat(50))

	console.log(`  API Provider: ${config.apiProvider}`)
	console.log(`  Model: ${config.apiModelId}`)
	console.log(`  API Key: ${config.apiKey ? "[SET]" : "[NOT SET]"}`)
	console.log(`  Auto Approval: ${config.autoApprovalEnabled ? "Enabled" : "Disabled"}`)
	console.log(`  Always Allow Read: ${config.alwaysAllowReadOnly ? "Yes" : "No"}`)
	console.log(`  Always Allow Write: ${config.alwaysAllowWrite ? "Yes" : "No"}`)
	console.log(`  Always Allow Browser: ${config.alwaysAllowBrowser ? "Yes" : "No"}`)
	console.log(`  Always Allow Execute: ${config.alwaysAllowExecute ? "Yes" : "No"}`)
	console.log(`  Always Allow MCP: ${config.alwaysAllowMcp ? "Yes" : "No"}`)
	console.log(`  Request Delay: ${config.requestDelaySeconds}s`)
	console.log(`  Max Requests: ${config.allowedMaxRequests || "Unlimited"}`)
	console.log()
}

function showHelp(): void {
	console.log()
	console.log("Roo CLI Configuration Management")
	console.log()
	console.log("Usage:")
	console.log("  roo-cli [options]                     Start interactive mode")
	console.log('  roo-cli --batch "task description"    Run in batch mode')
	console.log("  roo-cli --generate-config <path>     Generate default config")
	console.log("  roo-cli config                       Show current configuration")
	console.log()
	console.log("Options:")
	console.log("  -c, --cwd <path>              Working directory")
	console.log("  --config <path>               Configuration file path")
	console.log("  -b, --batch <task>            Run in batch mode")
	console.log("  -i, --interactive             Run in interactive mode (default)")
	console.log("  --no-color                    Disable colored output")
	console.log("  -v, --verbose                 Enable verbose logging")
	console.log("  --generate-config <path>      Generate default configuration")
	console.log("  -h, --help                    Show this help")
	console.log()
	console.log("Configuration:")
	console.log("  Environment Variables:")
	console.log("    ROO_API_KEY         Set your API key")
	console.log("    ROO_API_PROVIDER    Set your preferred provider")
	console.log("    ROO_MODEL           Set your preferred model")
	console.log("    ROO_AUTO_APPROVAL   Enable auto-approval (true/false)")
	console.log()
	console.log("  Config Files (in order of priority):")
	console.log("    .roo-cli.json       Project-level configuration")
	console.log("    ~/.roo-cli/config.json  User-level configuration")
	console.log()
	console.log("Examples:")
	console.log("  roo-cli --generate-config ~/.roo-cli/config.json")
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
				console.log("⚠️ API configuration required.")
				console.log("Set your API key using one of these methods:")
				console.log("  1. Environment variable: export ROO_API_KEY=your_api_key_here")
				console.log("  2. Config file: roo-cli --generate-config ~/.roo-cli/config.json")
				console.log("  3. Project config: Create .roo-cli.json in your project")
				console.log()
				process.exit(1)
			}

			if (options.verbose) {
				console.log(`Using ${config.apiProvider} with model ${config.apiModelId}`)
			}

			// For now, just show the configuration - full CLI implementation would go here
			if (options.batch) {
				console.log(`Batch mode: ${options.batch}`)
				console.log("Configuration loaded successfully!")
				console.log("Full CLI implementation is available via the main roo-cli entry point.")
			} else {
				console.log("Configuration loaded successfully!")
				console.log("Full interactive mode is available via the main roo-cli entry point.")
				console.log()
				showCurrentConfig(config)
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.error("Error:", message)
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
