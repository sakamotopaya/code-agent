import {
	BatchConfig,
	BatchCommand,
	BatchSettings,
	NonInteractiveDefaults,
	ErrorHandlingStrategy,
	OutputFormat,
	YAMLBatchFile,
} from "../types/batch-types"
import { JSONBatchParser } from "./JSONBatchParser"

export class YAMLBatchParser {
	private jsonParser: JSONBatchParser

	constructor() {
		this.jsonParser = new JSONBatchParser()
	}

	parse(content: string): BatchConfig {
		try {
			// Try to use js-yaml if available, otherwise fall back to simple YAML parsing
			let yamlData: any

			try {
				const yaml = require("js-yaml")
				yamlData = yaml.load(content)
			} catch {
				// Fallback to simple YAML parsing
				yamlData = this.parseSimpleYAML(content)
			}

			// Reuse JSON parser logic
			return this.jsonParser.parse(yamlData)
		} catch (error) {
			throw new Error(
				`Failed to parse YAML batch file: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private parseSimpleYAML(content: string): any {
		const lines = content.split("\n")
		const result: any = {}
		let currentSection: string | null = null
		let currentArray: any[] | null = null
		let currentObject: any = result
		let indentLevel = 0

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const trimmed = line.trim()

			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith("#")) {
				continue
			}

			// Calculate indentation
			const leadingSpaces = line.length - line.trimStart().length
			const currentIndent = Math.floor(leadingSpaces / 2)

			// Handle array items
			if (trimmed.startsWith("- ")) {
				const value = trimmed.substring(2).trim()

				if (!currentArray) {
					currentArray = []
					if (currentSection) {
						currentObject[currentSection] = currentArray
					}
				}

				// Check if it's a simple value or object
				if (value.includes(":")) {
					const obj: any = {}
					const pairs = value.split(",")
					for (const pair of pairs) {
						const [key, val] = pair.split(":").map((s) => s.trim())
						if (key && val !== undefined) {
							obj[key] = this.parseValue(val)
						}
					}
					currentArray.push(obj)
				} else {
					currentArray.push(this.parseValue(value))
				}
				continue
			}

			// Handle key-value pairs
			if (trimmed.includes(":")) {
				const colonIndex = trimmed.indexOf(":")
				const key = trimmed.substring(0, colonIndex).trim()
				const value = trimmed.substring(colonIndex + 1).trim()

				if (currentIndent === 0) {
					currentSection = key
					currentObject = result
					currentArray = null
				}

				if (value) {
					currentObject[key] = this.parseValue(value)
				} else {
					// This is a section header
					currentObject[key] = {}
					if (currentIndent === 0) {
						currentObject = currentObject[key]
					}
				}
			}
		}

		return result
	}

	private parseValue(value: string): any {
		const trimmed = value.trim()

		// Boolean values
		if (trimmed === "true") return true
		if (trimmed === "false") return false

		// Null values
		if (trimmed === "null" || trimmed === "~") return null

		// Numbers
		if (/^-?\d+$/.test(trimmed)) {
			return parseInt(trimmed, 10)
		}
		if (/^-?\d+\.\d+$/.test(trimmed)) {
			return parseFloat(trimmed)
		}

		// Quoted strings
		if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
			return trimmed.slice(1, -1)
		}

		// Arrays
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			const content = trimmed.slice(1, -1).trim()
			if (!content) return []
			return content.split(",").map((item) => this.parseValue(item.trim()))
		}

		// Objects
		if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
			const content = trimmed.slice(1, -1).trim()
			if (!content) return {}
			const obj: any = {}
			const pairs = content.split(",")
			for (const pair of pairs) {
				const [key, val] = pair.split(":").map((s) => s.trim())
				if (key && val !== undefined) {
					obj[key.replace(/['"]/g, "")] = this.parseValue(val)
				}
			}
			return obj
		}

		// Plain string
		return trimmed
	}

	stringify(config: BatchConfig): string {
		try {
			const yaml = require("js-yaml")
			const yamlFile: YAMLBatchFile = {
				version: "1.0",
				settings: config.settings,
				defaults: config.defaults,
				commands: config.commands,
			}
			return yaml.dump(yamlFile, { indent: 2, lineWidth: 120 })
		} catch {
			// Fallback to simple YAML generation
			return this.stringifySimpleYAML(config)
		}
	}

	private stringifySimpleYAML(config: BatchConfig): string {
		const lines: string[] = []

		lines.push('version: "1.0"')
		lines.push("")
		lines.push("settings:")
		lines.push(`  parallel: ${config.settings.parallel}`)
		lines.push(`  maxConcurrency: ${config.settings.maxConcurrency}`)
		lines.push(`  continueOnError: ${config.settings.continueOnError}`)
		lines.push(`  verbose: ${config.settings.verbose}`)
		lines.push(`  dryRun: ${config.settings.dryRun}`)
		lines.push(`  outputFormat: ${config.settings.outputFormat}`)
		lines.push("")

		lines.push("defaults:")
		lines.push(`  confirmations: ${config.defaults.confirmations}`)
		lines.push(`  fileOverwrite: ${config.defaults.fileOverwrite}`)
		lines.push(`  createDirectories: ${config.defaults.createDirectories}`)
		lines.push(`  timeout: ${config.defaults.timeout}`)
		lines.push(`  retryCount: ${config.defaults.retryCount}`)
		lines.push("")

		lines.push("commands:")
		for (const cmd of config.commands) {
			lines.push(`  - id: "${cmd.id}"`)
			lines.push(`    command: "${cmd.command}"`)

			if (cmd.args && cmd.args.length > 0) {
				lines.push("    args:")
				for (const arg of cmd.args) {
					lines.push(`      - "${arg}"`)
				}
			}

			if (cmd.environment) {
				lines.push("    environment:")
				for (const [key, value] of Object.entries(cmd.environment)) {
					lines.push(`      ${key}: "${value}"`)
				}
			}

			if (cmd.workingDirectory) {
				lines.push(`    workingDirectory: "${cmd.workingDirectory}"`)
			}

			if (cmd.timeout) {
				lines.push(`    timeout: ${cmd.timeout}`)
			}

			if (cmd.retries) {
				lines.push(`    retries: ${cmd.retries}`)
			}

			if (cmd.dependsOn && cmd.dependsOn.length > 0) {
				lines.push("    dependsOn:")
				for (const dep of cmd.dependsOn) {
					lines.push(`      - "${dep}"`)
				}
			}

			if (cmd.condition) {
				lines.push("    condition:")
				lines.push(`      type: "${cmd.condition.type}"`)
				if (cmd.condition.value) {
					lines.push(`      value: "${cmd.condition.value}"`)
				}
				if (cmd.condition.expectedExitCode !== undefined) {
					lines.push(`      expectedExitCode: ${cmd.condition.expectedExitCode}`)
				}
			}

			lines.push("")
		}

		return lines.join("\n")
	}

	validate(content: string): { valid: boolean; errors: string[] } {
		const errors: string[] = []

		try {
			this.parse(content)
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error))
		}

		return {
			valid: errors.length === 0,
			errors,
		}
	}
}
