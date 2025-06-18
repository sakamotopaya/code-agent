/**
 * Example usage of the data layer abstraction
 * This demonstrates how to integrate the repository pattern with existing code
 */

import {
	createNativeRepositoryContainer,
	createExternalRepositoryContainer,
	RepositoryFactory,
	type DataLayerConfig,
	type NativeServicesConfig,
} from "../index"
import { IStorageService } from "../../interfaces/IStorageService"

/**
 * Example: Creating a native repository container
 */
export async function createNativeExample(storageService: IStorageService) {
	const services: NativeServicesConfig = {
		storageService,
		workspacePath: "/workspace/path",
	}

	const repositories = await createNativeRepositoryContainer(services)

	// Example usage
	const workspace = await repositories.workspace.createFromPath("/workspace/path", {
		name: "Example Workspace",
	})

	const conversation = await repositories.conversation.create({
		workspaceId: workspace.id,
		title: "Example Conversation",
		provider: "openai",
		model: "gpt-4",
		tags: [],
		isArchived: false,
		metadata: {},
		messages: [], // Required by interface
	})

	return { repositories, workspace, conversation }
}

/**
 * Example: Factory pattern usage
 */
export async function createWithFactory(config: DataLayerConfig) {
	const factory = RepositoryFactory.getInstance()
	const repositories = await factory.create(config)

	return repositories
}

/**
 * Example: External repository container (when implemented)
 */
export async function createExternalExample() {
	// This would be used when external adapters are implemented
	// const adapter = new HttpExternalDataAdapter({ baseUrl: 'http://external-app.com/api' })
	// const repositories = await createExternalRepositoryContainer(adapter, '/workspace/root')
	// return repositories

	// For now, return null to avoid errors
	return null
}

/**
 * Example: Switching between native and external modes
 */
export class DataLayerManager {
	private repositories: any = null

	async initializeNative(storageService: IStorageService) {
		const config: DataLayerConfig = {
			mode: "native",
			nativeServices: {
				storageService,
				workspacePath: "/workspace/path",
			},
		}

		this.repositories = await createWithFactory(config)
		return this.repositories
	}

	async initializeExternal(externalAdapter: any, workspaceRoot: string) {
		const config: DataLayerConfig = {
			mode: "external",
			externalAdapter,
			workspaceRoot,
		}

		this.repositories = await createWithFactory(config)
		return this.repositories
	}

	getRepositories() {
		return this.repositories
	}
}

// Example: Task Integration with Data Layer
export async function exampleTaskWithDataLayer() {
	console.log("=== Task Integration with Data Layer ===")

	// Mock external adapter for demonstration
	class MockTaskDataAdapter {
		private storage = new Map<string, any>()

		async read<T>(collection: string, id: string): Promise<T | null> {
			const key = `${collection}:${id}`
			return this.storage.get(key) || null
		}

		async create<T>(collection: string, data: any): Promise<T> {
			const id = data.id || `${collection}-${Date.now()}`
			const entity = { ...data, id, createdAt: new Date(), updatedAt: new Date() }
			const key = `${collection}:${id}`
			this.storage.set(key, entity)
			console.log(`✅ Created ${collection}: ${id}`)
			return entity as T
		}

		async update<T>(collection: string, id: string, updates: any): Promise<T> {
			const key = `${collection}:${id}`
			const existing = this.storage.get(key)
			if (!existing) throw new Error(`Entity not found: ${key}`)

			const updated = { ...existing, ...updates, updatedAt: new Date() }
			this.storage.set(key, updated)
			console.log(`✅ Updated ${collection}: ${id}`)
			return updated as T
		}

		async delete(collection: string, id: string): Promise<void> {
			const key = `${collection}:${id}`
			this.storage.delete(key)
			console.log(`✅ Deleted ${collection}: ${id}`)
		}

		async list<T>(collection: string, options?: any): Promise<T[]> {
			const prefix = `${collection}:`
			const results: T[] = []
			for (const [key, value] of this.storage.entries()) {
				if (key.startsWith(prefix)) {
					results.push(value)
				}
			}
			console.log(`📋 Listed ${collection}: ${results.length} items`)
			return results
		}
	}

	// Create repositories with external adapter
	const repositories = await createExternalRepositoryContainer(
		new MockTaskDataAdapter() as any, // Cast to satisfy IExternalDataAdapter interface
		"/tmp/test-workspace",
	)

	await repositories.initialize?.()

	// Task integration would be shown here if Task class is available
	console.log("🎯 Task can now optionally use data layer repositories")
	console.log("📊 All task operations can be tracked through the repository pattern")

	await repositories.dispose?.()
	console.log("✅ Task integration example completed")
}

// Example: NPM Package Integration Scenario
export async function exampleNPMPackageIntegration() {
	console.log("=== NPM Package Integration Scenario ===")
	console.log("This demonstrates how an external application would use code-agent as an NPM dependency")

	// This is what an external application would implement
	class ExternalAppDataAdapter {
		constructor(private dbConnection: any) {}

		async read<T>(collection: string, id: string): Promise<T | null> {
			// External app would query their database
			console.log(`📖 External app reading ${collection}/${id} from their database`)
			return null // Mock implementation
		}

		async create<T>(collection: string, data: any): Promise<T> {
			// External app would insert into their database
			console.log(`💾 External app creating ${collection} in their database:`, data)
			return { id: `ext-${Date.now()}`, ...data } as T
		}

		async update<T>(collection: string, id: string, updates: any): Promise<T> {
			// External app would update their database
			console.log(`✏️ External app updating ${collection}/${id} in their database:`, updates)
			return { id, ...updates } as T
		}

		async delete(collection: string, id: string): Promise<void> {
			// External app would delete from their database
			console.log(`🗑️ External app deleting ${collection}/${id} from their database`)
		}

		async list<T>(collection: string, options?: any): Promise<T[]> {
			// External app would query their database
			console.log(`📋 External app listing ${collection} from their database`, options)
			return []
		}
	}

	// External application setup
	const externalAppConfig = {
		// Their database connection, config, etc.
		database: { connection: "mock-db-connection" },
		workspaceManager: {
			/* their workspace logic */
		},
	}

	// Create repositories using their adapter
	const repositories = await createExternalRepositoryContainer(
		new ExternalAppDataAdapter(externalAppConfig.database) as any,
		"/external/app/workspace",
	)

	await repositories.initialize?.()

	console.log("🔗 External application has integrated code-agent with their data layer")
	console.log("📦 All conversation, workspace, and task data will be stored in their system")
	console.log("🎯 All data operations will flow through their database via the adapter pattern")

	await repositories.dispose?.()
}
