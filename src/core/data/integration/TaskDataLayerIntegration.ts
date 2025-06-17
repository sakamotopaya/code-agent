/**
 * Integration point for Task class to optionally use data layer
 * This demonstrates how existing code can gradually adopt the repository pattern
 */

import { getDataLayer, hasRepositories } from "../DataLayerService"
import { type RepositoryContainer } from "../interfaces"

/**
 * Optional integration helper for Task class
 * Shows how existing code can gradually adopt repository pattern
 */
export class TaskDataLayerIntegration {
	private dataLayer = getDataLayer()

	/**
	 * Check if data layer is available and initialized
	 */
	isDataLayerAvailable(): boolean {
		return hasRepositories(this.dataLayer)
	}

	/**
	 * Get repositories if available, null otherwise
	 */
	getRepositories(): RepositoryContainer | null {
		return this.dataLayer.getRepositories()
	}

	/**
	 * Save task state using repository if available, fallback to original method
	 */
	async saveTaskState(taskData: any, fallbackSave?: () => Promise<void>): Promise<void> {
		const repositories = this.getRepositories()

		if (repositories && taskData.workspaceId) {
			try {
				// Use repository pattern for task persistence
				await repositories.task.create({
					workspaceId: taskData.workspaceId,
					conversationId: taskData.conversationId,
					type: taskData.type || "conversation",
					name: taskData.name || "Task",
					description: taskData.description,
					status: "pending",
					progress: { percentage: 0 },
					metadata: taskData.metadata || {},
				})
				return
			} catch (error) {
				// Fall back to original method if repository fails
				console.warn("Repository save failed, falling back to original method:", error)
			}
		}

		// Fallback to original save method
		if (fallbackSave) {
			await fallbackSave()
		}
	}

	/**
	 * Load conversation using repository if available
	 */
	async loadConversation(conversationId: string, fallbackLoad?: () => Promise<any>): Promise<any> {
		const repositories = this.getRepositories()

		if (repositories) {
			try {
				const conversation = await repositories.conversation.get(conversationId)
				if (conversation) {
					return conversation
				}
			} catch (error) {
				console.warn("Repository load failed, falling back to original method:", error)
			}
		}

		// Fallback to original load method
		if (fallbackLoad) {
			return await fallbackLoad()
		}

		return null
	}

	/**
	 * Save workspace context using repository if available
	 */
	async saveWorkspaceContext(
		workspaceId: string,
		contextData: any,
		fallbackSave?: () => Promise<void>,
	): Promise<void> {
		const repositories = this.getRepositories()

		if (repositories) {
			try {
				await repositories.context.createCustomContext(workspaceId, "task-context", contextData)
				return
			} catch (error) {
				console.warn("Repository context save failed, falling back to original method:", error)
			}
		}

		// Fallback to original save method
		if (fallbackSave) {
			await fallbackSave()
		}
	}
}

/**
 * Factory function to create integration instance
 */
export function createTaskDataLayerIntegration(): TaskDataLayerIntegration {
	return new TaskDataLayerIntegration()
}

/**
 * Helper to check if task should use data layer
 */
export function shouldUseDataLayer(): boolean {
	return hasRepositories(getDataLayer())
}
