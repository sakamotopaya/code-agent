#!/usr/bin/env node

import { Command } from "commander"
import chalk from "chalk"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const program = new Command()

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

function generateConfig(configPath: string): void {
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
	console.log(chalk.cyan("Configuration options:"))
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
	console.log(chalk.cyan("Environment variables:"))
	console.log("  ROO_API_KEY: Set your API key")
	console.log("  ROO_API_PROVIDER: Set your preferred provider")
	console.log("  ROO_MODEL: Set your preferred model")
	console.log("  ROO_AUTO_APPROVAL: Enable auto-approval (true/false)")
	console.log()
}

function validateConfig(configPath: string): void {
	try {
		if (!fs.existsSync(configPath)) {
			console.error(chalk.red(`Configuration file not found: ${configPath}`))
			process.exit(1)
		}

		const content = fs.readFileSync(configPath, "utf8")
		const config = JSON.parse(content)

		console.log(chalk.cyan("Validating configuration..."))

		// Basic validation
		const requiredFields = ["apiProvider", "apiModelId"]
		const booleanFields = [
			"autoApprovalEnabled",
			"alwaysAllowReadOnly",
			"alwaysAllowWrite",
			"alwaysAllowBrowser",
			"alwaysAllowExecute",
			"alwaysAllowMcp",
		]

		let isValid = true

		for (const field of requiredFields) {
			if (!config[field]) {
				console.error(chalk.red(`✗ Missing required field: ${field}`))
				isValid = false
			}
		}

		for (const field of booleanFields) {
			if (config[field] !== undefined && typeof config[field] !== "boolean") {
				console.error(chalk.red(`✗ Field ${field} must be a boolean`))
				isValid = false
			}
		}

		if (
			config.requestDelaySeconds !== undefined &&
			(typeof config.requestDelaySeconds !== "number" || config.requestDelaySeconds < 0)
		) {
			console.error(chalk.red("✗ requestDelaySeconds must be a non-negative number"))
			isValid = false
		}

		if (
			config.allowedMaxRequests !== undefined &&
			(typeof config.allowedMaxRequests !== "number" || config.allowedMaxRequests < 1)
		) {
			console.error(chalk.red("✗ allowedMaxRequests must be a positive number"))
			isValid = false
		}

		if (isValid) {
			console.log(chalk.green("✓ Configuration is valid"))
		} else {
			console.error(chalk.red("✗ Configuration validation failed"))
			process.exit(1)
		}
	} catch (error) {
		console.error(
			chalk.red("✗ Failed to validate configuration:"),
			error instanceof Error ? error.message : String(error),
		)
		process.exit(1)
	}
}

function showConfig(configPath: string): void {
	try {
		if (!fs.existsSync(configPath)) {
			console.log(chalk.yellow(`Configuration file not found: ${configPath}`))
			console.log(chalk.gray("Run with --generate to create a default configuration."))
			return
		}

		const content = fs.readFileSync(configPath, "utf8")
		const config = JSON.parse(content)

		console.log(chalk.cyan.bold("Configuration:"))
		console.log(chalk.gray("=".repeat(50)))

		Object.entries(config).forEach(([key, value]) => {
			if (key === "apiKey" && value) {
				console.log(`  ${key}: ${chalk.green("[SET]")}`)
			} else {
				console.log(`  ${key}: ${chalk.white(String(value))}`)
			}
		})

		console.log()
		console.log(chalk.gray(`Configuration file: ${configPath}`))
	} catch (error) {
		console.error(
			chalk.red("Failed to read configuration:"),
			error instanceof Error ? error.message : String(error),
		)
		process.exit(1)
	}
}

// CLI setup
program.name("roo-config").description("Roo CLI Configuration Manager").version("1.0.0")

program
	.command("generate")
	.description("Generate default configuration file")
	.argument("[path]", "Configuration file path", path.join(os.homedir(), ".roo-cli", "config.json"))
	.action((configPath: string) => {
		generateConfig(configPath)
	})

program
	.command("validate")
	.description("Validate configuration file")
	.argument("[path]", "Configuration file path", path.join(os.homedir(), ".roo-cli", "config.json"))
	.action((configPath: string) => {
		validateConfig(configPath)
	})

program
	.command("show")
	.description("Show current configuration")
	.argument("[path]", "Configuration file path", path.join(os.homedir(), ".roo-cli", "config.json"))
	.action((configPath: string) => {
		showConfig(configPath)
	})

// Handle no command - show help
if (process.argv.length <= 2) {
	program.help()
}

// Parse command line arguments
program.parse()
