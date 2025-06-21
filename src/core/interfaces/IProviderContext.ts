/**
 * Interface for abstracting provider context dependencies
 * Allows different modes to provide their own context implementations
 */
export interface IProviderContext {
	/**
	 * Get the global storage path for persistent data
	 */
	getGlobalStoragePath(): string

	/**
	 * Get the current workspace path
	 */
	getWorkspacePath(): string

	/**
	 * Get the extension/application path
	 */
	getExtensionPath(): string

	// Persistent State Management
	/**
	 * Get a value from global/persistent state
	 */
	getGlobalState<T>(key: string): T | undefined

	/**
	 * Update a value in global/persistent state
	 */
	updateGlobalState(key: string, value: any): Promise<void>

	// Configuration Management
	/**
	 * Get current configuration/settings
	 */
	getConfiguration(): any

	/**
	 * Update configuration/settings
	 */
	updateConfiguration(config: any): Promise<void>

	// Lifecycle
	/**
	 * Initialize the context (async setup)
	 */
	initialize?(): Promise<void>

	/**
	 * Cleanup and dispose resources
	 */
	dispose?(): Promise<void>
}
