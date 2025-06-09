import { IQuestionHandler } from "../interfaces/IQuestionHandler"
import {
	QuestionData,
	QuestionResponse,
	QuestionCapabilities,
	QuestionFeature,
	QuestionHandlingError,
	QuestionError,
} from "../types/question-types"
import { QuestionProcessor } from "../services/QuestionProcessor"

/**
 * CLI implementation of the question handler interface
 *
 * Uses inquirer.js through PromptManager for interactive console prompts
 */
export class CLIQuestionHandler implements IQuestionHandler {
	private promptManager: any
	private logger: any

	constructor(promptManager: any, logger?: any) {
		this.promptManager = promptManager
		this.logger = logger
	}

	async askQuestion(data: QuestionData): Promise<QuestionResponse> {
		// Validate input
		const validation = QuestionProcessor.validateQuestionData(data)
		if (validation !== true) {
			throw QuestionProcessor.createError(QuestionError.INVALID_INPUT, validation)
		}

		try {
			// Handle partial questions (for streaming scenarios)
			if (data.partial) {
				// For CLI, we can't really show partial questions effectively
				// So we'll just log the partial question and return an empty response
				if (this.logger) {
					this.logger.debug(`Partial question: ${data.question}`)
				}
				return {
					text: "",
					timestamp: new Date(),
				}
			}

			let response: string

			// If we have suggestions, show them as a selection list
			if (data.suggestions && data.suggestions.length > 0) {
				const choices = data.suggestions.map((suggestion, index) => ({
					name: suggestion.answer,
					value: index.toString(),
				}))

				// Add a custom input option
				choices.push({
					name: "(Custom answer)",
					value: "custom",
				})

				const selection = await this.promptManager.promptSelect({
					message: data.question,
					choices,
				})

				if (selection === "custom") {
					// Get custom input
					response = await this.promptManager.promptText({
						message: "Enter your custom answer:",
						validate: (input: string) => {
							if (!input || input.trim().length === 0) {
								return "Answer cannot be empty"
							}
							return true
						},
					})
				} else {
					// Use selected suggestion
					const suggestionIndex = parseInt(selection)
					response = data.suggestions[suggestionIndex].answer

					return {
						text: QuestionProcessor.sanitizeInput(response),
						fromSuggestion: true,
						suggestionIndex,
						timestamp: new Date(),
					}
				}
			} else {
				// No suggestions, just ask for text input
				response = await this.promptManager.promptText({
					message: data.question,
					validate: (input: string) => {
						if (!input || input.trim().length === 0) {
							return "Answer cannot be empty"
						}
						return true
					},
				})
			}

			return {
				text: QuestionProcessor.sanitizeInput(response),
				fromSuggestion: false,
				timestamp: new Date(),
			}
		} catch (error) {
			// Handle timeout and cancellation
			if (error instanceof Error) {
				if (error.message.includes("timeout")) {
					throw QuestionProcessor.createError(
						QuestionError.TIMEOUT,
						"Question timed out waiting for user input",
						error,
					)
				}
				if (error.message.includes("cancel") || error.message.includes("interrupt")) {
					throw QuestionProcessor.createError(
						QuestionError.USER_CANCELLED,
						"User cancelled the question",
						error,
					)
				}
			}

			throw QuestionProcessor.createError(
				QuestionError.HANDLER_ERROR,
				`CLI question handler error: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined,
			)
		}
	}

	supportsFeature(feature: QuestionFeature): boolean {
		switch (feature) {
			case QuestionFeature.SUGGESTIONS:
				return true
			case QuestionFeature.TIMEOUT:
				return false // inquirer doesn't have built-in timeout support
			case QuestionFeature.IMAGES:
				return false // CLI can't display images
			case QuestionFeature.PARTIAL_QUESTIONS:
				return true // We can handle them (though limited)
			case QuestionFeature.RICH_FORMATTING:
				return false // Basic text only
			case QuestionFeature.ASYNC_RESPONSE:
				return false // CLI is synchronous
			default:
				return false
		}
	}

	getCapabilities(): QuestionCapabilities {
		return {
			features: [QuestionFeature.SUGGESTIONS, QuestionFeature.PARTIAL_QUESTIONS],
			maxSuggestions: 20, // Reasonable limit for CLI display
			supportsAsync: false,
		}
	}

	getPlatform(): string {
		return "cli"
	}

	validateQuestion(data: QuestionData): true | string {
		return QuestionProcessor.validateQuestionData(data)
	}
}

/**
 * Factory function for creating CLI question handlers
 */
export function createCLIQuestionHandler(config?: { promptManager?: any; logger?: any }): CLIQuestionHandler {
	if (!config?.promptManager) {
		throw new Error("CLI question handler requires a prompt manager")
	}

	return new CLIQuestionHandler(config.promptManager, config.logger)
}
