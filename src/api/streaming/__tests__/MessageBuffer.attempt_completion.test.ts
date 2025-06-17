/**
 * Tests for MessageBuffer attempt_completion result display fix
 */

import { MessageBuffer } from "../MessageBuffer"

describe("MessageBuffer - attempt_completion result display", () => {
	let messageBuffer: MessageBuffer

	beforeEach(() => {
		messageBuffer = new MessageBuffer()
	})

	it("should classify result content inside attempt_completion as tool_call content", () => {
		// Simulate attempt_completion with result content
		const input = `<attempt_completion>
<result>
This is the final result that should be displayed to the user.
</result>
</attempt_completion>`

		const messages = messageBuffer.processMessage(input)

		// Find the result content message
		const resultContent = messages.find(
			(msg) =>
				msg.content.includes("This is the final result that should be displayed") &&
				msg.contentType === "tool_call",
		)

		expect(resultContent).toBeDefined()
		expect(resultContent?.contentType).toBe("tool_call")
		expect(resultContent?.toolName).toBe("attempt_completion")
		expect(resultContent?.content).toContain("This is the final result that should be displayed to the user.")
	})

	it("should still classify regular result tags as tool_result", () => {
		// Simulate regular tool result (not inside attempt_completion)
		const input = `<read_file>
<path>test.txt</path>
</read_file>
<result>File content here</result>`

		const messages = messageBuffer.processMessage(input)

		// Find the result tag message (should be tool_result)
		const resultTag = messages.find((msg) => msg.content === "<result>" && msg.contentType === "tool_result")

		expect(resultTag).toBeDefined()
		expect(resultTag?.contentType).toBe("tool_result")
	})

	it("should handle nested tags correctly in attempt_completion", () => {
		// Simulate attempt_completion with nested structure
		const input = `<attempt_completion>
<result>
I've successfully completed the task.

## Summary
- Fixed the issue
- Added tests
- Updated documentation
</result>
</attempt_completion>`

		const messages = messageBuffer.processMessage(input)

		// All content inside attempt_completion should be classified as tool_call
		const attemptCompletionContent = messages.filter(
			(msg) => msg.contentType === "tool_call" && msg.toolName === "attempt_completion",
		)

		expect(attemptCompletionContent.length).toBeGreaterThan(0)

		// Should contain the summary content
		const summaryContent = attemptCompletionContent.find((msg) =>
			msg.content.includes("I've successfully completed the task"),
		)
		expect(summaryContent).toBeDefined()
	})

	it("should handle multiple attempt_completion blocks correctly", () => {
		// Process first attempt_completion
		const input1 = `<attempt_completion>
<result>First result</result>
</attempt_completion>`

		const messages1 = messageBuffer.processMessage(input1)

		// Process second attempt_completion
		const input2 = `<attempt_completion>
<result>Second result</result>
</attempt_completion>`

		const messages2 = messageBuffer.processMessage(input2)

		// Both should be classified correctly
		const firstResult = messages1.find(
			(msg) => msg.content.includes("First result") && msg.contentType === "tool_call",
		)
		const secondResult = messages2.find(
			(msg) => msg.content.includes("Second result") && msg.contentType === "tool_call",
		)

		expect(firstResult).toBeDefined()
		expect(secondResult).toBeDefined()
	})
})
