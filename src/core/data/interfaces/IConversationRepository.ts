/**
 * Conversation repository interface for managing chat conversations
 */

import { IRepository, QueryOptions, SearchOptions } from "./IRepository"
import { Conversation, Message, CreateConversationRequest, CreateMessageRequest } from "../types/entities"

export interface MessageQueryOptions extends QueryOptions {
	since?: Date
	until?: Date
	messageTypes?: ("user" | "assistant" | "system")[]
	includeMetadata?: boolean
	includeToolUsage?: boolean
}

export interface ConversationSearchOptions extends SearchOptions {
	workspaceId?: string
	provider?: string
	model?: string
	tags?: string[]
	dateRange?: {
		start: Date
		end: Date
	}
	hasMessages?: boolean
}

export interface IConversationRepository extends IRepository<Conversation> {
	/**
	 * Add a message to a conversation
	 */
	addMessage(conversationId: string, message: CreateMessageRequest): Promise<Message>

	/**
	 * Get messages for a conversation
	 */
	getMessages(conversationId: string, options?: MessageQueryOptions): Promise<Message[]>

	/**
	 * Update a specific message
	 */
	updateMessage(conversationId: string, messageId: string, updates: Partial<Message>): Promise<Message>

	/**
	 * Delete a specific message
	 */
	deleteMessage(conversationId: string, messageId: string): Promise<void>

	/**
	 * Get the latest message in a conversation
	 */
	getLatestMessage(conversationId: string): Promise<Message | null>

	/**
	 * Get message count for a conversation
	 */
	getMessageCount(conversationId: string): Promise<number>

	/**
	 * Search conversations
	 */
	searchConversations(query: string, options?: ConversationSearchOptions): Promise<Conversation[]>

	/**
	 * Get conversations by workspace
	 */
	getConversationsByWorkspace(workspaceId: string, options?: QueryOptions): Promise<Conversation[]>

	/**
	 * Get conversations by provider
	 */
	getConversationsByProvider(provider: string, options?: QueryOptions): Promise<Conversation[]>

	/**
	 * Get conversations by tags
	 */
	getConversationsByTags(tags: string[], options?: QueryOptions): Promise<Conversation[]>

	/**
	 * Clear all messages from a conversation
	 */
	clearMessages(conversationId: string): Promise<void>

	/**
	 * Archive a conversation
	 */
	archiveConversation(conversationId: string): Promise<void>

	/**
	 * Unarchive a conversation
	 */
	unarchiveConversation(conversationId: string): Promise<void>

	/**
	 * Get archived conversations
	 */
	getArchivedConversations(workspaceId?: string): Promise<Conversation[]>

	/**
	 * Add tag to conversation
	 */
	addTag(conversationId: string, tag: string): Promise<void>

	/**
	 * Remove tag from conversation
	 */
	removeTag(conversationId: string, tag: string): Promise<void>

	/**
	 * Update conversation metadata
	 */
	updateMetadata(conversationId: string, metadata: Partial<Conversation["metadata"]>): Promise<void>

	/**
	 * Get conversation statistics
	 */
	getConversationStats(conversationId: string): Promise<ConversationStats>

	/**
	 * Get recent conversations
	 */
	getRecentConversations(workspaceId?: string, limit?: number): Promise<Conversation[]>

	/**
	 * Export conversation to various formats
	 */
	exportConversation(conversationId: string, format: ExportFormat): Promise<string>

	/**
	 * Import conversation from external format
	 */
	importConversation(data: string, format: ExportFormat, workspaceId: string): Promise<Conversation>

	/**
	 * Duplicate a conversation
	 */
	duplicateConversation(conversationId: string, options?: DuplicateOptions): Promise<Conversation>
}

export interface ConversationStats {
	messageCount: number
	totalTokens: number
	duration: number
	toolUsageCount: number
	lastMessageAt: Date
	participantCount: number
}

export type ExportFormat = "json" | "markdown" | "csv" | "txt"

export interface DuplicateOptions {
	includeMessages?: boolean
	newTitle?: string
	newWorkspaceId?: string
	preserveMetadata?: boolean
}
