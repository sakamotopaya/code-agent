import { ContentFilterOptions, StreamEvent, TokenUsage } from "../types/api-client-types"

// Mock console and process.stdout methods
const mockConsoleLog = jest.fn()
const mockProcessStdoutWrite = jest.fn()

// Mock the displayTokenUsage function that's used in the ClientContentFilter
jest.mock("../api-client", () => ({
	displayTokenUsage: jest.fn(),
}))

// Import the ClientContentFilter class after mocking
let ClientContentFilter: any
beforeAll(async () => {
	// Mock console.log and process.stdout.write
	jest.spyOn(console, "log").mockImplementation(mockConsoleLog)
	jest.spyOn(process.stdout, "write").mockImplementation(mockProcessStdoutWrite)

	// Dynamically import the class after mocking
	const apiClient = await import("../api-client")
	ClientContentFilter = (apiClient as any).ClientContentFilter
})

describe("ClientContentFilter Refactoring", () => {
	let contentFilter: any
	let mockOptions: ContentFilterOptions

	beforeEach(() => {
		// Reset mocks
		mockConsoleLog.mockClear()
		mockProcessStdoutWrite.mockClear()

		// Default options
		mockOptions = {
			showResponse: true,
			showThinking: true,
			showTools: true,
			showSystem: true,
			showCompletion: true,
			showMcpUse: true,
			showTokenUsage: true,
			hideTokenUsage: false,
			verbose: false,
		}

		contentFilter = new ClientContentFilter(mockOptions)
	})

	describe("Content Type Filtering", () => {
		it("should filter content based on showThinking option", () => {
			mockOptions.showThinking = false
			contentFilter = new ClientContentFilter(mockOptions)

			expect(contentFilter.shouldShowContent("thinking")).toBe(false)
			expect(contentFilter.shouldShowContent("response")).toBe(true)
		})

		it("should filter content based on showTools option", () => {
			mockOptions.showTools = false
			contentFilter = new ClientContentFilter(mockOptions)

			expect(contentFilter.shouldShowContent("tool")).toBe(false)
			expect(contentFilter.shouldShowContent("response")).toBe(true)
		})

		it("should filter content based on showSystem option", () => {
			mockOptions.showSystem = false
			contentFilter = new ClientContentFilter(mockOptions)

			expect(contentFilter.shouldShowContent("system")).toBe(false)
			expect(contentFilter.shouldShowContent("response")).toBe(true)
		})

		it("should show unknown content types by default", () => {
			expect(contentFilter.shouldShowContent("unknown")).toBe(true)
			expect(contentFilter.shouldShowContent("")).toBe(true)
			expect(contentFilter.shouldShowContent(undefined)).toBe(true)
		})
	})

	describe("Content Type Prefixes", () => {
		it("should return correct prefixes for different content types", () => {
			expect(contentFilter.getContentTypePrefix("thinking")).toBe("🤔 ")
			expect(contentFilter.getContentTypePrefix("tool")).toBe("🔧 ")
			expect(contentFilter.getContentTypePrefix("tool", "testTool")).toBe("🔧 testTool: ")
			expect(contentFilter.getContentTypePrefix("system")).toBe("⚙️  ")
			expect(contentFilter.getContentTypePrefix("response")).toBe("💬 ")
			expect(contentFilter.getContentTypePrefix("completion")).toBe("✅ ")
			expect(contentFilter.getContentTypePrefix("mcp_use")).toBe("🔌 ")
			expect(contentFilter.getContentTypePrefix("unknown")).toBe("")
		})
	})

	describe("System Message Detection", () => {
		it("should detect system messages", () => {
			expect(contentFilter.isSystemMessage("[SYSTEM] test")).toBe(true)
			expect(contentFilter.isSystemMessage("[DEBUG] test")).toBe(true)
			expect(contentFilter.isSystemMessage("[INTERNAL] test")).toBe(true)
			expect(contentFilter.isSystemMessage("normal message")).toBe(false)
			expect(contentFilter.isSystemMessage("")).toBe(false)
		})
	})

	describe("Verbose Mode Output", () => {
		beforeEach(() => {
			mockOptions.verbose = true
			contentFilter = new ClientContentFilter(mockOptions)
		})

		it("should output start events with timestamps in verbose mode", () => {
			const event: StreamEvent = {
				type: "start",
				message: "Starting task",
				result: "Task started",
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			expect(mockConsoleLog).toHaveBeenCalledWith("     🚀 [12:34:56] Starting task: Task started")
		})

		it("should output progress events with step info in verbose mode", () => {
			const event: StreamEvent = {
				type: "progress",
				message: "Processing step",
				step: 2,
				total: 5,
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			expect(mockConsoleLog).toHaveBeenCalledWith("     ⏳ [12:34:56] Step 2/5: Processing step")
		})

		it("should output completion events in verbose mode", () => {
			const event: StreamEvent = {
				type: "completion",
				message: "Task completed",
				result: "Success",
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			expect(mockConsoleLog).toHaveBeenCalledWith("     ✅ [12:34:56] Task completed")
			expect(mockConsoleLog).toHaveBeenCalledWith("     📋 Result: Success")
		})

		it("should output error events in verbose mode", () => {
			const event: StreamEvent = {
				type: "error",
				error: "Something went wrong",
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			expect(mockConsoleLog).toHaveBeenCalledWith("     ❌ [12:34:56] Error: Something went wrong")
		})
	})

	describe("Simple Mode Output", () => {
		beforeEach(() => {
			mockOptions.verbose = false
			contentFilter = new ClientContentFilter(mockOptions)
		})

		it("should not output start events in simple mode", () => {
			const event: StreamEvent = {
				type: "start",
				message: "Starting task",
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			expect(mockConsoleLog).not.toHaveBeenCalled()
			expect(mockProcessStdoutWrite).not.toHaveBeenCalled()
		})

		it("should output progress events with filtering in simple mode", () => {
			const event: StreamEvent = {
				type: "progress",
				message: "Processing content",
				contentType: "response",
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			expect(mockProcessStdoutWrite).toHaveBeenCalledWith("💬 Processing content")
		})

		it("should filter progress events based on content type in simple mode", () => {
			mockOptions.showThinking = false
			contentFilter = new ClientContentFilter(mockOptions)

			const event: StreamEvent = {
				type: "progress",
				message: "Thinking...",
				contentType: "thinking",
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			expect(mockProcessStdoutWrite).not.toHaveBeenCalled()
		})

		it("should output completion events with filtering in simple mode", () => {
			const event: StreamEvent = {
				type: "completion",
				result: "Task completed successfully",
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			expect(mockProcessStdoutWrite).toHaveBeenCalledWith("Task completed successfully")
		})

		it("should handle invalid mode errors in simple mode", () => {
			const event: StreamEvent = {
				type: "error",
				error: "Invalid mode",
				message: "test-mode",
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			expect(mockConsoleLog).toHaveBeenCalledWith("❌ Invalid mode: test-mode")
			expect(mockConsoleLog).toHaveBeenCalledWith(
				"💡 Tip: Check available modes on the server or use a built-in mode",
			)
		})
	})

	describe("Token Usage Handling", () => {
		it("should accumulate token usage for final display", () => {
			const mockTokenUsage: TokenUsage = {
				inputTokens: 100,
				outputTokens: 50,
				totalTokens: 150,
				cost: 0.001,
			}

			const event: StreamEvent = {
				type: "token_usage",
				tokenUsage: mockTokenUsage,
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			const finalTokenUsage = contentFilter.getFinalTokenUsage()
			expect(finalTokenUsage.tokenUsage).toEqual(mockTokenUsage)
			expect(finalTokenUsage.timestamp).toBe("12:34:56")
		})

		it("should not accumulate token usage when hideTokenUsage is true", () => {
			mockOptions.hideTokenUsage = true
			contentFilter = new ClientContentFilter(mockOptions)

			const mockTokenUsage: TokenUsage = {
				inputTokens: 100,
				outputTokens: 50,
				totalTokens: 150,
				cost: 0.001,
			}

			const event: StreamEvent = {
				type: "token_usage",
				tokenUsage: mockTokenUsage,
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			const finalTokenUsage = contentFilter.getFinalTokenUsage()
			expect(finalTokenUsage.tokenUsage).toBeNull()
		})

		it("should reset token usage state", () => {
			const mockTokenUsage: TokenUsage = {
				inputTokens: 100,
				outputTokens: 50,
				totalTokens: 150,
				cost: 0.001,
			}

			const event: StreamEvent = {
				type: "token_usage",
				tokenUsage: mockTokenUsage,
			}

			contentFilter.formatAndOutputEvent(event, "12:34:56")

			// Verify token usage was accumulated
			let finalTokenUsage = contentFilter.getFinalTokenUsage()
			expect(finalTokenUsage.tokenUsage).toEqual(mockTokenUsage)

			// Reset and verify it's cleared
			contentFilter.resetTokenUsage()
			finalTokenUsage = contentFilter.getFinalTokenUsage()
			expect(finalTokenUsage.tokenUsage).toBeNull()
			expect(finalTokenUsage.timestamp).toBeNull()
		})
	})

	describe("Integration with StreamProcessor", () => {
		it("should be the single source of truth for all output formatting", () => {
			// Test that all event types are handled by the ContentFilter
			const eventTypes = [
				"start",
				"progress",
				"complete",
				"completion",
				"error",
				"token_usage",
				"stream_end",
				"log",
			]

			eventTypes.forEach((eventType) => {
				const event: StreamEvent = {
					type: eventType,
					message: `Test ${eventType}`,
					result: `Result for ${eventType}`,
				}

				// Should not throw an error
				expect(() => {
					contentFilter.formatAndOutputEvent(event, "12:34:56")
				}).not.toThrow()
			})
		})
	})
})
