/**
 * CLI Display Formatter - implements Single Responsibility Principle
 * Only responsible for formatting content for display using Strategy pattern
 */

import chalk from "chalk"
import { ProcessedMessage, ContentType } from "../../../api/streaming/MessageBuffer"
import { IDisplayFormatter, IContentTypeHandler, DisplayContext } from "./interfaces"
import { ContentHandlerFactory } from "./ContentHandlers"

/**
 * CLIDisplayFormatter handles display formatting using Strategy pattern
 * Single Responsibility: Format content for CLI display
 * Open/Closed: Extensible via content type handlers
 */
export class CLIDisplayFormatter implements IDisplayFormatter {
	private contentHandlers: Map<ContentType, IContentTypeHandler>
	private useColor: boolean
	private showThinking: boolean

	constructor(useColor: boolean = true, showThinking: boolean = false, customHandlers: IContentTypeHandler[] = []) {
		this.useColor = useColor
		this.showThinking = showThinking

		// Initialize with default handlers
		this.contentHandlers = ContentHandlerFactory.createHandlersRegistry()

		// Register any custom handlers (Open/Closed Principle)
		this.registerCustomHandlers(customHandlers)
	}

	/**
	 * Format a processed message for display
	 * Strategy Pattern: delegates to appropriate content handler
	 */
	formatContent(message: ProcessedMessage): string | null {
		try {
			// Validate input
			if (!message || typeof message !== "object") {
				console.error("[CLIDisplayFormatter] Invalid message object:", message)
				return null
			}

			if (!message.contentType) {
				console.error("[CLIDisplayFormatter] Message missing contentType:", message)
				return null
			}

			// Get appropriate handler for content type
			const handler = this.contentHandlers.get(message.contentType)
			if (!handler) {
				// Fallback for unknown content types
				return this.formatDefault(message)
			}

			// Create display context
			const context: DisplayContext = {
				useColor: this.useColor,
				showThinking: this.showThinking,
			}

			// Delegate to handler
			const result = handler.handle(message, context)
			return result?.displayText || null
		} catch (error) {
			console.error("[CLIDisplayFormatter] Error formatting content:", error)
			// Fallback to basic content display
			return this.formatDefault(message)
		}
	}

	/**
	 * Format a tool indicator for display
	 */
	formatToolIndicator(toolName: string): string {
		if (!toolName || typeof toolName !== "string") {
			return ""
		}

		const toolDisplay = this.useColor ? chalk.yellow(`${toolName}...`) : `${toolName}...`

		return `\n${toolDisplay}\n`
	}

	/**
	 * Register custom content handlers (Open/Closed Principle)
	 */
	registerHandler(handler: IContentTypeHandler): void {
		const contentTypes: ContentType[] = ["content", "thinking", "tool_call", "system", "tool_result"]

		for (const contentType of contentTypes) {
			if (handler.canHandle(contentType)) {
				this.contentHandlers.set(contentType, handler)
			}
		}
	}

	/**
	 * Register multiple custom handlers
	 */
	registerCustomHandlers(handlers: IContentTypeHandler[]): void {
		for (const handler of handlers) {
			this.registerHandler(handler)
		}
	}

	/**
	 * Get registered handler for content type (for testing)
	 */
	getHandler(contentType: ContentType): IContentTypeHandler | undefined {
		return this.contentHandlers.get(contentType)
	}

	/**
	 * Format markdown content for terminal display
	 * Preserved from original CLILogger for consistency
	 */
	formatMarkdown(content: string): string {
		if (!content || typeof content !== "string") {
			return ""
		}

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
	 * Fallback formatting for unknown content types
	 */
	private formatDefault(message: ProcessedMessage): string | null {
		if (!message.content) {
			return null
		}

		// Default to treating as regular content
		return message.content
	}
}
