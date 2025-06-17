import chalk from "chalk"
import { createDefaultCLILogger, CLILogger as SOLIDCLILogger } from "./streaming"

/**
 * Global debug timing tracker
 */
export class DebugTimer {
	private static instance: DebugTimer | null = null
	private lastDebugTime: number | null = null

	static getInstance(): DebugTimer {
		if (!DebugTimer.instance) {
			DebugTimer.instance = new DebugTimer()
		}
		return DebugTimer.instance
	}

	getElapsedAndUpdate(): number | null {
		const now = Date.now()
		const elapsed = this.lastDebugTime ? now - this.lastDebugTime : null
		this.lastDebugTime = now
		return elapsed
	}

	reset(): void {
		this.lastDebugTime = null
	}
}

/**
 * Format debug message with elapsed milliseconds
 */
export function formatDebugMessage(message: string, useColor: boolean = true): string {
	const timer = DebugTimer.getInstance()
	const elapsed = timer.getElapsedAndUpdate()
	const elapsedStr = elapsed !== null ? `+${elapsed}ms` : "+0ms"

	if (useColor) {
		return `${chalk.gray("[DEBUG]")} ${chalk.dim(`[${elapsedStr}]`)} ${message}`
	} else {
		return `[DEBUG] [${elapsedStr}] ${message}`
	}
}

/**
 * CLI-aware logger that handles output formatting for terminal display
 * Updated to use SOLID-based MessageBuffer integration while maintaining backward compatibility
 */
export class CLILogger {
	private solidLogger: SOLIDCLILogger
	private isVerbose: boolean
	private isQuiet: boolean
	private useColor: boolean
	private showThinking: boolean

	constructor(
		verbose: boolean = false,
		quiet: boolean = false,
		useColor: boolean = true,
		showThinking: boolean = false,
	) {
		this.isVerbose = verbose
		this.isQuiet = quiet
		this.useColor = useColor
		this.showThinking = showThinking

		// Create the SOLID-based logger with same options
		this.solidLogger = createDefaultCLILogger({
			verbose,
			quiet,
			useColor,
			showThinking,
		})
	}

	/**
	 * Debug logs - only shown in verbose mode
	 */
	debug(message: string, ...args: any[]): void {
		if (this.isVerbose && !this.isQuiet) {
			const formattedMessage = formatDebugMessage(message, this.useColor)
			console.error(formattedMessage, ...args)
		}
	}

	/**
	 * Info logs - shown unless quiet mode
	 */
	info(message: string, ...args: any[]): void {
		if (!this.isQuiet) {
			console.log(message, ...args)
		}
	}

	/**
	 * User-facing output - always shown
	 */
	output(message: string, ...args: any[]): void {
		console.log(message, ...args)
	}

	/**
	 * Error output - always shown
	 */
	error(message: string, ...args: any[]): void {
		const prefix = this.useColor ? chalk.red("[ERROR]") : "[ERROR]"
		console.error(`${prefix} ${message}`, ...args)
	}

	/**
	 * Warning output - shown unless quiet mode
	 */
	warn(message: string, ...args: any[]): void {
		if (!this.isQuiet) {
			const prefix = this.useColor ? chalk.yellow("[WARN]") : "[WARN]"
			console.error(`${prefix} ${message}`, ...args)
		}
	}

	/**
	 * Success message - shown unless quiet mode
	 */
	success(message: string, ...args: any[]): void {
		if (!this.isQuiet) {
			const prefix = this.useColor ? chalk.green("✓") : "✓"
			console.log(`${prefix} ${message}`, ...args)
		}
	}

	/**
	 * Progress indicator - shown unless quiet mode
	 */
	progress(message: string, ...args: any[]): void {
		if (!this.isQuiet) {
			const prefix = this.useColor ? chalk.blue("⋯") : "..."
			console.log(`${prefix} ${message}`, ...args)
		}
	}

	/**
	 * Format markdown content for terminal display
	 * Delegates to SOLID display formatter
	 */
	formatMarkdown(content: string): string {
		return this.solidLogger.formatMarkdown(content)
	}

	/**
	 * Stream LLM output with MessageBuffer-based processing
	 * UPDATED: Now uses SOLID-based MessageBuffer integration instead of manual parsing
	 */
	streamLLMOutput(content: string): void {
		// Debug output if verbose
		if (this.isVerbose) {
			console.error(`[CLILogger.streamLLMOutput] Processing content: ${content.substring(0, 100)}...`)
		}

		// Delegate to SOLID-based streaming logger
		this.solidLogger.streamContent(content)
	}

	/**
	 * Reset tool display tracking (call at start of new requests)
	 * UPDATED: Now delegates to SOLID state manager
	 */
	resetToolDisplay(): void {
		this.solidLogger.reset()
	}

	/**
	 * Clear current line (for progress updates)
	 * Delegates to SOLID output writer
	 */
	clearLine(): void {
		this.solidLogger.clearLine()
	}

	/**
	 * Create a new logger with different settings
	 * UPDATED: Creates new SOLID-based logger with settings
	 */
	withSettings(verbose?: boolean, quiet?: boolean, useColor?: boolean, showThinking?: boolean): CLILogger {
		return new CLILogger(
			verbose ?? this.isVerbose,
			quiet ?? this.isQuiet,
			useColor ?? this.useColor,
			showThinking ?? this.showThinking,
		)
	}

	/**
	 * Get the underlying SOLID logger (for testing/advanced usage)
	 */
	getSOLIDLogger(): SOLIDCLILogger {
		return this.solidLogger
	}
}

/**
 * Global CLI logger instance
 */
export let globalCLILogger: CLILogger | null = null

/**
 * Initialize the global CLI logger
 */
export function initializeCLILogger(
	verbose: boolean = false,
	quiet: boolean = false,
	useColor: boolean = true,
	showThinking: boolean = false,
): CLILogger {
	globalCLILogger = new CLILogger(verbose, quiet, useColor, showThinking)
	return globalCLILogger
}

/**
 * Get the global CLI logger (creates a default one if not initialized)
 */
export function getCLILogger(): CLILogger {
	if (!globalCLILogger) {
		globalCLILogger = new CLILogger()
	}
	return globalCLILogger
}
