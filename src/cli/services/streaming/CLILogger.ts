/**
 * Refactored CLI Logger with SOLID principles and dependency injection
 * Replaces the original CLILogger.streamLLMOutput with MessageBuffer integration
 */

import chalk from "chalk"
import { formatDebugMessage } from "../CLILogger"
import {
	IContentProcessor,
	IDisplayFormatter,
	IOutputWriter,
	IStateManager,
	IStreamingLogger,
	DisplayContext,
} from "./interfaces"
import { CLIContentProcessor } from "./CLIContentProcessor"
import { CLIDisplayFormatter } from "./CLIDisplayFormatter"
import { ConsoleOutputWriter } from "./ConsoleOutputWriter"

/**
 * State manager for CLI streaming
 * Single Responsibility: Only handles state management
 */
export class CLIStateManager implements IStateManager {
	private displayedToolNames = new Set<string>()
	private showThinking: boolean

	constructor(showThinking: boolean = false) {
		this.showThinking = showThinking
	}

	reset(): void {
		this.displayedToolNames.clear()
	}

	shouldShowThinking(): boolean {
		return this.showThinking
	}

	hasDisplayedTool(toolName: string): boolean {
		return this.displayedToolNames.has(toolName)
	}

	markToolDisplayed(toolName: string): void {
		this.displayedToolNames.add(toolName)
	}

	setShowThinking(show: boolean): void {
		this.showThinking = show
	}
}

/**
 * Refactored CLILogger using dependency injection and SOLID principles
 * Replaces the manual XML parsing with MessageBuffer integration
 */
export class CLILogger implements IStreamingLogger, IStateManager {
	private contentProcessor: IContentProcessor
	private displayFormatter: IDisplayFormatter
	private outputWriter: IOutputWriter
	private stateManager: IStateManager
	private useColor: boolean
	private isVerbose: boolean

	constructor(
		contentProcessor?: IContentProcessor,
		displayFormatter?: IDisplayFormatter,
		outputWriter?: IOutputWriter,
		stateManager?: IStateManager,
		options: {
			useColor?: boolean
			showThinking?: boolean
			isVerbose?: boolean
			isQuiet?: boolean
		} = {},
	) {
		// Default options
		const { useColor = true, showThinking = false, isVerbose = false, isQuiet = false } = options

		this.useColor = useColor
		this.isVerbose = isVerbose

		// Dependency injection with defaults (Dependency Inversion Principle)
		this.contentProcessor = contentProcessor || new CLIContentProcessor()
		this.displayFormatter = displayFormatter || new CLIDisplayFormatter(useColor, showThinking)
		this.outputWriter = outputWriter || new ConsoleOutputWriter(isQuiet)
		this.stateManager = stateManager || new CLIStateManager(showThinking)
	}

	/**
	 * Process and display streaming content
	 * Single Responsibility: Orchestrate the streaming workflow
	 */
	streamContent(content: string): void {
		try {
			// Debug output if verbose
			if (this.isVerbose) {
				console.error(
					formatDebugMessage(
						`[CLILogger.streamContent] Processing content: ${content.substring(0, 100)}...`,
						this.useColor,
					),
				)
			}

			// Process content through MessageBuffer
			const processedMessages = this.contentProcessor.processContent(content)

			if (this.isVerbose) {
				console.error(
					formatDebugMessage(
						`[CLILogger.streamContent] Processed ${processedMessages.length} messages`,
						this.useColor,
					),
				)
			}

			// Format and display each message
			for (const message of processedMessages) {
				const displayContext: DisplayContext = {
					useColor: this.useColor,
					showThinking: this.stateManager.shouldShowThinking(),
					hasDisplayedTool: (toolName: string) => this.stateManager.hasDisplayedTool(toolName),
					markToolDisplayed: (toolName: string) => this.stateManager.markToolDisplayed(toolName),
				}

				// Handle tool call display logic
				if (message.contentType === "tool_call" && message.toolName) {
					if (!this.stateManager.hasDisplayedTool(message.toolName)) {
						const toolIndicator = this.displayFormatter.formatToolIndicator(message.toolName)
						if (toolIndicator) {
							this.outputWriter.write(toolIndicator)
						}
						this.stateManager.markToolDisplayed(message.toolName)

						if (this.isVerbose) {
							console.error(
								formatDebugMessage(
									`[CLILogger.streamContent] Displayed tool: ${message.toolName}`,
									this.useColor,
								),
							)
						}
					}
					// Skip the tool content itself
					continue
				}

				// Format the message for display
				const formatted = this.displayFormatter.formatContent(message)
				if (formatted) {
					this.outputWriter.write(formatted)
				}
			}
		} catch (error) {
			console.error("[CLILogger.streamContent] Error processing content:", error)
			// Fallback: display content as-is to ensure streaming continues
			if (content) {
				this.outputWriter.write(content)
			}
		}
	}

	/**
	 * Reset streaming state for new task
	 */
	reset(): void {
		try {
			this.contentProcessor.reset()
			this.stateManager.reset()
		} catch (error) {
			console.error("[CLILogger.reset] Error during reset:", error)
		}
	}

	// IStateManager delegation methods
	shouldShowThinking(): boolean {
		return this.stateManager.shouldShowThinking()
	}

	hasDisplayedTool(toolName: string): boolean {
		return this.stateManager.hasDisplayedTool(toolName)
	}

	markToolDisplayed(toolName: string): void {
		this.stateManager.markToolDisplayed(toolName)
	}

	/**
	 * Legacy method compatibility - maps to streamContent
	 * Preserves existing API for gradual migration
	 */
	streamLLMOutput(content: string): void {
		this.streamContent(content)
	}

	/**
	 * Reset tool display tracking (legacy compatibility)
	 */
	resetToolDisplay(): void {
		this.stateManager.reset()
	}

	/**
	 * Clear current line (delegates to output writer)
	 */
	clearLine(): void {
		this.outputWriter.clearLine()
	}

	/**
	 * Format markdown content (delegates to display formatter)
	 */
	formatMarkdown(content: string): string {
		return this.displayFormatter.formatMarkdown(content)
	}

	/**
	 * Create a new logger with different settings (factory method)
	 * Liskov Substitution: Returns same interface type
	 */
	withSettings(verbose?: boolean, quiet?: boolean, useColor?: boolean, showThinking?: boolean): CLILogger {
		const newOptions = {
			useColor: useColor ?? this.useColor,
			showThinking: showThinking ?? this.stateManager.shouldShowThinking(),
			isVerbose: verbose ?? this.isVerbose,
			isQuiet: quiet ?? false,
		}

		return new CLILogger(
			undefined, // Use default content processor
			undefined, // Use default display formatter
			undefined, // Use default output writer
			undefined, // Use default state manager
			newOptions,
		)
	}

	/**
	 * Get current content processor (for testing)
	 */
	getContentProcessor(): IContentProcessor {
		return this.contentProcessor
	}

	/**
	 * Get current display formatter (for testing)
	 */
	getDisplayFormatter(): IDisplayFormatter {
		return this.displayFormatter
	}

	/**
	 * Get current output writer (for testing)
	 */
	getOutputWriter(): IOutputWriter {
		return this.outputWriter
	}

	/**
	 * Get current state manager (for testing)
	 */
	getStateManager(): IStateManager {
		return this.stateManager
	}
}
