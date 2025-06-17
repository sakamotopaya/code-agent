/**
 * External repository container for external application integration
 */

import { RepositoryContainer } from "../../interfaces"
import { ExternalServicesConfig } from "../../RepositoryFactory"
import { ExternalWorkspaceRepository } from "./ExternalWorkspaceRepository"
import { ExternalConversationRepository } from "./ExternalConversationRepository"
import { ExternalProviderRepository } from "./ExternalProviderRepository"
import { ExternalContextRepository } from "./ExternalContextRepository"
import { ExternalTaskRepository } from "./ExternalTaskRepository"

export class ExternalRepositoryContainer implements RepositoryContainer {
	public readonly workspace: ExternalWorkspaceRepository
	public readonly conversation: ExternalConversationRepository
	public readonly provider: ExternalProviderRepository
	public readonly context: ExternalContextRepository
	public readonly task: ExternalTaskRepository

	constructor(config: ExternalServicesConfig) {
		// Create repository instances using external adapter
		this.workspace = new ExternalWorkspaceRepository(config)
		this.conversation = new ExternalConversationRepository(config)
		this.provider = new ExternalProviderRepository(config)
		this.context = new ExternalContextRepository(config)
		this.task = new ExternalTaskRepository(config)
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
