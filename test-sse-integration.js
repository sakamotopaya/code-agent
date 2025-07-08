#!/usr/bin/env node

// Test script to verify XML tag filtering integration with SSE processing
const { ClientContentFilter } = require("./test-api.js")

console.log("🧪 Testing ClientContentFilter SSE Integration\n")

// Mock SSE data scenarios
const mockSSEData = [
	{
		type: "progress",
		message: "Starting task<thinking>Let me think about this...</thinking>",
		contentType: "content",
		timestamp: "2024-01-01T00:00:00Z",
	},
	{
		type: "progress",
		message: "<thinking>I need to analyze this problem first.</thinking>Now I will implement the solution.",
		contentType: "content",
		timestamp: "2024-01-01T00:00:01Z",
	},
	{
		type: "progress",
		message: "Here is some normal content without thinking tags.",
		contentType: "content",
		timestamp: "2024-01-01T00:00:02Z",
	},
	{
		type: "progress",
		message: "Multiple<thinking>first thought</thinking> and <thinking>second thought</thinking>sections.",
		contentType: "content",
		timestamp: "2024-01-01T00:00:03Z",
	},
	{
		type: "complete",
		message: "Task completed<thinking>Final reflection on the task</thinking>successfully!",
		result: "Final result<thinking>Some internal reasoning</thinking>here",
		timestamp: "2024-01-01T00:00:04Z",
	},
]

console.log("=== Testing with showThinking = false ===\n")

const filterHidden = new ClientContentFilter({ showThinking: false })

mockSSEData.forEach((data, index) => {
	console.log(`Test ${index + 1}: ${data.type} event`)
	console.log(`Original message: "${data.message}"`)

	const result = filterHidden.processData(data)
	console.log(`Filtered message: "${result.content.message}"`)

	if (data.result) {
		console.log(`Original result:  "${data.result}"`)
		const filteredResult = filterHidden.processText(data.result)
		console.log(`Filtered result:  "${filteredResult}"`)
	}

	console.log(`Should output: ${result.shouldOutput}`)
	console.log(`Output type: ${result.outputType}\n`)
})

console.log("=== Testing with showThinking = true ===\n")

const filterVisible = new ClientContentFilter({ showThinking: true })

mockSSEData.forEach((data, index) => {
	console.log(`Test ${index + 1}: ${data.type} event`)
	console.log(`Original message: "${data.message}"`)

	const result = filterVisible.processData(data)
	console.log(`Filtered message: "${result.content.message}"`)

	if (data.result) {
		console.log(`Original result:  "${data.result}"`)
		const filteredResult = filterVisible.processText(data.result)
		console.log(`Filtered result:  "${filteredResult}"`)
	}

	console.log(`Should output: ${result.shouldOutput}`)
	console.log(`Output type: ${result.outputType}\n`)
})

// Test edge cases
console.log("=== Testing Edge Cases ===\n")

const edgeCases = [
	{
		name: "Empty message",
		data: { type: "progress", message: "", contentType: "content" },
	},
	{
		name: "Null message",
		data: { type: "progress", message: null, contentType: "content" },
	},
	{
		name: "Undefined message",
		data: { type: "progress", contentType: "content" },
	},
	{
		name: "Non-string message",
		data: { type: "progress", message: 123, contentType: "content" },
	},
]

const edgeFilter = new ClientContentFilter({ showThinking: false })

edgeCases.forEach((testCase, index) => {
	console.log(`Edge Case ${index + 1}: ${testCase.name}`)
	console.log(`Input: ${JSON.stringify(testCase.data)}`)

	try {
		const result = edgeFilter.processData(testCase.data)
		console.log(`Result: ${JSON.stringify(result)}`)
		console.log(`✅ Handled gracefully\n`)
	} catch (error) {
		console.log(`❌ Error: ${error.message}\n`)
	}
})

console.log("🎉 SSE Integration Tests Complete!")
