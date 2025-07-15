import { EventEmitter } from "events"
import { QuestionOptions, ConfirmationOptions, InputOptions } from "../interfaces/IUserInterface"
import {
	QuestionData,
	IQuestionPresenter,
	IAnswerCollector,
	IQuestionStore,
	UnifiedQuestionManagerConfig,
	QuestionResult,
	QuestionSystemEvents,
} from "./interfaces/IQuestionSystem"

/**
 * Unified Question Manager that provides consistent question handling
 * across all runtime modes (VSCode, API, CLI)
 */
export class UnifiedQuestionManager extends EventEmitter {
	private config: Required<UnifiedQuestionManagerConfig>
	private questionTimeouts = new Map<string, NodeJS.Timeout>()
	private activeQuestions = new Set<string>()

	constructor(
		private presenter: IQuestionPresenter,
		private collector: IAnswerCollector,
		private store: IQuestionStore,
		config: UnifiedQuestionManagerConfig = {},
	) {
		super()

		console.log(`[UnifiedQuestionManagerEO] Constructor called with:`, {
			presenter: !!presenter,
			collector: !!collector,
			store: !!store,
			config,
		})

		this.config = {
			defaultTimeout: config.defaultTimeout || 300000, // 5 minutes
			enableTimeouts: config.enableTimeouts || false,
			maxConcurrentQuestions: config.maxConcurrentQuestions || 10,
			enableLogging: config.enableLogging || false,
			...config,
		}

		console.log(`[UnifiedQuestionManager] Final config:`, this.config)

		// Set up event listeners
		this.setupEventListeners()
	}

	/**
	 * Ask a multiple choice question
	 */
	async askQuestion(question: string, options: QuestionOptions): Promise<string | undefined> {
		console.log(`[UnifiedQuestionManager] askQuestion called:`, {
			question,
			options: JSON.stringify(options, null, 2),
		})

		this.log(`askQuestion: ${question}`)

		const questionData: QuestionData = {
			id: this.generateQuestionId(),
			type: "question",
			question,
			options,
			timestamp: new Date(),
			metadata: { choices: options.choices, defaultChoice: options.defaultChoice },
		}

		console.log(`[UnifiedQuestionManager] Created questionData:`, JSON.stringify(questionData, null, 2))

		try {
			const result = await this.processQuestion(questionData)
			console.log(`[UnifiedQuestionManager] askQuestion returning:`, {
				result,
				type: typeof result,
				isNull: result === null,
				isUndefined: result === undefined,
			})
			return result
		} catch (error) {
			console.error(`[UnifiedQuestionManager] askQuestion failed:`, {
				error: error.message,
				stack: error.stack,
				questionId: questionData.id,
			})
			throw error
		}
	}

	/**
	 * Ask a confirmation question (yes/no)
	 */
	async askConfirmation(message: string, options?: ConfirmationOptions): Promise<boolean> {
		this.log(`askConfirmation: ${message}`)

		const questionData: QuestionData = {
			id: this.generateQuestionId(),
			type: "confirmation",
			question: message,
			options,
			timestamp: new Date(),
			metadata: {
				yesText: options?.yesText || "Yes",
				noText: options?.noText || "No",
			},
		}

		const result = await this.processQuestion(questionData)
		return this.parseConfirmationAnswer(result, options)
	}

	/**
	 * Ask for text input
	 */
	async askInput(prompt: string, options?: InputOptions): Promise<string | undefined> {
		this.log(`askInput: ${prompt}`)

		const questionData: QuestionData = {
			id: this.generateQuestionId(),
			type: "input",
			question: prompt,
			options,
			timestamp: new Date(),
			metadata: {
				placeholder: options?.placeholder,
				defaultValue: options?.defaultValue,
				password: options?.password,
			},
		}

		return this.processQuestion(questionData)
	}

	/**
	 * Cancel a specific question
	 */
	async cancelQuestion(questionId: string): Promise<void> {
		this.log(`cancelQuestion: ${questionId}`)

		const question = this.store.getQuestion(questionId)
		if (!question) {
			this.log(`Question ${questionId} not found`)
			return
		}

		// Clear timeout if it exists
		this.clearQuestionTimeout(questionId)

		// Remove from active questions
		this.activeQuestions.delete(questionId)

		// Cancel via collector
		this.collector.cancelQuestion(questionId)

		// Remove from store
		this.store.removeQuestion(questionId)

		// Emit event
		this.emit("questionCancelled", question)
	}

	/**
	 * Cancel all active questions
	 */
	async cancelAllQuestions(): Promise<void> {
		this.log("cancelAllQuestions")

		const activeQuestionIds = Array.from(this.activeQuestions)
		await Promise.all(activeQuestionIds.map((id) => this.cancelQuestion(id)))
	}

	/**
	 * Get statistics about question handling
	 */
	getStatistics(): {
		activeQuestions: number
		totalQuestions: number
		questionsByType: Record<string, number>
	} {
		const allQuestions = this.store.getAllQuestions()
		const questionsByType = allQuestions.reduce(
			(acc, q) => {
				acc[q.type] = (acc[q.type] || 0) + 1
				return acc
			},
			{} as Record<string, number>,
		)

		return {
			activeQuestions: this.activeQuestions.size,
			totalQuestions: allQuestions.length,
			questionsByType,
		}
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		this.log("cleanup")

		// Cancel all active questions
		await this.cancelAllQuestions()

		// Clear all timeouts
		this.questionTimeouts.forEach((timeout) => clearTimeout(timeout))
		this.questionTimeouts.clear()

		// Cleanup collector
		this.collector.cleanup()

		// Remove all event listeners
		this.removeAllListeners()
	}

	/**
	 * Core question processing logic
	 */
	private async processQuestion(questionData: QuestionData): Promise<string | undefined> {
		console.log(`[UnifiedQuestionManager] processQuestion starting for:`, {
			questionId: questionData.id,
			type: questionData.type,
			question: questionData.question,
		})

		// Check concurrent question limit
		if (this.activeQuestions.size >= this.config.maxConcurrentQuestions) {
			const error = new Error(`Maximum concurrent questions (${this.config.maxConcurrentQuestions}) exceeded`)
			console.error(`[UnifiedQuestionManager] Concurrent question limit exceeded:`, {
				activeCount: this.activeQuestions.size,
				maxAllowed: this.config.maxConcurrentQuestions,
			})
			this.emit("error", error, questionData.id)
			throw error
		}

		// Store question
		console.log(`[UnifiedQuestionManager] Storing question ${questionData.id}`)
		this.store.storeQuestion(questionData)
		this.activeQuestions.add(questionData.id)

		// Emit creation event
		console.log(`[UnifiedQuestionManager] Emitting questionCreated event for ${questionData.id}`)
		this.emit("questionCreated", questionData)

		try {
			// Present question via presenter
			console.log(`[UnifiedQuestionManager] Presenting question ${questionData.id}`)
			await this.presentQuestion(questionData)

			// Set up timeout if enabled
			if (this.config.enableTimeouts && this.config.defaultTimeout > 0) {
				console.log(
					`[UnifiedQuestionManager] Setting up timeout for ${questionData.id}: ${this.config.defaultTimeout}ms`,
				)
				this.setupQuestionTimeout(questionData)
			} else {
				console.log(`[UnifiedQuestionManager] Timeouts disabled or timeout is 0`)
			}

			// Wait for answer via collector
			console.log(`[UnifiedQuestionManager] Waiting for answer via collector for ${questionData.id}`)
			const answer = await this.collector.waitForAnswer(questionData.id)

			console.log(`[UnifiedQuestionManager] Received answer from collector:`, {
				questionId: questionData.id,
				answer,
				answerType: typeof answer,
				isNull: answer === null,
				isUndefined: answer === undefined,
			})

			// Clear timeout
			this.clearQuestionTimeout(questionData.id)

			// Update question with answer
			console.log(`[UnifiedQuestionManager] Updating question ${questionData.id} with answer`)
			this.store.updateQuestion(questionData.id, {
				metadata: {
					...questionData.metadata,
					answer,
					answeredAt: new Date(),
				},
			})

			// Emit answered event
			console.log(`[UnifiedQuestionManager] Emitting questionAnswered event for ${questionData.id}`)
			this.emit("questionAnswered", questionData, answer)

			console.log(`[UnifiedQuestionManager] processQuestion returning answer:`, {
				questionId: questionData.id,
				answer,
				answerType: typeof answer,
			})

			return answer
		} catch (error) {
			console.error(`[UnifiedQuestionManager] Error processing question ${questionData.id}:`, {
				error: error.message,
				stack: error.stack,
				errorName: error.name,
				errorConstructor: error.constructor.name,
			})
			this.log(`Error processing question ${questionData.id}: ${error}`)
			this.emit("error", error as Error, questionData.id)
			throw error
		} finally {
			// Cleanup
			console.log(`[UnifiedQuestionManager] Cleaning up question ${questionData.id}`)
			this.clearQuestionTimeout(questionData.id)
			this.activeQuestions.delete(questionData.id)
			this.store.removeQuestion(questionData.id)
		}
	}

	/**
	 * Present question using the appropriate presenter method
	 */
	private async presentQuestion(questionData: QuestionData): Promise<void> {
		switch (questionData.type) {
			case "question":
				await this.presenter.presentQuestion(questionData)
				break
			case "confirmation":
				await this.presenter.presentConfirmation(questionData)
				break
			case "input":
				await this.presenter.presentInput(questionData)
				break
			default:
				throw new Error(`Unknown question type: ${questionData.type}`)
		}
	}

	/**
	 * Setup timeout for a question
	 */
	private setupQuestionTimeout(questionData: QuestionData): void {
		const timeout = setTimeout(() => {
			this.log(`Question ${questionData.id} timed out`)
			this.handleQuestionTimeout(questionData)
		}, this.config.defaultTimeout)

		this.questionTimeouts.set(questionData.id, timeout)
	}

	/**
	 * Clear timeout for a question
	 */
	private clearQuestionTimeout(questionId: string): void {
		const timeout = this.questionTimeouts.get(questionId)
		if (timeout) {
			clearTimeout(timeout)
			this.questionTimeouts.delete(questionId)
		}
	}

	/**
	 * Handle question timeout
	 */
	private handleQuestionTimeout(questionData: QuestionData): void {
		this.activeQuestions.delete(questionData.id)
		this.collector.cancelQuestion(questionData.id)
		this.store.removeQuestion(questionData.id)
		this.emit("questionTimedOut", questionData)
	}

	/**
	 * Parse confirmation answer to boolean
	 */
	private parseConfirmationAnswer(answer: string | undefined, options?: ConfirmationOptions): boolean {
		if (!answer) return false

		const yesText = options?.yesText || "Yes"
		return answer.toLowerCase() === yesText.toLowerCase()
	}

	/**
	 * Generate unique question ID
	 */
	private generateQuestionId(): string {
		return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		// Add any global event listeners here
	}

	/**
	 * Log message if logging is enabled
	 */
	private log(message: string): void {
		if (this.config.enableLogging) {
			console.log(`[UnifiedQuestionManager] ${message}`)
		}
	}
}

/**
 * Typed event emitter for question system events
 * The UnifiedQuestionManager class already extends EventEmitter
 * which provides the on/emit methods with proper typing
 */
