/**
 * Data layer interface exports
 */

// Base repository interface
export type { IRepository, QueryOptions, SearchOptions } from "./IRepository"

// Repository interfaces
export type { IWorkspaceRepository, CreateWorkspaceOptions, WorkspaceStats } from "./IWorkspaceRepository"
export type {
	IConversationRepository,
	MessageQueryOptions,
	ConversationSearchOptions,
	ConversationStats,
	ExportFormat,
	DuplicateOptions,
} from "./IConversationRepository"
export type {
	IProviderRepository,
	ProviderQueryOptions,
	ConnectionTestResult,
	ModelInfo,
	ValidationResult,
	ValidationError,
	ValidationWarning,
	ProviderStats,
	DateRange,
} from "./IProviderRepository"
export type {
	IContextRepository,
	ContextQueryOptions,
	GitContextData,
	EnvironmentContextData,
	ContextStats,
} from "./IContextRepository"
export type {
	ITaskRepository,
	TaskQueryOptions,
	TaskExecutionOptions,
	TaskHistoryEntry,
	TaskAction,
	TaskLogEntry,
	LogLevel,
	TaskLogQueryOptions,
	TaskStats,
	TaskExportOptions,
} from "./ITaskRepository"

// Repository container interface
export interface RepositoryContainer {
	workspace: IWorkspaceRepository
	conversation: IConversationRepository
	provider: IProviderRepository
	context: IContextRepository
	task: ITaskRepository

	// Lifecycle methods
	initialize?(): Promise<void>
	dispose?(): Promise<void>
}

import type { IWorkspaceRepository } from "./IWorkspaceRepository"
import type { IConversationRepository } from "./IConversationRepository"
import type { IProviderRepository } from "./IProviderRepository"
import type { IContextRepository } from "./IContextRepository"
import type { ITaskRepository } from "./ITaskRepository"
