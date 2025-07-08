const { ClientContentFilter } = require("../test-api.js")

describe("ClientContentFilter", () => {
	describe("Basic Construction", () => {
		test("should create filter with default options", () => {
			const filter = new ClientContentFilter()
			expect(filter.showThinking).toBe(false)
			expect(filter.showTools).toBe(false)
			expect(filter.showSystem).toBe(false)
			expect(filter.showResponse).toBe(false)
			expect(filter.verbose).toBe(false)
		})

		test("should create filter with custom options", () => {
			const filter = new ClientContentFilter({
				showThinking: true,
				showTools: true,
				showSystem: true,
				showResponse: true,
				verbose: true,
			})
			expect(filter.showThinking).toBe(true)
			expect(filter.showTools).toBe(true)
			expect(filter.showSystem).toBe(true)
			expect(filter.showResponse).toBe(true)
			expect(filter.verbose).toBe(true)
		})
	})

	describe("Basic Tag Recognition", () => {
		test("should recognize complete thinking tag in single chunk when showThinking=false", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("before<thinking>hidden content</thinking>after")
			expect(result).toBe("beforeafter")
		})

		test("should preserve thinking tag when showThinking=true", () => {
			const filter = new ClientContentFilter({ showThinking: true })
			const result = filter.processText("before<thinking>visible content</thinking>after")
			expect(result).toBe("before<thinking>visible content</thinking>after")
		})

		test("should ignore non-thinking tags", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("before<other>content</other>after")
			expect(result).toBe("before<other>content</other>after")
		})

		test("should handle empty thinking sections", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("before<thinking></thinking>after")
			expect(result).toBe("beforeafter")
		})

		test("should handle thinking with newlines and whitespace", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("before<thinking>\n  content with spaces  \n</thinking>after")
			expect(result).toBe("beforeafter")
		})
	})

	describe("Chunk Boundary Handling", () => {
		test("should handle opening tag split across chunks", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result1 = filter.processText("<thin")
			const result2 = filter.processText("king>content</thinking>")
			expect(result1 + result2).toBe("")
		})

		test("should handle closing tag split across chunks", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result1 = filter.processText("<thinking>content</thin")
			const result2 = filter.processText("king>")
			expect(result1 + result2).toBe("")
		})

		test("should handle content split across chunks", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result1 = filter.processText("<thinking>part1")
			const result2 = filter.processText("part2</thinking>")
			expect(result1 + result2).toBe("")
		})

		test("should handle tag name split across chunks", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result1 = filter.processText("<")
			const result2 = filter.processText("thinking>content</thinking>")
			expect(result1 + result2).toBe("")
		})

		test("should handle multiple chunks with mixed content", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result1 = filter.processText("before<thin")
			const result2 = filter.processText("king>hidden</thin")
			const result3 = filter.processText("king>after")
			expect(result1 + result2 + result3).toBe("beforeafter")
		})
	})

	describe("State Management", () => {
		test("should maintain parser state across chunks", () => {
			const filter = new ClientContentFilter({ showThinking: false })

			// Check initial state
			expect(filter.getParserState()).toBe("NORMAL")

			// Process opening tag
			filter.processText("<thin")
			expect(filter.getParserState()).toBe("TAG_OPENING")

			// Complete tag
			filter.processText("king>content</thinking>")
			expect(filter.getParserState()).toBe("NORMAL")
		})

		test("should reset state after complete tag", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			filter.processText("<thinking>content</thinking>")
			expect(filter.getParserState()).toBe("NORMAL")
			expect(filter.getCurrentTag()).toBe(null)
		})

		test("should handle multiple thinking sections in sequence", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("<thinking>first</thinking><thinking>second</thinking>")
			expect(result).toBe("")
		})

		test("should handle thinking sections with content between", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("<thinking>first</thinking>middle<thinking>second</thinking>")
			expect(result).toBe("middle")
		})
	})

	describe("Content Filtering", () => {
		test("should suppress thinking content when showThinking=false", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("public<thinking>private thoughts</thinking>content")
			expect(result).toBe("publiccontent")
		})

		test("should show thinking content when showThinking=true", () => {
			const filter = new ClientContentFilter({ showThinking: true })
			const result = filter.processText("public<thinking>visible thoughts</thinking>content")
			expect(result).toBe("public<thinking>visible thoughts</thinking>content")
		})

		test("should preserve non-thinking content", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("This content should always be visible")
			expect(result).toBe("This content should always be visible")
		})

		test("should handle special characters in thinking sections", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("before<thinking>special chars: <>{}[]\"'&</thinking>after")
			expect(result).toBe("beforeafter")
		})
	})

	describe("Edge Cases", () => {
		test("should handle unclosed thinking tags gracefully", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("<thinking>unclosed content")
			expect(result).toBe("") // Should suppress until proper closing or reset
		})

		test("should handle orphaned closing tags", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("content</thinking>")
			expect(result).toBe("content</thinking>") // Should pass through
		})

		test("should handle empty input", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("")
			expect(result).toBe("")
		})

		test("should handle malformed opening tags", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText('<thinking extra="attr">content</thinking>')
			expect(result).toBe("") // Should still recognize as thinking tag
		})

		test("should handle case sensitivity", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("<THINKING>content</THINKING>")
			expect(result).toBe("<THINKING>content</THINKING>") // Should not match case-sensitive
		})

		test("should handle nested-like content", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const result = filter.processText("<thinking>outer<inner>nested</inner>content</thinking>")
			expect(result).toBe("")
		})
	})

	describe("Performance", () => {
		test("should handle large inputs efficiently", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const largeContent = "x".repeat(10000)
			const input = `before<thinking>${largeContent}</thinking>after`

			const startTime = Date.now()
			const result = filter.processText(input)
			const endTime = Date.now()

			expect(result).toBe("beforeafter")
			expect(endTime - startTime).toBeLessThan(100) // Should complete within 100ms
		})

		test("should not leak memory with many chunks", () => {
			const filter = new ClientContentFilter({ showThinking: false })

			// Process many small chunks
			for (let i = 0; i < 1000; i++) {
				filter.processText(`chunk${i}`)
			}

			// Should not have excessive buffer growth
			expect(filter.getTagBuffer().length).toBeLessThan(1000)
		})
	})

	describe("Integration with processData", () => {
		test("should integrate with processData method", () => {
			const filter = new ClientContentFilter({ showThinking: false })
			const mockData = {
				type: "progress",
				message: "public<thinking>private</thinking>content",
				contentType: "content",
				timestamp: "2024-01-01T00:00:00Z",
			}

			const result = filter.processData(mockData)
			expect(result.shouldOutput).toBe(true)
			expect(result.content.message).toBe("publiccontent")
		})

		test("should maintain compatibility with existing output modes", () => {
			const filter = new ClientContentFilter({
				showThinking: false,
				verbose: true,
			})

			const mockData = {
				type: "progress",
				message: "test<thinking>hidden</thinking>content",
				contentType: "content",
			}

			const result = filter.processData(mockData)
			expect(result.shouldOutput).toBe(true)
			expect(result.content.message).toBe("testcontent")
		})
	})
})
