import { IQuestionStore, QuestionData } from "../interfaces/IQuestionSystem"
import { ApiQuestionManager, ApiQuestion } from "../../../api/questions/ApiQuestionManager"

/**
 * Persistent implementation of IQuestionStore
 * Wraps existing ApiQuestionManager for persistent storage
 */
export class PersistentQuestionStore implements IQuestionStore {
	private questionIdMapping = new Map<string, string>() // Maps UnifiedQuestionManager IDs to ApiQuestionManager IDs

	constructor(private questionManager: ApiQuestionManager) {}

	/**
	 * Store a question and return its ID
	 */
	storeQuestion(question: QuestionData): string {
		// Convert QuestionData to ApiQuestionManager format and create it asynchronously
		const suggestions = this.convertToApiSuggestions(question)
		const jobId = this.extractJobId(question)

		// Create the question in ApiQuestionManager asynchronously
		// We don't await here to keep the interface synchronous
		this.questionManager
			.createQuestion(jobId, question.question, suggestions)
			.then(({ questionId: apiQuestionId }) => {
				// Map the UnifiedQuestionManager ID to the ApiQuestionManager ID
				this.questionIdMapping.set(question.id, apiQuestionId)

				console.log(`[PersistentQuestionStore] Stored question:`, {
					unifiedId: question.id,
					apiId: apiQuestionId,
					jobId,
					question: question.question,
					suggestions: suggestions.length,
				})
			})
			.catch((error) => {
				console.error(`[PersistentQuestionStore] Failed to store question:`, error)
				// Remove from mapping on error
				this.questionIdMapping.delete(question.id)
			})

		return question.id // Return the original ID immediately
	}

	/**
	 * Get a question by its ID
	 */
	getQuestion(questionId: string): QuestionData | undefined {
		// First check if we have a mapping to the ApiQuestionManager ID
		const apiQuestionId = this.questionIdMapping.get(questionId)
		if (apiQuestionId) {
			const apiQuestion = this.questionManager.getQuestion(apiQuestionId)
			if (apiQuestion) {
				return this.convertApiQuestionToQuestionData(apiQuestion)
			}
		}

		// Fallback: try the original questionId directly
		const apiQuestion = this.questionManager.getQuestion(questionId)
		if (apiQuestion) {
			return this.convertApiQuestionToQuestionData(apiQuestion)
		}

		return undefined
	}

	/**
	 * Update a question with new data
	 */
	updateQuestion(questionId: string, updates: Partial<QuestionData>): void {
		// ApiQuestionManager handles updates internally
		// We can't directly update the ApiQuestion, but we can store the updates
		// in the metadata field if needed
		const existingQuestion = this.getQuestion(questionId)
		if (existingQuestion && updates.metadata) {
			// Store updates in a way that can be retrieved later
			// This is a limitation of the current ApiQuestionManager interface
		}
	}

	/**
	 * Remove a question from storage
	 */
	removeQuestion(questionId: string): void {
		// ApiQuestionManager doesn't have a direct remove method
		// But questions are cleaned up when they're answered or cancelled
		// We could cancel the question to remove it
		this.questionManager.cancelQuestion(questionId, "Removed by unified question system")
	}

	/**
	 * Get all questions currently in storage
	 */
	getAllQuestions(): QuestionData[] {
		// ApiQuestionManager doesn't expose all questions directly
		// We'll need to track questions separately or enhance ApiQuestionManager
		// For now, return empty array
		return []
	}

	/**
	 * Get all questions of a specific type
	 */
	getQuestionsByType(type: QuestionData["type"]): QuestionData[] {
		// Similar limitation - ApiQuestionManager doesn't track question types
		return this.getAllQuestions().filter((q) => q.type === type)
	}

	/**
	 * Get questions for a specific job
	 */
	getQuestionsByJob(jobId: string): QuestionData[] {
		const apiQuestions = this.questionManager.getJobQuestions(jobId)
		return apiQuestions.map((q) => this.convertApiQuestionToQuestionData(q))
	}

	/**
	 * Get pending questions for a specific job
	 */
	getPendingQuestionsByJob(jobId: string): QuestionData[] {
		const apiQuestions = this.questionManager.getPendingQuestions(jobId)
		return apiQuestions.map((q) => this.convertApiQuestionToQuestionData(q))
	}

	/**
	 * Clear all questions from storage
	 */
	clear(): void {
		// ApiQuestionManager doesn't have a clear method
		// We could cancel all questions
		const stats = this.questionManager.getStats()
		// This is a limitation - we can't directly clear all questions
	}

	/**
	 * Get storage statistics
	 */
	getStatistics(): {
		total: number
		byType: Record<string, number>
		oldestTimestamp?: Date
		newestTimestamp?: Date
	} {
		const stats = this.questionManager.getStats()

		return {
			total: stats.total,
			byType: {}, // ApiQuestionManager doesn't track types
			oldestTimestamp: undefined, // Would need to iterate through questions
			newestTimestamp: undefined,
		}
	}

	/**
	 * Convert ApiQuestion to QuestionData
	 */
	private convertApiQuestionToQuestionData(apiQuestion: ApiQuestion): QuestionData {
		return {
			id: apiQuestion.id,
			type: this.inferQuestionType(apiQuestion),
			question: apiQuestion.question,
			options: this.extractOptions(apiQuestion),
			timestamp: apiQuestion.createdAt,
			metadata: {
				jobId: apiQuestion.jobId,
				state: apiQuestion.state,
				answer: apiQuestion.answer,
				answeredAt: apiQuestion.answeredAt,
				timeout: apiQuestion.timeout,
				suggestions: apiQuestion.suggestions,
			},
		}
	}

	/**
	 * Infer question type from ApiQuestion structure
	 */
	private inferQuestionType(apiQuestion: ApiQuestion): QuestionData["type"] {
		// We'll need to infer the type from the suggestions or question content
		// This is a limitation of the current ApiQuestion interface
		const suggestions = apiQuestion.suggestions || []

		// If there are exactly 2 suggestions that look like Yes/No, it's a confirmation
		if (suggestions.length === 2) {
			// Handle both string and object formats safely
			const answers = suggestions.map((s) => {
				// Cast to any to handle mixed types safely
				const suggestion = s as any
				if (typeof suggestion === "string") {
					return suggestion.toLowerCase()
				}
				if (typeof suggestion === "object" && suggestion !== null && "answer" in suggestion) {
					return suggestion.answer.toLowerCase()
				}
				return String(suggestion).toLowerCase()
			})

			if (answers.includes("yes") && answers.includes("no")) {
				return "confirmation"
			}
		}

		// If there are no suggestions, it's likely an input
		if (suggestions.length === 0) {
			return "input"
		}

		// Otherwise, it's a question
		return "question"
	}

	/**
	 * Extract options from ApiQuestion
	 */
	private extractOptions(apiQuestion: ApiQuestion): any {
		const type = this.inferQuestionType(apiQuestion)
		const suggestions = apiQuestion.suggestions || []

		// Normalize suggestions to handle both string and object formats
		const normalizedSuggestions = suggestions.map((s) => {
			// Cast to any to handle mixed types safely
			const suggestion = s as any
			if (typeof suggestion === "string") {
				return { answer: suggestion }
			}
			if (typeof suggestion === "object" && suggestion !== null && "answer" in suggestion) {
				return suggestion
			}
			// Fallback for unexpected formats
			return { answer: String(suggestion) }
		})

		switch (type) {
			case "question":
				return {
					choices: normalizedSuggestions.map((s) => s.answer),
					defaultChoice: normalizedSuggestions[0]?.answer,
				}

			case "confirmation":
				return {
					yesText: normalizedSuggestions.find((s) => s.answer.toLowerCase().includes("yes"))?.answer || "Yes",
					noText: normalizedSuggestions.find((s) => s.answer.toLowerCase().includes("no"))?.answer || "No",
				}

			case "input":
				return {
					placeholder: normalizedSuggestions[0]?.answer || undefined,
				}

			default:
				return undefined
		}
	}

	/**
	 * Convert QuestionData to ApiQuestionManager suggestions format
	 */
	private convertToApiSuggestions(question: QuestionData): Array<{ answer: string }> {
		if (!question.options) {
			return []
		}

		// Handle different question types
		switch (question.type) {
			case "question": {
				const questionOptions = question.options as any
				if (questionOptions.choices && Array.isArray(questionOptions.choices)) {
					return questionOptions.choices.map((choice: string) => ({ answer: choice }))
				}
				break
			}

			case "confirmation": {
				const confirmOptions = question.options as any
				return [{ answer: confirmOptions.yesText || "Yes" }, { answer: confirmOptions.noText || "No" }]
			}

			case "input": {
				const inputOptions = question.options as any
				if (inputOptions.placeholder) {
					return [{ answer: inputOptions.placeholder }]
				}
				break
			}
		}

		return []
	}

	/**
	 * Extract job ID from QuestionData metadata
	 */
	private extractJobId(question: QuestionData): string {
		// Try to extract jobId from metadata
		if (question.metadata?.jobId) {
			return question.metadata.jobId
		}

		// Fallback: derive jobId from question ID or use a default
		// UnifiedQuestionManager IDs are in format: q_${timestamp}_${random}
		// We need to convert this to a format compatible with ApiQuestionManager
		if (question.id.startsWith("q_")) {
			// Extract timestamp from the ID and create a job ID
			const parts = question.id.split("_")
			if (parts.length >= 2) {
				return `job_${parts[1]}`
			}
		}

		// Ultimate fallback
		return `job_${Date.now()}`
	}
}
