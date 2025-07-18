import type { ReplHistoryService } from "../../shared/services/ReplHistoryService"

// Command line options interface
export interface ApiClientOptions {
	useStream: boolean
	host: string
	port: number
	mode: string
	task?: string
	restartTask: boolean
	replMode: boolean
	verbose: boolean
	showThinking: boolean
	showTools: boolean
	showSystem: boolean
	showResponse: boolean
	showCompletion: boolean
	showMcpUse: boolean
	showTokenUsage: boolean
	hideTokenUsage: boolean
	showTiming: boolean
	logSystemPrompt: boolean
	logLlm: boolean
	logRawChunks?: boolean
	rawChunkLogDir?: string
}

// REPL session configuration
export interface REPLSessionOptions {
	historyService?: ReplHistoryService
	taskId?: string
	verbose: boolean
	host: string
	port: number
	mode: string
	useStream: boolean
	showResponse: boolean
	showThinking: boolean
	showTools: boolean
	showSystem: boolean
	showCompletion: boolean
	showMcpUse: boolean
	showTokenUsage: boolean
	hideTokenUsage: boolean
	showTiming: boolean
	logRawChunks?: boolean
	rawChunkLogDir?: string
}

// Stream processor options
export interface StreamProcessorOptions {
	verbose?: boolean
	maxRetries?: number
	baseDelay?: number
}

// Content filter options
export interface ContentFilterOptions {
	showResponse: boolean
	showThinking: boolean
	showTools: boolean
	showSystem: boolean
	showCompletion: boolean
	showMcpUse: boolean
	showTokenUsage: boolean
	hideTokenUsage: boolean
	verbose: boolean
}

// API request/response types
export interface ApiRequest {
	task: string
	mode: string
	taskId?: string
	restartTask?: boolean
}

export interface ApiResponse {
	success: boolean
	data?: any
	error?: string
}

// Event types for streaming
export interface StreamEvent {
	type: string
	message?: string
	error?: string
	questionId?: string
	tokenUsage?: TokenUsage
	contentType?: string
	toolName?: string
	step?: number
	total?: number
	result?: string
	[key: string]: any
}

export interface TokenUsage {
	inputTokens: number
	outputTokens: number
	totalTokens: number
	cost?: number
}

// Question event data structure (AC-002)
export interface QuestionEventData {
	type: "question"
	questionId: string
	questionType: "select" | "input" | "confirmation" | "password"
	question: string
	timestamp: string
	choices?: string[]
	placeholder?: string
	password?: boolean
	yesText?: string
	noText?: string
	defaultValue?: string | boolean
}

// Question handler state management (AC-002)
export interface QuestionHandlerState {
	currentQuestion: QuestionEventData | null
	isProcessing: boolean
	questionQueue: QuestionEventData[]
}

// Supported modes
export type SupportedMode =
	| "code"
	| "debug"
	| "architect"
	| "ask"
	| "test"
	| "design-engineer"
	| "release-engineer"
	| "translate"
	| "product-owner"
	| "orchestrator"

// Command line argument parsing result
export interface ParsedArgs {
	options: ApiClientOptions
	task: string
	showHelp: boolean
}

// HTTP request options
export interface HttpRequestOptions {
	hostname: string
	port: number
	path: string
	method: string
	headers: Record<string, string>
}

// Question handling types
export interface QuestionEvent {
	type: "question_ask"
	questionId: string
	message: string
	choices?: string[]
}

export interface AnswerSubmission {
	questionId: string
	answer: string
}

// Timer and execution tracking
export interface ExecutionTimerOptions {
	verbose?: boolean
	showTiming?: boolean
}

export interface TimerRecord {
	operation: string
	startTime: number
	endTime?: number
	duration?: number
	details?: string
}

// Content filter state
export interface ContentFilterState {
	currentState: "normal" | "tag_opening" | "inside_tag" | "tag_closing"
	currentTag: string
	currentSection: {
		type: string
		content: string
		shouldFilter: boolean
	} | null
	sectionStack: string[]
}

// Stream processing state
export interface StreamProcessingState {
	isPaused: boolean
	currentQuestion: QuestionEvent | null
	eventQueue: Array<{
		event: StreamEvent
		timestamp: string
		contentFilter: any
	}>
	finalTokenUsage: TokenUsage | null
	finalTokenTimestamp: string | null
}

// Error types
export interface ApiClientError extends Error {
	code?: string
	statusCode?: number
	details?: any
}

// Utility types
export type LogLevel = "debug" | "info" | "warn" | "error"
export type EventType =
	| "start"
	| "progress"
	| "complete"
	| "completion"
	| "error"
	| "question_ask"
	| "token_usage"
	| "stream_end"
	| "log"

// History command types
export type HistoryCommand = "show" | "search" | "clear" | "stats"

// REPL command types
export type REPLCommand = "exit" | "quit" | "newtask" | "help" | "history"

// HTTP client types
export interface HttpClientOptions {
	timeout?: number
	retries?: number
	retryDelay?: number
}

export interface HttpResponse {
	statusCode: number
	headers: Record<string, string>
	body: string
}

// Export all types for easy importing
export type { ReplHistoryService }
