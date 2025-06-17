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
