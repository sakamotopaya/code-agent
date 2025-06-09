import { QuestionData, QuestionResponse, QuestionCapabilities, QuestionFeature } from "../types/question-types"

/**
 * Core interface for platform-agnostic question handling
 *
 * Implementations of this interface handle asking followup questions
 * in different environments (VSCode, CLI, web, message queues, etc.)
 */
export interface IQuestionHandler {
	/**
	 * Ask a followup question and wait for response
	 *
	 * @param data Question data including text and suggestions
	 * @returns Promise resolving to the user's response
	 * @throws QuestionHandlingError for various error conditions
	 */
	askQuestion(data: QuestionData): Promise<QuestionResponse>

	/**
	 * Check if handler supports a specific feature
	 *
	 * @param feature Feature to check
	 * @returns true if feature is supported
	 */
	supportsFeature(feature: QuestionFeature): boolean

	/**
	 * Get handler capabilities
	 *
	 * @returns Capabilities object describing what this handler supports
	 */
	getCapabilities(): QuestionCapabilities

	/**
	 * Get handler platform identifier
	 *
	 * @returns Platform name (e.g., 'vscode', 'cli', 'web', 'messagequeue')
	 */
	getPlatform(): string

	/**
	 * Initialize the handler (if needed)
	 * Called once before first use
	 *
	 * @param config Optional configuration
	 */
	initialize?(config?: Record<string, any>): Promise<void>

	/**
	 * Cleanup handler resources (if needed)
	 * Called when handler is no longer needed
	 */
	dispose?(): Promise<void>

	/**
	 * Validate question data before processing
	 *
	 * @param data Question data to validate
	 * @returns true if valid, error message if invalid
	 */
	validateQuestion?(data: QuestionData): true | string
}

/**
 * Factory function type for creating question handlers
 */
export type QuestionHandlerFactory = (config?: Record<string, any>) => IQuestionHandler

/**
 * Registry entry for a question handler
 */
export interface QuestionHandlerRegistration {
	/** Unique identifier for this handler */
	id: string
	/** Human-readable name */
	name: string
	/** Factory function to create handler instances */
	factory: QuestionHandlerFactory
	/** Priority for automatic selection (higher = preferred) */
	priority: number
	/** Function to detect if this handler should be used automatically */
	detector?: () => boolean
}
