import { QuestionOptions, ConfirmationOptions, InputOptions } from "../../interfaces/IUserInterface"

/**
 * Unified question data structure
 */
export interface QuestionData {
	id: string
	type: "question" | "confirmation" | "input"
	question: string
	options?: QuestionOptions | ConfirmationOptions | InputOptions
	timestamp: Date
	metadata?: Record<string, any>
}

/**
 * Interface for presenting questions to users in runtime-specific ways
 */
export interface IQuestionPresenter {
	/**
	 * Present a multiple choice question to the user
	 * @param question The question data
	 */
	presentQuestion(question: QuestionData): Promise<void>

	/**
	 * Present a confirmation dialog to the user
	 * @param question The question data
	 */
	presentConfirmation(question: QuestionData): Promise<void>

	/**
	 * Present an input prompt to the user
	 * @param question The question data
	 */
	presentInput(question: QuestionData): Promise<void>
}

/**
 * Interface for collecting answers from users in runtime-specific ways
 */
export interface IAnswerCollector {
	/**
	 * Wait for an answer to a specific question
	 * This method should block until the user provides an answer
	 * @param questionId The ID of the question to wait for
	 * @returns The user's answer
	 */
	waitForAnswer(questionId: string): Promise<string>

	/**
	 * Cancel a pending question
	 * @param questionId The ID of the question to cancel
	 */
	cancelQuestion(questionId: string): void

	/**
	 * Cleanup any resources used by the collector
	 */
	cleanup(): void
}

/**
 * Interface for storing questions during their lifecycle
 */
export interface IQuestionStore {
	/**
	 * Store a question and return its ID
	 * @param question The question to store
	 * @returns The question ID
	 */
	storeQuestion(question: QuestionData): string

	/**
	 * Get a question by its ID
	 * @param questionId The question ID
	 * @returns The question data or undefined if not found
	 */
	getQuestion(questionId: string): QuestionData | undefined

	/**
	 * Update a question with new data
	 * @param questionId The question ID
	 * @param updates The updates to apply
	 */
	updateQuestion(questionId: string, updates: Partial<QuestionData>): void

	/**
	 * Remove a question from storage
	 * @param questionId The question ID
	 */
	removeQuestion(questionId: string): void

	/**
	 * Get all questions currently in storage
	 * @returns All questions
	 */
	getAllQuestions(): QuestionData[]

	/**
	 * Get all questions of a specific type
	 * @param type The question type
	 * @returns Questions of the specified type
	 */
	getQuestionsByType(type: QuestionData["type"]): QuestionData[]
}

/**
 * Configuration for the unified question manager
 */
export interface UnifiedQuestionManagerConfig {
	/** Default timeout for questions in milliseconds */
	defaultTimeout?: number
	/** Whether to enable question timeouts */
	enableTimeouts?: boolean
	/** Maximum number of concurrent questions */
	maxConcurrentQuestions?: number
	/** Whether to enable question logging */
	enableLogging?: boolean
}

/**
 * Result of a question operation
 */
export interface QuestionResult<T = string> {
	/** Whether the operation was successful */
	success: boolean
	/** The result value (if successful) */
	value?: T
	/** Error message (if unsuccessful) */
	error?: string
	/** The question ID */
	questionId: string
	/** Timestamp when the result was obtained */
	timestamp: Date
}

/**
 * Events emitted by the question system
 */
export interface QuestionSystemEvents {
	/** Emitted when a question is created */
	questionCreated: (question: QuestionData) => void
	/** Emitted when a question is answered */
	questionAnswered: (question: QuestionData, answer: string) => void
	/** Emitted when a question is cancelled */
	questionCancelled: (question: QuestionData) => void
	/** Emitted when a question times out */
	questionTimedOut: (question: QuestionData) => void
	/** Emitted when an error occurs */
	error: (error: Error, questionId?: string) => void
}
