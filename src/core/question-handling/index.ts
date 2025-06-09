/**
 * Question Handling System
 *
 * Platform-agnostic system for handling followup questions across
 * different environments (VSCode, CLI, web, message queues, etc.)
 */

// Core interfaces
export type {
	IQuestionHandler,
	QuestionHandlerFactory,
	QuestionHandlerRegistration,
} from "./interfaces/IQuestionHandler"

// Types
export type {
	QuestionData,
	QuestionResponse,
	QuestionSuggestion,
	QuestionContext,
	QuestionCapabilities,
	QuestionFeature,
	QuestionError,
	QuestionHandlingError,
	ParsedSuggestions,
} from "./types/question-types"

// Services
export { QuestionProcessor } from "./services/QuestionProcessor"
export { TaskQuestionService } from "./services/TaskQuestionService"

// Handlers
export { CLIQuestionHandler, createCLIQuestionHandler } from "./handlers/CLIQuestionHandler"

// Re-export for convenience
export type * from "./types/question-types"
export type * from "./interfaces/IQuestionHandler"
