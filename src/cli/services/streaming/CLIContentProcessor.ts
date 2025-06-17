/**
 * CLI Content Processor - implements Single Responsibility Principle
 * Only responsible for processing streaming content via MessageBuffer
 */

import { MessageBuffer, ProcessedMessage } from "../../../api/streaming/MessageBuffer"
import { IContentProcessor } from "./interfaces"

/**
 * CLIContentProcessor handles content processing by delegating to MessageBuffer
 * Single Responsibility: Process streaming content and return classified messages
 */
export class CLIContentProcessor implements IContentProcessor {
	private messageBuffer: MessageBuffer

	constructor(messageBuffer?: MessageBuffer) {
		this.messageBuffer = messageBuffer || new MessageBuffer()
	}

	/**
	 * Process streaming content and return classified messages
	 * Delegates to MessageBuffer for actual parsing logic
	 */
	processContent(content: string): ProcessedMessage[] {
		try {
			// Validate input
			if (typeof content !== "string") {
				throw new Error(`Invalid content type: expected string, got ${typeof content}`)
			}

			// Delegate to MessageBuffer for processing
			return this.messageBuffer.processMessage(content)
		} catch (error) {
			// Graceful error handling - return content as-is if parsing fails
			console.error("[CLIContentProcessor] Error processing content:", error)

			// Return the content as a basic content message to ensure streaming continues
			return [
				{
					content: content,
					contentType: "content",
					isComplete: true,
				},
			]
		}
	}

	/**
	 * Reset processing state for new task
	 * Delegates to MessageBuffer for state management
	 */
	reset(): void {
		try {
			this.messageBuffer.reset()
		} catch (error) {
			// Log error but don't throw - reset should always succeed
			console.error("[CLIContentProcessor] Error during reset:", error)
			// Create new MessageBuffer as fallback
			this.messageBuffer = new MessageBuffer()
		}
	}

	/**
	 * Get current buffered content (for debugging/testing)
	 */
	getBufferedContent(): string {
		return this.messageBuffer.getBufferedContent()
	}

	/**
	 * Get current MessageBuffer state (for debugging/testing)
	 */
	getState(): ReturnType<MessageBuffer["getState"]> {
		return this.messageBuffer.getState()
	}
}
