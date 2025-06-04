import {
	BatchConfig,
	BatchCommand,
	BatchSettings,
	NonInteractiveDefaults,
	ErrorHandlingStrategy,
	OutputFormat,
	JSONBatchFile,
} from "../types/batch-types"

export class JSONBatchParser {
	parse(data: any): BatchConfig {
		if (!data || typeof data !== "object") {
			throw new Error("Invalid JSON batch file: root must be an object")
		}

		const jsonFile = data as JSONBatchFile

		// Validate version
		if (!jsonFile.version) {
			throw new Error("Batch file version is required")
		}

		// Parse settings with defaults
		const settings: BatchSettings = {
			parallel: jsonFile.settings?.parallel || false,
			maxConcurrency: jsonFile.settings?.maxConcurrency || 1,
			continueOnError: jsonFile.settings?.continueOnError || false,
			verbose: jsonFile.settings?.verbose || false,
			dryRun: jsonFile.settings?.dryRun || false,
			outputFormat: this.parseOutputFormat(jsonFile.settings?.outputFormat),
		}

		// Parse defaults
		const defaults: NonInteractiveDefaults = {
			confirmations: jsonFile.defaults?.confirmations || false,
			fileOverwrite: jsonFile.defaults?.fileOverwrite || false,
			createDirectories: jsonFile.defaults?.createDirectories !== false,
			timeout: jsonFile.defaults?.timeout || 300000,
			retryCount: jsonFile.defaults?.retryCount || 3,
		}

		// Parse error handling strategy
		const errorHandling = this.parseErrorHandlingStrategy(
			jsonFile.settings?.continueOnError ? "continue_on_error" : "fail_fast",
		)

		// Parse commands
		const commands = this.parseCommands(jsonFile.commands || [])

		return {
			commands,
			settings,
			defaults,
			errorHandling,
		}
	}

	private parseOutputFormat(format?: string): OutputFormat {
		if (!format) return OutputFormat.TEXT

		const normalizedFormat = format.toLowerCase()
		switch (normalizedFormat) {
			case "json":
				return OutputFormat.JSON
			case "yaml":
			case "yml":
				return OutputFormat.YAML
			case "csv":
				return OutputFormat.CSV
			case "markdown":
			case "md":
				return OutputFormat.MARKDOWN
			case "text":
			case "plain":
			default:
				return OutputFormat.TEXT
		}
	}

	private parseErrorHandlingStrategy(strategy?: string): ErrorHandlingStrategy {
		if (!strategy) return ErrorHandlingStrategy.FAIL_FAST

		switch (strategy.toLowerCase()) {
			case "continue_on_error":
			case "continue-on-error":
				return ErrorHandlingStrategy.CONTINUE_ON_ERROR
			case "collect_errors":
			case "collect-errors":
				return ErrorHandlingStrategy.COLLECT_ERRORS
			case "retry_failures":
			case "retry-failures":
				return ErrorHandlingStrategy.RETRY_FAILURES
			case "fail_fast":
			case "fail-fast":
			default:
				return ErrorHandlingStrategy.FAIL_FAST
		}
	}

	private parseCommands(commands: any[]): BatchCommand[] {
		if (!Array.isArray(commands)) {
			throw new Error("Commands must be an array")
		}

		return commands.map((cmd, index) => {
			if (!cmd || typeof cmd !== "object") {
				throw new Error(`Command at index ${index} must be an object`)
			}

			if (!cmd.id || typeof cmd.id !== "string") {
				throw new Error(`Command at index ${index} must have a string 'id' field`)
			}

			if (!cmd.command || typeof cmd.command !== "string") {
				throw new Error(`Command '${cmd.id}' must have a string 'command' field`)
			}

			const batchCommand: BatchCommand = {
				id: cmd.id,
				command: cmd.command,
				args: Array.isArray(cmd.args) ? cmd.args : [],
			}

			// Optional fields
			if (cmd.environment && typeof cmd.environment === "object") {
				batchCommand.environment = cmd.environment
			}

			if (cmd.workingDirectory && typeof cmd.workingDirectory === "string") {
				batchCommand.workingDirectory = cmd.workingDirectory
			}

			if (cmd.timeout && typeof cmd.timeout === "number" && cmd.timeout > 0) {
				batchCommand.timeout = cmd.timeout
			}

			if (cmd.retries && typeof cmd.retries === "number" && cmd.retries >= 0) {
				batchCommand.retries = cmd.retries
			}

			if (cmd.dependsOn && Array.isArray(cmd.dependsOn)) {
				batchCommand.dependsOn = cmd.dependsOn.filter((dep: any) => typeof dep === "string")
			}

			if (cmd.condition && typeof cmd.condition === "object") {
				batchCommand.condition = this.parseCondition(cmd.condition)
			}

			return batchCommand
		})
	}

	private parseCondition(condition: any): any {
		if (!condition.type || typeof condition.type !== "string") {
			throw new Error("Condition must have a valid type")
		}

		const validTypes = ["file_exists", "env_var", "exit_code", "always", "never"]
		if (!validTypes.includes(condition.type)) {
			throw new Error(`Invalid condition type: ${condition.type}. Valid types: ${validTypes.join(", ")}`)
		}

		const parsedCondition: any = {
			type: condition.type,
		}

		if (condition.value !== undefined) {
			parsedCondition.value = String(condition.value)
		}

		if (condition.expectedExitCode !== undefined) {
			if (typeof condition.expectedExitCode === "number") {
				parsedCondition.expectedExitCode = condition.expectedExitCode
			} else {
				throw new Error("expectedExitCode must be a number")
			}
		}

		return parsedCondition
	}

	stringify(config: BatchConfig): string {
		const jsonFile: JSONBatchFile = {
			version: "1.0",
			settings: config.settings,
			defaults: config.defaults,
			commands: config.commands,
		}

		return JSON.stringify(jsonFile, null, 2)
	}

	validate(data: any): { valid: boolean; errors: string[] } {
		const errors: string[] = []

		try {
			this.parse(data)
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error))
		}

		return {
			valid: errors.length === 0,
			errors,
		}
	}
}
