/**
 * Unit tests for Content Handlers
 * Tests Open/Closed Principle compliance and Strategy pattern implementation
 */

import chalk from "chalk"
import {
	ContentHandler,
	ContentHandler_Content,
	ContentHandler_Thinking,
	ContentHandler_ToolCall,
	ContentHandler_System,
	ContentHandler_ToolResult,
	ContentHandlerFactory,
} from "../ContentHandlers"
import { ProcessedMessage, ContentType } from "../../../../api/streaming/MessageBuffer"
import { DisplayContext, DisplayResult } from "../interfaces"

describe("ContentHandlers", () => {
	let mockDisplayContext: DisplayContext

	beforeEach(() => {
		mockDisplayContext = {
			useColor: true,
			showThinking: false,
			hasDisplayedTool: jest.fn().mockReturnValue(false),
			markToolDisplayed: jest.fn(),
		}
	})

	describe("ContentHandler (Abstract Base)", () => {
		class TestContentHandler extends ContentHandler {
			canHandle(contentType: ContentType): boolean {
				return contentType === "content"
			}

			protected handleSpecific(message: ProcessedMessage, context: DisplayContext): DisplayResult | null {
				return { displayText: `handled: ${message.content}` }
			}
		}

		let handler: TestContentHandler

		beforeEach(() => {
			handler = new TestContentHandler()
		})

		it("should implement template method pattern", () => {
			const message: ProcessedMessage = {
				content: "test content",
				contentType: "content",
				isComplete: true,
			}

			const result = handler.handle(message, mockDisplayContext)
			expect(result).toEqual({ displayText: "handled: test content" })
		})

		it("should return null for unsupported content types", () => {
			const message: ProcessedMessage = {
				content: "thinking content",
				contentType: "thinking",
				isComplete: true,
			}

			const result = handler.handle(message, mockDisplayContext)
			expect(result).toBeNull()
		})

		it("should apply color correctly", () => {
			const text = "test text"
			const colorFn = chalk.red

			// Test with color enabled
			const withColor = (handler as any).applyColor(text, colorFn, true)
			expect(withColor).toBe(chalk.red(text))

			// Test with color disabled
			const withoutColor = (handler as any).applyColor(text, colorFn, false)
			expect(withoutColor).toBe(text)
		})
	})

	describe("ContentHandler_Content", () => {
		let handler: ContentHandler_Content

		beforeEach(() => {
			handler = new ContentHandler_Content()
		})

		it("should handle content type correctly", () => {
			expect(handler.canHandle("content")).toBe(true)
			expect(handler.canHandle("thinking")).toBe(false)
			expect(handler.canHandle("tool_call")).toBe(false)
		})

		it("should return content as display text", () => {
			const message: ProcessedMessage = {
				content: "Hello world",
				contentType: "content",
				isComplete: true,
			}

			const result = handler.handle(message, mockDisplayContext)
			expect(result).toEqual({ displayText: "Hello world" })
		})

		it("should return null for empty content", () => {
			const message: ProcessedMessage = {
				content: "",
				contentType: "content",
				isComplete: true,
			}

			const result = handler.handle(message, mockDisplayContext)
			expect(result).toBeNull()
		})
	})

	describe("ContentHandler_Thinking", () => {
		let handler: ContentHandler_Thinking

		beforeEach(() => {
			handler = new ContentHandler_Thinking()
		})

		it("should handle thinking type correctly", () => {
			expect(handler.canHandle("thinking")).toBe(true)
			expect(handler.canHandle("content")).toBe(false)
		})

		it("should return null when showThinking is false", () => {
			const message: ProcessedMessage = {
				content: "internal thoughts",
				contentType: "thinking",
				isComplete: true,
			}

			mockDisplayContext.showThinking = false
			const result = handler.handle(message, mockDisplayContext)
			expect(result).toBeNull()
		})

		it("should format thinking content when showThinking is true", () => {
			const message: ProcessedMessage = {
				content: "internal thoughts",
				contentType: "thinking",
				isComplete: true,
			}

			mockDisplayContext.showThinking = true
			const result = handler.handle(message, mockDisplayContext)
			expect(result?.displayText).toContain("[THINKING]")
			expect(result?.displayText).toContain("internal thoughts")
		})

		it("should apply color formatting when enabled", () => {
			const message: ProcessedMessage = {
				content: "thoughts",
				contentType: "thinking",
				isComplete: true,
			}

			mockDisplayContext.showThinking = true
			mockDisplayContext.useColor = true

			const result = handler.handle(message, mockDisplayContext)
			// Should contain ANSI color codes when color is enabled
			// eslint-disable-next-line no-control-regex
			expect(result?.displayText).toMatch(/\u001b\[\d+m/)
		})

		it("should not apply color when disabled", () => {
			const message: ProcessedMessage = {
				content: "thoughts",
				contentType: "thinking",
				isComplete: true,
			}

			mockDisplayContext.showThinking = true
			mockDisplayContext.useColor = false

			const result = handler.handle(message, mockDisplayContext)
			expect(result?.displayText).toBe("[THINKING] thoughts")
		})
	})

	describe("ContentHandler_ToolCall", () => {
		let handler: ContentHandler_ToolCall

		beforeEach(() => {
			handler = new ContentHandler_ToolCall()
		})

		it("should handle tool_call type correctly", () => {
			expect(handler.canHandle("tool_call")).toBe(true)
			expect(handler.canHandle("content")).toBe(false)
		})

		it("should display tool indicator for new tools", () => {
			const message: ProcessedMessage = {
				content: "<path>test.ts</path>",
				contentType: "tool_call",
				isComplete: true,
				toolName: "read_file",
			}

			const result = handler.handle(message, mockDisplayContext)

			expect(result?.displayText).toContain("read_file...")
			expect(result?.displayText).toMatch(/\n.*\n/) // Should have newlines
			expect(mockDisplayContext.markToolDisplayed).toHaveBeenCalledWith("read_file")
		})

		it("should not display tool indicator for already displayed tools", () => {
			const message: ProcessedMessage = {
				content: "<path>test.ts</path>",
				contentType: "tool_call",
				isComplete: true,
				toolName: "read_file",
			}

			// Mock as already displayed
			;(mockDisplayContext.hasDisplayedTool as jest.Mock).mockReturnValue(true)

			const result = handler.handle(message, mockDisplayContext)
			expect(result).toBeNull()
			expect(mockDisplayContext.markToolDisplayed).not.toHaveBeenCalled()
		})

		it("should return null for tool calls without toolName", () => {
			const message: ProcessedMessage = {
				content: "<path>test.ts</path>",
				contentType: "tool_call",
				isComplete: true,
				// No toolName
			}

			const result = handler.handle(message, mockDisplayContext)
			expect(result).toBeNull()
		})

		it("should apply color formatting for tool indicators", () => {
			const message: ProcessedMessage = {
				content: "<path>test.ts</path>",
				contentType: "tool_call",
				isComplete: true,
				toolName: "write_file",
			}

			mockDisplayContext.useColor = true
			const result = handler.handle(message, mockDisplayContext)

			// Should contain ANSI color codes (yellow)
			// eslint-disable-next-line no-control-regex
			expect(result?.displayText).toMatch(/\u001b\[\d+m/)
		})
	})

	describe("ContentHandler_System", () => {
		let handler: ContentHandler_System

		beforeEach(() => {
			handler = new ContentHandler_System()
		})

		it("should handle system type correctly", () => {
			expect(handler.canHandle("system")).toBe(true)
			expect(handler.canHandle("content")).toBe(false)
		})

		it("should always return null for system content", () => {
			const message: ProcessedMessage = {
				content: "<path>system.xml</path>",
				contentType: "system",
				isComplete: true,
			}

			const result = handler.handle(message, mockDisplayContext)
			expect(result).toBeNull()
		})
	})

	describe("ContentHandler_ToolResult", () => {
		let handler: ContentHandler_ToolResult

		beforeEach(() => {
			handler = new ContentHandler_ToolResult()
		})

		it("should handle tool_result type correctly", () => {
			expect(handler.canHandle("tool_result")).toBe(true)
			expect(handler.canHandle("content")).toBe(false)
		})

		it("should always return null for tool results", () => {
			const message: ProcessedMessage = {
				content: "<result>success</result>",
				contentType: "tool_result",
				isComplete: true,
			}

			const result = handler.handle(message, mockDisplayContext)
			expect(result).toBeNull()
		})
	})

	describe("ContentHandlerFactory", () => {
		describe("createDefaultHandlers", () => {
			it("should create all default handler types", () => {
				const handlers = ContentHandlerFactory.createDefaultHandlers()

				expect(handlers).toHaveLength(5)
				expect(handlers.some((h) => h instanceof ContentHandler_Content)).toBe(true)
				expect(handlers.some((h) => h instanceof ContentHandler_Thinking)).toBe(true)
				expect(handlers.some((h) => h instanceof ContentHandler_ToolCall)).toBe(true)
				expect(handlers.some((h) => h instanceof ContentHandler_System)).toBe(true)
				expect(handlers.some((h) => h instanceof ContentHandler_ToolResult)).toBe(true)
			})

			it("should create handlers that implement IContentTypeHandler", () => {
				const handlers = ContentHandlerFactory.createDefaultHandlers()

				for (const handler of handlers) {
					expect(handler).toHaveProperty("canHandle")
					expect(handler).toHaveProperty("handle")
					expect(typeof handler.canHandle).toBe("function")
					expect(typeof handler.handle).toBe("function")
				}
			})
		})

		describe("createHandlersRegistry", () => {
			it("should create registry with correct content type mappings", () => {
				const registry = ContentHandlerFactory.createHandlersRegistry()

				expect(registry.has("content")).toBe(true)
				expect(registry.has("thinking")).toBe(true)
				expect(registry.has("tool_call")).toBe(true)
				expect(registry.has("system")).toBe(true)
				expect(registry.has("tool_result")).toBe(true)
			})

			it("should map content types to correct handler instances", () => {
				const registry = ContentHandlerFactory.createHandlersRegistry()

				expect(registry.get("content")).toBeInstanceOf(ContentHandler_Content)
				expect(registry.get("thinking")).toBeInstanceOf(ContentHandler_Thinking)
				expect(registry.get("tool_call")).toBeInstanceOf(ContentHandler_ToolCall)
				expect(registry.get("system")).toBeInstanceOf(ContentHandler_System)
				expect(registry.get("tool_result")).toBeInstanceOf(ContentHandler_ToolResult)
			})
		})
	})

	describe("Open/Closed Principle compliance", () => {
		it("should allow extension without modification", () => {
			// Create custom handler for hypothetical new content type
			class CustomContentHandler extends ContentHandler {
				canHandle(contentType: ContentType): boolean {
					return contentType === "content" // Pretend this is a new type
				}

				protected handleSpecific(message: ProcessedMessage, context: DisplayContext): DisplayResult | null {
					return { displayText: `CUSTOM: ${message.content}` }
				}
			}

			const customHandler = new CustomContentHandler()
			const message: ProcessedMessage = {
				content: "test",
				contentType: "content",
				isComplete: true,
			}

			const result = customHandler.handle(message, mockDisplayContext)
			expect(result?.displayText).toBe("CUSTOM: test")
		})
	})
})
