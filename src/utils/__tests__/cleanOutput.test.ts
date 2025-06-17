import { cleanOutput, extractCleanContent } from "../cleanOutput"

describe("cleanOutput", () => {
	describe("basic XML tag removal", () => {
		it("should remove <name> tags at the beginning", () => {
			const input = "<name>## Summary of Issue #8\nThis is the actual content"
			const expected = "## Summary of Issue #8\nThis is the actual content"
			expect(cleanOutput(input)).toBe(expected)
		})

		it("should remove <format> tags at the beginning", () => {
			const input = "<format>## Summary of Issue #8\nThis is the actual content"
			const expected = "## Summary of Issue #8\nThis is the actual content"
			expect(cleanOutput(input)).toBe(expected)
		})

		it("should remove multiple consecutive XML tags", () => {
			const input = "<name><format>## Summary of Issue #8\nThis is the actual content"
			const expected = "## Summary of Issue #8\nThis is the actual content"
			expect(cleanOutput(input)).toBe(expected)
		})

		it("should remove XML tags with closing tags", () => {
			const input = "<name>title</name>## Summary of Issue #8\nThis is the actual content"
			const expected = "## Summary of Issue #8\nThis is the actual content"
			expect(cleanOutput(input)).toBe(expected)
		})

		it("should handle content without XML tags", () => {
			const input = "## Summary of Issue #8\nThis is the actual content"
			const expected = "## Summary of Issue #8\nThis is the actual content"
			expect(cleanOutput(input)).toBe(expected)
		})

		it("should preserve XML tags that are not at the beginning", () => {
			const input = "This content has <emphasis>XML tags</emphasis> in the middle"
			const expected = "This content has <emphasis>XML tags</emphasis> in the middle"
			expect(cleanOutput(input)).toBe(expected)
		})

		it("should handle empty or undefined input", () => {
			expect(cleanOutput("")).toBe("")
			expect(cleanOutput("   ")).toBe("")
		})

		it("should handle custom tag names", () => {
			const input = "<custom-tag>## Summary of Issue #8\nThis is the actual content"
			const expected = "## Summary of Issue #8\nThis is the actual content"
			expect(cleanOutput(input)).toBe(expected)
		})
	})

	describe("extractCleanContent", () => {
		it("should extract content from <result> tags", () => {
			const input = "<result><name>title</name>## Summary\nContent here</result>"
			const expected = "## Summary\nContent here"
			expect(extractCleanContent(input)).toBe(expected)
		})

		it("should extract content from <content> tags", () => {
			const input = "<content><format>## Summary\nContent here</content>"
			const expected = "## Summary\nContent here"
			expect(extractCleanContent(input)).toBe(expected)
		})

		it("should extract content from <text> tags", () => {
			const input = "<text><name>title</name>## Summary\nContent here</text>"
			const expected = "## Summary\nContent here"
			expect(extractCleanContent(input)).toBe(expected)
		})

		it("should handle content without wrapper tags", () => {
			const input = "<name>title</name>## Summary\nContent here"
			const expected = "## Summary\nContent here"
			expect(extractCleanContent(input)).toBe(expected)
		})

		it("should handle nested XML structures", () => {
			const input =
				"<result><metadata><name>title</name><format>html</format></metadata>## Summary\nContent here</result>"
			const expected = "## Summary\nContent here"
			expect(extractCleanContent(input)).toBe(expected)
		})
	})

	describe("real-world examples", () => {
		it("should clean the reported CLI output issue", () => {
			const input =
				'<name><format>## Summary of Issue #8: "Story 8: Add Command Line Argument Parsing"\n[rest of content]'
			const expected = '## Summary of Issue #8: "Story 8: Add Command Line Argument Parsing"\n[rest of content]'
			expect(cleanOutput(input)).toBe(expected)
		})

		it("should handle attempt_completion result format", () => {
			const input =
				"<name>Task Complete</name><format>markdown</format>\n## Task Summary\n\nI have successfully completed the requested task.\n\n### Changes Made\n- Fixed the issue\n- Updated documentation"
			const expected =
				"## Task Summary\n\nI have successfully completed the requested task.\n\n### Changes Made\n- Fixed the issue\n- Updated documentation"
			expect(cleanOutput(input)).toBe(expected)
		})
	})
})
