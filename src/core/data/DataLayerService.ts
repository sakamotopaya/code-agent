/**
 * Data Layer Service - Integration point for repository pattern
 * This service can be optionally used to replace direct storage access
 */

import {
	RepositoryFactory,
	createNativeRepositoryContainer,
	type DataLayerConfig,
	type RepositoryContainer,
	type NativeServicesConfig,
} from "./index"
import { IStorageService } from "../interfaces/IStorageService"
import { ProviderSettingsManager } from "../config/ProviderSettingsManager"

export class DataLayerService {
	private static instance: DataLayerService | null = null
	private repositories: RepositoryContainer | null = null
	private isInitialized = false

	static getInstance(): DataLayerService {
		if (!this.instance) {
			this.instance = new DataLayerService()
		}
		return this.instance
	}

	/**
	 * Initialize with native storage services (backwards compatible)
	 */
	async initializeNative(
		storageService: IStorageService,
		providerSettingsManager?: ProviderSettingsManager,
		workspacePath?: string,
	): Promise<RepositoryContainer> {
		if (this.isInitialized && this.repositories) {
			return this.repositories
		}

		const services: NativeServicesConfig = {
			storageService,
			providerSettingsManager,
			workspacePath,
		}

		this.repositories = await createNativeRepositoryContainer(services)
		this.isInitialized = true

		return this.repositories
	}

	/**
	 * Initialize with external data layer (for future integration)
	 */
	async initializeExternal(config: DataLayerConfig): Promise<RepositoryContainer> {
		if (this.isInitialized && this.repositories) {
			return this.repositories
		}

		const factory = RepositoryFactory.getInstance()
		this.repositories = await factory.create(config)
		this.isInitialized = true

		return this.repositories
	}

	/**
	 * Get current repositories (null if not initialized)
	 */
	getRepositories(): RepositoryContainer | null {
		return this.repositories
	}

	/**
	 * Check if data layer is initialized
	 */
	isReady(): boolean {
		return this.isInitialized && this.repositories !== null
	}

	/**
	 * Reset the service (useful for testing)
	 */
	reset(): void {
		this.repositories = null
		this.isInitialized = false
	}

	/**
	 * Get workspace repository (convenience method)
	 */
	getWorkspaceRepository() {
		return this.repositories?.workspace || null
	}

	/**
	 * Get conversation repository (convenience method)
	 */
	getConversationRepository() {
		return this.repositories?.conversation || null
	}

	/**
	 * Get provider repository (convenience method)
	 */
	getProviderRepository() {
		return this.repositories?.provider || null
	}

	/**
	 * Get context repository (convenience method)
	 */
	getContextRepository() {
		return this.repositories?.context || null
	}

	/**
	 * Get task repository (convenience method)
	 */
	getTaskRepository() {
		return this.repositories?.task || null
	}
}

/**
 * Convenience function to get the data layer service instance
 */
export function getDataLayer(): DataLayerService {
	return DataLayerService.getInstance()
}

/**
 * Type guard to check if repositories are available
 */
export function hasRepositories(
	dataLayer: DataLayerService,
): dataLayer is DataLayerService & { getRepositories(): RepositoryContainer } {
	return dataLayer.isReady()
}
