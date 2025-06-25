import { IOutputAdapter } from "../../interfaces/IOutputAdapter"
import { ProcessedContent } from "../../interfaces/IContentProcessor"
import { HistoryItem, ClineMessage } from "@roo-code/types"
import { ClineProvider } from "../../webview/ClineProvider"
import { ExtensionMessage } from "../../../shared/ExtensionMessage"

/**
 * VSCode implementation of IOutputAdapter
 * Bridges the unified output interface to VSCode webview messaging system
 */
export class VSCodeOutputAdapter implements IOutputAdapter {
	private readonly provider: ClineProvider

	constructor(provider: ClineProvider) {
		this.provider = provider
	}

	// Content Output Methods
	async outputContent(message: ClineMessage): Promise<void> {
		// Send complete message to webview
		await this.provider.postMessageToWebview({
			type: "partialMessage",
			partialMessage: message,
		})
	}

	async outputPartialContent(partialMessage: ClineMessage): Promise<void> {
		// Send partial update to webview
		await this.provider.postMessageToWebview({
			type: "partialMessage",
			partialMessage,
		})
	}

	async streamChunk(chunk: string): Promise<void> {
		// VSCode webview doesn't have direct streaming support like CLI
		// Content will be shown when message is complete
		// This could be enhanced in the future if needed
		console.log(`[VSCodeOutputAdapter] Streaming chunk received: ${chunk.length} chars`)
	}

	// Message Communication Methods
	async sendMessage(message: any): Promise<void> {
		// Send any structured message to webview
		await this.provider.postMessageToWebview(message as ExtensionMessage)
	}

	async sendPartialUpdate(partialMessage: any): Promise<void> {
		// Send partial update (typically a ClineMessage)
		await this.provider.postMessageToWebview({
			type: "partialMessage",
			partialMessage,
		})
	}

	// State Management Methods
	async syncState(state: any): Promise<void> {
		// Sync complete application state to webview
		await this.provider.postMessageToWebview({
			type: "state",
			state,
		})
	}

	async notifyStateChange(changeType: string, data?: any): Promise<void> {
		// Notify webview of state changes
		await this.provider.postMessageToWebview({
			type: "action",
			action: changeType,
			...data,
		})
	}

	// Data Persistence Methods
	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		// Delegate to provider's task history management
		await this.provider.updateTaskHistory(item)

		// Return updated history from provider
		const state = await this.provider.getStateToPostToWebview()
		return state.taskHistory || []
	}

	async updatePersistentData(key: string, data: any): Promise<void> {
		// VSCode uses the provider's internal state management system
		// For now, we'll log this but VSCode state is managed differently
		console.log(`[VSCodeOutputAdapter] Persistent data update requested for key: ${key}`)
		// Note: VSCode extension state is managed through the provider's internal systems
		// This method is part of the generic IOutputAdapter interface but VSCode handles
		// state management through its own mechanisms (context.globalState, etc.)
	}

	getPersistentData<T>(key: string): T | undefined {
		// VSCode uses the provider's internal state management system
		console.log(`[VSCodeOutputAdapter] Persistent data retrieval requested for key: ${key}`)
		// Note: VSCode extension state is managed through the provider's internal systems
		// This method is part of the generic IOutputAdapter interface but VSCode handles
		// state management through its own mechanisms (context.globalState, etc.)
		return undefined
	}

	// Lifecycle Methods
	reset(): void {
		// Reset any adapter-specific state
		// VSCode adapter doesn't maintain significant internal state
		console.log("[VSCodeOutputAdapter] Reset called")
	}

	async dispose(): Promise<void> {
		// Cleanup resources if needed
		// VSCode adapter doesn't own the provider, so no cleanup needed
		console.log("[VSCodeOutputAdapter] Dispose called")
	}
}
