/**
 * Core data entity definitions for the data layer abstraction
 */

/**
 * Base entity with common properties
 */
export interface BaseEntity {
	id: string
	createdAt: Date
	updatedAt: Date
}

/**
 * Workspace entity representing a project workspace
 */
export interface Workspace extends BaseEntity {
	name: string
	path: string
	settings: WorkspaceSettings
	isActive: boolean
}

/**
 * Workspace-specific settings and configuration
 */
export interface WorkspaceSettings {
	defaultProvider?: string
	customInstructions?: string
	systemPrompt?: string
	rateLimitSeconds?: number
	diffEnabled?: boolean
	fuzzyMatchThreshold?: number
	modeApiConfigs?: Record<string, string>
	[key: string]: any
}

/**
 * Conversation entity representing a chat session
 */
export interface Conversation extends BaseEntity {
	workspaceId: string
	title: string
	messages: Message[]
	provider: string
	model: string
	tags: string[]
	isArchived: boolean
	metadata: ConversationMetadata
}

/**
 * Additional metadata for conversations
 */
export interface ConversationMetadata {
	tokenUsage?: TokenUsage
	duration?: number
	lastMessageAt?: Date
	messageCount?: number
	[key: string]: any
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
	inputTokens: number
	outputTokens: number
	totalTokens: number
	cost?: number
}

/**
 * Message entity representing individual conversation messages
 */
export interface Message extends BaseEntity {
	conversationId: string
	role: "user" | "assistant" | "system"
	content: string
	metadata: MessageMetadata
}

/**
 * Additional metadata for messages
 */
export interface MessageMetadata {
	model?: string
	tokens?: number
	duration?: number
	toolUsage?: ToolUsage[]
	[key: string]: any
}

/**
 * Tool usage tracking
 */
export interface ToolUsage {
	toolName: string
	duration?: number
	success: boolean
	error?: string
	[key: string]: any
}

/**
 * Provider entity representing AI service providers
 */
export interface Provider extends BaseEntity {
	name: string
	type: ProviderType
	apiKey: string
	baseUrl?: string
	isDefault: boolean
	settings: ProviderSettings
	isActive: boolean
}

/**
 * Supported provider types (aligned with existing system)
 */
export type ProviderType =
	| "openai"
	| "anthropic"
	| "groq"
	| "deepseek"
	| "litellm"
	| "xai"
	| "lmstudio"
	| "openrouter"
	| "ollama"
	| "bedrock"
	| "vertex"
	| "gemini"
	| "openai-native"
	| "vscode-lm"
	| "glama"

/**
 * Provider-specific settings
 */
export interface ProviderSettings {
	model?: string
	temperature?: number
	maxTokens?: number
	rateLimitSeconds?: number
	diffEnabled?: boolean
	fuzzyMatchThreshold?: number
	openAiHeaders?: Record<string, string>
	[key: string]: any
}

/**
 * Context entity for workspace context tracking
 */
export interface Context extends BaseEntity {
	workspaceId: string
	type: ContextType
	name: string
	description?: string
	data: ContextData
	isActive: boolean
}

/**
 * Types of context
 */
export type ContextType = "file" | "directory" | "git" | "environment" | "custom"

/**
 * Context data payload
 */
export interface ContextData {
	path?: string
	content?: string
	metadata?: Record<string, any>
	references?: string[]
	[key: string]: any
}

/**
 * Task entity for background task tracking
 */
export interface Task extends BaseEntity {
	workspaceId: string
	conversationId?: string
	type: TaskType
	name: string
	description?: string
	status: TaskStatus
	progress: TaskProgress
	result?: TaskResult
	error?: string
	metadata: TaskMetadata
}

/**
 * Types of tasks
 */
export type TaskType = "conversation" | "file_operation" | "code_analysis" | "mcp_operation" | "custom"

/**
 * Task execution status
 */
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

/**
 * Task progress tracking
 */
export interface TaskProgress {
	percentage: number
	currentStep?: string
	totalSteps?: number
	estimatedTimeRemaining?: number
}

/**
 * Task execution result
 */
export interface TaskResult {
	success: boolean
	data?: any
	files?: string[]
	summary?: string
	[key: string]: any
}

/**
 * Additional task metadata
 */
export interface TaskMetadata {
	startedAt?: Date
	completedAt?: Date
	duration?: number
	userId?: string
	priority?: number
	[key: string]: any
}

/**
 * Create request types (omitting generated fields)
 */
export type CreateWorkspaceRequest = Omit<Workspace, "id" | "createdAt" | "updatedAt">
export type CreateConversationRequest = Omit<Conversation, "id" | "createdAt" | "updatedAt" | "messages">
export type CreateMessageRequest = Omit<Message, "id" | "createdAt" | "updatedAt" | "conversationId">
export type CreateProviderRequest = Omit<Provider, "id" | "createdAt" | "updatedAt">
export type CreateContextRequest = Omit<Context, "id" | "createdAt" | "updatedAt">
export type CreateTaskRequest = Omit<Task, "id" | "createdAt" | "updatedAt" | "status" | "progress" | "result">
