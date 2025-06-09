import { parseXml } from "../../../utils/xml"
import {
	QuestionData,
	QuestionSuggestion,
	QuestionResponse,
	ParsedSuggestions,
	QuestionHandlingError,
	QuestionError,
} from "../types/question-types"

/**
 * Service for processing and validating question data
 *
 * Handles XML parsing of suggestions, validation, and normalization
 * of question data across different platforms.
 */
export class QuestionProcessor {
	/**
	 * Parse XML follow_up content into structured suggestions
	 *
	 * @param followUpXml Raw XML content containing <suggest> tags
	 * @returns Parsed suggestions with any errors encountered
	 */
	static parseFollowUpSuggestions(followUpXml: string): ParsedSuggestions {
		const errors: string[] = []
		let suggestions: QuestionSuggestion[] = []

		if (!followUpXml || !followUpXml.trim()) {
			return { suggestions: [], errors }
		}

		try {
			// Parse XML content expecting <suggest> tags
			const parsedSuggest = parseXml(followUpXml, ["suggest"]) as {
				suggest: QuestionSuggestion[] | QuestionSuggestion
			}

			// Normalize to array format
			const normalizedSuggest = Array.isArray(parsedSuggest?.suggest)
				? parsedSuggest.suggest
				: [parsedSuggest?.suggest].filter((sug): sug is QuestionSuggestion => sug !== undefined)

			suggestions = normalizedSuggest.map((sug) => ({
				answer: typeof sug === "string" ? sug : sug.answer || "",
				metadata: typeof sug === "object" && sug.metadata ? sug.metadata : {},
			}))
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			errors.push(`Failed to parse suggestions XML: ${errorMessage}`)
		}

		return { suggestions, errors }
	}

	/**
	 * Validate question data structure
	 *
	 * @param data Question data to validate
	 * @returns true if valid, error message if invalid
	 */
	static validateQuestionData(data: QuestionData): true | string {
		if (!data) {
			return "Question data is required"
		}

		if (!data.question || typeof data.question !== "string") {
			return "Question text is required and must be a string"
		}

		if (data.question.trim().length === 0) {
			return "Question text cannot be empty"
		}

		if (data.suggestions) {
			if (!Array.isArray(data.suggestions)) {
				return "Suggestions must be an array"
			}

			for (let i = 0; i < data.suggestions.length; i++) {
				const suggestion = data.suggestions[i]
				if (!suggestion || typeof suggestion !== "object") {
					return `Suggestion at index ${i} must be an object`
				}
				if (!suggestion.answer || typeof suggestion.answer !== "string") {
					return `Suggestion at index ${i} must have a valid answer string`
				}
				if (suggestion.answer.trim().length === 0) {
					return `Suggestion at index ${i} cannot have empty answer`
				}
			}
		}

		if (data.timeout !== undefined) {
			if (typeof data.timeout !== "number" || data.timeout <= 0) {
				return "Timeout must be a positive number"
			}
		}

		return true
	}

	/**
	 * Create question data from raw parameters (legacy compatibility)
	 *
	 * @param question Question text
	 * @param followUpXml Optional XML containing suggestions
	 * @param partial Whether this is a partial question
	 * @param context Optional context data
	 * @returns Structured question data
	 */
	static createQuestionData(
		question: string,
		followUpXml?: string,
		partial?: boolean,
		context?: Record<string, any>,
	): QuestionData {
		const questionData: QuestionData = {
			question: question || "",
			partial: partial || false,
		}

		// Add context if provided
		if (context) {
			questionData.context = {
				data: context,
			}
		}

		// Parse suggestions if provided
		if (followUpXml) {
			const parsed = this.parseFollowUpSuggestions(followUpXml)
			if (parsed.suggestions.length > 0) {
				questionData.suggestions = parsed.suggestions
			}
			if (parsed.errors && parsed.errors.length > 0) {
				// Add errors to metadata for debugging
				questionData.metadata = {
					parseErrors: parsed.errors,
				}
			}
		}

		return questionData
	}

	/**
	 * Format response for tool result (legacy compatibility)
	 *
	 * @param response Question response
	 * @returns Formatted response string
	 */
	static formatResponseForTool(response: QuestionResponse): string {
		return `<answer>\n${response.text}\n</answer>`
	}

	/**
	 * Create a question handling error
	 *
	 * @param type Error type
	 * @param message Error message
	 * @param originalError Original error if any
	 * @returns QuestionHandlingError instance
	 */
	static createError(type: QuestionError, message: string, originalError?: Error): QuestionHandlingError {
		return new QuestionHandlingError(type, message, originalError)
	}

	/**
	 * Sanitize user input for security
	 *
	 * @param input Raw user input
	 * @returns Sanitized input
	 */
	static sanitizeInput(input: string): string {
		if (!input || typeof input !== "string") {
			return ""
		}

		// Basic sanitization - remove control characters but preserve formatting
		return input
			.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars except \n, \r, \t
			.trim()
	}

	/**
	 * Truncate long responses to reasonable length
	 *
	 * @param text Text to truncate
	 * @param maxLength Maximum length (default: 10000)
	 * @returns Truncated text
	 */
	static truncateResponse(text: string, maxLength: number = 10000): string {
		if (!text || text.length <= maxLength) {
			return text
		}

		return text.substring(0, maxLength) + "\n[... response truncated ...]"
	}
}
