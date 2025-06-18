/**
 * External data adapter interface for NPM package integration
 *
 * When code-agent is used as an NPM package dependency, the external application
 * implements this interface to provide data layer access to code-agent.
 *
 * Usage:
 * 1. External app: npm install code-agent
 * 2. External app: implements IExternalDataAdapter
 * 3. External app: passes adapter to code-agent's RepositoryFactory
 * 4. Code-agent: uses adapter to access external app's data layer
 */

import { QueryOptions, SearchOptions } from "../interfaces/IRepository"

export interface QueryDefinition {
	filters?: Record<string, any>
	sort?: Array<{ field: string; direction: "asc" | "desc" }>
	limit?: number
	offset?: number
	include?: string[]
}

export interface Transaction {
	id: string
	createdAt: Date
	operations: TransactionOperation[]
}

export interface TransactionOperation {
	type: "create" | "update" | "delete"
	resource: string
	id?: string
	data?: any
}

export interface IExternalDataAdapter {
	/**
	 * Connection management
	 */
	healthCheck(): Promise<void>
	connect(): Promise<void>
	disconnect(): Promise<void>
	isConnected(): boolean

	/**
	 * Generic CRUD operations
	 */
	read<T>(resource: string, id: string): Promise<T | null>
	create<T>(resource: string, data: T): Promise<T>
	update<T>(resource: string, id: string, updates: Partial<T>): Promise<T>
	delete(resource: string, id: string): Promise<void>
	list<T>(resource: string, options?: QueryOptions): Promise<T[]>
	exists(resource: string, id: string): Promise<boolean>

	/**
	 * Batch operations for performance
	 */
	batchRead<T>(resource: string, ids: string[]): Promise<(T | null)[]>
	batchCreate<T>(resource: string, items: T[]): Promise<T[]>
	batchUpdate<T>(resource: string, updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]>
	batchDelete(resource: string, ids: string[]): Promise<void>

	/**
	 * Query operations
	 */
	query<T>(resource: string, query: QueryDefinition): Promise<T[]>
	search<T>(resource: string, searchQuery: string, options?: SearchOptions): Promise<T[]>
	count(resource: string, options?: QueryOptions): Promise<number>

	/**
	 * Transaction support
	 */
	beginTransaction(): Promise<Transaction>
	commitTransaction(transaction: Transaction): Promise<void>
	rollbackTransaction(transaction: Transaction): Promise<void>

	/**
	 * Workspace-specific operations
	 */
	setWorkspaceContext(workspaceId: string): Promise<void>
	getWorkspaceContext(): Promise<string | null>

	/**
	 * Custom operations for specific external application needs
	 */
	executeCustomOperation(operation: string, params: any): Promise<any>

	/**
	 * Metadata and schema operations
	 */
	getResourceSchema(resource: string): Promise<any>
	getAvailableResources(): Promise<string[]>

	/**
	 * Event handling for real-time updates
	 */
	subscribe(resource: string, callback: (event: ExternalDataEvent) => void): Promise<string>
	unsubscribe(subscriptionId: string): Promise<void>
}

export interface ExternalDataEvent {
	type: "created" | "updated" | "deleted"
	resource: string
	id: string
	data?: any
	timestamp: Date
}

/**
 * Configuration for external data adapters
 */
export interface ExternalDataAdapterConfig {
	baseUrl?: string
	apiKey?: string
	timeout?: number
	retryOptions?: {
		maxRetries: number
		initialDelay: number
		maxDelay: number
		backoffFactor: number
	}
	cacheOptions?: {
		enabled: boolean
		ttl: number
		maxSize: number
	}
	headers?: Record<string, string>
	[key: string]: any
}

/**
 * Base class for external data adapters
 */
export abstract class BaseExternalDataAdapter implements IExternalDataAdapter {
	protected config: ExternalDataAdapterConfig
	protected connected = false
	protected subscriptions = new Map<string, (event: ExternalDataEvent) => void>()

	constructor(config: ExternalDataAdapterConfig) {
		this.config = config
	}

	abstract healthCheck(): Promise<void>
	abstract connect(): Promise<void>
	abstract disconnect(): Promise<void>

	isConnected(): boolean {
		return this.connected
	}

	abstract read<T>(resource: string, id: string): Promise<T | null>
	abstract create<T>(resource: string, data: T): Promise<T>
	abstract update<T>(resource: string, id: string, updates: Partial<T>): Promise<T>
	abstract delete(resource: string, id: string): Promise<void>
	abstract list<T>(resource: string, options?: QueryOptions): Promise<T[]>
	abstract exists(resource: string, id: string): Promise<boolean>

	abstract batchRead<T>(resource: string, ids: string[]): Promise<(T | null)[]>
	abstract batchCreate<T>(resource: string, items: T[]): Promise<T[]>
	abstract batchUpdate<T>(resource: string, updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]>
	abstract batchDelete(resource: string, ids: string[]): Promise<void>

	abstract query<T>(resource: string, query: QueryDefinition): Promise<T[]>
	abstract search<T>(resource: string, searchQuery: string, options?: SearchOptions): Promise<T[]>
	abstract count(resource: string, options?: QueryOptions): Promise<number>

	abstract beginTransaction(): Promise<Transaction>
	abstract commitTransaction(transaction: Transaction): Promise<void>
	abstract rollbackTransaction(transaction: Transaction): Promise<void>

	abstract setWorkspaceContext(workspaceId: string): Promise<void>
	abstract getWorkspaceContext(): Promise<string | null>

	abstract executeCustomOperation(operation: string, params: any): Promise<any>

	abstract getResourceSchema(resource: string): Promise<any>
	abstract getAvailableResources(): Promise<string[]>

	abstract subscribe(resource: string, callback: (event: ExternalDataEvent) => void): Promise<string>
	abstract unsubscribe(subscriptionId: string): Promise<void>

	/**
	 * Utility method to ensure connection
	 */
	protected async ensureConnected(): Promise<void> {
		if (!this.connected) {
			await this.connect()
		}
	}

	/**
	 * Utility method for retrying operations
	 */
	protected async retry<T>(operation: () => Promise<T>): Promise<T> {
		const {
			maxRetries = 3,
			initialDelay = 1000,
			maxDelay = 10000,
			backoffFactor = 2,
		} = this.config.retryOptions || {}

		let lastError: Error
		let delay = initialDelay

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation()
			} catch (error) {
				lastError = error as Error

				if (attempt === maxRetries) {
					break
				}

				await new Promise((resolve) => setTimeout(resolve, delay))
				delay = Math.min(delay * backoffFactor, maxDelay)
			}
		}

		throw lastError!
	}
}
