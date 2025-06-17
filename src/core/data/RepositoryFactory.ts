/**
 * Repository Factory for creating data layer implementations
 */

import { IStorageService } from "../interfaces/IStorageService"
import { ProviderSettingsManager } from "../config/ProviderSettingsManager"
import { ISessionStorage } from "../../cli/types/storage-types"
import { RepositoryContainer } from "./interfaces"
import { IExternalDataAdapter } from "./adapters/IExternalDataAdapter"

export interface DataLayerConfig {
	mode: "native" | "external"
	workspaceRoot?: string
	externalAdapter?: IExternalDataAdapter
	nativeServices?: NativeServicesConfig
}

export interface NativeServicesConfig {
	storageService: IStorageService
	providerSettingsManager?: ProviderSettingsManager
	sessionStorage?: ISessionStorage
	workspacePath?: string
}

export interface ExternalServicesConfig {
	adapter: IExternalDataAdapter
	workspaceRoot: string
	timeout?: number
	retryOptions?: RetryOptions
}

export interface RetryOptions {
	maxRetries: number
	initialDelay: number
	maxDelay: number
	backoffFactor: number
}

export class ConfigValidator {
	async validate(config: DataLayerConfig): Promise<void> {
		if (!config.mode) {
			throw new Error("Data layer mode is required")
		}

		if (config.mode === "native") {
			await this.validateNativeConfig(config)
		} else if (config.mode === "external") {
			await this.validateExternalConfig(config)
		} else {
			throw new Error(`Unsupported data layer mode: ${config.mode}`)
		}
	}

	private async validateNativeConfig(config: DataLayerConfig): Promise<void> {
		if (!config.nativeServices) {
			throw new Error("Native services configuration is required for native mode")
		}

		if (!config.nativeServices.storageService) {
			throw new Error("Storage service is required for native mode")
		}
	}

	private async validateExternalConfig(config: DataLayerConfig): Promise<void> {
		if (!config.externalAdapter) {
			throw new Error("External adapter is required for external mode")
		}

		if (!config.workspaceRoot) {
			throw new Error("Workspace root is required for external mode")
		}

		// Test adapter connection
		try {
			await config.externalAdapter.healthCheck()
		} catch (error) {
			throw new Error(`External adapter health check failed: ${error}`)
		}
	}
}

export class RepositoryFactory {
	private static instance: RepositoryFactory | null = null
	private validator = new ConfigValidator()

	static getInstance(): RepositoryFactory {
		if (!this.instance) {
			this.instance = new RepositoryFactory()
		}
		return this.instance
	}

	/**
	 * Create repository container based on configuration
	 */
	async create(config: DataLayerConfig): Promise<RepositoryContainer> {
		await this.validator.validate(config)

		if (config.mode === "native") {
			return this.createNativeContainer(config)
		} else {
			return this.createExternalContainer(config)
		}
	}

	/**
	 * Create native repository container using existing storage services
	 */
	private async createNativeContainer(config: DataLayerConfig): Promise<RepositoryContainer> {
		const { nativeServices } = config
		if (!nativeServices) {
			throw new Error("Native services configuration required for native mode")
		}

		// Import native implementations (these will be created in next phase)
		const { NativeRepositoryContainer } = await import("./repositories/native/NativeRepositoryContainer")

		return new NativeRepositoryContainer(nativeServices)
	}

	/**
	 * Create external repository container using external data adapter
	 */
	private async createExternalContainer(config: DataLayerConfig): Promise<RepositoryContainer> {
		const { externalAdapter, workspaceRoot } = config
		if (!externalAdapter || !workspaceRoot) {
			throw new Error("External adapter and workspace root required for external mode")
		}

		// Test connection to external system
		await externalAdapter.connect()

		// Import external implementations (these will be created in next phase)
		const { ExternalRepositoryContainer } = await import("./repositories/external/ExternalRepositoryContainer")

		const externalConfig: ExternalServicesConfig = {
			adapter: externalAdapter,
			workspaceRoot,
			timeout: 30000,
			retryOptions: {
				maxRetries: 3,
				initialDelay: 1000,
				maxDelay: 10000,
				backoffFactor: 2,
			},
		}

		return new ExternalRepositoryContainer(externalConfig)
	}

	/**
	 * Create configuration for native mode
	 */
	static createNativeConfig(services: NativeServicesConfig): DataLayerConfig {
		return {
			mode: "native",
			nativeServices: services,
		}
	}

	/**
	 * Create configuration for external mode
	 */
	static createExternalConfig(adapter: IExternalDataAdapter, workspaceRoot: string): DataLayerConfig {
		return {
			mode: "external",
			externalAdapter: adapter,
			workspaceRoot,
		}
	}

	/**
	 * Reset factory instance (useful for testing)
	 */
	static reset(): void {
		this.instance = null
	}
}

/**
 * Convenience function to create repository container
 */
export async function createRepositoryContainer(config: DataLayerConfig): Promise<RepositoryContainer> {
	const factory = RepositoryFactory.getInstance()
	return await factory.create(config)
}

/**
 * Convenience function to create native repository container
 */
export async function createNativeRepositoryContainer(services: NativeServicesConfig): Promise<RepositoryContainer> {
	const config = RepositoryFactory.createNativeConfig(services)
	return await createRepositoryContainer(config)
}

/**
 * Convenience function to create external repository container
 */
export async function createExternalRepositoryContainer(
	adapter: IExternalDataAdapter,
	workspaceRoot: string,
): Promise<RepositoryContainer> {
	const config = RepositoryFactory.createExternalConfig(adapter, workspaceRoot)
	return await createRepositoryContainer(config)
}
