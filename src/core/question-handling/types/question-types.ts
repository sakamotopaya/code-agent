/**
 * Core types for platform-agnostic question handling system
 */

/**
 * Suggestion for a followup question answer
 */
export interface QuestionSuggestion {
	/** The suggested answer text */
	answer: string
	/** Optional metadata for the suggestion */
	metadata?: Record<string, any>
}

/**
 * Context information for a question
 */
export interface QuestionContext {
	/** Current task ID or identifier */
	taskId?: string
	/** Platform context (vscode, cli, web, etc.) */
	platform?: string
	/** Additional context data */
	data?: Record<string, any>
}

/**
 * Data structure for a followup question
 */
export interface QuestionData {
	/** The question text to ask the user */
	question: string
	/** Optional suggested answers */
	suggestions?: QuestionSuggestion[]
	/** Optional context information */
	context?: QuestionContext
	/** Timeout in milliseconds for the question */
	timeout?: number
	/** Additional metadata */
	metadata?: Record<string, any>
	/** Whether this is a partial question (for streaming) */
	partial?: boolean
}

/**
 * Response to a followup question
 */
export interface QuestionResponse {
	/** The user's answer text */
	text: string
	/** Optional images/attachments */
	images?: any[]
	/** Whether the response was from a suggestion */
	fromSuggestion?: boolean
	/** Index of the selected suggestion if applicable */
	suggestionIndex?: number
	/** Response metadata */
	metadata?: Record<string, any>
	/** Timestamp of the response */
	timestamp?: Date
}

/**
 * Features that a question handler might support
 */
export enum QuestionFeature {
	SUGGESTIONS = "suggestions",
	IMAGES = "images",
	PARTIAL_QUESTIONS = "partial_questions",
	TIMEOUT = "timeout",
	RICH_FORMATTING = "rich_formatting",
	ASYNC_RESPONSE = "async_response",
}

/**
 * Capabilities of a question handler
 */
export interface QuestionCapabilities {
	/** Supported features */
	features: QuestionFeature[]
	/** Maximum timeout supported (ms) */
	maxTimeout?: number
	/** Maximum number of suggestions supported */
	maxSuggestions?: number
	/** Whether handler supports async responses */
	supportsAsync: boolean
}

/**
 * Error types for question handling
 */
export enum QuestionError {
	TIMEOUT = "timeout",
	USER_CANCELLED = "user_cancelled",
	INVALID_INPUT = "invalid_input",
	HANDLER_ERROR = "handler_error",
	UNSUPPORTED_FEATURE = "unsupported_feature",
}

/**
 * Question handling error
 */
export class QuestionHandlingError extends Error {
	constructor(
		public errorType: QuestionError,
		message: string,
		public originalError?: Error,
	) {
		super(message)
		this.name = "QuestionHandlingError"
	}
}

/**
 * Parse result for XML suggestions
 */
export interface ParsedSuggestions {
	suggestions: QuestionSuggestion[]
	errors?: string[]
}
