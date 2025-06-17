/**
 * Native repository container for backwards compatibility
 */

import { RepositoryContainer } from "../../interfaces"
import { NativeServicesConfig } from "../../RepositoryFactory"
import { NativeWorkspaceRepository } from "./NativeWorkspaceRepository"
import { NativeConversationRepository } from "./NativeConversationRepository"
import { NativeProviderRepository } from "./NativeProviderRepository"
import { NativeContextRepository } from "./NativeContextRepository"
import { NativeTaskRepository } from "./NativeTaskRepository"

export class NativeRepositoryContainer implements RepositoryContainer {
	public readonly workspace: NativeWorkspaceRepository
	public readonly conversation: NativeConversationRepository
	public readonly provider: NativeProviderRepository
	public readonly context: NativeContextRepository
	public readonly task: NativeTaskRepository

	constructor(services: NativeServicesConfig) {
		// Create repository instances using existing services
		this.workspace = new NativeWorkspaceRepository(services)
		this.conversation = new NativeConversationRepository(services)
		this.provider = new NativeProviderRepository(services)
		this.context = new NativeContextRepository(services)
		this.task = new NativeTaskRepository(services)
	}

	/**
	 * Initialize all repositories
	 */
	async initialize(): Promise<void> {
		await Promise.all([
			this.workspace.initialize(),
			this.conversation.initialize(),
			this.provider.initialize(),
			this.context.initialize(),
			this.task.initialize(),
		])
	}

	/**
	 * Cleanup resources
	 */
	async dispose(): Promise<void> {
		await Promise.all([
			this.workspace.dispose(),
			this.conversation.dispose(),
			this.provider.dispose(),
			this.context.dispose(),
			this.task.dispose(),
		])
	}

	/**
	 * Get all repositories
	 */
	getAllRepositories() {
		return {
			workspace: this.workspace,
			conversation: this.conversation,
			provider: this.provider,
			context: this.context,
			task: this.task,
		}
	}
}
