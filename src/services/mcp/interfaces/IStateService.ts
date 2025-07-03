/**
 * Platform abstraction for state/configuration storage
 */
export interface IStateService {
	/**
	 * Get stored value by key
	 */
	get<T>(key: string): Promise<T | undefined>

	/**
	 * Update stored value by key
	 */
	update(key: string, value: any): Promise<void>

	/**
	 * Remove stored value by key
	 */
	remove(key: string): Promise<void>

	/**
	 * Clear all stored values (optional, for cleanup)
	 */
	clear?(): Promise<void>
}
