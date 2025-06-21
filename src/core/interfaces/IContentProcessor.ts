import { ContentType } from "../../api/streaming/MessageBuffer"

/**
 * Processed content result from shared content processor
 */
export interface ProcessedContent {
	content: string
	contentType: ContentType
	isComplete: boolean
	toolName?: string
	isToolIndicator?: boolean
	shouldDisplay?: boolean
}

/**
 * Shared interface for content processing logic
 * Used by both CLI and API to ensure consistent content handling
 */
export interface IContentProcessor {
	/**
	 * Process content chunk and return structured results
	 */
	processContent(chunk: string): Promise<ProcessedContent[]>

	/**
	 * Reset processing state for new task
	 */
	reset(): void
}
