// Core interfaces
export * from "./interfaces/IQuestionSystem"

// Core manager
export { UnifiedQuestionManager } from "./UnifiedQuestionManager"

// Factory
export { QuestionSystemFactory, createQuestionManager, detectQuestionSystemMode } from "./QuestionSystemFactory"
export type { QuestionSystemMode, QuestionSystemFactoryConfig } from "./QuestionSystemFactory"

// Stores
export { InMemoryQuestionStore } from "./stores/InMemoryQuestionStore"

// Re-export from IUserInterface for convenience
export type { QuestionOptions, ConfirmationOptions, InputOptions } from "../interfaces/IUserInterface"
