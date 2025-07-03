/**
 * Unified logging interface for multi-platform Code Agent
 *
 * Provides consistent logging API across CLI, VSCode Extension, and API contexts.
 * Each platform implements this interface with appropriate output mechanisms.
 */
export interface ILogger {
	/**
	 * Debug messages - only shown in verbose mode
	 * Used for detailed debugging information
	 */
	debug(message: string, ...args: any[]): void

	/**
	 * Verbose messages - only shown in verbose mode
	 * Used for extra detail beyond normal operation
	 */
	verbose(message: string, ...args: any[]): void

	/**
	 * Info messages - shown unless quiet mode
	 * Used for general information about operation
	 */
	info(message: string, ...args: any[]): void

	/**
	 * Warning messages - shown unless quiet mode
	 * Used for important notices that aren't errors
	 */
	warn(message: string, ...args: any[]): void

	/**
	 * Error messages - always shown
	 * Used for critical issues that need attention
	 */
	error(message: string, ...args: any[]): void

	/**
	 * Success messages - shown unless quiet mode
	 * Used for positive feedback about completed operations
	 */
	success?(message: string, ...args: any[]): void

	/**
	 * Progress messages - shown unless quiet mode
	 * Used for indicating ongoing operations
	 */
	progress?(message: string, ...args: any[]): void
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
	/** Enable verbose/debug output */
	verbose?: boolean
	/** Suppress non-essential output */
	quiet?: boolean
	/** Enable colored output */
	useColor?: boolean
	/** Show thinking process messages */
	showThinking?: boolean
	/** Custom log level filter */
	logLevel?: "error" | "warn" | "info" | "verbose" | "debug"
}

/**
 * Platform context for logger creation
 */
export enum LoggerPlatform {
	CLI = "cli",
	VSCODE = "vscode",
	API = "api",
}

/**
 * No-op logger implementation for testing or fallback scenarios
 */
export class NoOpLogger implements ILogger {
	debug(_message: string, ..._args: any[]): void {}
	verbose(_message: string, ..._args: any[]): void {}
	info(_message: string, ..._args: any[]): void {}
	warn(_message: string, ..._args: any[]): void {}
	error(_message: string, ..._args: any[]): void {}
	success?(_message: string, ..._args: any[]): void {}
	progress?(_message: string, ..._args: any[]): void {}
}
