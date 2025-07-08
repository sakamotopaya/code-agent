#!/usr/bin/env node

// Debug script to see what's being filtered incorrectly
const { ClientContentFilter } = require("./test-api.js")

console.log("🔍 Debugging Content Filtering\n")

const filter = new ClientContentFilter({ showThinking: false })

// Test different types of content that should NOT be filtered
const testCases = [
	{
		name: "Tool Call",
		content: "<tool_call>some tool data</tool_call>",
	},
	{
		name: "Attempt Completion",
		content: "<attempt_completion>task complete</attempt_completion>",
	},
	{
		name: "Mixed Tool and Thinking",
		content: "Using tool <tool_call>data</tool_call> and <thinking>my thoughts</thinking> done",
	},
	{
		name: "Pure XML",
		content: "<other_tag>content</other_tag>",
	},
	{
		name: "Normal text with thinking",
		content: "Normal text <thinking>hidden</thinking> continues",
	},
	{
		name: "Multiple XML tags",
		content: "<tool>data</tool> and <system>info</system> content",
	},
]

testCases.forEach((testCase, index) => {
	console.log(`Test ${index + 1}: ${testCase.name}`)
	console.log(`Input:  "${testCase.content}"`)

	const result = filter.processText(testCase.content)
	console.log(`Output: "${result}"`)

	const shouldBeUnchanged = !testCase.content.includes("<thinking>")
	const isUnchanged = result === testCase.content

	if (shouldBeUnchanged && !isUnchanged) {
		console.log(`❌ PROBLEM: Non-thinking content was modified!`)
	} else if (shouldBeUnchanged && isUnchanged) {
		console.log(`✅ Good: Non-thinking content preserved`)
	} else {
		console.log(`✅ Expected: Thinking content filtered`)
	}

	console.log()
})

console.log("🔍 Debug Complete!")
