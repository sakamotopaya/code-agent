/**
 * Interface for storage services
 * Provides abstraction for both VSCode and CLI storage implementations
 */
export interface IStorageService {
	/**
	 * Get the global storage path for this environment
	 */
	getGlobalStoragePath(): string

	/**
	 * Get a value from global state
	 */
	getGlobalState<T>(key: string): T | undefined

	/**
	 * Set a value in global state
	 */
	setGlobalState<T>(key: string, value: T): Promise<void>

	/**
	 * Get a secret value
	 */
	getSecret(key: string): string | undefined

	/**
	 * Set a secret value
	 */
	setSecret(key: string, value: string): Promise<void>
}
