import { IStreamingAdapter, IContentOutputAdapter } from "../../interfaces/IOutputAdapter"
import { ProcessedContent } from "../../interfaces/IContentProcessor"
import { SSEOutputAdapter } from "../../../api/streaming/SSEOutputAdapter"
import { SSEEvent, SSE_EVENTS, SSEEventType } from "../../../api/streaming/types"

/**
 * SSE implementation of immediate streaming adapter
 * Provides immediate SSE emission without processing delays
 */
export class SSEStreamingAdapter implements IStreamingAdapter {
	constructor(private sseAdapter: SSEOutputAdapter) {}

	async streamRawChunk(chunk: string): Promise<void> {
		// Direct immediate SSE emission - bypass all processing
		await this.sseAdapter.emitRawChunk(chunk)
	}

	reset(): void {
		// No state to reset for raw streaming
	}
}

/**
 * SSE implementation of content output adapter
 * Handles processed content output via SSE events
 */
export class SSEContentOutputAdapter implements IContentOutputAdapter {
	constructor(private sseAdapter: SSEOutputAdapter) {}

	async outputProcessedContent(content: ProcessedContent[]): Promise<void> {
		for (const item of content) {
			if (item.shouldDisplay) {
				// Convert to appropriate SSE event format
				const event: SSEEvent = {
					type: this.getEventType(item),
					jobId: this.sseAdapter.jobId,
					message: item.content,
					toolName: item.toolName,
					contentType: item.contentType,
					timestamp: new Date().toISOString(),
				}

				await this.sseAdapter.emitSSEEvent(event)
			}
		}
	}

	reset(): void {
		// No state to reset for SSE output
	}

	/**
	 * Determine appropriate SSE event type based on processed content
	 */
	private getEventType(content: ProcessedContent): SSEEventType {
		if (content.isToolIndicator) {
			return SSE_EVENTS.TOOL_USE
		}

		switch (content.contentType) {
			case "tool_call":
				return SSE_EVENTS.TOOL_USE
			case "content":
				return SSE_EVENTS.PROGRESS
			case "thinking":
				return SSE_EVENTS.LOG
			default:
				return SSE_EVENTS.PROGRESS
		}
	}
}
