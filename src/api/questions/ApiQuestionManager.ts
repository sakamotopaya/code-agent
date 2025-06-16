import { promises as fs } from "fs"
import path from "path"
import { EventEmitter } from "events"
import { getStoragePath } from "../../shared/paths"

export interface ApiQuestion {
	id: string
	jobId: string
	question: string
	suggestions: Array<{ answer: string }>
	state: "pending" | "answered" | "expired" | "cancelled"
	createdAt: Date
	answeredAt?: Date
	answer?: string
	timeout?: number // Optional timeout in ms
	resolvePromise?: (answer: string) => void
	rejectPromise?: (error: Error) => void
}

export interface QuestionManagerConfig {
	storageDir?: string
	defaultTimeout?: number
	enableTimeout?: boolean
	maxConcurrentQuestions?: number
}

/**
 * Manages question lifecycle and persistent state for API tasks
 * Supports long-lived questions without forced timeouts
 */
export class ApiQuestionManager extends EventEmitter {
	private questions = new Map<string, ApiQuestion>()
	private questionCounter = 0
	private config: Required<QuestionManagerConfig>
	private storageFile: string
	private persistencePromise: Promise<void> = Promise.resolve()

	constructor(config: QuestionManagerConfig = {}) {
		super()

		this.config = {
			storageDir: config.storageDir || path.join(getStoragePath(), "questions"),
			defaultTimeout: config.defaultTimeout || 0, // Disabled by default
			enableTimeout: config.enableTimeout || false,
			maxConcurrentQuestions: config.maxConcurrentQuestions || 100,
		}

		this.storageFile = path.join(this.config.storageDir, "questions.json")

		// Initialize storage directory
		this.initializeStorage()
	}

	/**
	 * Initialize storage directory and load existing questions
	 */
	private async initializeStorage(): Promise<void> {
		try {
			await fs.mkdir(this.config.storageDir, { recursive: true })
			await this.loadPersistedQuestions()
		} catch (error) {
			console.error("Failed to initialize question storage:", error)
		}
	}

	/**
	 * Create a new question and return a Promise that resolves when answered
	 */
	async createQuestion(
		jobId: string,
		question: string,
		suggestions: Array<{ answer: string }> = [],
		timeout?: number,
	): Promise<{ questionId: string; promise: Promise<string> }> {
		// Check concurrent question limit
		const activeQuestions = Array.from(this.questions.values()).filter((q) => q.state === "pending")
		if (activeQuestions.length >= this.config.maxConcurrentQuestions) {
			throw new Error(`Maximum concurrent questions (${this.config.maxConcurrentQuestions}) exceeded`)
		}

		const questionId = `q_${jobId}_${Date.now()}_${++this.questionCounter}`

		const questionPromise = new Promise<string>((resolve, reject) => {
			const apiQuestion: ApiQuestion = {
				id: questionId,
				jobId,
				question,
				suggestions,
				state: "pending",
				createdAt: new Date(),
				timeout: timeout || (this.config.enableTimeout ? this.config.defaultTimeout : undefined),
				resolvePromise: resolve,
				rejectPromise: reject,
			}

			this.questions.set(questionId, apiQuestion)

			// Set up optional timeout
			if (apiQuestion.timeout && apiQuestion.timeout > 0) {
				setTimeout(() => {
					this.expireQuestion(questionId, `Question timed out after ${apiQuestion.timeout}ms`)
				}, apiQuestion.timeout)
			}

			// Persist question state
			this.persistQuestions().catch((error) => {
				console.error("Failed to persist question:", error)
			})

			// Emit question created event
			this.emit("questionCreated", apiQuestion)
		})

		return {
			questionId,
			promise: questionPromise,
		}
	}

	/**
	 * Submit an answer to a question
	 */
	async submitAnswer(questionId: string, answer: string): Promise<boolean> {
		const question = this.questions.get(questionId)

		if (!question) {
			return false
		}

		if (question.state !== "pending") {
			return false
		}

		// Update question with answer
		question.state = "answered"
		question.answer = answer
		question.answeredAt = new Date()

		// Resolve the promise
		if (question.resolvePromise) {
			question.resolvePromise(answer)
		}

		// Persist updated state
		await this.persistQuestions()

		// Emit answer received event
		this.emit("questionAnswered", question)

		return true
	}

	/**
	 * Cancel a question
	 */
	async cancelQuestion(questionId: string, reason: string = "Cancelled"): Promise<boolean> {
		const question = this.questions.get(questionId)

		if (!question) {
			return false
		}

		if (question.state !== "pending") {
			return false
		}

		question.state = "cancelled"

		// Reject the promise if it exists and is still active
		if (question.rejectPromise) {
			try {
				question.rejectPromise(new Error(`Question cancelled: ${reason}`))
			} catch (error) {
				// Ignore errors during promise rejection (e.g., already resolved/rejected)
			}
		}

		// Persist updated state
		await this.persistQuestions()

		// Emit question cancelled event
		this.emit("questionCancelled", question)

		return true
	}

	/**
	 * Expire a question due to timeout
	 */
	private async expireQuestion(questionId: string, reason: string): Promise<void> {
		const question = this.questions.get(questionId)

		if (!question || question.state !== "pending") {
			return
		}

		question.state = "expired"

		// Reject the promise
		if (question.rejectPromise) {
			question.rejectPromise(new Error(`Question expired: ${reason}`))
		}

		// Persist updated state
		await this.persistQuestions()

		// Emit question expired event
		this.emit("questionExpired", question)
	}

	/**
	 * Get a question by ID
	 */
	getQuestion(questionId: string): ApiQuestion | undefined {
		return this.questions.get(questionId)
	}

	/**
	 * Get all pending questions for a job
	 */
	getPendingQuestions(jobId: string): ApiQuestion[] {
		return Array.from(this.questions.values()).filter((q) => q.jobId === jobId && q.state === "pending")
	}

	/**
	 * Get all questions for a job
	 */
	getJobQuestions(jobId: string): ApiQuestion[] {
		return Array.from(this.questions.values()).filter((q) => q.jobId === jobId)
	}

	/**
	 * Cancel all pending questions for a job
	 */
	async cancelJobQuestions(jobId: string, reason: string = "Job cancelled"): Promise<number> {
		const pendingQuestions = this.getPendingQuestions(jobId)
		let cancelledCount = 0

		for (const question of pendingQuestions) {
			const cancelled = await this.cancelQuestion(question.id, reason)
			if (cancelled) {
				cancelledCount++
			}
		}

		return cancelledCount
	}

	/**
	 * Manually clean up completed questions (no automatic deletion)
	 */
	async cleanupQuestions(olderThanDays: number = 30): Promise<number> {
		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

		const questionsToRemove: string[] = []

		for (const [questionId, question] of this.questions) {
			// Only remove completed questions (answered, expired, cancelled) that are old enough
			if (question.state !== "pending" && question.createdAt < cutoffDate) {
				questionsToRemove.push(questionId)
			}
		}

		// Remove questions
		for (const questionId of questionsToRemove) {
			this.questions.delete(questionId)
		}

		// Persist changes
		if (questionsToRemove.length > 0) {
			await this.persistQuestions()
		}

		return questionsToRemove.length
	}

	/**
	 * Get question statistics
	 */
	getStats(): {
		total: number
		pending: number
		answered: number
		expired: number
		cancelled: number
		byJob: Record<string, number>
	} {
		const stats = {
			total: this.questions.size,
			pending: 0,
			answered: 0,
			expired: 0,
			cancelled: 0,
			byJob: {} as Record<string, number>,
		}

		for (const question of this.questions.values()) {
			stats[question.state]++
			stats.byJob[question.jobId] = (stats.byJob[question.jobId] || 0) + 1
		}

		return stats
	}

	/**
	 * Persist questions to disk
	 */
	private async persistQuestions(): Promise<void> {
		// Chain persistence operations to avoid race conditions
		this.persistencePromise = this.persistencePromise.then(async () => {
			try {
				const questionsData = Array.from(this.questions.values()).map((q) => ({
					...q,
					// Remove Promise functions which can't be serialized
					resolvePromise: undefined,
					rejectPromise: undefined,
				}))

				const data = {
					questions: questionsData,
					lastUpdated: new Date().toISOString(),
				}

				await fs.writeFile(this.storageFile, JSON.stringify(data, null, 2), "utf8")
			} catch (error) {
				console.error("Failed to persist questions:", error)
				throw error
			}
		})

		return this.persistencePromise
	}

	/**
	 * Load persisted questions from disk
	 */
	private async loadPersistedQuestions(): Promise<void> {
		try {
			const data = await fs.readFile(this.storageFile, "utf8")
			const parsed = JSON.parse(data)

			if (parsed.questions && Array.isArray(parsed.questions)) {
				for (const questionData of parsed.questions) {
					// Reconstruct question object but don't restore Promise functions
					// These questions will be in a "zombie" state until the system restarts
					const question: ApiQuestion = {
						...questionData,
						createdAt: new Date(questionData.createdAt),
						answeredAt: questionData.answeredAt ? new Date(questionData.answeredAt) : undefined,
					}

					this.questions.set(question.id, question)
				}

				console.log(`Loaded ${parsed.questions.length} persisted questions`)
			}
		} catch (error) {
			if ((error as any).code !== "ENOENT") {
				console.error("Failed to load persisted questions:", error)
			}
			// File doesn't exist yet, which is fine
		}
	}

	/**
	 * Shutdown the question manager
	 */
	async shutdown(): Promise<void> {
		// Cancel all pending questions silently
		const pendingQuestions = Array.from(this.questions.values()).filter((q) => q.state === "pending")

		for (const question of pendingQuestions) {
			try {
				question.state = "cancelled"
				if (question.rejectPromise) {
					question.rejectPromise(new Error(`Question cancelled: System shutdown`))
				}
			} catch (error) {
				// Ignore errors during shutdown
			}
		}

		// Wait for any pending persistence operations
		try {
			await this.persistencePromise
		} catch (error) {
			// Ignore persistence errors during shutdown
		}

		// Clear all questions
		this.questions.clear()

		// Remove all listeners
		this.removeAllListeners()
	}
}
