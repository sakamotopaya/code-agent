/**
 * Content Type Handlers - implements Open/Closed Principle
 * Extensible handlers for different content types without modifying existing code
 */

import chalk from "chalk"
import { ProcessedMessage, ContentType } from "../../../api/streaming/MessageBuffer"
import { IContentTypeHandler, DisplayContext, DisplayResult } from "./interfaces"

/**
 * Base abstract class for content handlers
 * Template Method Pattern for common behavior
 */
export abstract class ContentHandler implements IContentTypeHandler {
	abstract canHandle(contentType: ContentType): boolean

	/**
	 * Template method that ensures proper flow
	 */
	handle(message: ProcessedMessage, context: DisplayContext): DisplayResult | null {
		if (!this.canHandle(message.contentType)) {
			return null
		}

		return this.handleSpecific(message, context)
	}

	/**
	 * Specific handling logic to be implemented by subclasses
	 */
	protected abstract handleSpecific(message: ProcessedMessage, context: DisplayContext): DisplayResult | null

	/**
	 * Utility method for color handling
	 */
	protected applyColor(text: string, colorFn: (text: string) => string, useColor: boolean): string {
		return useColor ? colorFn(text) : text
	}
}

/**
 * Handler for regular content
 */
export class ContentHandler_Content extends ContentHandler {
	canHandle(contentType: ContentType): boolean {
		return contentType === "content"
	}

	protected handleSpecific(message: ProcessedMessage, context: DisplayContext): DisplayResult | null {
		if (!message.content) {
			return null
		}

		// Apply basic formatting for content
		return {
			displayText: message.content,
		}
	}
}

/**
 * Handler for thinking sections
 */
export class ContentHandler_Thinking extends ContentHandler {
	canHandle(contentType: ContentType): boolean {
		return contentType === "thinking"
	}

	protected handleSpecific(message: ProcessedMessage, context: DisplayContext): DisplayResult | null {
		// Only show thinking content if enabled
		if (!context.showThinking) {
			return null
		}

		const thinkingText = this.applyColor(`[THINKING] ${message.content}`, chalk.gray, context.useColor)

		return {
			displayText: thinkingText,
		}
	}
}

/**
 * Handler for tool calls
 */
export class ContentHandler_ToolCall extends ContentHandler {
	canHandle(contentType: ContentType): boolean {
		return contentType === "tool_call"
	}

	protected handleSpecific(message: ProcessedMessage, context: DisplayContext): DisplayResult | null {
		// Handle tool name display
		if (message.toolName && context.hasDisplayedTool && context.markToolDisplayed) {
			if (!context.hasDisplayedTool(message.toolName)) {
				const toolDisplay = this.applyColor(`${message.toolName}...`, chalk.yellow, context.useColor)

				context.markToolDisplayed(message.toolName)
				return {
					displayText: `\n${toolDisplay}\n`,
				}
			}
		}

		// Skip tool content itself (XML tags and parameters)
		return null
	}
}

/**
 * Handler for system tags
 */
export class ContentHandler_System extends ContentHandler {
	canHandle(contentType: ContentType): boolean {
		return contentType === "system"
	}

	protected handleSpecific(message: ProcessedMessage, context: DisplayContext): DisplayResult | null {
		// System tags should not be displayed to users
		return null
	}
}

/**
 * Handler for tool results
 */
export class ContentHandler_ToolResult extends ContentHandler {
	canHandle(contentType: ContentType): boolean {
		return contentType === "tool_result"
	}

	protected handleSpecific(message: ProcessedMessage, context: DisplayContext): DisplayResult | null {
		// Tool results are handled separately in the tool execution pipeline
		// Skip display in streaming to avoid duplication
		return null
	}
}

/**
 * Factory for creating default content handlers
 */
export class ContentHandlerFactory {
	/**
	 * Create the default set of content handlers
	 */
	static createDefaultHandlers(): IContentTypeHandler[] {
		return [
			new ContentHandler_Content(),
			new ContentHandler_Thinking(),
			new ContentHandler_ToolCall(),
			new ContentHandler_System(),
			new ContentHandler_ToolResult(),
		]
	}

	/**
	 * Create handlers registry mapped by content type
	 */
	static createHandlersRegistry(): Map<ContentType, IContentTypeHandler> {
		const handlers = this.createDefaultHandlers()
		const registry = new Map<ContentType, IContentTypeHandler>()

		for (const handler of handlers) {
			// Register each handler for the content types it can handle
			const contentTypes: ContentType[] = ["content", "thinking", "tool_call", "system", "tool_result"]

			for (const contentType of contentTypes) {
				if (handler.canHandle(contentType)) {
					registry.set(contentType, handler)
				}
			}
		}

		return registry
	}
}
