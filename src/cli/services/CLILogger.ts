import chalk from "chalk"

/**
 * CLI-aware logger that handles output formatting for terminal display
 */
export class CLILogger {
	private isVerbose: boolean
	private isQuiet: boolean
	private useColor: boolean
	private showThinking: boolean

	// State tracking for streaming content filtering
	private inThinkingSection: boolean = false
	private inSystemTag: boolean = false
	private currentTagBuffer: string = ""
	private displayedToolNames = new Set<string>() // Track which tool names we've already displayed
	private systemTags = new Set([
		"attempt_completion",
		"result",
		"read_file",
		"write_to_file",
		"args",
		"path",
		"content",
		"line_count",
		"tool_use",
	])

	// Comprehensive list of all possible tool names
	private toolNames = new Set([
		"read_file",
		"write_to_file",
		"apply_diff",
		"search_files",
		"list_files",
		"list_code_definition_names",
		"execute_command",
		"browser_action",
		"insert_content",
		"search_and_replace",
		"ask_followup_question",
		"attempt_completion",
		"use_mcp_tool",
		"access_mcp_resource",
		"switch_mode",
		"new_task",
		"fetch_instructions",
	])

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
	 * Stream LLM output with state-based filtering for CLI mode
	 */
	streamLLMOutput(content: string): void {
		// Debug output if verbose
		if (this.isVerbose) {
			console.error(`[CLILogger.streamLLMOutput] Processing content: ${content.substring(0, 100)}...`)
		}

		let i = 0
		let output = ""

		while (i < content.length) {
			const char = content[i]

			// Check for start of XML tag
			if (char === "<" && !this.inSystemTag) {
				// Look ahead to see if this is a system tag or tool
				const remainingContent = content.slice(i)
				const tagMatch = remainingContent.match(/^<(\/?[a-zA-Z_][a-zA-Z0-9_-]*)[^>]*>/)

				if (tagMatch) {
					const fullTagName = tagMatch[1] // Keep the full name with potential "/"
					const isClosingTag = fullTagName.startsWith("/")
					const tagName = isClosingTag ? fullTagName.slice(1) : fullTagName
					const isSystemTag = this.systemTags.has(tagName)
					const isToolName = this.toolNames.has(tagName)

					if (this.isVerbose) {
						console.error(
							`[CLILogger.streamLLMOutput] Found tag: ${tagName}, isToolName: ${isToolName}, isClosingTag: ${isClosingTag}`,
						)
					}

					if (tagName === "thinking") {
						if (isClosingTag) {
							this.inThinkingSection = false
						} else {
							this.inThinkingSection = true
						}
						// Skip the entire tag
						i += tagMatch[0].length
						continue
					} else if (isToolName && !isClosingTag && !this.displayedToolNames.has(tagName)) {
						// Display tool name in yellow when first encountered
						const toolDisplay = this.useColor ? chalk.yellow(`${tagName}...`) : `${tagName}...`
						process.stdout.write(`\n${toolDisplay}\n`)
						this.displayedToolNames.add(tagName)

						if (this.isVerbose) {
							console.error(`[CLILogger.streamLLMOutput] Displayed tool: ${tagName}`)
						}

						// Skip the tool tag
						i += tagMatch[0].length
						continue
					} else if (isSystemTag || isToolName) {
						// Skip system tags and tool tags entirely
						i += tagMatch[0].length
						continue
					}
				}
			}

			// Only output if we're not in a thinking section (unless thinking is enabled)
			// and not in a system tag
			if (!this.inThinkingSection || this.showThinking) {
				output += char
			}

			i++
		}

		if (output) {
			process.stdout.write(output)
		}
	}

	/**
	 * Reset tool display tracking (call at start of new requests)
	 */
	resetToolDisplay(): void {
		this.displayedToolNames.clear()
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
	withSettings(verbose?: boolean, quiet?: boolean, useColor?: boolean, showThinking?: boolean): CLILogger {
		return new CLILogger(
			verbose ?? this.isVerbose,
			quiet ?? this.isQuiet,
			useColor ?? this.useColor,
			showThinking ?? this.showThinking,
		)
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
