import {
	BatchConfig,
	BatchCommand,
	BatchSettings,
	NonInteractiveDefaults,
	ErrorHandlingStrategy,
	OutputFormat,
} from "../types/batch-types"

export class TextBatchParser {
	parse(content: string): BatchConfig {
		const lines = content.split("\n")
		const commands: BatchCommand[] = []
		let commandCounter = 1

		for (const line of lines) {
			const trimmed = line.trim()

			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith("#")) {
				continue
			}

			// Parse command line
			const command = this.parseCommandLine(trimmed, commandCounter)
			if (command) {
				commands.push(command)
				commandCounter++
			}
		}

		// Return default config with parsed commands
		return {
			commands,
			settings: this.getDefaultSettings(),
			defaults: this.getDefaultDefaults(),
			errorHandling: ErrorHandlingStrategy.FAIL_FAST,
		}
	}

	private parseCommandLine(line: string, counter: number): BatchCommand | null {
		// Handle environment variable definitions (KEY=value command...)
		let environment: Record<string, string> | undefined
		let commandPart = line

		const envVarRegex = /^([A-Z_][A-Z0-9_]*=\S+\s+)+/
		const envMatch = line.match(envVarRegex)
		if (envMatch) {
			environment = {}
			const envPart = envMatch[0].trim()
			commandPart = line.substring(envMatch[0].length).trim()

			// Parse environment variables
			const envPairs = envPart.split(/\s+/)
			for (const pair of envPairs) {
				const [key, value] = pair.split("=")
				if (key && value) {
					environment[key] = value
				}
			}
		}

		// Handle working directory changes (cd /path && command)
		let workingDirectory: string | undefined
		const cdMatch = commandPart.match(/^cd\s+([^\s&]+)\s*&&\s*(.+)/)
		if (cdMatch) {
			workingDirectory = cdMatch[1]
			commandPart = cdMatch[2]
		}

		// Parse command and arguments
		const parts = this.parseCommandParts(commandPart)
		if (parts.length === 0) {
			return null
		}

		const [command, ...args] = parts

		const batchCommand: BatchCommand = {
			id: `cmd_${counter}`,
			command,
			args,
		}

		if (environment && Object.keys(environment).length > 0) {
			batchCommand.environment = environment
		}

		if (workingDirectory) {
			batchCommand.workingDirectory = workingDirectory
		}

		return batchCommand
	}

	private parseCommandParts(commandLine: string): string[] {
		const parts: string[] = []
		let current = ""
		let inQuotes = false
		let quoteChar = ""

		for (let i = 0; i < commandLine.length; i++) {
			const char = commandLine[i]

			if ((char === '"' || char === "'") && !inQuotes) {
				inQuotes = true
				quoteChar = char
			} else if (char === quoteChar && inQuotes) {
				inQuotes = false
				quoteChar = ""
			} else if (char === " " && !inQuotes) {
				if (current.trim()) {
					parts.push(current.trim())
					current = ""
				}
			} else {
				current += char
			}
		}

		if (current.trim()) {
			parts.push(current.trim())
		}

		return parts
	}

	private getDefaultSettings(): BatchSettings {
		return {
			parallel: false,
			maxConcurrency: 1,
			continueOnError: false,
			verbose: false,
			dryRun: false,
			outputFormat: OutputFormat.TEXT,
		}
	}

	private getDefaultDefaults(): NonInteractiveDefaults {
		return {
			confirmations: false,
			fileOverwrite: false,
			createDirectories: true,
			timeout: 300000, // 5 minutes
			retryCount: 3,
		}
	}

	stringify(config: BatchConfig): string {
		const lines: string[] = []

		// Add header comment
		lines.push("# Roo CLI Batch Commands")
		lines.push("# One command per line")
		lines.push("# Lines starting with # are comments")
		lines.push("# Environment variables: KEY=value command")
		lines.push("# Working directory: cd /path && command")
		lines.push("")

		// Add settings as comments
		lines.push("# Settings:")
		lines.push(`# - Parallel execution: ${config.settings.parallel}`)
		lines.push(`# - Max concurrency: ${config.settings.maxConcurrency}`)
		lines.push(`# - Continue on error: ${config.settings.continueOnError}`)
		lines.push(`# - Verbose: ${config.settings.verbose}`)
		lines.push(`# - Dry run: ${config.settings.dryRun}`)
		lines.push(`# - Output format: ${config.settings.outputFormat}`)
		lines.push("")

		// Add commands
		for (const cmd of config.commands) {
			let line = ""

			// Add environment variables
			if (cmd.environment && Object.keys(cmd.environment).length > 0) {
				const envVars = Object.entries(cmd.environment)
					.map(([key, value]) => `${key}=${value}`)
					.join(" ")
				line += `${envVars} `
			}

			// Add working directory change
			if (cmd.workingDirectory) {
				line += `cd ${cmd.workingDirectory} && `
			}

			// Add command
			line += cmd.command

			// Add arguments
			if (cmd.args && cmd.args.length > 0) {
				const quotedArgs = cmd.args.map((arg) => {
					// Quote arguments that contain spaces
					if (arg.includes(" ")) {
						return `"${arg}"`
					}
					return arg
				})
				line += ` ${quotedArgs.join(" ")}`
			}

			lines.push(line)
		}

		return lines.join("\n")
	}

	validate(content: string): { valid: boolean; errors: string[] } {
		const errors: string[] = []

		try {
			const config = this.parse(content)

			if (config.commands.length === 0) {
				errors.push("No valid commands found in text file")
			}

			// Check for common issues
			const lines = content.split("\n")
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].trim()
				if (!line || line.startsWith("#")) continue

				// Check for potentially problematic characters
				if (line.includes("&&") && !line.match(/cd\s+[^\s&]+\s*&&/)) {
					errors.push(
						`Line ${i + 1}: Complex command chaining may not work as expected. Consider using separate commands.`,
					)
				}

				if (line.includes("|")) {
					errors.push(`Line ${i + 1}: Pipe operations may not work as expected in batch mode.`)
				}

				if (line.includes(">") || line.includes("<")) {
					errors.push(`Line ${i + 1}: File redirection may not work as expected in batch mode.`)
				}
			}
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error))
		}

		return {
			valid: errors.length === 0,
			errors,
		}
	}

	generateSample(): string {
		const sampleLines = [
			"# Roo CLI Batch Commands Example",
			"# This is a sample batch file for the Roo CLI",
			"",
			"# Simple command",
			'echo "Starting batch process"',
			"",
			"# Command with environment variable",
			"NODE_ENV=development npm install",
			"",
			"# Command with working directory change",
			"cd ./src && npm test",
			"",
			"# Multiple arguments",
			"git add .",
			'git commit -m "Automated commit from batch process"',
			"",
			"# Command with quoted arguments containing spaces",
			'echo "This is a message with spaces"',
			"",
			"# More complex example",
			"DEBUG=true NODE_ENV=test cd ./test && npm run test:integration",
		]

		return sampleLines.join("\n")
	}
}
