import chalk from "chalk"
import { MessageBuffer, ProcessedMessage } from "../../../api/streaming/MessageBuffer"

/**
 * CLI-specific options for controlling output display
 */
export interface CLIStreamOptions {
	showThinking: boolean
	showTools: boolean
	useColor: boolean
}

/**
 * Result of processing a chunk for CLI output
 */
export interface CLIOutputResult {
	content: string
	hasOutput: boolean
}

/**
 * CLIStreamProcessor is a thin wrapper around MessageBuffer that adds
 * CLI-specific formatting and filtering of XML content.
 *
 * It leverages MessageBuffer's XML parsing and adds:
 * - Content type filtering based on CLI flags
 * - Color formatting for different content types
 * - User-friendly tool and thinking notifications
 */
export class CLIStreamProcessor {
	private messageBuffer: MessageBuffer
	private options: CLIStreamOptions

	constructor(options: CLIStreamOptions) {
		this.messageBuffer = new MessageBuffer()
		this.options = options
	}

	/**
	 * Process a chunk of LLM output and return formatted CLI content
	 */
	processChunk(chunk: string): CLIOutputResult {
		// Let MessageBuffer handle the XML parsing and classification
		const processedMessages = this.messageBuffer.processMessage(chunk)

		let outputContent = ""

		for (const message of processedMessages) {
			const formatted = this.formatMessageForCLI(message)
			if (formatted) {
				outputContent += formatted
			}
		}

		return {
			content: outputContent,
			hasOutput: outputContent.length > 0,
		}
	}

	/**
	 * Format a processed message for CLI display based on content type and options
	 */
	private formatMessageForCLI(message: ProcessedMessage): string {
		switch (message.contentType) {
			case "content":
				// Always show regular content
				return message.content

			case "thinking":
				// Show thinking content only if --thinking flag is enabled
				if (this.options.showThinking) {
					const prefix = "🤔 "
					return this.options.useColor ? chalk.gray(prefix + message.content) : prefix + message.content
				}
				return ""

			case "tool_call":
				// Special case: attempt_completion content should always be shown to user
				if (message.toolName === "attempt_completion") {
					return message.content
				}

				// Show tool notifications only if --tools flag is enabled
				if (this.options.showTools && message.toolName) {
					const toolNotification = `🔧 Using tool: ${message.toolName}\n`
					return this.options.useColor ? chalk.yellow(toolNotification) : toolNotification
				}
				return ""

			case "tool_result":
			case "system":
				// Never show system messages or tool results to CLI users
				return ""

			default:
				// Fallback: treat unknown types as content
				return message.content
		}
	}

	/**
	 * Reset the internal message buffer state (call between tasks)
	 */
	reset(): void {
		this.messageBuffer.reset()
	}

	/**
	 * Get current buffered content for debugging
	 */
	getBufferedContent(): string {
		return this.messageBuffer.getBufferedContent()
	}

	/**
	 * Get current processing state for debugging/testing
	 */
	getState(): any {
		return this.messageBuffer.getState()
	}
}
