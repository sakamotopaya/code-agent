/**
 * Tests for ContentHandler_ToolCall attempt_completion XML tag cleaning
 */
import { ContentHandler_ToolCall } from "../ContentHandlers"
import { ProcessedMessage } from "../../../../api/streaming/MessageBuffer"
import { DisplayContext } from "../interfaces"

describe("ContentHandler_ToolCall - attempt_completion", () => {
	let handler: ContentHandler_ToolCall
	let mockContext: DisplayContext

	beforeEach(() => {
		handler = new ContentHandler_ToolCall()
		mockContext = {
			useColor: false,
			showThinking: false,
			hasDisplayedTool: jest.fn().mockReturnValue(true), // Tool already displayed
			markToolDisplayed: jest.fn(),
		}
	})

	it("should clean XML tags from attempt_completion content", () => {
		const message: ProcessedMessage = {
			content:
				'<name><format>## Summary of Issue #8: "Story 8: Add Command Line Argument Parsing"\n\nThis is the actual content that should be displayed to the user.',
			contentType: "tool_call",
			toolName: "attempt_completion",
			isComplete: true,
		}

		const result = handler.handle(message, mockContext)

		expect(result).not.toBeNull()
		expect(result?.displayText).toBe(
			'## Summary of Issue #8: "Story 8: Add Command Line Argument Parsing"\n\nThis is the actual content that should be displayed to the user.',
		)
		expect(result?.displayText).not.toContain("<name>")
		expect(result?.displayText).not.toContain("<format>")
	})

	it("should handle attempt_completion with nested XML tags", () => {
		const message: ProcessedMessage = {
			content:
				"<name>Task Complete</name><format>markdown</format>\n## Task Summary\n\nI have successfully completed the requested task.\n\n### Changes Made\n- Fixed the issue\n- Updated documentation",
			contentType: "tool_call",
			toolName: "attempt_completion",
			isComplete: true,
		}

		const result = handler.handle(message, mockContext)

		expect(result).not.toBeNull()
		expect(result?.displayText).toBe(
			"## Task Summary\n\nI have successfully completed the requested task.\n\n### Changes Made\n- Fixed the issue\n- Updated documentation",
		)
		expect(result?.displayText).not.toContain("<name>")
		expect(result?.displayText).not.toContain("<format>")
		expect(result?.displayText).not.toContain("Task Complete")
		expect(result?.displayText).not.toContain("markdown")
	})

	it("should handle attempt_completion content without XML tags", () => {
		const message: ProcessedMessage = {
			content: "## Summary\n\nThis content has no XML tags and should be displayed as-is.",
			contentType: "tool_call",
			toolName: "attempt_completion",
			isComplete: true,
		}

		const result = handler.handle(message, mockContext)

		expect(result).not.toBeNull()
		expect(result?.displayText).toBe("## Summary\n\nThis content has no XML tags and should be displayed as-is.")
	})

	it("should handle empty attempt_completion content", () => {
		const message: ProcessedMessage = {
			content: "",
			contentType: "tool_call",
			toolName: "attempt_completion",
			isComplete: true,
		}

		const result = handler.handle(message, mockContext)

		expect(result).toBeNull()
	})

	it("should handle attempt_completion content that becomes empty after cleaning", () => {
		const message: ProcessedMessage = {
			content: "<name></name><format></format>",
			contentType: "tool_call",
			toolName: "attempt_completion",
			isComplete: true,
		}

		const result = handler.handle(message, mockContext)

		expect(result).toBeNull()
	})

	it("should not display content for non-attempt_completion tools", () => {
		const message: ProcessedMessage = {
			content: "<path>test.ts</path>",
			contentType: "tool_call",
			toolName: "read_file",
			isComplete: true,
		}

		const result = handler.handle(message, mockContext)

		// Should return null for non-attempt_completion tools when tool already displayed
		expect(result).toBeNull()
	})

	it("should still show tool name for attempt_completion when not yet displayed", () => {
		// Setup mock to return false for hasDisplayedTool
		mockContext.hasDisplayedTool = jest.fn().mockReturnValue(false)

		const message: ProcessedMessage = {
			content: "<name><format>## Summary\n\nContent here",
			contentType: "tool_call",
			toolName: "attempt_completion",
			isComplete: true,
		}

		const result = handler.handle(message, mockContext)

		expect(result).not.toBeNull()
		expect(result?.displayText).toBe("\nattempt_completion...\n")
		expect(mockContext.markToolDisplayed).toHaveBeenCalledWith("attempt_completion")
	})
})
