#!/usr/bin/env node

// Quick test to verify thinking filtering works end-to-end
const { ClientContentFilter } = require("./test-api.js")

console.log("🧪 Testing End-to-End Thinking Filter\n")

// Simulate SSE data with thinking sections
const testSSEChunks = [
	'data: {"type":"progress","message":"Starting the task<thinking>I need to plan this carefully</thinking>now let me begin","contentType":"content","timestamp":"2024-01-01T00:00:00Z"}\n',
	'data: {"type":"progress","message":"<thinking>Let me analyze the requirements first</thinking>I will implement the solution step by step","contentType":"content","timestamp":"2024-01-01T00:00:01Z"}\n',
	'data: {"type":"progress","message":"Processing data and generating output","contentType":"content","timestamp":"2024-01-01T00:00:02Z"}\n',
	'data: {"type":"complete","message":"Task completed<thinking>That went well</thinking>successfully!","result":"Final output<thinking>Good result</thinking>ready","timestamp":"2024-01-01T00:00:03Z"}\n',
]

console.log("=== Testing with showThinking = false ===\n")

const filterHidden = new ClientContentFilter({
	showThinking: false,
	showResponse: true,
	verbose: false,
})

testSSEChunks.forEach((chunk, index) => {
	console.log(`Chunk ${index + 1}:`)

	if (chunk.startsWith("data: ")) {
		try {
			const data = JSON.parse(chunk.slice(6))
			console.log(`  Original: "${data.message}"`)

			const result = filterHidden.processData(data)
			console.log(`  Filtered: "${result.content.message}"`)

			if (data.result) {
				console.log(`  Original result: "${data.result}"`)
				console.log(`  Filtered result: "${result.content.result}"`)
			}

			// Show what would be output
			const shouldShow =
				result.content.message &&
				result.content.message !== "Processing..." &&
				!filterHidden.isSystemMessage(result.content.message)

			if (shouldShow) {
				console.log(`  → OUTPUT: "${result.content.message}"`)
			} else {
				console.log(`  → (suppressed)`)
			}
			console.log()
		} catch (e) {
			console.log(`  Error parsing: ${e.message}\n`)
		}
	}
})

console.log("=== Testing with showThinking = true ===\n")

const filterVisible = new ClientContentFilter({
	showThinking: true,
	showResponse: true,
	verbose: false,
})

testSSEChunks.forEach((chunk, index) => {
	console.log(`Chunk ${index + 1}:`)

	if (chunk.startsWith("data: ")) {
		try {
			const data = JSON.parse(chunk.slice(6))
			console.log(`  Original: "${data.message}"`)

			const result = filterVisible.processData(data)
			console.log(`  Filtered: "${result.content.message}"`)

			if (data.result) {
				console.log(`  Original result: "${data.result}"`)
				console.log(`  Filtered result: "${result.content.result}"`)
			}

			// Show what would be output
			const shouldShow =
				result.content.message &&
				result.content.message !== "Processing..." &&
				!filterVisible.isSystemMessage(result.content.message)

			if (shouldShow) {
				console.log(`  → OUTPUT: "${result.content.message}"`)
			} else {
				console.log(`  → (suppressed)`)
			}
			console.log()
		} catch (e) {
			console.log(`  Error parsing: ${e.message}\n`)
		}
	}
})

console.log("🎉 End-to-End Test Complete!")
