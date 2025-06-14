/**
 * SOLID-based interfaces for CLI streaming content processing
 */

import { ProcessedMessage, ContentType } from "../../../api/streaming/MessageBuffer"

/**
 * Display context for content formatting
 */
export interface DisplayContext {
	useColor: boolean
	showThinking: boolean
	hasDisplayedTool?: (toolName: string) => boolean
	markToolDisplayed?: (toolName: string) => void
}

/**
 * Result of content display processing
 */
export interface DisplayResult {
	displayText: string
	shouldClearLine?: boolean
}

/**
 * Interface for processing streaming content
 * Single Responsibility: Only handles content processing
 */
export interface IContentProcessor {
	/**
	 * Process streaming content and return classified messages
	 */
	processContent(content: string): ProcessedMessage[]

	/**
	 * Reset processing state for new task
	 */
	reset(): void
}

/**
 * Interface for formatting content for display
 * Single Responsibility: Only handles display formatting
 */
export interface IDisplayFormatter {
	/**
	 * Format a processed message for display
	 * @returns formatted string or null if content should be hidden
	 */
	formatContent(message: ProcessedMessage): string | null

	/**
	 * Format a tool indicator for display
	 */
	formatToolIndicator(toolName: string): string

	/**
	 * Format markdown content for terminal display
	 */
	formatMarkdown(content: string): string
}

/**
 * Interface for writing output to terminal/console
 * Single Responsibility: Only handles output operations
 */
export interface IOutputWriter {
	/**
	 * Write content to output
	 */
	write(content: string): void

	/**
	 * Write a tool indicator
	 */
	writeToolIndicator(toolName: string): void

	/**
	 * Clear current line
	 */
	clearLine(): void
}

/**
 * Interface for managing streaming state
 * Single Responsibility: Only handles state management
 */
export interface IStateManager {
	/**
	 * Reset all state for new task
	 */
	reset(): void

	/**
	 * Check if thinking content should be shown
	 */
	shouldShowThinking(): boolean

	/**
	 * Check if a tool has been displayed
	 */
	hasDisplayedTool(toolName: string): boolean

	/**
	 * Mark a tool as displayed
	 */
	markToolDisplayed(toolName: string): void
}

/**
 * Interface for handling specific content types
 * Open/Closed Principle: Extensible for new content types
 */
export interface IContentTypeHandler {
	/**
	 * Check if this handler can process the given content type
	 */
	canHandle(contentType: ContentType): boolean

	/**
	 * Handle the specific content type
	 * @returns display result or null if content should be hidden
	 */
	handle(message: ProcessedMessage, context: DisplayContext): DisplayResult | null
}

/**
 * Main streaming logger interface
 * Interface Segregation: Focused on streaming concerns
 */
export interface IStreamingLogger {
	/**
	 * Process and display streaming content
	 */
	streamContent(content: string): void

	/**
	 * Reset streaming state
	 */
	reset(): void
}
