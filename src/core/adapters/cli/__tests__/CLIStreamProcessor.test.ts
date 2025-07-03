import { CLIStreamProcessor } from "../CLIStreamProcessor"

describe("CLIStreamProcessor", () => {
	let processor: CLIStreamProcessor

	beforeEach(() => {
		processor = new CLIStreamProcessor({
			showThinking: false,
			showTools: false,
			useColor: false,
		})
	})

	afterEach(() => {
		processor.reset()
	})

	describe("content filtering", () => {
		it("should output regular content without XML tags", () => {
			const result = processor.processChunk("Hello world!")

			expect(result.hasOutput).toBe(true)
			expect(result.content).toBe("Hello world!")
		})

		it("should hide thinking content by default", () => {
			const result = processor.processChunk("<thinking>This is internal reasoning</thinking>")

			expect(result.hasOutput).toBe(false)
			expect(result.content).toBe("")
		})

		it("should show thinking content when enabled", () => {
			const processorWithThinking = new CLIStreamProcessor({
				showThinking: true,
				showTools: false,
				useColor: false,
			})

			const result = processorWithThinking.processChunk("<thinking>This is internal reasoning</thinking>")

			expect(result.hasOutput).toBe(true)
			expect(result.content).toContain("🤔")
			expect(result.content).toContain("This is internal reasoning")
		})

		it("should hide tool calls by default", () => {
			const result = processor.processChunk("<read_file><path>test.txt</path></read_file>")

			expect(result.hasOutput).toBe(false)
			expect(result.content).toBe("")
		})

		it("should show tool notifications when enabled", () => {
			const processorWithTools = new CLIStreamProcessor({
				showThinking: false,
				showTools: true,
				useColor: false,
			})

			const result = processorWithTools.processChunk("<read_file><path>test.txt</path></read_file>")

			expect(result.hasOutput).toBe(true)
			expect(result.content).toContain("🔧 Using tool: read_file")
		})

		it("should filter out XML tags but show content inside", () => {
			// The content inside XML tags is extracted as regular content
			const systemResult = processor.processChunk("<args><path>test.txt</path></args>")
			expect(systemResult.hasOutput).toBe(true)
			expect(systemResult.content).toBe("test.txt") // Content inside tags is shown

			// Reset for next test
			processor.reset()

			// Same for result tags - content inside is shown
			const toolResultResult = processor.processChunk("<result>File content here</result>")
			expect(toolResultResult.hasOutput).toBe(true)
			expect(toolResultResult.content).toBe("File content here")
		})
	})

	describe("attempt_completion handling", () => {
		it("should extract content from attempt_completion result tags", () => {
			const xmlInput = `<attempt_completion>
<result>
Hello! I've completed the task successfully.
</result>
</attempt_completion>`

			const result = processor.processChunk(xmlInput)

			expect(result.hasOutput).toBe(true)
			expect(result.content).toContain("Hello! I've completed the task successfully.")
		})

		it("should handle mixed content with attempt_completion", () => {
			const xmlInput = `Some initial text<attempt_completion>
<result>
Final answer here.
</result>
</attempt_completion>`

			const result = processor.processChunk(xmlInput)

			expect(result.hasOutput).toBe(true)
			expect(result.content).toContain("Some initial text")
			expect(result.content).toContain("Final answer here.")
		})
	})

	describe("partial XML handling", () => {
		it("should handle XML tags split across chunks", () => {
			// First chunk has opening tag
			const result1 = processor.processChunk("<think")
			expect(result1.hasOutput).toBe(false)

			// Second chunk completes the tag and adds content
			const result2 = processor.processChunk("ing>This is split content</thinking>")
			expect(result2.hasOutput).toBe(false) // thinking is hidden by default
		})

		it("should accumulate content properly across chunks", () => {
			const result1 = processor.processChunk("Hello ")
			expect(result1.content).toBe("Hello ")

			const result2 = processor.processChunk("world!")
			expect(result2.content).toBe("world!")

			// Both chunks should have output
			expect(result1.hasOutput).toBe(true)
			expect(result2.hasOutput).toBe(true)
		})
	})

	describe("color formatting", () => {
		it("should apply colors when enabled", () => {
			const colorProcessor = new CLIStreamProcessor({
				showThinking: true,
				showTools: true,
				useColor: true,
			})

			const thinkingResult = colorProcessor.processChunk("<thinking>Reasoning here</thinking>")
			expect(thinkingResult.content).toMatch(/\u001b\[\d+m/) // ANSI color codes

			const toolResult = colorProcessor.processChunk("<read_file><path>test</path></read_file>")
			expect(toolResult.content).toMatch(/\u001b\[\d+m/) // ANSI color codes
		})

		it("should not apply colors when disabled", () => {
			const noColorProcessor = new CLIStreamProcessor({
				showThinking: true,
				showTools: true,
				useColor: false,
			})

			const thinkingResult = noColorProcessor.processChunk("<thinking>Reasoning here</thinking>")
			expect(thinkingResult.content).not.toMatch(/\u001b\[\d+m/) // No ANSI color codes

			const toolResult = noColorProcessor.processChunk("<read_file><path>test</path></read_file>")
			expect(toolResult.content).not.toMatch(/\u001b\[\d+m/) // No ANSI color codes
		})
	})

	describe("reset functionality", () => {
		it("should reset MessageBuffer state", () => {
			// Add some content to buffer
			processor.processChunk("<thinking>Some content")

			// Reset should clear buffer
			processor.reset()

			// Buffer should be empty
			expect(processor.getBufferedContent()).toBe("")
		})
	})

	describe("debugging helpers", () => {
		it("should provide access to buffered content", () => {
			processor.processChunk("Some text")
			const buffered = processor.getBufferedContent()

			// Should be able to access buffer for debugging
			expect(typeof buffered).toBe("string")
		})

		it("should provide access to processing state", () => {
			const state = processor.getState()

			// Should return state object
			expect(state).toBeTruthy()
			expect(typeof state).toBe("object")
		})
	})
})
