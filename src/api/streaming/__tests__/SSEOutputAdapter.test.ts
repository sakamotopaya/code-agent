import { SSEOutputAdapter } from "../SSEOutputAdapter"
import { StreamManager } from "../StreamManager"
import { SSE_EVENTS, SSEEvent } from "../types"
import { LogLevel } from "../../../core/interfaces/IUserInterface"
import { ServerResponse } from "http"

// Mock the logger
jest.mock("../../../cli/services/CLILogger", () => ({
	getCLILogger: () => ({
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	}),
}))

describe("SSEOutputAdapter", () => {
	let mockResponse: Partial<ServerResponse>
	let streamManager: StreamManager
	let adapter: SSEOutputAdapter
	let jobId: string

	beforeEach(() => {
		// Mock ServerResponse
		mockResponse = {
			write: jest.fn(),
			end: jest.fn(),
			writeHead: jest.fn(),
			headersSent: false,
			on: jest.fn(),
		}

		streamManager = new StreamManager()
		jobId = "test-job-123"

		// Create stream first
		streamManager.createStream(mockResponse as ServerResponse, jobId)

		adapter = new SSEOutputAdapter(streamManager, jobId, false) // Add verbose parameter
	})

	afterEach(() => {
		streamManager.closeAllStreams()
	})

	describe("showInformation", () => {
		it("should emit information event", async () => {
			const message = "Test information message"

			await adapter.showInformation(message)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"information"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(message))
		})

		it("should include options in event data", async () => {
			const message = "Test message"
			const options = { modal: true, actions: ["OK", "Cancel"] }

			await adapter.showInformation(message, options)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"modal":true'))
		})
	})

	describe("showWarning", () => {
		it("should emit warning event", async () => {
			const message = "Test warning message"

			await adapter.showWarning(message)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"warning"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(message))
		})
	})

	describe("showError", () => {
		it("should emit error event", async () => {
			const message = "Test error message"

			await adapter.showError(message)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(message))
		})
	})

	describe("askQuestion", () => {
		it("should emit question event and return default choice", async () => {
			const question = "What is your choice?"
			const options = {
				choices: ["Option A", "Option B"],
				defaultChoice: "Option A",
			}

			const result = await adapter.askQuestion(question, options)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"question"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(question))
			expect(result).toBe("Option A")
		})

		it("should return first choice if no default provided", async () => {
			const question = "Choose an option"
			const options = {
				choices: ["First", "Second"],
			}

			const result = await adapter.askQuestion(question, options)

			expect(result).toBe("First")
		})
	})

	describe("askConfirmation", () => {
		it("should emit question event and return true", async () => {
			const message = "Are you sure?"

			const result = await adapter.askConfirmation(message)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"question"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(message))
			expect(result).toBe(true)
		})

		it("should use custom yes/no text", async () => {
			const message = "Confirm action"
			const options = { yesText: "Proceed", noText: "Abort" }

			await adapter.askConfirmation(message, options)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining("Proceed"))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining("Abort"))
		})
	})

	describe("askInput", () => {
		it("should emit question event and return default value", async () => {
			const prompt = "Enter your name:"
			const options = { defaultValue: "John Doe" }

			const result = await adapter.askInput(prompt, options)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"question"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(prompt))
			expect(result).toBe("John Doe")
		})

		it("should return empty string if no default provided", async () => {
			const prompt = "Enter text:"

			const result = await adapter.askInput(prompt)

			expect(result).toBe("")
		})
	})

	describe("showProgress", () => {
		it("should emit progress event", async () => {
			const message = "Processing..."
			const progress = 50

			await adapter.showProgress(message, progress)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"progress"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(message))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"progress":50'))
		})
	})

	describe("clearProgress", () => {
		it("should emit progress cleared event", async () => {
			await adapter.clearProgress()

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"progress"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining("Progress cleared"))
		})
	})

	describe("log", () => {
		it("should emit log event with default level", async () => {
			const message = "Log message"

			await adapter.log(message)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"log"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(message))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"level":"info"'))
		})

		it("should emit log event with specified level", async () => {
			const message = "Error message"

			await adapter.log(message, LogLevel.ERROR)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"level":"error"'))
		})
	})

	describe("custom event methods", () => {
		it("should emit start event", async () => {
			const message = "Task starting"

			await adapter.emitStart(message)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"start"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(message))
		})

		it("should emit tool use event", async () => {
			const toolName = "read_file"
			const result = { content: "file content" }

			await adapter.emitToolUse(toolName, result)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"tool_use"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(toolName))
		})

		it("should emit completion event", async () => {
			const message = "Task completed successfully"
			const result = { status: "success" }

			await adapter.emitCompletion(message, result, undefined, "final")

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"completion"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(message))
		})

		it("should emit error event with Error object", async () => {
			const error = new Error("Test error")

			await adapter.emitError(error)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining("Test error"))
		})

		it("should emit error event with string", async () => {
			const error = "String error message"

			await adapter.emitError(error)

			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'))
			expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining(error))
		})
	})

	describe("stream management", () => {
		it("should check if stream is active", () => {
			expect(adapter.isActive()).toBe(true)
		})

		it("should close stream", () => {
			adapter.close()

			expect(adapter.isActive()).toBe(false)
		})
	})

	describe("webview methods", () => {
		it("should handle showWebview gracefully", async () => {
			const content = { html: "<div>Test</div>" }
			const options = { title: "Test Webview" }

			// Should not throw
			await expect(adapter.showWebview(content, options)).resolves.toBeUndefined()
		})

		it("should handle sendWebviewMessage gracefully", async () => {
			const message = { type: "test", data: "test data" }

			// Should not throw
			await expect(adapter.sendWebviewMessage(message)).resolves.toBeUndefined()
		})

		it("should handle onWebviewMessage gracefully", () => {
			const callback = jest.fn()

			// Should not throw
			expect(() => adapter.onWebviewMessage(callback)).not.toThrow()
		})
	})

	describe("event structure", () => {
		it("should generate proper event structure", async () => {
			const message = "Test message"

			await adapter.showInformation(message)

			const writeCall = (mockResponse.write as jest.Mock).mock.calls[0][0]
			const eventData = writeCall.replace("data: ", "").replace("\n\n", "")
			const event = JSON.parse(eventData)

			expect(event).toHaveProperty("type", "information")
			expect(event).toHaveProperty("jobId", jobId)
			expect(event).toHaveProperty("timestamp")
			expect(event).toHaveProperty("data")
			expect(event.data).toHaveProperty("message", message)
			expect(new Date(event.timestamp)).toBeInstanceOf(Date)
		})
	})

	describe("error handling", () => {
		it("should handle stream failure gracefully", async () => {
			// Close the stream to simulate failure
			streamManager.closeStream(jobId)

			// Spy on console.log to verify error logging
			const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {})

			await adapter.showInformation("Test message")

			// Verify that error logging uses public API
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("[SSE] Failed to send event information for job test-job-123"),
			)
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("[SSE] Available streams:"),
				expect.any(Array),
			)

			consoleSpy.mockRestore()
		})
	})

	describe("enhanced logging", () => {
		it("should log detailed event information", async () => {
			const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {})
			const message = "Test message with detailed logging"

			await adapter.showInformation(message)

			// Check that enhanced logging includes source and content preview
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("[SSE] Emitting information for job test-job-123:"),
				expect.objectContaining({
					eventType: "information",
					contentPreview: message,
					contentLength: message.length,
					source: "userInterface",
				}),
			)

			consoleSpy.mockRestore()
		})

		it("should truncate long content in preview", async () => {
			const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {})
			const longMessage = "a".repeat(150) // 150 characters

			await adapter.showInformation(longMessage)

			// Check that content is truncated to 100 chars + "..."
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					contentPreview: "a".repeat(100) + "...",
					contentLength: 150,
				}),
			)

			consoleSpy.mockRestore()
		})

		it("should show success indicator in logs", async () => {
			const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {})

			await adapter.showInformation("Test")

			// Check for success indicator
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("[SSE] ✅ Successfully sent information for job test-job-123 (4 chars)"),
			)

			consoleSpy.mockRestore()
		})
	})
})
