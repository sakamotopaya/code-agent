import { ProcessedContent } from "./IContentProcessor"
import { HistoryItem, ClineMessage } from "@roo-code/types"

/**
 * Comprehensive interface for all output and communication concerns
 * Replaces the need for separate streaming, content, message, and state adapters
 */
export interface IOutputAdapter {
	// Content Output
	/**
	 * Output a complete message with both immediate streaming and processed content
	 * Adapter internally handles streaming strategy
	 */
	outputContent(message: ClineMessage): Promise<void>

	/**
	 * Output partial/updating content (for streaming updates)
	 */
	outputPartialContent(partialMessage: ClineMessage): Promise<void>

	/**
	 * Stream a raw text chunk for immediate display/emission
	 * Used for real-time streaming during LLM response generation
	 */
	streamChunk?(chunk: string): Promise<void>

	// Message Communication (replaces postMessageToWebview)
	/**
	 * Send a structured message to the user interface
	 */
	sendMessage(message: any): Promise<void>

	/**
	 * Send a partial/streaming update to the user interface
	 */
	sendPartialUpdate(partialMessage: any): Promise<void>

	// State Management (replaces postStateToWebview)
	/**
	 * Synchronize complete application state with the user interface
	 */
	syncState(state: any): Promise<void>

	/**
	 * Notify of state changes that need UI updates
	 */
	notifyStateChange(changeType: string, data?: any): Promise<void>

	// Data Persistence (replaces updateTaskHistory and state management)
	/**
	 * Update task history in persistent storage
	 */
	updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]>

	/**
	 * Update any persistent state data
	 */
	updatePersistentData(key: string, data: any): Promise<void>

	/**
	 * Get persistent data
	 */
	getPersistentData<T>(key: string): T | undefined

	// Lifecycle
	/**
	 * Reset adapter state for new task
	 */
	reset(): void

	/**
	 * Cleanup and dispose resources (optional)
	 */
	dispose?(): Promise<void>
}

/**
 * @deprecated Use IOutputAdapter instead
 * Interface for immediate raw streaming
 * Handles immediate output without content processing delays
 */
export interface IStreamingAdapter {
	/**
	 * Stream a chunk of content immediately without buffering or processing
	 * This is for immediate user feedback while content processing happens in parallel
	 */
	streamRawChunk(chunk: string): Promise<void>

	/**
	 * Reset streaming state for new task
	 */
	reset(): void
}

/**
 * @deprecated Use IOutputAdapter instead
 * Interface for formatted content output
 * Handles processed content display/emission
 */
export interface IContentOutputAdapter {
	/**
	 * Output processed content in the appropriate format for the mode
	 */
	outputProcessedContent(content: ProcessedContent[]): Promise<void>

	/**
	 * Reset output adapter state for new task
	 */
	reset(): void
}
