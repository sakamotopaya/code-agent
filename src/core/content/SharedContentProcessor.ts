import { MessageBuffer, ProcessedMessage } from "../../api/streaming/MessageBuffer"
import { CLIDisplayFormatter } from "../../cli/services/streaming/CLIDisplayFormatter"
import { IContentProcessor, ProcessedContent } from "../interfaces/IContentProcessor"

/**
 * Shared content processor that both CLI and API use
 * Contains all the logic for content classification, tool indicators, and formatting
 */
export class SharedContentProcessor implements IContentProcessor {
	private messageBuffer = new MessageBuffer()
	private displayFormatter = new CLIDisplayFormatter(false, false) // No colors, will be handled by output adapters
	private displayedTools = new Set<string>()

	async processContent(chunk: string): Promise<ProcessedContent[]> {
		try {
			// Use the existing MessageBuffer logic for content classification
			const processedMessages = this.messageBuffer.processMessage(chunk)
			const results: ProcessedContent[] = []

			for (const message of processedMessages) {
				// Process each message through the content processing pipeline
				const processedContent = await this.processMessage(message)
				if (processedContent) {
					results.push(processedContent)
				}
			}

			return results
		} catch (error) {
			console.error("[SharedContentProcessor] Error processing content:", error)

			// Return the content as a basic content message to ensure streaming continues
			return [
				{
					content: chunk,
					contentType: "content",
					isComplete: true,
					shouldDisplay: true,
				},
			]
		}
	}

	reset(): void {
		this.messageBuffer.reset()
		this.displayedTools.clear()
	}

	/**
	 * Process individual message with tool indicator logic
	 */
	private async processMessage(message: ProcessedMessage): Promise<ProcessedContent | null> {
		if (!message.content) {
			return null
		}

		// Handle tool indicators - this is the logic that generates "execute_command..." etc.
		let isToolIndicator = false
		let displayContent = message.content

		if (message.contentType === "tool_call" && message.toolName) {
			// Check if we need to show tool indicator (like CLI does)
			if (!this.displayedTools.has(message.toolName)) {
				// Generate tool indicator
				displayContent = this.displayFormatter.formatToolIndicator(message.toolName)
				isToolIndicator = true
				this.displayedTools.add(message.toolName)
			} else {
				// Tool already displayed, this is the tool content
				displayContent = message.content
				isToolIndicator = false
			}
		} else {
			// Format the content using existing formatter logic
			const formatted = this.displayFormatter.formatContent(message)
			displayContent = formatted || message.content
		}

		return {
			content: displayContent,
			contentType: message.contentType,
			isComplete: message.isComplete,
			toolName: message.toolName,
			isToolIndicator,
			shouldDisplay: this.shouldDisplayContent(message.contentType),
		}
	}

	/**
	 * Determine if content type should be displayed to users
	 * Shared logic for what content types should be shown
	 */
	private shouldDisplayContent(contentType: string): boolean {
		switch (contentType) {
			case "content":
			case "tool_call":
				return true
			case "thinking":
				return false // Can be made configurable later
			case "system":
			case "tool_result":
				return false // Internal content, not for user display
			default:
				return true // Default to showing unknown types
		}
	}

	/**
	 * Get current buffered content (for debugging)
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

	/**
	 * Check if tool has been displayed (for testing)
	 */
	hasDisplayedTool(toolName: string): boolean {
		return this.displayedTools.has(toolName)
	}
}
