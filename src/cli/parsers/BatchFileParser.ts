import {
	BatchConfig,
	BatchCommand,
	BatchSettings,
	NonInteractiveDefaults,
	ErrorHandlingStrategy,
	OutputFormat,
	JSONBatchFile,
	YAMLBatchFile,
} from "../types/batch-types"
import { JSONBatchParser } from "./JSONBatchParser"
import { YAMLBatchParser } from "./YAMLBatchParser"
import { TextBatchParser } from "./TextBatchParser"
import * as fs from "fs/promises"
import * as path from "path"

export class BatchFileParser {
	private jsonParser: JSONBatchParser
	private yamlParser: YAMLBatchParser
	private textParser: TextBatchParser

	constructor() {
		this.jsonParser = new JSONBatchParser()
		this.yamlParser = new YAMLBatchParser()
		this.textParser = new TextBatchParser()
	}

	async parseFile(filePath: string): Promise<BatchConfig> {
		const content = await fs.readFile(filePath, "utf-8")
		const extension = path.extname(filePath).toLowerCase()

		switch (extension) {
			case ".json":
				return this.parseJSON(JSON.parse(content))
			case ".yaml":
			case ".yml":
				return this.parseYAML(content)
			case ".txt":
			default:
				return this.parseText(content)
		}
	}

	parseJSON(data: any): BatchConfig {
		return this.jsonParser.parse(data)
	}

	parseYAML(content: string): BatchConfig {
		return this.yamlParser.parse(content)
	}

	parseText(content: string): BatchConfig {
		return this.textParser.parse(content)
	}

	async validateBatchFile(filePath: string): Promise<{
		valid: boolean
		errors: string[]
		warnings: string[]
	}> {
		try {
			const config = await this.parseFile(filePath)
			return this.validateBatchConfig(config)
		} catch (error) {
			return {
				valid: false,
				errors: [error instanceof Error ? error.message : String(error)],
				warnings: [],
			}
		}
	}

	private validateBatchConfig(config: BatchConfig): {
		valid: boolean
		errors: string[]
		warnings: string[]
	} {
		const errors: string[] = []
		const warnings: string[] = []

		// Validate commands
		if (!config.commands || config.commands.length === 0) {
			errors.push("At least one command is required")
		}

		config.commands.forEach((cmd, index) => {
			if (!cmd.id) {
				errors.push(`Command at index ${index} is missing required 'id' field`)
			}
			if (!cmd.command) {
				errors.push(`Command '${cmd.id}' is missing required 'command' field`)
			}

			// Validate dependencies
			if (cmd.dependsOn) {
				const invalidDeps = cmd.dependsOn.filter((dep) => !config.commands.some((c) => c.id === dep))
				if (invalidDeps.length > 0) {
					errors.push(`Command '${cmd.id}' has invalid dependencies: ${invalidDeps.join(", ")}`)
				}

				// Check for circular dependencies
				if (this.hasCircularDependency(config.commands, cmd.id)) {
					errors.push(`Circular dependency detected for command '${cmd.id}'`)
				}
			}

			// Validate timeout
			if (cmd.timeout && cmd.timeout <= 0) {
				warnings.push(`Command '${cmd.id}' has invalid timeout value: ${cmd.timeout}`)
			}

			// Validate retries
			if (cmd.retries && cmd.retries < 0) {
				warnings.push(`Command '${cmd.id}' has invalid retries value: ${cmd.retries}`)
			}
		})

		// Validate settings
		if (config.settings.maxConcurrency && config.settings.maxConcurrency <= 0) {
			errors.push("maxConcurrency must be greater than 0")
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		}
	}

	private hasCircularDependency(
		commands: BatchCommand[],
		commandId: string,
		visited: Set<string> = new Set(),
	): boolean {
		if (visited.has(commandId)) {
			return true
		}

		const command = commands.find((c) => c.id === commandId)
		if (!command || !command.dependsOn) {
			return false
		}

		visited.add(commandId)

		for (const depId of command.dependsOn) {
			if (this.hasCircularDependency(commands, depId, new Set(visited))) {
				return true
			}
		}

		return false
	}

	getDefaultBatchConfig(): BatchConfig {
		return {
			commands: [],
			settings: {
				parallel: false,
				maxConcurrency: 1,
				continueOnError: false,
				verbose: false,
				dryRun: false,
				outputFormat: OutputFormat.TEXT,
			},
			defaults: {
				confirmations: false,
				fileOverwrite: false,
				createDirectories: true,
				timeout: 300000, // 5 minutes
				retryCount: 3,
			},
			errorHandling: ErrorHandlingStrategy.FAIL_FAST,
		}
	}

	async generateSampleBatchFile(filePath: string, format: "json" | "yaml" | "text" = "json"): Promise<void> {
		const sampleConfig = this.createSampleConfig()

		let content: string

		const batchConfig: BatchConfig = {
			commands: sampleConfig.commands,
			settings: sampleConfig.settings,
			defaults: sampleConfig.defaults,
			errorHandling: ErrorHandlingStrategy.FAIL_FAST,
		}

		switch (format) {
			case "json":
				content = JSON.stringify(sampleConfig, null, 2)
				break
			case "yaml":
				content = this.yamlParser.stringify(batchConfig)
				break
			case "text":
				content = this.textParser.stringify(batchConfig)
				break
			default:
				throw new Error(`Unsupported format: ${format}`)
		}

		// Ensure directory exists
		const dir = path.dirname(filePath)
		await fs.mkdir(dir, { recursive: true })

		// Write sample file
		await fs.writeFile(filePath, content, "utf-8")
	}

	private createSampleConfig(): JSONBatchFile {
		return {
			version: "1.0",
			settings: {
				parallel: false,
				maxConcurrency: 3,
				continueOnError: false,
				verbose: true,
				dryRun: false,
				outputFormat: OutputFormat.JSON,
			},
			defaults: {
				confirmations: false,
				fileOverwrite: false,
				createDirectories: true,
				timeout: 300000,
				retryCount: 3,
			},
			commands: [
				{
					id: "setup",
					command: "echo",
					args: ["Setting up environment"],
					environment: {
						NODE_ENV: "development",
					},
					timeout: 30000,
				},
				{
					id: "install",
					command: "npm",
					args: ["install"],
					dependsOn: ["setup"],
					retries: 2,
				},
				{
					id: "test",
					command: "npm",
					args: ["test"],
					dependsOn: ["install"],
					condition: {
						type: "file_exists",
						value: "package.json",
					},
				},
			],
		}
	}
}
