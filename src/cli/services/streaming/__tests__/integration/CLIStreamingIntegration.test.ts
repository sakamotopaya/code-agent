/**
 * Integration tests for CLI streaming with MessageBuffer
 * Verifies end-to-end streaming functionality and tool execution preservation
 */

import { CLILogger } from "../../CLILogger"
import { createDefaultCLILogger } from "../../factory"
import { CLIContentProcessor } from "../../CLIContentProcessor"
import { CLIDisplayFormatter } from "../../CLIDisplayFormatter"
import { ConsoleOutputWriter } from "../../ConsoleOutputWriter"
import { MessageBuffer } from "../../../../../api/streaming/MessageBuffer"

describe("CLI Streaming Integration", () => {
	let capturedOutput: string[]
	let capturedErrors: string[]
	let originalStdoutWrite: typeof process.stdout.write
	let originalConsoleError: typeof console.error

	beforeEach(() => {
		capturedOutput = []
		capturedErrors = []

		// Mock stdout to capture output
		originalStdoutWrite = process.stdout.write
		process.stdout.write = jest.fn((chunk: any) => {
			capturedOutput.push(chunk.toString())
			return true
		}) as any

		// Mock console.error to capture debug output
		originalConsoleError = console.error
		console.error = jest.fn((...args) => {
			capturedErrors.push(args.join(" "))
		})
	})

	afterEach(() => {
		// Restore original functions
		process.stdout.write = originalStdoutWrite
		console.error = originalConsoleError
	})

	describe("End-to-End Streaming", () => {
		it("should process complete streaming scenario correctly", () => {
			const logger = createDefaultCLILogger({
				verbose: false,
				quiet: false,
				useColor: false,
				showThinking: false,
			})

			// Simulate a complete LLM response with mixed content
			const streamingChunks = [
				"I need to read a file.",
				"\n\n<thinking>",
				"Let me think about which file to read",
				"</thinking>",
				"\n\nI'll use the read_file tool.",
				"\n\n<read_file>",
				"\n<path>",
				"test.ts",
				"</path>",
				"\n</read_file>",
				"\n\nThe file has been read successfully.",
			]

			// Process each chunk
			for (const chunk of streamingChunks) {
				logger.streamLLMOutput(chunk)
			}

			const fullOutput = capturedOutput.join("")

			// Verify correct content is displayed
			expect(fullOutput).toContain("I need to read a file.")
			expect(fullOutput).toContain("I'll use the read_file tool.")
			expect(fullOutput).toContain("The file has been read successfully.")
			expect(fullOutput).toContain("read_file...")

			// Verify thinking content is hidden
			expect(fullOutput).not.toContain("Let me think about which file to read")

			// Verify system tags are hidden
			expect(fullOutput).not.toContain("<path>")
			expect(fullOutput).not.toContain("test.ts")
			expect(fullOutput).not.toContain("</path>")
		})

		it("should handle thinking content when enabled", () => {
			const logger = createDefaultCLILogger({
				showThinking: true,
				useColor: false,
			})

			logger.streamLLMOutput("Before <thinking>internal thoughts</thinking> after")

			const fullOutput = capturedOutput.join("")
			expect(fullOutput).toContain("Before")
			expect(fullOutput).toContain("[THINKING] internal thoughts")
			expect(fullOutput).toContain("after")
		})

		it("should display tool indicators only once per tool", () => {
			const logger = createDefaultCLILogger({ useColor: false })

			// Use read_file tool multiple times
			logger.streamLLMOutput("<read_file><path>file1.ts</path></read_file>")
			logger.streamLLMOutput("<read_file><path>file2.ts</path></read_file>")

			const fullOutput = capturedOutput.join("")
			const toolIndicatorMatches = fullOutput.match(/read_file\.\.\./g)

			// Should only appear once despite multiple uses
			expect(toolIndicatorMatches).toHaveLength(1)
		})

		it("should handle multiple different tools correctly", () => {
			const logger = createDefaultCLILogger({ useColor: false })

			logger.streamLLMOutput("<read_file><path>test.ts</path></read_file>")
			logger.streamLLMOutput("<write_to_file><path>output.ts</path><content>data</content></write_to_file>")
			logger.streamLLMOutput("<execute_command><command>ls -la</command></execute_command>")

			const fullOutput = capturedOutput.join("")
			expect(fullOutput).toContain("read_file...")
			expect(fullOutput).toContain("write_to_file...")
			expect(fullOutput).toContain("execute_command...")
		})

		it("should reset state correctly between tasks", () => {
			const logger = createDefaultCLILogger({ useColor: false })

			// First task
			logger.streamLLMOutput("<read_file><path>test1.ts</path></read_file>")
			let output1 = capturedOutput.join("")
			expect(output1).toContain("read_file...")

			// Reset for new task
			logger.resetToolDisplay()
			capturedOutput.length = 0

			// Second task - same tool should show indicator again
			logger.streamLLMOutput("<read_file><path>test2.ts</path></read_file>")
			let output2 = capturedOutput.join("")
			expect(output2).toContain("read_file...")
		})
	})

	describe("MessageBuffer Integration", () => {
		it("should handle partial XML tags across chunks", () => {
			const logger = createDefaultCLILogger({ useColor: false })

			// Simulate partial tag split across chunks
			logger.streamLLMOutput("Before <read_")
			logger.streamLLMOutput("file><path>test.ts</path></read_file> after")

			const fullOutput = capturedOutput.join("")
			expect(fullOutput).toContain("Before")
			expect(fullOutput).toContain("read_file...")
			expect(fullOutput).toContain("after")
		})

		it("should handle malformed XML gracefully", () => {
			const logger = createDefaultCLILogger({ useColor: false })

			// Malformed XML should not crash the system
			expect(() => {
				logger.streamLLMOutput("Text with <invalid><thinking>mixed</invalid> content")
			}).not.toThrow()

			const fullOutput = capturedOutput.join("")
			expect(fullOutput).toContain("Text with")
			expect(fullOutput).toContain("content")
		})
	})

	describe("Performance", () => {
		it("should handle high-frequency streaming without degradation", () => {
			const logger = createDefaultCLILogger({ quiet: true }) // Suppress output for perf test

			const startTime = performance.now()

			// Simulate high-frequency chunks
			for (let i = 0; i < 1000; i++) {
				logger.streamLLMOutput(`chunk ${i} `)
			}

			const endTime = performance.now()
			const duration = endTime - startTime

			// Should process 1000 chunks in reasonable time
			expect(duration).toBeLessThan(1000) // 1 second
		})
	})

	describe("Backward Compatibility", () => {
		it("should maintain legacy CLILogger API compatibility", () => {
			const legacyLogger = new (require("../../CLILogger").CLILogger)(false, false, false, false)

			// Legacy methods should still work
			expect(typeof legacyLogger.streamLLMOutput).toBe("function")
			expect(typeof legacyLogger.resetToolDisplay).toBe("function")
			expect(typeof legacyLogger.clearLine).toBe("function")
			expect(typeof legacyLogger.formatMarkdown).toBe("function")
			expect(typeof legacyLogger.withSettings).toBe("function")

			// Should not throw when called
			expect(() => {
				legacyLogger.streamLLMOutput("test content")
				legacyLogger.resetToolDisplay()
				legacyLogger.clearLine()
				legacyLogger.formatMarkdown("# Test")
			}).not.toThrow()
		})
	})
})
