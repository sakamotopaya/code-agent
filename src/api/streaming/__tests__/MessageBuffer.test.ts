import { MessageBuffer, ContentType, ProcessedMessage } from "../MessageBuffer"

describe("MessageBuffer", () => {
	let buffer: MessageBuffer

	beforeEach(() => {
		buffer = new MessageBuffer()
	})

	describe("single chunk processing", () => {
		it("should process plain content as content type", () => {
			const results = buffer.processMessage("Hello world")

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				content: "Hello world",
				contentType: "content",
				isComplete: true,
			})
		})

		it("should process thinking content correctly", () => {
			const results = buffer.processMessage("<thinking>Let me analyze this</thinking>")

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				content: "Let me analyze this",
				contentType: "thinking",
				isComplete: true,
			})
		})

		it("should process tool call content correctly", () => {
			const results = buffer.processMessage("<read_file>some parameters</read_file>")

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				content: "some parameters",
				contentType: "tool_call",
				isComplete: true,
				toolName: "read_file",
			})
		})

		it("should classify system tags correctly", () => {
			const results = buffer.processMessage("<args>parameter content</args>")

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				content: "<args>parameter content</args>",
				contentType: "system",
				isComplete: true,
			})
		})

		it("should classify result tags correctly", () => {
			const results = buffer.processMessage("<result>operation completed</result>")

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				content: "<result>operation completed</result>",
				contentType: "tool_result",
				isComplete: true,
			})
		})

		it("should handle mixed content types in single chunk", () => {
			const results = buffer.processMessage("Before<thinking>analysis</thinking>After")

			expect(results).toHaveLength(3)
			expect(results[0]).toEqual({
				content: "Before",
				contentType: "content",
				isComplete: true,
			})
			expect(results[1]).toEqual({
				content: "analysis",
				contentType: "thinking",
				isComplete: true,
			})
			expect(results[2]).toEqual({
				content: "After",
				contentType: "content",
				isComplete: true,
			})
		})

		it("should handle nested thinking in tool calls", () => {
			const results = buffer.processMessage(
				"<read_file>content<thinking>analysis</thinking>more content</read_file>",
			)

			expect(results).toHaveLength(3)
			expect(results[0]).toEqual({
				content: "content",
				contentType: "tool_call",
				isComplete: true,
				toolName: "read_file",
			})
			expect(results[1]).toEqual({
				content: "analysis",
				contentType: "thinking",
				isComplete: true,
			})
			expect(results[2]).toEqual({
				content: "more content",
				contentType: "tool_call",
				isComplete: true,
				toolName: "read_file",
			})
		})

		it("should handle empty content gracefully", () => {
			const results = buffer.processMessage("")

			expect(results).toHaveLength(0)
		})

		it("should handle malformed XML", () => {
			const results = buffer.processMessage("Hello <invalid tag> world")

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				content: "Hello <invalid tag> world",
				contentType: "content",
				isComplete: true,
			})
		})

		it("should handle unknown XML tags as content", () => {
			const results = buffer.processMessage("<unknown_tag>content</unknown_tag>")

			expect(results).toHaveLength(3)
			expect(results[0]).toEqual({
				content: "<unknown_tag>",
				contentType: "content",
				isComplete: true,
			})
			expect(results[1]).toEqual({
				content: "content",
				contentType: "content",
				isComplete: true,
			})
			expect(results[2]).toEqual({
				content: "</unknown_tag>",
				contentType: "content",
				isComplete: true,
			})
		})
	})

	describe("multi-chunk processing", () => {
		it("should handle tags split across chunks", () => {
			// Split opening tag
			const results1 = buffer.processMessage("<read_")
			expect(results1).toHaveLength(0) // Waiting for complete tag

			const results2 = buffer.processMessage("file>content</read_file>")
			expect(results2).toHaveLength(1)
			expect(results2[0]).toEqual({
				content: "content",
				contentType: "tool_call",
				isComplete: true,
				toolName: "read_file",
			})
		})

		it("should handle content split across chunks within same context", () => {
			// Start thinking section
			const results1 = buffer.processMessage("<thinking>Part 1")
			expect(results1).toHaveLength(1)
			expect(results1[0]).toEqual({
				content: "Part 1",
				contentType: "thinking",
				isComplete: true,
			})

			// Continue thinking section
			const results2 = buffer.processMessage(" Part 2</thinking>")
			expect(results2).toHaveLength(1)
			expect(results2[0]).toEqual({
				content: " Part 2",
				contentType: "thinking",
				isComplete: true,
			})
		})

		it("should handle nested tags across chunks", () => {
			// Start tool call
			buffer.processMessage("<read_file>content")

			// Add thinking within tool call across chunks
			const results1 = buffer.processMessage("<think")
			expect(results1).toHaveLength(1)
			expect(results1[0].contentType).toBe("tool_call")

			const results2 = buffer.processMessage("ing>analysis</thinking>more</read_file>")
			expect(results2).toHaveLength(2)
			expect(results2[0]).toEqual({
				content: "analysis",
				contentType: "thinking",
				isComplete: true,
			})
			expect(results2[1]).toEqual({
				content: "more",
				contentType: "tool_call",
				isComplete: true,
				toolName: "read_file",
			})
		})

		it("should maintain state consistency across multiple chunks", () => {
			// Start complex nested structure
			buffer.processMessage("<attempt_completion>")
			buffer.processMessage("<result>Starting result")

			// Verify state
			const state = buffer.getState()
			expect(state.inToolSection).toBe(true)
			expect(state.currentToolName).toBe("attempt_completion")
			expect(state.tagStack).toContain("attempt_completion")

			// Continue and finish
			const results = buffer.processMessage(" content</result></attempt_completion>")
			expect(results).toHaveLength(1)

			// Verify state is clean
			const finalState = buffer.getState()
			expect(finalState.inToolSection).toBe(false)
			expect(finalState.currentToolName).toBe(null)
			expect(finalState.tagStack).toHaveLength(0)
		})

		it("should handle partial tag at buffer end", () => {
			// Send partial tag that's incomplete
			const results1 = buffer.processMessage("content <read")
			expect(results1).toHaveLength(1)
			expect(results1[0].content).toBe("content ")

			// Verify partial tag is still buffered
			expect(buffer.getBufferedContent()).toBe("<read")

			// Complete the tag
			const results2 = buffer.processMessage("_file>more content</read_file>")
			expect(results2).toHaveLength(1)
			expect(results2[0]).toEqual({
				content: "more content",
				contentType: "tool_call",
				isComplete: true,
				toolName: "read_file",
			})
		})
	})

	describe("content type classification", () => {
		it("should correctly identify all tool names", () => {
			const toolNames = [
				"read_file",
				"write_to_file",
				"apply_diff",
				"search_files",
				"list_files",
				"execute_command",
				"browser_action",
				"attempt_completion",
			]

			toolNames.forEach((toolName) => {
				const buffer = new MessageBuffer()
				const results = buffer.processMessage(`<${toolName}>content</${toolName}>`)

				expect(results).toHaveLength(1)
				expect(results[0]).toEqual({
					content: "content",
					contentType: "tool_call",
					isComplete: true,
					toolName,
				})
			})
		})

		it("should correctly identify system tags", () => {
			const systemTags = ["args", "path", "content", "line_count", "file", "files"]

			systemTags.forEach((tagName) => {
				const buffer = new MessageBuffer()
				const results = buffer.processMessage(`<${tagName}>content</${tagName}>`)

				expect(results).toHaveLength(1)
				expect(results[0]).toEqual({
					content: `<${tagName}>content</${tagName}>`,
					contentType: "system",
					isComplete: true,
				})
			})
		})

		it("should correctly identify result tags", () => {
			const resultTags = ["result", "error", "output", "response"]

			resultTags.forEach((tagName) => {
				const buffer = new MessageBuffer()
				const results = buffer.processMessage(`<${tagName}>content</${tagName}>`)

				expect(results).toHaveLength(1)
				expect(results[0]).toEqual({
					content: `<${tagName}>content</${tagName}>`,
					contentType: "tool_result",
					isComplete: true,
				})
			})
		})

		it("should handle tool name extraction correctly", () => {
			const results = buffer.processMessage("<use_mcp_tool>parameters</use_mcp_tool>")

			expect(results).toHaveLength(1)
			expect(results[0].toolName).toBe("use_mcp_tool")
			expect(results[0].contentType).toBe("tool_call")
		})

		it("should prioritize thinking over tool context", () => {
			const results = buffer.processMessage("<read_file><thinking>analysis</thinking></read_file>")

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				content: "analysis",
				contentType: "thinking",
				isComplete: true,
			})
		})
	})

	describe("edge cases", () => {
		it("should handle buffer overflow protection", () => {
			// Create very large content chunk
			const largeContent = "x".repeat(10000)
			const results = buffer.processMessage(largeContent)

			expect(results).toHaveLength(1)
			expect(results[0].content).toBe(largeContent)
			expect(results[0].contentType).toBe("content")
		})

		it("should handle multiple consecutive tags", () => {
			const results = buffer.processMessage("<thinking></thinking><read_file></read_file>")

			expect(results).toHaveLength(0) // Empty tags produce no content
		})

		it("should handle malformed nested tags", () => {
			const results = buffer.processMessage("<thinking><read_file>content</thinking></read_file>")

			// Should handle gracefully - thinking closes first, then content is in normal context
			expect(results).toHaveLength(1)
			expect(results[0].content).toBe("content")
		})

		it("should handle very long tag names", () => {
			const longTagName = "very_long_tag_name_that_might_cause_issues"
			const results = buffer.processMessage(`<${longTagName}>content</${longTagName}>`)

			expect(results).toHaveLength(3) // Unknown tag treated as content
			expect(results[1].contentType).toBe("content")
		})

		it("should handle XML with attributes", () => {
			const results = buffer.processMessage('<read_file path="/test">content</read_file>')

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				content: "content",
				contentType: "tool_call",
				isComplete: true,
				toolName: "read_file",
			})
		})

		it("should handle self-closing tags", () => {
			const results = buffer.processMessage("before<br/>after")

			expect(results).toHaveLength(1)
			expect(results[0]).toEqual({
				content: "before<br/>after",
				contentType: "content",
				isComplete: true,
			})
		})
	})

	describe("state management", () => {
		it("should reset state correctly", () => {
			// Set up some state
			buffer.processMessage("<thinking>content")

			const stateBeforeReset = buffer.getState()
			expect(stateBeforeReset.inThinkingSection).toBe(true)
			expect(stateBeforeReset.buffer).toBeTruthy()

			// Reset
			buffer.reset()

			const stateAfterReset = buffer.getState()
			expect(stateAfterReset.inThinkingSection).toBe(false)
			expect(stateAfterReset.inToolSection).toBe(false)
			expect(stateAfterReset.currentToolName).toBe(null)
			expect(stateAfterReset.tagStack).toHaveLength(0)
			expect(stateAfterReset.buffer).toBe("")
		})

		it("should track tag stack correctly for nested tags", () => {
			buffer.processMessage("<read_file>")
			expect(buffer.getState().tagStack).toEqual(["read_file"])

			buffer.processMessage("<thinking>")
			expect(buffer.getState().tagStack).toEqual(["read_file", "thinking"])

			buffer.processMessage("</thinking>")
			expect(buffer.getState().tagStack).toEqual(["read_file"])

			buffer.processMessage("</read_file>")
			expect(buffer.getState().tagStack).toEqual([])
		})

		it("should provide buffered content for debugging", () => {
			buffer.processMessage("partial <read")

			expect(buffer.getBufferedContent()).toBe("<read")

			buffer.processMessage("_file>complete")
			expect(buffer.getBufferedContent()).toBe("")
		})

		it("should handle state when tags are not properly closed", () => {
			buffer.processMessage("<thinking>some content")
			buffer.processMessage("<read_file>more content")

			// Should still be in thinking section
			const state = buffer.getState()
			expect(state.inThinkingSection).toBe(true)
			expect(state.inToolSection).toBe(true)
			expect(state.tagStack).toEqual(["thinking", "read_file"])
		})
	})

	describe("real-world scenarios", () => {
		it("should handle typical LLM response with attempt_completion", () => {
			const chunks = [
				"I need to analyze this code. <thinking>Let me examine the structure",
				" and identify the key components</thinking>\n\nBased on my analysis, I can see that",
				" <attempt_completion>\n<result>\nI have completed the analysis.",
				" The code structure is well organized.</result>\n</attempt_completion>",
			]

			const allResults: ProcessedMessage[] = []
			chunks.forEach((chunk) => {
				allResults.push(...buffer.processMessage(chunk))
			})

			// Verify we got the expected content types
			const contentTypes = allResults.map((r) => r.contentType)
			expect(contentTypes).toContain("content")
			expect(contentTypes).toContain("thinking")
			expect(contentTypes).toContain("tool_call")
			expect(contentTypes).toContain("tool_result")
		})

		it("should handle streamed read_file response", () => {
			const chunks = [
				"<read_file>\n<args>\n<file>\n<path>src/test.ts</path>",
				"\n</file>\n</args>\n</read_file>\n\nLet me analyze this file",
				" <thinking>The file contains TypeScript code</thinking>",
			]

			const allResults: ProcessedMessage[] = []
			chunks.forEach((chunk) => {
				allResults.push(...buffer.processMessage(chunk))
			})

			// Should classify system tags and thinking correctly
			const systemResults = allResults.filter((r) => r.contentType === "system")
			const thinkingResults = allResults.filter((r) => r.contentType === "thinking")
			const contentResults = allResults.filter((r) => r.contentType === "content")

			expect(systemResults.length).toBeGreaterThan(0)
			expect(thinkingResults.length).toBe(1)
			expect(contentResults.length).toBeGreaterThan(0)
		})
	})
})
