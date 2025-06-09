import { IQuestionHandler } from "../interfaces/IQuestionHandler"
import { QuestionData, QuestionResponse, QuestionHandlingError, QuestionError } from "../types/question-types"
import { QuestionProcessor } from "./QuestionProcessor"

/**
 * Service that coordinates question handling between tools and handlers
 *
 * This service acts as the bridge between the askFollowupQuestionTool
 * and the various platform-specific question handlers.
 */
export class TaskQuestionService {
	private handler: IQuestionHandler
	private logger?: any

	constructor(handler: IQuestionHandler, logger?: any) {
		this.handler = handler
		this.logger = logger
	}

	/**
	 * Ask a followup question using the configured handler
	 *
	 * @param questionText The question to ask
	 * @param followUpXml Optional XML containing suggestions
	 * @param partial Whether this is a partial question
	 * @param context Optional context data
	 * @returns Promise resolving to the user's response
	 */
	async askFollowupQuestion(
		questionText: string,
		followUpXml?: string,
		partial?: boolean,
		context?: Record<string, any>,
	): Promise<QuestionResponse> {
		// Create structured question data
		const questionData = QuestionProcessor.createQuestionData(questionText, followUpXml, partial, context)

		// Log the question if logger is available
		if (this.logger && typeof this.logger.logDebug === "function") {
			this.logger.logDebug(`Asking question: ${questionText}`)
			if (questionData.suggestions?.length) {
				this.logger.logDebug(`With ${questionData.suggestions.length} suggestions`)
			}
		}

		try {
			// Delegate to the handler
			const response = await this.handler.askQuestion(questionData)

			// Truncate very long responses for sanity
			if (response.text && response.text.length > 10000) {
				response.text = QuestionProcessor.truncateResponse(response.text)
			}

			// Log the response if logger is available
			if (this.logger && typeof this.logger.logDebug === "function") {
				this.logger.logDebug(
					`Received response: ${response.text.substring(0, 100)}${response.text.length > 100 ? "..." : ""}`,
				)
				if (response.fromSuggestion) {
					this.logger.logDebug(`Response was from suggestion ${response.suggestionIndex}`)
				}
			}

			return response
		} catch (error) {
			// Log the error if logger is available
			if (this.logger && typeof this.logger.logError === "function") {
				this.logger.logError(
					`Question handling failed: ${error instanceof Error ? error.message : String(error)}`,
				)
			}

			// Re-throw if it's already a QuestionHandlingError
			if (error instanceof QuestionHandlingError) {
				throw error
			}

			// Wrap other errors
			throw QuestionProcessor.createError(
				QuestionError.HANDLER_ERROR,
				`Question handling failed: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined,
			)
		}
	}

	/**
	 * Ask a question with direct QuestionData (advanced usage)
	 *
	 * @param questionData Structured question data
	 * @returns Promise resolving to the user's response
	 */
	async askQuestion(questionData: QuestionData): Promise<QuestionResponse> {
		return await this.handler.askQuestion(questionData)
	}

	/**
	 * Check if the handler supports a specific feature
	 *
	 * @param feature Feature to check
	 * @returns true if supported
	 */
	supportsFeature(feature: any): boolean {
		return this.handler.supportsFeature(feature)
	}

	/**
	 * Get handler capabilities
	 *
	 * @returns Handler capabilities
	 */
	getCapabilities() {
		return this.handler.getCapabilities()
	}

	/**
	 * Get the platform of the current handler
	 *
	 * @returns Platform identifier
	 */
	getPlatform(): string {
		return this.handler.getPlatform()
	}

	/**
	 * Format response for tool result (legacy compatibility)
	 *
	 * @param response Question response
	 * @returns Formatted response string for tool result
	 */
	formatResponseForTool(response: QuestionResponse): string {
		return QuestionProcessor.formatResponseForTool(response)
	}

	/**
	 * Create error response for tool (legacy compatibility)
	 *
	 * @param errorType Error type
	 * @param message Error message
	 * @returns Formatted error response
	 */
	createErrorResponse(errorType: QuestionError, message: string): string {
		// This would integrate with the existing formatResponse system
		return `Error: ${message}`
	}
}
