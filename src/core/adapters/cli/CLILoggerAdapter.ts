import { ILogger, LoggerConfig } from "../../interfaces/ILogger"
import { getCLILogger, CLILogger, formatDebugMessage } from "../../../cli/services/CLILogger"

/**
 * CLI implementation of ILogger interface
 *
 * Integrates with existing CLI logging infrastructure while providing
 * the unified interface for core modules.
 */
export class CLILoggerAdapter implements ILogger {
	private cliLogger: CLILogger
	private config: LoggerConfig

	constructor(config: LoggerConfig = {}) {
		this.config = {
			verbose: false,
			quiet: false,
			useColor: true,
			showThinking: false,
			...config,
		}

		// Get or create CLI logger with our configuration
		this.cliLogger = getCLILogger().withSettings(
			this.config.verbose,
			this.config.quiet,
			this.config.useColor,
			this.config.showThinking,
		)
	}

	debug(message: string, ...args: any[]): void {
		if (this.config.verbose && !this.config.quiet) {
			// Use existing debug infrastructure
			this.cliLogger.debug(message, ...args)
		}
	}

	verbose(message: string, ...args: any[]): void {
		if (this.config.verbose && !this.config.quiet) {
			// Verbose is same as debug for CLI
			this.cliLogger.debug(message, ...args)
		}
	}

	info(message: string, ...args: any[]): void {
		if (!this.config.quiet) {
			this.cliLogger.info(message, ...args)
		}
	}

	warn(message: string, ...args: any[]): void {
		if (!this.config.quiet) {
			this.cliLogger.warn(message, ...args)
		}
	}

	error(message: string, ...args: any[]): void {
		// Errors always show
		this.cliLogger.error(message, ...args)
	}

	success(message: string, ...args: any[]): void {
		if (!this.config.quiet) {
			this.cliLogger.success(message, ...args)
		}
	}

	progress(message: string, ...args: any[]): void {
		if (!this.config.quiet) {
			this.cliLogger.progress(message, ...args)
		}
	}

	/**
	 * Update logger configuration
	 */
	updateConfig(config: Partial<LoggerConfig>): void {
		this.config = { ...this.config, ...config }
		this.cliLogger = this.cliLogger.withSettings(
			this.config.verbose,
			this.config.quiet,
			this.config.useColor,
			this.config.showThinking,
		)
	}

	/**
	 * Get current configuration
	 */
	getConfig(): LoggerConfig {
		return { ...this.config }
	}

	/**
	 * Access underlying CLI logger for advanced usage
	 */
	getCLILogger(): CLILogger {
		return this.cliLogger
	}
}

/**
 * Create a CLI logger adapter from CLI options
 * Helper function for easy integration with existing CLI code
 */
export function createCLILoggerFromOptions(options: {
	verbose?: boolean
	quiet?: boolean
	color?: boolean
}): CLILoggerAdapter {
	return new CLILoggerAdapter({
		verbose: options.verbose ?? false,
		quiet: options.quiet ?? false,
		useColor: options.color ?? true,
	})
}
