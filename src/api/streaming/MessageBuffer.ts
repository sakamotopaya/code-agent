/**
 * Content type classification for LLM output messages
 */
export type ContentType = "content" | "thinking" | "tool_call" | "tool_result" | "system"

/**
 * Processed message result from MessageBuffer
 */
export interface ProcessedMessage {
	content: string
	contentType: ContentType
	isComplete: boolean // For multi-part tool calls
	toolName?: string // When contentType is 'tool_call'
}

/**
 * Internal buffer state for tracking XML parsing
 */
interface BufferState {
	buffer: string
	inThinkingSection: boolean
	inToolSection: boolean
	currentToolName: string | null
	tagStack: string[] // Track nested tags
	pendingContent: string // Content waiting for tag completion
}

/**
 * MessageBuffer handles stateful processing of LLM output chunks that may contain
 * partial XML tags across multiple SSE events. It classifies content by type and
 * maintains parsing state to handle tags split across chunk boundaries.
 */
export class MessageBuffer {
	private state: BufferState

	// Tool names that should be classified as tool_call content
	private static readonly TOOL_NAMES = new Set([
		"read_file",
		"write_to_file",
		"apply_diff",
		"search_files",
		"list_files",
		"list_code_definition_names",
		"execute_command",
		"browser_action",
		"insert_content",
		"search_and_replace",
		"ask_followup_question",
		"attempt_completion",
		"use_mcp_tool",
		"access_mcp_resource",
		"switch_mode",
		"new_task",
		"fetch_instructions",
	])

	// System tags that should be classified as system content
	private static readonly SYSTEM_TAGS = new Set([
		"args",
		"path",
		"content",
		"line_count",
		"file",
		"files",
		"coordinate",
		"size",
		"text",
		"url",
		"action",
		"server_name",
		"tool_name",
		"arguments",
		"uri",
		"question",
		"follow_up",
		"suggest",
		"command",
		"cwd",
		"mode_slug",
		"reason",
		"mode",
		"message",
		"task",
	])

	// Result tags that should be classified as tool_result content
	private static readonly RESULT_TAGS = new Set(["result", "error", "output", "response"])

	constructor() {
		this.state = this.createInitialState()
	}

	/**
	 * Process a new chunk of content and return any complete messages
	 */
	processMessage(chunk: string): ProcessedMessage[] {
		const results: ProcessedMessage[] = []

		// Add new chunk to buffer
		this.state.buffer += chunk

		let processedIndex = 0

		while (processedIndex < this.state.buffer.length) {
			const processed = this.processBufferFromIndex(processedIndex)

			if (processed.message) {
				results.push(processed.message)
			}

			if (processed.advanceBy === 0) {
				// No progress made, break to avoid infinite loop
				break
			}

			processedIndex += processed.advanceBy
		}

		// Remove processed content from buffer
		this.state.buffer = this.state.buffer.slice(processedIndex)

		return results
	}

	/**
	 * Reset buffer state (call between tasks)
	 */
	reset(): void {
		this.state = this.createInitialState()
	}

	/**
	 * Get current buffered content (for debugging)
	 */
	getBufferedContent(): string {
		return this.state.buffer
	}

	/**
	 * Get current state (for debugging/testing)
	 */
	getState(): Readonly<BufferState> {
		return { ...this.state }
	}

	private createInitialState(): BufferState {
		return {
			buffer: "",
			inThinkingSection: false,
			inToolSection: false,
			currentToolName: null,
			tagStack: [],
			pendingContent: "",
		}
	}

	private processBufferFromIndex(startIndex: number): { message?: ProcessedMessage; advanceBy: number } {
		const remaining = this.state.buffer.slice(startIndex)

		// Look for XML tag at current position
		const tagMatch = remaining.match(/^<(\/?[a-zA-Z_][a-zA-Z0-9_-]*)[^>]*>/)

		if (tagMatch) {
			const fullTag = tagMatch[0]
			const tagNameWithSlash = tagMatch[1]
			const isClosingTag = tagNameWithSlash.startsWith("/")
			const tagName = isClosingTag ? tagNameWithSlash.slice(1) : tagNameWithSlash

			// Process the tag and update state
			const tagResult = this.processTag(tagName, isClosingTag, fullTag)

			return {
				message: tagResult.message,
				advanceBy: fullTag.length,
			}
		}

		// No tag found, look for next character or potential partial tag
		const nextTagIndex = remaining.indexOf("<")

		if (nextTagIndex === -1) {
			// No more tags in buffer, process all remaining content as current type
			if (remaining.length > 0) {
				const message = this.createContentMessage(remaining)
				return {
					message,
					advanceBy: remaining.length,
				}
			}
			return { advanceBy: 0 }
		}

		if (nextTagIndex === 0) {
			// We're at a '<' but it didn't match as a complete tag
			// This might be a partial tag at buffer end
			const partialTag = remaining.match(/^<[^>]*$/)
			if (partialTag) {
				// Partial tag at end of buffer, wait for more content
				return { advanceBy: 0 }
			}
			// Invalid tag, skip the '<' character
			return { advanceBy: 1 }
		}

		// Process content before next tag
		const contentBeforeTag = remaining.slice(0, nextTagIndex)
		const message = this.createContentMessage(contentBeforeTag)

		return {
			message,
			advanceBy: nextTagIndex,
		}
	}

	private processTag(tagName: string, isClosingTag: boolean, fullTag: string): { message?: ProcessedMessage } {
		// Handle thinking tags
		if (tagName === "thinking") {
			if (isClosingTag) {
				this.state.inThinkingSection = false
				this.state.tagStack = this.state.tagStack.filter((tag) => tag !== "thinking")
			} else {
				this.state.inThinkingSection = true
				this.state.tagStack.push("thinking")
			}
			return {}
		}

		// Handle tool tags
		if (MessageBuffer.TOOL_NAMES.has(tagName)) {
			if (isClosingTag) {
				this.state.inToolSection = false
				this.state.currentToolName = null
				this.state.tagStack = this.state.tagStack.filter((tag) => tag !== tagName)
			} else {
				this.state.inToolSection = true
				this.state.currentToolName = tagName
				this.state.tagStack.push(tagName)
			}
			return {}
		}

		// Handle system and result tags - these don't change parsing state
		// but we classify their content appropriately
		if (MessageBuffer.SYSTEM_TAGS.has(tagName) || MessageBuffer.RESULT_TAGS.has(tagName)) {
			// Don't change parsing state, just return tag as system/result content
			const contentType = MessageBuffer.RESULT_TAGS.has(tagName) ? "tool_result" : "system"

			return {
				message: {
					content: fullTag,
					contentType,
					isComplete: true,
				},
			}
		}

		// Unknown tag - treat as content
		return {
			message: {
				content: fullTag,
				contentType: "content",
				isComplete: true,
			},
		}
	}

	private createContentMessage(content: string): ProcessedMessage {
		if (!content) {
			return {
				content: "",
				contentType: "content",
				isComplete: true,
			}
		}

		// Determine content type based on current parsing state
		let contentType: ContentType
		let toolName: string | undefined

		if (this.state.inThinkingSection) {
			contentType = "thinking"
		} else if (this.state.inToolSection) {
			contentType = "tool_call"
			toolName = this.state.currentToolName || undefined
		} else {
			contentType = "content"
		}

		return {
			content,
			contentType,
			isComplete: true,
			toolName,
		}
	}
}
