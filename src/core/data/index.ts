/**
 * Data layer abstraction exports
 */

// Core interfaces
export type * from "./interfaces"

// Entity types
export type * from "./types/entities"

// Repository factory
export {
	RepositoryFactory,
	ConfigValidator,
	createRepositoryContainer,
	createNativeRepositoryContainer,
	createExternalRepositoryContainer,
} from "./RepositoryFactory"

export type { DataLayerConfig, NativeServicesConfig, ExternalServicesConfig, RetryOptions } from "./RepositoryFactory"

// External data adapter
export type { IExternalDataAdapter, ExternalDataAdapterConfig } from "./adapters/IExternalDataAdapter"
export { BaseExternalDataAdapter } from "./adapters/IExternalDataAdapter"

// Native repository implementations
export { NativeRepositoryContainer } from "./repositories/native/NativeRepositoryContainer"
export { NativeWorkspaceRepository } from "./repositories/native/NativeWorkspaceRepository"
export { NativeConversationRepository } from "./repositories/native/NativeConversationRepository"
export { NativeProviderRepository } from "./repositories/native/NativeProviderRepository"
export { NativeContextRepository } from "./repositories/native/NativeContextRepository"
export { NativeTaskRepository } from "./repositories/native/NativeTaskRepository"

// External repository implementations
export { ExternalRepositoryContainer } from "./repositories/external/ExternalRepositoryContainer"
export { ExternalWorkspaceRepository } from "./repositories/external/ExternalWorkspaceRepository"
export { ExternalConversationRepository } from "./repositories/external/ExternalConversationRepository"
export { ExternalProviderRepository } from "./repositories/external/ExternalProviderRepository"
export { ExternalContextRepository } from "./repositories/external/ExternalContextRepository"
export { ExternalTaskRepository } from "./repositories/external/ExternalTaskRepository"

// Data layer service
export { DataLayerService, getDataLayer, hasRepositories } from "./DataLayerService"

// Integration helpers
export * from "./integration/TaskDataLayerIntegration"

// Usage examples
export * from "./examples/usage-example"
