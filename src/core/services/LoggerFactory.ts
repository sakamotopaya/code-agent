import { ILogger, LoggerConfig, LoggerPlatform, NoOpLogger } from "../interfaces/ILogger"
import { CLILoggerAdapter } from "../adapters/cli/CLILoggerAdapter"

/**
 * Factory service for creating platform-appropriate loggers
 *
 * Provides centralized logger creation with automatic platform detection
 * and fallback mechanisms for robust operation across all contexts.
 */
export class LoggerFactory {
	private static instance: LoggerFactory | null = null
	private currentPlatform: LoggerPlatform | null = null
	private defaultConfig: LoggerConfig = {}

	/**
	 * Get singleton instance of LoggerFactory
	 */
	static getInstance(): LoggerFactory {
		if (!LoggerFactory.instance) {
			LoggerFactory.instance = new LoggerFactory()
		}
		return LoggerFactory.instance
	}

	/**
	 * Initialize factory with platform and default configuration
	 */
	initialize(platform: LoggerPlatform, config: LoggerConfig = {}): void {
		this.currentPlatform = platform
		this.defaultConfig = { ...config }
	}

	/**
	 * Create logger for current platform with optional config override
	 */
	createLogger(configOverride: LoggerConfig = {}): ILogger {
		const effectiveConfig = { ...this.defaultConfig, ...configOverride }
		const platform = this.currentPlatform || this.detectPlatform()

		switch (platform) {
			case LoggerPlatform.CLI:
				return this.createCLILogger(effectiveConfig)

			case LoggerPlatform.VSCODE:
				return this.createVSCodeLogger(effectiveConfig)

			case LoggerPlatform.API:
				return this.createAPILogger(effectiveConfig)

			default:
				console.warn(`[LoggerFactory] Unknown platform: ${platform}, using NoOp logger`)
				return new NoOpLogger()
		}
	}

	/**
	 * Create logger for specific platform (bypasses current platform setting)
	 */
	createLoggerForPlatform(platform: LoggerPlatform, config: LoggerConfig = {}): ILogger {
		const effectiveConfig = { ...this.defaultConfig, ...config }

		switch (platform) {
			case LoggerPlatform.CLI:
				return this.createCLILogger(effectiveConfig)

			case LoggerPlatform.VSCODE:
				return this.createVSCodeLogger(effectiveConfig)

			case LoggerPlatform.API:
				return this.createAPILogger(effectiveConfig)

			default:
				return new NoOpLogger()
		}
	}

	/**
	 * Detect current execution platform
	 */
	private detectPlatform(): LoggerPlatform {
		// Check for VSCode context
		if (typeof globalThis !== "undefined" && "vscode" in globalThis) {
			return LoggerPlatform.VSCODE
		}

		// Check for Node.js environment variables that indicate CLI
		if (typeof process !== "undefined" && process.env) {
			// Check if we're running as CLI (has argv and not in VSCode extension host)
			if (process.argv && !process.env.VSCODE_PID) {
				return LoggerPlatform.CLI
			}
		}

		// Check for API/server context (Fastify, Express, etc.)
		if (typeof process !== "undefined" && process.env?.NODE_ENV) {
			// If we have server-like environment but not CLI, assume API
			return LoggerPlatform.API
		}

		// Default fallback
		return LoggerPlatform.CLI
	}

	/**
	 * Create CLI logger adapter
	 */
	private createCLILogger(config: LoggerConfig): ILogger {
		try {
			return new CLILoggerAdapter(config)
		} catch (error) {
			console.warn(`[LoggerFactory] Failed to create CLI logger:`, error)
			return new NoOpLogger()
		}
	}

	/**
	 * Create VSCode logger adapter (placeholder for future implementation)
	 */
	private createVSCodeLogger(config: LoggerConfig): ILogger {
		try {
			// TODO: Implement VSCodeLoggerAdapter
			// const { VSCodeLoggerAdapter } = require("../adapters/vscode/VSCodeLoggerAdapter")
			// return new VSCodeLoggerAdapter(config)

			// For now, fall back to console-based logging
			console.warn(`[LoggerFactory] VSCode logger not implemented yet, using NoOp logger`)
			return new NoOpLogger()
		} catch (error) {
			console.warn(`[LoggerFactory] Failed to create VSCode logger:`, error)
			return new NoOpLogger()
		}
	}

	/**
	 * Create API logger adapter (placeholder for future implementation)
	 */
	private createAPILogger(config: LoggerConfig): ILogger {
		try {
			// TODO: Implement APILoggerAdapter
			// const { APILoggerAdapter } = require("../adapters/api/APILoggerAdapter")
			// return new APILoggerAdapter(config)

			// For now, fall back to console-based logging
			console.warn(`[LoggerFactory] API logger not implemented yet, using NoOp logger`)
			return new NoOpLogger()
		} catch (error) {
			console.warn(`[LoggerFactory] Failed to create API logger:`, error)
			return new NoOpLogger()
		}
	}

	/**
	 * Get current platform
	 */
	getCurrentPlatform(): LoggerPlatform | null {
		return this.currentPlatform
	}

	/**
	 * Get default configuration
	 */
	getDefaultConfig(): LoggerConfig {
		return { ...this.defaultConfig }
	}

	/**
	 * Update default configuration
	 */
	updateDefaultConfig(config: Partial<LoggerConfig>): void {
		this.defaultConfig = { ...this.defaultConfig, ...config }
	}

	/**
	 * Reset factory to initial state
	 */
	reset(): void {
		this.currentPlatform = null
		this.defaultConfig = {}
	}
}

/**
 * Convenience function to get a logger with current factory settings
 */
export function getLogger(configOverride: LoggerConfig = {}): ILogger {
	return LoggerFactory.getInstance().createLogger(configOverride)
}

/**
 * Convenience function to initialize and get logger in one call
 */
export function initializeLogger(platform: LoggerPlatform, config: LoggerConfig = {}): ILogger {
	const factory = LoggerFactory.getInstance()
	factory.initialize(platform, config)
	return factory.createLogger()
}
