/**
 * Simple test script to verify attempt_completion result display fix
 */

const { MessageBuffer } = require("./src/dist/api/streaming/MessageBuffer.js")

console.log("Testing MessageBuffer attempt_completion fix...\n")

function testAttemptCompletion() {
	console.log("=== Test 1: attempt_completion with result content ===")

	const messageBuffer = new MessageBuffer()

	const input = `<attempt_completion>
<result>
This is the final result that should be displayed to the user.

## Summary
- Fixed the issue
- Added comprehensive tests  
- Updated documentation
</result>
</attempt_completion>`

	console.log("Input:", input)

	const messages = messageBuffer.processMessage(input)

	console.log("\nProcessed messages:")
	messages.forEach((msg, i) => {
		console.log(`${i + 1}. Type: ${msg.contentType}, Tool: ${msg.toolName || "N/A"}`)
		console.log(`   Content: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? "..." : ""}`)
		console.log("")
	})

	// Check if result content is classified as tool_call (should be displayed)
	const resultContent = messages.find(
		(msg) =>
			msg.content.includes("This is the final result that should be displayed") &&
			msg.contentType === "tool_call",
	)

	if (resultContent) {
		console.log("✅ SUCCESS: Result content is classified as tool_call and should be displayed")
	} else {
		console.log("❌ FAILURE: Result content is not properly classified")
	}
}

function testRegularResult() {
	console.log("\n=== Test 2: Regular result tag (not in attempt_completion) ===")

	const messageBuffer = new MessageBuffer()

	const input = `<read_file>
<path>test.txt</path>
</read_file>
<result>File content here</result>`

	console.log("Input:", input)

	const messages = messageBuffer.processMessage(input)

	console.log("\nProcessed messages:")
	messages.forEach((msg, i) => {
		console.log(`${i + 1}. Type: ${msg.contentType}, Tool: ${msg.toolName || "N/A"}`)
		console.log(`   Content: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? "..." : ""}`)
		console.log("")
	})

	// Check if regular result tag is still classified as tool_result
	const resultTag = messages.find((msg) => msg.content === "<result>" && msg.contentType === "tool_result")

	if (resultTag) {
		console.log("✅ SUCCESS: Regular result tags are still classified as tool_result")
	} else {
		console.log("❌ FAILURE: Regular result tag classification broken")
	}
}

try {
	testAttemptCompletion()
	testRegularResult()
	console.log("\n🎉 Fix verification complete!")
} catch (error) {
	console.error("Error running tests:", error)
	console.log("\nNote: This test requires the bundled MessageBuffer. Try running: npm run bundle")
}
