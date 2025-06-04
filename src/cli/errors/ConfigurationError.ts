/**
 * Configuration related errors
 */

import { ErrorCategory, ErrorSeverity, ErrorContext } from "../types/error-types"
import { CLIError } from "./CLIError"

export class ConfigurationError extends CLIError {
	readonly category = ErrorCategory.CONFIGURATION
	readonly severity = ErrorSeverity.HIGH
	readonly isRecoverable = true

	constructor(
		message: string,
		code: string,
		public readonly configPath?: string,
		public readonly configKey?: string,
		context?: ErrorContext,
		cause?: Error,
	) {
		super(message, code, context, cause)
	}

	override getSuggestedActions(): string[] {
		const actions = [
			"Check configuration file syntax",
			"Verify required settings are present",
			"Reset to default configuration",
		]

		if (this.configPath) {
			actions.push(`Check configuration file: ${this.configPath}`)
		}

		if (this.configKey) {
			actions.push(`Verify configuration key "${this.configKey}" is correct`)
		}

		return actions
	}

	override getDocumentationLinks(): string[] {
		return [
			"https://docs.npmjs.com/cli/v8/configuring-npm/npmrc",
			"https://nodejs.org/api/fs.html#fs_fs_readfilesync_path_options",
		]
	}

	override getUserFriendlyMessage(): string {
		if (this.configPath && this.configKey) {
			return `Configuration error in "${this.configPath}" for key "${this.configKey}": ${this.message}`
		}
		if (this.configPath) {
			return `Configuration error in "${this.configPath}": ${this.message}`
		}
		return `Configuration error: ${this.message}`
	}
}

// Specific configuration error types
export class InvalidConfigSyntaxError extends ConfigurationError {
	constructor(configPath: string, line?: number, context?: ErrorContext, cause?: Error) {
		const message = line
			? `Invalid syntax in configuration file at line ${line}`
			: "Invalid syntax in configuration file"

		super(message, "CONFIG_INVALID_SYNTAX", configPath, undefined, context, cause)
	}

	override getSuggestedActions(): string[] {
		return [
			"Check JSON/YAML syntax in configuration file",
			"Validate configuration with online JSON/YAML validator",
			"Check for missing commas, brackets, or quotes",
			"Reset configuration to default values",
		]
	}
}

export class MissingConfigError extends ConfigurationError {
	constructor(configPath: string, context?: ErrorContext, cause?: Error) {
		super(`Configuration file not found: ${configPath}`, "CONFIG_NOT_FOUND", configPath, undefined, context, cause)
	}

	override getSuggestedActions(): string[] {
		return [
			`Create configuration file at: ${this.configPath}`,
			"Run initialization command to create default config",
			"Check if configuration file path is correct",
			"Use --config flag to specify configuration file location",
		]
	}
}

export class InvalidConfigValueError extends ConfigurationError {
	constructor(
		configKey: string,
		expectedType: string,
		actualValue: any,
		configPath?: string,
		context?: ErrorContext,
		cause?: Error,
	) {
		super(
			`Invalid value for "${configKey}": expected ${expectedType}, got ${typeof actualValue}`,
			"CONFIG_INVALID_VALUE",
			configPath,
			configKey,
			context,
			cause,
		)
	}

	override getSuggestedActions(): string[] {
		return [
			`Check the value type for configuration key "${this.configKey}"`,
			"Refer to documentation for valid configuration values",
			"Use configuration validation tool",
			"Reset this configuration value to default",
		]
	}
}

export class MissingRequiredConfigError extends ConfigurationError {
	constructor(configKey: string, configPath?: string, context?: ErrorContext, cause?: Error) {
		super(
			`Required configuration key "${configKey}" is missing`,
			"CONFIG_MISSING_REQUIRED",
			configPath,
			configKey,
			context,
			cause,
		)
	}

	override getSuggestedActions(): string[] {
		return [
			`Add required configuration key "${this.configKey}"`,
			"Check documentation for required configuration options",
			"Run setup command to configure required settings",
			"Use environment variables as alternative configuration",
		]
	}
}
