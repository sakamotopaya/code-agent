import { IQuestionStore, QuestionData } from "../interfaces/IQuestionSystem"

/**
 * In-memory implementation of IQuestionStore
 * Used for VSCode and CLI modes where persistence is not required
 */
export class InMemoryQuestionStore implements IQuestionStore {
	private questions = new Map<string, QuestionData>()

	/**
	 * Store a question and return its ID
	 */
	storeQuestion(question: QuestionData): string {
		this.questions.set(question.id, { ...question })
		return question.id
	}

	/**
	 * Get a question by its ID
	 */
	getQuestion(questionId: string): QuestionData | undefined {
		const question = this.questions.get(questionId)
		return question ? { ...question } : undefined
	}

	/**
	 * Update a question with new data
	 */
	updateQuestion(questionId: string, updates: Partial<QuestionData>): void {
		const existing = this.questions.get(questionId)
		if (existing) {
			const updated = { ...existing, ...updates }
			// Preserve timestamp if not explicitly updated
			if (!updates.timestamp) {
				updated.timestamp = existing.timestamp
			}
			this.questions.set(questionId, updated)
		}
	}

	/**
	 * Remove a question from storage
	 */
	removeQuestion(questionId: string): void {
		this.questions.delete(questionId)
	}

	/**
	 * Get all questions currently in storage
	 */
	getAllQuestions(): QuestionData[] {
		return Array.from(this.questions.values()).map((q) => ({ ...q }))
	}

	/**
	 * Get all questions of a specific type
	 */
	getQuestionsByType(type: QuestionData["type"]): QuestionData[] {
		return this.getAllQuestions().filter((q) => q.type === type)
	}

	/**
	 * Get questions within a time range
	 */
	getQuestionsByTimeRange(start: Date, end: Date): QuestionData[] {
		return this.getAllQuestions().filter((q) => q.timestamp >= start && q.timestamp <= end)
	}

	/**
	 * Clear all questions from storage
	 */
	clear(): void {
		this.questions.clear()
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
		const questions = this.getAllQuestions()
		const stats = {
			total: questions.length,
			byType: {} as Record<string, number>,
			oldestTimestamp: undefined as Date | undefined,
			newestTimestamp: undefined as Date | undefined,
		}

		if (questions.length === 0) {
			return stats
		}

		// Count by type
		questions.forEach((q) => {
			stats.byType[q.type] = (stats.byType[q.type] || 0) + 1
		})

		// Find timestamp range
		const timestamps = questions.map((q) => q.timestamp).sort((a, b) => a.getTime() - b.getTime())
		stats.oldestTimestamp = timestamps[0]
		stats.newestTimestamp = timestamps[timestamps.length - 1]

		return stats
	}
}
