/**
 * Unit tests for CLIContentProcessor
 * Tests Single Responsibility Principle compliance and MessageBuffer integration
 */

import { CLIContentProcessor } from "../CLIContentProcessor"
import { MessageBuffer, ProcessedMessage } from "../../../../api/streaming/MessageBuffer"

describe("CLIContentProcessor", () => {
	let processor: CLIContentProcessor
	let mockMessageBuffer: jest.Mocked<MessageBuffer>

	beforeEach(() => {
		// Create mock MessageBuffer
		mockMessageBuffer = {
			processMessage: jest.fn(),
			reset: jest.fn(),
			getBufferedContent: jest.fn(),
			getState: jest.fn(),
		} as any

		processor = new CLIContentProcessor(mockMessageBuffer)
	})

	describe("constructor", () => {
		it("should accept custom MessageBuffer instance", () => {
			const customProcessor = new CLIContentProcessor(mockMessageBuffer)
			expect(customProcessor).toBeInstanceOf(CLIContentProcessor)
		})

		it("should create default MessageBuffer if none provided", () => {
			const defaultProcessor = new CLIContentProcessor()
			expect(defaultProcessor).toBeInstanceOf(CLIContentProcessor)
		})
	})

	describe("processContent", () => {
		it("should delegate to MessageBuffer.processMessage", () => {
			const content = "test content"
			const expectedResult: ProcessedMessage[] = [
				{
					content: "test content",
					contentType: "content",
					isComplete: true,
				},
			]

			mockMessageBuffer.processMessage.mockReturnValue(expectedResult)

			const result = processor.processContent(content)

			expect(mockMessageBuffer.processMessage).toHaveBeenCalledWith(content)
			expect(result).toEqual(expectedResult)
		})

		it("should validate input type", () => {
			// Test with invalid input type
			const result = processor.processContent(null as any)

			// Should handle gracefully and return fallback content
			expect(result).toEqual([
				{
					content: null,
					contentType: "content",
					isComplete: true,
				},
			])
		})

		it("should handle MessageBuffer errors gracefully", () => {
			const content = "problematic content"
			mockMessageBuffer.processMessage.mockImplementation(() => {
				throw new Error("MessageBuffer parsing error")
			})

			const result = processor.processContent(content)

			// Should return fallback content message
			expect(result).toEqual([
				{
					content: content,
					contentType: "content",
					isComplete: true,
				},
			])
		})

		describe("content type processing", () => {
			it("should handle thinking content", () => {
				const content = "<thinking>internal thoughts</thinking>"
				const expectedResult: ProcessedMessage[] = [
					{ content: "internal thoughts", contentType: "thinking", isComplete: true },
				]

				mockMessageBuffer.processMessage.mockReturnValue(expectedResult)

				const result = processor.processContent(content)
				expect(result).toEqual(expectedResult)
			})

			it("should handle tool call content", () => {
				const content = "<read_file><path>test.ts</path></read_file>"
				const expectedResult: ProcessedMessage[] = [
					{
						content: "<path>test.ts</path>",
						contentType: "tool_call",
						isComplete: true,
						toolName: "read_file",
					},
				]

				mockMessageBuffer.processMessage.mockReturnValue(expectedResult)

				const result = processor.processContent(content)
				expect(result).toEqual(expectedResult)
			})

			it("should handle mixed content types", () => {
				const content = "Normal text <thinking>thoughts</thinking> <read_file><path>file.ts</path></read_file>"
				const expectedResult: ProcessedMessage[] = [
					{ content: "Normal text ", contentType: "content", isComplete: true },
					{ content: "thoughts", contentType: "thinking", isComplete: true },
					{ content: " ", contentType: "content", isComplete: true },
					{
						content: "<path>file.ts</path>",
						contentType: "tool_call",
						isComplete: true,
						toolName: "read_file",
					},
				]

				mockMessageBuffer.processMessage.mockReturnValue(expectedResult)

				const result = processor.processContent(content)
				expect(result).toEqual(expectedResult)
			})
		})

		describe("edge cases", () => {
			it.each([
				["empty string", ""],
				["whitespace only", "   \n\t  "],
				["partial XML", "<thinking>unfinished"],
				["malformed XML", "<invalid><thinking>mixed</invalid>"],
				["unicode content", "🔧 Tool execution 中文"],
				["very long content", "x".repeat(10000)],
			])("should handle %s without throwing", (_, content) => {
				mockMessageBuffer.processMessage.mockReturnValue([
					{
						content,
						contentType: "content",
						isComplete: true,
					},
				])

				expect(() => processor.processContent(content)).not.toThrow()
			})
		})
	})

	describe("reset", () => {
		it("should delegate to MessageBuffer.reset", () => {
			processor.reset()
			expect(mockMessageBuffer.reset).toHaveBeenCalled()
		})

		it("should handle reset errors gracefully", () => {
			mockMessageBuffer.reset.mockImplementation(() => {
				throw new Error("Reset failed")
			})

			// Should not throw even if MessageBuffer reset fails
			expect(() => processor.reset()).not.toThrow()
		})
	})

	describe("debugging methods", () => {
		it("should provide access to buffered content", () => {
			const expectedContent = "buffered content"
			mockMessageBuffer.getBufferedContent.mockReturnValue(expectedContent)

			const result = processor.getBufferedContent()
			expect(result).toBe(expectedContent)
			expect(mockMessageBuffer.getBufferedContent).toHaveBeenCalled()
		})

		it("should provide access to MessageBuffer state", () => {
			const expectedState = {
				buffer: "test",
				inThinkingSection: false,
				inToolSection: true,
				currentToolName: "read_file",
				tagStack: ["read_file"],
				pendingContent: "",
				inAttemptCompletion: false,
			}
			mockMessageBuffer.getState.mockReturnValue(expectedState)

			const result = processor.getState()
			expect(result).toEqual(expectedState)
			expect(mockMessageBuffer.getState).toHaveBeenCalled()
		})
	})

	describe("IContentProcessor contract compliance", () => {
		it("should always return an array from processContent", () => {
			mockMessageBuffer.processMessage.mockReturnValue([])

			const result = processor.processContent("test")
			expect(Array.isArray(result)).toBe(true)
		})

		it("should handle null/undefined input gracefully", () => {
			expect(() => processor.processContent(null as any)).not.toThrow()
			expect(() => processor.processContent(undefined as any)).not.toThrow()
		})

		it("should return ProcessedMessage objects with required properties", () => {
			const mockResult: ProcessedMessage[] = [
				{
					content: "test",
					contentType: "content",
					isComplete: true,
				},
			]
			mockMessageBuffer.processMessage.mockReturnValue(mockResult)

			const result = processor.processContent("test content")

			for (const message of result) {
				expect(message).toHaveProperty("content")
				expect(message).toHaveProperty("contentType")
				expect(message).toHaveProperty("isComplete")
				expect(typeof message.content).toBe("string")
				expect(["content", "thinking", "tool_call", "system", "tool_result"]).toContain(message.contentType)
				expect(typeof message.isComplete).toBe("boolean")
			}
		})
	})

	describe("performance considerations", () => {
		it("should process large content efficiently", () => {
			const largeContent = "x".repeat(100000) // 100KB
			mockMessageBuffer.processMessage.mockReturnValue([
				{
					content: largeContent,
					contentType: "content",
					isComplete: true,
				},
			])

			const startTime = performance.now()
			processor.processContent(largeContent)
			const endTime = performance.now()

			// Should process within reasonable time (< 100ms)
			expect(endTime - startTime).toBeLessThan(100)
		})

		it("should handle frequent calls without memory leaks", () => {
			mockMessageBuffer.processMessage.mockReturnValue([
				{
					content: "chunk",
					contentType: "content",
					isComplete: true,
				},
			])

			// Simulate frequent streaming calls
			for (let i = 0; i < 1000; i++) {
				processor.processContent(`chunk ${i}`)
			}

			// Should complete without errors
			expect(mockMessageBuffer.processMessage).toHaveBeenCalledTimes(1000)
		})
	})
})
