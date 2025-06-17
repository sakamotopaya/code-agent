/**
 * Core module exports
 */

// Existing core exports
export * from "./interfaces"

// Data layer abstraction exports
export * from "./data"

// Re-export commonly used data layer components
export {
	RepositoryFactory,
	createRepositoryContainer,
	createNativeRepositoryContainer,
	DataLayerService,
	getDataLayer,
	type DataLayerConfig,
	type RepositoryContainer,
} from "./data"
