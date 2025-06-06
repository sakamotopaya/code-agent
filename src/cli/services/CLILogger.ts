import chalk from "chalk"

/**
 * CLI-aware logger that handles output formatting for terminal display
 */
export class CLILogger {
	private isVerbose: boolean
	private isQuiet: boolean
	private useColor: boolean

	constructor(verbose: boolean = false, quiet: boolean = false, useColor: boolean = true) {
		this.isVerbose = verbose
		this.isQuiet = quiet
		this.useColor = useColor
	}

	/**
	 * Debug logs - only shown in verbose mode
	 */
	debug(message: string, ...args: any[]): void {
		if (this.isVerbose && !this.isQuiet) {
			const prefix = this.useColor ? chalk.gray("[DEBUG]") : "[DEBUG]"
			console.error(`${prefix} ${message}`, ...args)
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
	 */
	formatMarkdown(content: string): string {
		if (!this.useColor) {
			// Just clean up the content without colors but preserve spaces
			return content
				.replace(/\n\n+/g, "\n\n") // Normalize multiple newlines
				.replace(/`([^`]+)`/g, "$1") // Remove backticks
				.replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold markers
				.replace(/\*([^*]+)\*/g, "$1") // Remove italic markers
				.replace(/#{1,6}\s*([^\n]+)/g, "$1") // Remove headers
				.trim()
		}

		// Apply terminal formatting with careful space preservation
		return content
			.replace(/\n\n+/g, "\n\n") // Normalize multiple newlines
			.replace(/`([^`]+)`/g, chalk.cyan("$1")) // Code spans
			.replace(/\*\*([^*]+)\*\*/g, chalk.bold("$1")) // Bold
			.replace(/\*([^*]+)\*/g, chalk.italic("$1")) // Italic
			.replace(/#{1,6}\s*([^\n]+)/g, chalk.bold.blue("$1")) // Headers
			.replace(/^\s*[-*+]\s+(.+)$/gm, chalk.gray("•") + " $1") // List items
			.trim()
	}

	/**
	 * Stream LLM output with proper formatting
	 */
	streamLLMOutput(content: string): void {
		// Don't format when streaming - just output raw content
		// This preserves spaces and natural formatting
		process.stdout.write(content)
	}

	/**
	 * Clear current line (for progress updates)
	 */
	clearLine(): void {
		if (!this.isQuiet) {
			process.stdout.write("\r\x1b[K")
		}
	}

	/**
	 * Create a new logger with different settings
	 */
	withSettings(verbose?: boolean, quiet?: boolean, useColor?: boolean): CLILogger {
		return new CLILogger(verbose ?? this.isVerbose, quiet ?? this.isQuiet, useColor ?? this.useColor)
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
): CLILogger {
	globalCLILogger = new CLILogger(verbose, quiet, useColor)
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
