/**
 * Example implementation showing how external applications should implement
 * the IExternalDataAdapter interface for NPM package integration
 */

import { IExternalDataAdapter, QueryDefinition, Transaction, ExternalDataEvent } from "./IExternalDataAdapter"
import { QueryOptions, SearchOptions } from "../interfaces/IRepository"

/**
 * Example implementation for external applications to extend
 *
 * This shows how an external application (like the one with Workspaces, Conversations, etc.)
 * would implement the adapter interface to provide data access to code-agent.
 */
export class ExternalApplicationAdapter implements IExternalDataAdapter {
	private externalApp: any // Reference to external application's data services
	private workspaceContext: string | null = null

	constructor(externalApp: any) {
		this.externalApp = externalApp
	}

	async healthCheck(): Promise<void> {
		// External app can check if their services are available
		if (!this.externalApp || !this.externalApp.isInitialized()) {
			throw new Error("External application services not available")
		}
	}

	async connect(): Promise<void> {
		// Initialize connection to external app's data layer
		await this.externalApp.initialize()
	}

	async disconnect(): Promise<void> {
		// Cleanup external app connections
		await this.externalApp.cleanup()
	}

	isConnected(): boolean {
		return this.externalApp?.isInitialized() || false
	}

	async setWorkspaceContext(workspaceId: string): Promise<void> {
		this.workspaceContext = workspaceId
		// External app can set current workspace context
		await this.externalApp.setCurrentWorkspace(workspaceId)
	}

	async getWorkspaceContext(): Promise<string | null> {
		return this.workspaceContext
	}

	// Generic CRUD operations that map to external app's data layer
	async read<T>(resource: string, id: string): Promise<T | null> {
		switch (resource) {
			case "workspaces":
				return await this.externalApp.workspaceService.getById(id)
			case "conversations":
				return await this.externalApp.conversationService.getById(id)
			case "providers":
				return await this.externalApp.providerService.getById(id)
			case "contexts":
				return await this.externalApp.knowledgeService.getById(id)
			case "tasks":
				return await this.externalApp.taskService.getById(id)
			default:
				throw new Error(`Unknown resource type: ${resource}`)
		}
	}

	async create<T>(resource: string, data: T): Promise<T> {
		switch (resource) {
			case "workspaces":
				return await this.externalApp.workspaceService.create(data)
			case "conversations":
				return await this.externalApp.conversationService.create(data)
			case "providers":
				return await this.externalApp.providerService.create(data)
			case "contexts":
				return await this.externalApp.knowledgeService.create(data)
			case "tasks":
				return await this.externalApp.taskService.create(data)
			default:
				throw new Error(`Unknown resource type: ${resource}`)
		}
	}

	async update<T>(resource: string, id: string, updates: Partial<T>): Promise<T> {
		switch (resource) {
			case "workspaces":
				return await this.externalApp.workspaceService.update(id, updates)
			case "conversations":
				return await this.externalApp.conversationService.update(id, updates)
			case "providers":
				return await this.externalApp.providerService.update(id, updates)
			case "contexts":
				return await this.externalApp.knowledgeService.update(id, updates)
			case "tasks":
				return await this.externalApp.taskService.update(id, updates)
			default:
				throw new Error(`Unknown resource type: ${resource}`)
		}
	}

	async delete(resource: string, id: string): Promise<void> {
		switch (resource) {
			case "workspaces":
				await this.externalApp.workspaceService.delete(id)
				break
			case "conversations":
				await this.externalApp.conversationService.delete(id)
				break
			case "providers":
				await this.externalApp.providerService.delete(id)
				break
			case "contexts":
				await this.externalApp.knowledgeService.delete(id)
				break
			case "tasks":
				await this.externalApp.taskService.delete(id)
				break
			default:
				throw new Error(`Unknown resource type: ${resource}`)
		}
	}

	async list<T>(resource: string, options?: QueryOptions): Promise<T[]> {
		// Map code-agent query options to external app's query format
		const externalQuery = this.mapQueryOptions(options)

		switch (resource) {
			case "workspaces":
				return await this.externalApp.workspaceService.list(externalQuery)
			case "conversations":
				return await this.externalApp.conversationService.list(externalQuery)
			case "providers":
				return await this.externalApp.providerService.list(externalQuery)
			case "contexts":
				return await this.externalApp.knowledgeService.list(externalQuery)
			case "tasks":
				return await this.externalApp.taskService.list(externalQuery)
			default:
				throw new Error(`Unknown resource type: ${resource}`)
		}
	}

	async exists(resource: string, id: string): Promise<boolean> {
		try {
			const item = await this.read(resource, id)
			return item !== null
		} catch {
			return false
		}
	}

	// Batch operations for performance
	async batchRead<T>(resource: string, ids: string[]): Promise<(T | null)[]> {
		// External app may have optimized batch operations
		if (this.externalApp[`${resource}Service`]?.batchGet) {
			return await this.externalApp[`${resource}Service`].batchGet(ids)
		}

		// Fallback to individual reads
		return await Promise.all(ids.map((id) => this.read<T>(resource, id)))
	}

	async batchCreate<T>(resource: string, items: T[]): Promise<T[]> {
		if (this.externalApp[`${resource}Service`]?.batchCreate) {
			return await this.externalApp[`${resource}Service`].batchCreate(items)
		}

		return await Promise.all(items.map((item) => this.create<T>(resource, item)))
	}

	async batchUpdate<T>(resource: string, updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]> {
		if (this.externalApp[`${resource}Service`]?.batchUpdate) {
			return await this.externalApp[`${resource}Service`].batchUpdate(updates)
		}

		return await Promise.all(updates.map(({ id, data }) => this.update<T>(resource, id, data)))
	}

	async batchDelete(resource: string, ids: string[]): Promise<void> {
		if (this.externalApp[`${resource}Service`]?.batchDelete) {
			await this.externalApp[`${resource}Service`].batchDelete(ids)
			return
		}

		await Promise.all(ids.map((id) => this.delete(resource, id)))
	}

	async query<T>(resource: string, query: QueryDefinition): Promise<T[]> {
		// Map QueryDefinition to external app's query format
		const externalQuery = this.mapQueryDefinition(query)

		if (this.externalApp[`${resource}Service`]?.query) {
			return await this.externalApp[`${resource}Service`].query(externalQuery)
		}

		// Fallback to list with filters
		return await this.list<T>(resource, {
			filters: query.filters,
			limit: query.limit,
			offset: query.offset,
		})
	}

	async search<T>(resource: string, searchQuery: string, options?: SearchOptions): Promise<T[]> {
		if (this.externalApp[`${resource}Service`]?.search) {
			return await this.externalApp[`${resource}Service`].search(searchQuery, options)
		}

		throw new Error(`Search not implemented for resource: ${resource}`)
	}

	async count(resource: string, options?: QueryOptions): Promise<number> {
		if (this.externalApp[`${resource}Service`]?.count) {
			return await this.externalApp[`${resource}Service`].count(this.mapQueryOptions(options))
		}

		// Fallback to list and count
		const items = await this.list(resource, options)
		return items.length
	}

	// Transaction support (if external app supports it)
	async beginTransaction(): Promise<Transaction> {
		if (this.externalApp.transactionManager) {
			const txn = await this.externalApp.transactionManager.begin()
			return {
				id: txn.id,
				createdAt: new Date(),
				operations: [],
			}
		}

		throw new Error("Transactions not supported by external application")
	}

	async commitTransaction(transaction: Transaction): Promise<void> {
		if (this.externalApp.transactionManager) {
			await this.externalApp.transactionManager.commit(transaction.id)
		}
	}

	async rollbackTransaction(transaction: Transaction): Promise<void> {
		if (this.externalApp.transactionManager) {
			await this.externalApp.transactionManager.rollback(transaction.id)
		}
	}

	// Custom operations specific to external app
	async executeCustomOperation(operation: string, params: any): Promise<any> {
		if (this.externalApp.customOperations?.[operation]) {
			return await this.externalApp.customOperations[operation](params)
		}

		throw new Error(`Unknown custom operation: ${operation}`)
	}

	// Metadata operations
	async getResourceSchema(resource: string): Promise<any> {
		return this.externalApp.schemaService?.getSchema(resource) || {}
	}

	async getAvailableResources(): Promise<string[]> {
		return ["workspaces", "conversations", "providers", "contexts", "tasks"]
	}

	// Event handling for real-time updates (if supported)
	async subscribe(resource: string, callback: (event: ExternalDataEvent) => void): Promise<string> {
		if (this.externalApp.eventService) {
			return await this.externalApp.eventService.subscribe(resource, callback)
		}

		throw new Error("Real-time events not supported by external application")
	}

	async unsubscribe(subscriptionId: string): Promise<void> {
		if (this.externalApp.eventService) {
			await this.externalApp.eventService.unsubscribe(subscriptionId)
		}
	}

	// Helper methods to map between code-agent and external app formats
	private mapQueryOptions(options?: QueryOptions): any {
		if (!options) return {}

		return {
			limit: options.limit,
			offset: options.offset,
			sortBy: options.sortBy,
			sortOrder: options.sortOrder,
			filters: options.filters,
		}
	}

	private mapQueryDefinition(query: QueryDefinition): any {
		return {
			filters: query.filters,
			sort: query.sort,
			limit: query.limit,
			offset: query.offset,
			include: query.include,
		}
	}
}

/**
 * Example usage for external applications:
 *
 * ```typescript
 * import { createExternalRepositoryContainer, ExternalApplicationAdapter } from 'code-agent'
 *
 * // In your external application:
 * const adapter = new ExternalApplicationAdapter(myAppServices)
 * const repositories = await createExternalRepositoryContainer(adapter, '/workspace/root')
 *
 * // Use code-agent with your data layer:
 * const workspace = await repositories.workspace.getCurrentWorkspace()
 * const conversations = await repositories.conversation.getConversationsByWorkspace(workspace.id)
 * ```
 */
