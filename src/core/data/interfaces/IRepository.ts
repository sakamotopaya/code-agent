/**
 * Core repository interface for generic CRUD operations
 */

export interface QueryOptions {
	limit?: number
	offset?: number
	sortBy?: string
	sortOrder?: "asc" | "desc"
	filters?: Record<string, any>
}

export interface SearchOptions {
	limit?: number
	offset?: number
	highlightMatches?: boolean
	fuzzySearch?: boolean
}

/**
 * Base repository interface for all data entities
 */
export interface IRepository<T, TKey = string> {
	/**
	 * Get a single entity by ID
	 */
	get(id: TKey): Promise<T | null>

	/**
	 * Create a new entity
	 */
	create(entity: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T>

	/**
	 * Update an existing entity
	 */
	update(id: TKey, updates: Partial<T>): Promise<T>

	/**
	 * Delete an entity
	 */
	delete(id: TKey): Promise<void>

	/**
	 * List entities with optional filtering and pagination
	 */
	list(options?: QueryOptions): Promise<T[]>

	/**
	 * Check if an entity exists
	 */
	exists(id: TKey): Promise<boolean>

	/**
	 * Get multiple entities by IDs
	 */
	getMany(ids: TKey[]): Promise<(T | null)[]>

	/**
	 * Create multiple entities
	 */
	createMany(entities: Omit<T, "id" | "createdAt" | "updatedAt">[]): Promise<T[]>

	/**
	 * Update multiple entities
	 */
	updateMany(updates: Array<{ id: TKey; data: Partial<T> }>): Promise<T[]>

	/**
	 * Delete multiple entities
	 */
	deleteMany(ids: TKey[]): Promise<void>

	/**
	 * Count entities matching the given criteria
	 */
	count(options?: QueryOptions): Promise<number>
}
