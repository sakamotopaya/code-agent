/**
 * Native conversation repository implementation using existing session storage
 */

import {
	IConversationRepository,
	MessageQueryOptions,
	ConversationSearchOptions,
	ConversationStats,
	ExportFormat,
	DuplicateOptions,
} from "../../interfaces/IConversationRepository"
import { QueryOptions } from "../../interfaces/IRepository"
import { Conversation, Message, CreateConversationRequest, CreateMessageRequest } from "../../types/entities"
import { NativeServicesConfig } from "../../RepositoryFactory"
// import { ISessionStorage } from '../../../cli/types/storage-types'
import { IStorageService } from "../../../interfaces/IStorageService"
import * as crypto from "crypto"

export class NativeConversationRepository implements IConversationRepository {
	private storageService: IStorageService
	private readonly CONVERSATIONS_KEY = "conversations"

	constructor(services: NativeServicesConfig) {
		this.storageService = services.storageService
	}

	async initialize(): Promise<void> {
		// Initialize storage if needed
	}

	async dispose(): Promise<void> {
		// Cleanup if needed
	}

	private generateId(): string {
		return crypto.randomUUID()
	}

	private async getConversations(): Promise<Record<string, Conversation>> {
		return (await this.storageService.getGlobalState<Record<string, Conversation>>(this.CONVERSATIONS_KEY)) || {}
	}

	private async saveConversations(conversations: Record<string, Conversation>): Promise<void> {
		await this.storageService.setGlobalState(this.CONVERSATIONS_KEY, conversations)
	}

	async get(id: string): Promise<Conversation | null> {
		const conversations = await this.getConversations()
		return conversations[id] || null
	}

	async create(entity: Omit<Conversation, "id" | "createdAt" | "updatedAt" | "messages">): Promise<Conversation> {
		const now = new Date()
		const conversation: Conversation = {
			...entity,
			id: this.generateId(),
			messages: [],
			isArchived: false,
			metadata: entity.metadata || {},
			createdAt: now,
			updatedAt: now,
		}

		const conversations = await this.getConversations()
		conversations[conversation.id] = conversation
		await this.saveConversations(conversations)

		return conversation
	}

	async update(id: string, updates: Partial<Conversation>): Promise<Conversation> {
		const conversations = await this.getConversations()
		const existing = conversations[id]
		if (!existing) {
			throw new Error(`Conversation with id ${id} not found`)
		}

		const updated: Conversation = {
			...existing,
			...updates,
			id, // Ensure ID doesn't change
			updatedAt: new Date(),
		}

		conversations[id] = updated
		await this.saveConversations(conversations)

		return updated
	}

	async delete(id: string): Promise<void> {
		const conversations = await this.getConversations()
		if (!conversations[id]) {
			throw new Error(`Conversation with id ${id} not found`)
		}

		delete conversations[id]
		await this.saveConversations(conversations)
	}

	async list(options?: QueryOptions): Promise<Conversation[]> {
		const conversations = await this.getConversations()
		let result = Object.values(conversations)

		// Apply filters
		if (options?.filters) {
			result = result.filter((conversation) => {
				return Object.entries(options.filters!).every(([key, value]) => {
					if (key === "tags" && Array.isArray(value)) {
						return value.some((tag) => conversation.tags.includes(tag))
					}
					return (conversation as any)[key] === value
				})
			})
		}

		// Apply sorting
		if (options?.sortBy) {
			const { sortBy, sortOrder = "asc" } = options
			result.sort((a, b) => {
				const aVal = (a as any)[sortBy]
				const bVal = (b as any)[sortBy]
				const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
				return sortOrder === "desc" ? -comparison : comparison
			})
		}

		// Apply pagination
		if (options?.limit || options?.offset) {
			const offset = options.offset || 0
			const limit = options.limit || result.length
			result = result.slice(offset, offset + limit)
		}

		return result
	}

	async exists(id: string): Promise<boolean> {
		const conversations = await this.getConversations()
		return id in conversations
	}

	async getMany(ids: string[]): Promise<(Conversation | null)[]> {
		const conversations = await this.getConversations()
		return ids.map((id) => conversations[id] || null)
	}

	async createMany(
		entities: Omit<Conversation, "id" | "createdAt" | "updatedAt" | "messages">[],
	): Promise<Conversation[]> {
		const now = new Date()
		const newConversations = entities.map((entity) => ({
			...entity,
			id: this.generateId(),
			messages: [],
			isArchived: false,
			metadata: entity.metadata || {},
			createdAt: now,
			updatedAt: now,
		}))

		const conversations = await this.getConversations()
		newConversations.forEach((conversation) => {
			conversations[conversation.id] = conversation
		})
		await this.saveConversations(conversations)

		return newConversations
	}

	async updateMany(updates: Array<{ id: string; data: Partial<Conversation> }>): Promise<Conversation[]> {
		const conversations = await this.getConversations()
		const updated: Conversation[] = []

		for (const { id, data } of updates) {
			const existing = conversations[id]
			if (existing) {
				const updatedConversation = {
					...existing,
					...data,
					id,
					updatedAt: new Date(),
				}
				conversations[id] = updatedConversation
				updated.push(updatedConversation)
			}
		}

		await this.saveConversations(conversations)
		return updated
	}

	async deleteMany(ids: string[]): Promise<void> {
		const conversations = await this.getConversations()
		ids.forEach((id) => {
			if (conversations[id]) {
				delete conversations[id]
			}
		})
		await this.saveConversations(conversations)
	}

	async count(options?: QueryOptions): Promise<number> {
		const conversations = await this.list(options)
		return conversations.length
	}

	async addMessage(conversationId: string, message: CreateMessageRequest): Promise<Message> {
		const conversation = await this.get(conversationId)
		if (!conversation) {
			throw new Error(`Conversation with id ${conversationId} not found`)
		}

		const now = new Date()
		const newMessage: Message = {
			...message,
			id: this.generateId(),
			conversationId,
			createdAt: now,
			updatedAt: now,
		}

		conversation.messages.push(newMessage)
		conversation.metadata.messageCount = conversation.messages.length
		conversation.metadata.lastMessageAt = now

		await this.update(conversationId, conversation)

		return newMessage
	}

	async getMessages(conversationId: string, options?: MessageQueryOptions): Promise<Message[]> {
		const conversation = await this.get(conversationId)
		if (!conversation) {
			return []
		}

		let messages = [...conversation.messages]

		// Apply filters
		if (options?.since) {
			messages = messages.filter((msg) => msg.createdAt >= options.since!)
		}
		if (options?.until) {
			messages = messages.filter((msg) => msg.createdAt <= options.until!)
		}
		if (options?.messageTypes) {
			messages = messages.filter((msg) => options.messageTypes!.includes(msg.role))
		}

		// Apply sorting
		if (options?.sortBy) {
			const { sortBy, sortOrder = "asc" } = options
			messages.sort((a, b) => {
				const aVal = (a as any)[sortBy]
				const bVal = (b as any)[sortBy]
				const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
				return sortOrder === "desc" ? -comparison : comparison
			})
		}

		// Apply pagination
		if (options?.limit || options?.offset) {
			const offset = options.offset || 0
			const limit = options.limit || messages.length
			messages = messages.slice(offset, offset + limit)
		}

		return messages
	}

	async updateMessage(conversationId: string, messageId: string, updates: Partial<Message>): Promise<Message> {
		const conversation = await this.get(conversationId)
		if (!conversation) {
			throw new Error(`Conversation with id ${conversationId} not found`)
		}

		const messageIndex = conversation.messages.findIndex((msg) => msg.id === messageId)
		if (messageIndex === -1) {
			throw new Error(`Message with id ${messageId} not found`)
		}

		const updatedMessage = {
			...conversation.messages[messageIndex],
			...updates,
			id: messageId,
			conversationId,
			updatedAt: new Date(),
		}

		conversation.messages[messageIndex] = updatedMessage
		await this.update(conversationId, conversation)

		return updatedMessage
	}

	async deleteMessage(conversationId: string, messageId: string): Promise<void> {
		const conversation = await this.get(conversationId)
		if (!conversation) {
			throw new Error(`Conversation with id ${conversationId} not found`)
		}

		const messageIndex = conversation.messages.findIndex((msg) => msg.id === messageId)
		if (messageIndex === -1) {
			throw new Error(`Message with id ${messageId} not found`)
		}

		conversation.messages.splice(messageIndex, 1)
		conversation.metadata.messageCount = conversation.messages.length
		await this.update(conversationId, conversation)
	}

	async getLatestMessage(conversationId: string): Promise<Message | null> {
		const messages = await this.getMessages(conversationId, {
			sortBy: "createdAt",
			sortOrder: "desc",
			limit: 1,
		})
		return messages[0] || null
	}

	async getMessageCount(conversationId: string): Promise<number> {
		const conversation = await this.get(conversationId)
		return conversation ? conversation.messages.length : 0
	}

	async searchConversations(query: string, options?: ConversationSearchOptions): Promise<Conversation[]> {
		const searchOptions: QueryOptions = {
			filters: {},
			...options,
		}

		if (options?.workspaceId) {
			searchOptions.filters!.workspaceId = options.workspaceId
		}
		if (options?.provider) {
			searchOptions.filters!.provider = options.provider
		}
		if (options?.model) {
			searchOptions.filters!.model = options.model
		}

		const conversations = await this.list(searchOptions)

		// Simple text search in title and message content
		const lowerQuery = query.toLowerCase()
		return conversations.filter((conversation) => {
			if (conversation.title.toLowerCase().includes(lowerQuery)) {
				return true
			}
			return conversation.messages.some((message) => message.content.toLowerCase().includes(lowerQuery))
		})
	}

	async getConversationsByWorkspace(workspaceId: string, options?: QueryOptions): Promise<Conversation[]> {
		return await this.list({
			...options,
			filters: { ...options?.filters, workspaceId },
		})
	}

	async getConversationsByProvider(provider: string, options?: QueryOptions): Promise<Conversation[]> {
		return await this.list({
			...options,
			filters: { ...options?.filters, provider },
		})
	}

	async getConversationsByTags(tags: string[], options?: QueryOptions): Promise<Conversation[]> {
		return await this.list({
			...options,
			filters: { ...options?.filters, tags },
		})
	}

	async clearMessages(conversationId: string): Promise<void> {
		const conversation = await this.get(conversationId)
		if (!conversation) {
			throw new Error(`Conversation with id ${conversationId} not found`)
		}

		conversation.messages = []
		conversation.metadata.messageCount = 0
		await this.update(conversationId, conversation)
	}

	async archiveConversation(conversationId: string): Promise<void> {
		await this.update(conversationId, { isArchived: true })
	}

	async unarchiveConversation(conversationId: string): Promise<void> {
		await this.update(conversationId, { isArchived: false })
	}

	async getArchivedConversations(workspaceId?: string): Promise<Conversation[]> {
		const filters: any = { isArchived: true }
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}
		return await this.list({ filters })
	}

	async addTag(conversationId: string, tag: string): Promise<void> {
		const conversation = await this.get(conversationId)
		if (!conversation) {
			throw new Error(`Conversation with id ${conversationId} not found`)
		}

		if (!conversation.tags.includes(tag)) {
			conversation.tags.push(tag)
			await this.update(conversationId, conversation)
		}
	}

	async removeTag(conversationId: string, tag: string): Promise<void> {
		const conversation = await this.get(conversationId)
		if (!conversation) {
			throw new Error(`Conversation with id ${conversationId} not found`)
		}

		const tagIndex = conversation.tags.indexOf(tag)
		if (tagIndex > -1) {
			conversation.tags.splice(tagIndex, 1)
			await this.update(conversationId, conversation)
		}
	}

	async updateMetadata(conversationId: string, metadata: Partial<Conversation["metadata"]>): Promise<void> {
		const conversation = await this.get(conversationId)
		if (!conversation) {
			throw new Error(`Conversation with id ${conversationId} not found`)
		}

		await this.update(conversationId, {
			metadata: {
				...conversation.metadata,
				...metadata,
			},
		})
	}

	async getConversationStats(conversationId: string): Promise<ConversationStats> {
		const conversation = await this.get(conversationId)
		if (!conversation) {
			throw new Error(`Conversation with id ${conversationId} not found`)
		}

		const totalTokens = conversation.metadata.tokenUsage?.totalTokens || 0
		const duration = conversation.metadata.duration || 0
		const toolUsageCount = conversation.messages.reduce((count, msg) => {
			return count + (msg.metadata.toolUsage?.length || 0)
		}, 0)

		return {
			messageCount: conversation.messages.length,
			totalTokens,
			duration,
			toolUsageCount,
			lastMessageAt: conversation.metadata.lastMessageAt || conversation.updatedAt,
			participantCount: new Set(conversation.messages.map((msg) => msg.role)).size,
		}
	}

	async getRecentConversations(workspaceId?: string, limit: number = 10): Promise<Conversation[]> {
		const filters: any = {}
		if (workspaceId) {
			filters.workspaceId = workspaceId
		}

		return await this.list({
			filters,
			sortBy: "updatedAt",
			sortOrder: "desc",
			limit,
		})
	}

	async exportConversation(conversationId: string, format: ExportFormat): Promise<string> {
		const conversation = await this.get(conversationId)
		if (!conversation) {
			throw new Error(`Conversation with id ${conversationId} not found`)
		}

		switch (format) {
			case "json":
				return JSON.stringify(conversation, null, 2)
			case "markdown":
				return this.convertToMarkdown(conversation)
			case "csv":
				return this.convertToCsv(conversation)
			case "txt":
				return this.convertToText(conversation)
			default:
				throw new Error(`Unsupported export format: ${format}`)
		}
	}

	async importConversation(data: string, format: ExportFormat, workspaceId: string): Promise<Conversation> {
		let conversationData: any

		switch (format) {
			case "json":
				conversationData = JSON.parse(data)
				break
			default:
				throw new Error(`Import format ${format} not yet supported`)
		}

		return await this.create({
			...conversationData,
			workspaceId,
			messages: undefined, // Will be added separately
		})
	}

	async duplicateConversation(conversationId: string, options?: DuplicateOptions): Promise<Conversation> {
		const original = await this.get(conversationId)
		if (!original) {
			throw new Error(`Conversation with id ${conversationId} not found`)
		}

		const duplicated = await this.create({
			workspaceId: options?.newWorkspaceId || original.workspaceId,
			title: options?.newTitle || `${original.title} (Copy)`,
			provider: original.provider,
			model: original.model,
			tags: [...original.tags],
			isArchived: false,
			metadata: options?.preserveMetadata ? { ...original.metadata } : {},
		})

		if (options?.includeMessages !== false) {
			for (const message of original.messages) {
				await this.addMessage(duplicated.id, {
					role: message.role,
					content: message.content,
					metadata: { ...message.metadata },
				})
			}
		}

		return duplicated
	}

	private convertToMarkdown(conversation: Conversation): string {
		let markdown = `# ${conversation.title}\n\n`
		markdown += `**Provider:** ${conversation.provider}\n`
		markdown += `**Model:** ${conversation.model}\n`
		markdown += `**Created:** ${conversation.createdAt.toISOString()}\n\n`

		for (const message of conversation.messages) {
			markdown += `## ${message.role.charAt(0).toUpperCase() + message.role.slice(1)}\n\n`
			markdown += `${message.content}\n\n`
			markdown += `*${message.createdAt.toISOString()}*\n\n---\n\n`
		}

		return markdown
	}

	private convertToCsv(conversation: Conversation): string {
		const header = "timestamp,role,content\n"
		const rows = conversation.messages
			.map((msg) => `${msg.createdAt.toISOString()},${msg.role},"${msg.content.replace(/"/g, '""')}"`)
			.join("\n")
		return header + rows
	}

	private convertToText(conversation: Conversation): string {
		let text = `${conversation.title}\n${"=".repeat(conversation.title.length)}\n\n`

		for (const message of conversation.messages) {
			text += `[${message.createdAt.toISOString()}] ${message.role.toUpperCase()}:\n`
			text += `${message.content}\n\n`
		}

		return text
	}
}
