import { IAnswerCollector } from "../interfaces/IQuestionSystem"
import { ApiQuestionManager } from "../../../api/questions/ApiQuestionManager"

/**
 * API implementation of IAnswerCollector
 * Integrates with existing ApiQuestionManager to collect answers via API endpoints
 */
export class ApiAnswerCollector implements IAnswerCollector {
	private activeQuestions = new Map<
		string,
		{
			resolve: (answer: string) => void
			reject: (error: Error) => void
			jobId: string
		}
	>()

	constructor(private questionManager: ApiQuestionManager) {}

	/**
	 * Wait for an answer to a specific question
	 * This integrates with the existing ApiQuestionManager promise system
	 */
	async waitForAnswer(questionId: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			console.log(`[ApiAnswerCollectorEO] waitForAnswer called for questionId: ${questionId}`)

			// First try to find the question directly
			let question = this.questionManager.getQuestion(questionId)

			if (!question) {
				console.log(
					`[ApiAnswerCollector] Question ${questionId} not found directly, checking for mapped questions`,
				)
				// The question might be created asynchronously by PersistentQuestionStore
				// Let's wait a bit and try again
				setTimeout(() => {
					question = this.questionManager.getQuestion(questionId)
					if (!question) {
						// Try to find it by checking all questions in the manager
						const allQuestions = this.questionManager.getStats()
						console.log(`[ApiAnswerCollector] Total questions in manager: ${allQuestions.total}`)
						reject(new Error(`Question ${questionId} not found in ApiQuestionManager after retry`))
						return
					}

					this.processQuestion(questionId, question, resolve, reject)
				}, 100) // Small delay to allow for async creation
				return
			}

			this.processQuestion(questionId, question, resolve, reject)
		})
	}

	private processQuestion(
		questionId: string,
		question: any,
		resolve: (answer: string) => void,
		reject: (error: Error) => void,
	) {
		console.log(`[ApiAnswerCollector] Processing question ${questionId}`)

		this.activeQuestions.set(questionId, {
			resolve,
			reject,
			jobId: question.jobId,
		})

		// Setup the API question promise
		this.setupApiQuestionPromise(questionId, question.jobId)
			.then((answer) => {
				console.log(`[ApiAnswerCollector] Received answer for ${questionId}: ${answer}`)
				this.activeQuestions.delete(questionId)
				resolve(answer)
			})
			.catch((error) => {
				console.error(`[ApiAnswerCollector] Error for ${questionId}:`, error)
				this.activeQuestions.delete(questionId)
				reject(error)
			})
	}

	/**
	 * Cancel a pending question
	 */
	cancelQuestion(questionId: string): void {
		const pending = this.activeQuestions.get(questionId)
		if (pending) {
			this.activeQuestions.delete(questionId)

			// Cancel in the ApiQuestionManager
			this.questionManager.cancelQuestion(questionId, "Cancelled by unified question system")

			pending.reject(new Error(`Question ${questionId} was cancelled`))
		}
	}

	/**
	 * Cleanup any resources
	 */
	cleanup(): void {
		// Cancel all pending questions
		const pendingIds = Array.from(this.activeQuestions.keys())
		pendingIds.forEach((id) => this.cancelQuestion(id))
	}

	/**
	 * Set up the API question promise system
	 * This integrates with the existing ApiQuestionManager
	 */
	private async setupApiQuestionPromise(questionId: string, jobId: string): Promise<string> {
		// The question should already exist in the ApiQuestionManager
		// We need to create a new promise that resolves when the existing question is answered

		const existingQuestion = this.questionManager.getQuestion(questionId)
		if (!existingQuestion) {
			throw new Error(`Question ${questionId} not found`)
		}

		// If the question is already answered, return the answer immediately
		if (existingQuestion.state === "answered" && existingQuestion.answer) {
			return existingQuestion.answer
		}

		// If the question is not pending, throw an error
		if (existingQuestion.state !== "pending") {
			throw new Error(`Question ${questionId} is in state ${existingQuestion.state}, cannot wait for answer`)
		}

		// Create a new promise that resolves when the question is answered
		// We'll use the existing ApiQuestionManager's event system
		return new Promise<string>((resolve, reject) => {
			// Set up event listeners for this specific question
			const handleQuestionAnswered = (answeredQuestion: any) => {
				if (answeredQuestion.id === questionId) {
					this.questionManager.off("questionAnswered", handleQuestionAnswered)
					this.questionManager.off("questionCancelled", handleQuestionCancelled)
					this.questionManager.off("questionExpired", handleQuestionExpired)
					resolve(answeredQuestion.answer || "")
				}
			}

			const handleQuestionCancelled = (cancelledQuestion: any) => {
				if (cancelledQuestion.id === questionId) {
					this.questionManager.off("questionAnswered", handleQuestionAnswered)
					this.questionManager.off("questionCancelled", handleQuestionCancelled)
					this.questionManager.off("questionExpired", handleQuestionExpired)
					reject(new Error(`Question ${questionId} was cancelled`))
				}
			}

			const handleQuestionExpired = (expiredQuestion: any) => {
				if (expiredQuestion.id === questionId) {
					this.questionManager.off("questionAnswered", handleQuestionAnswered)
					this.questionManager.off("questionCancelled", handleQuestionCancelled)
					this.questionManager.off("questionExpired", handleQuestionExpired)
					reject(new Error(`Question ${questionId} expired`))
				}
			}

			// Listen for question events
			this.questionManager.on("questionAnswered", handleQuestionAnswered)
			this.questionManager.on("questionCancelled", handleQuestionCancelled)
			this.questionManager.on("questionExpired", handleQuestionExpired)
		})
	}

	/**
	 * Get statistics about pending questions
	 */
	getStatistics(): {
		pendingQuestions: number
		questionsByJob: Record<string, number>
	} {
		const pending = Array.from(this.activeQuestions.values())
		const questionsByJob: Record<string, number> = {}

		pending.forEach((q) => {
			questionsByJob[q.jobId] = (questionsByJob[q.jobId] || 0) + 1
		})

		return {
			pendingQuestions: pending.length,
			questionsByJob,
		}
	}
}
