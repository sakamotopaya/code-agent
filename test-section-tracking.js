#!/usr/bin/env node

// Test script to verify section tracking and generic XML handling
const { ClientContentFilter } = require("./test-api.js")

console.log("🧪 Testing Section Tracking and Generic XML Handling\n")

const filter = new ClientContentFilter({ showThinking: false })

// Test different types of content
const testCases = [
	{
		name: "Mixed content with thinking",
		content: "Before<thinking>hidden thoughts</thinking>middle<tool_call>some tool</tool_call>after",
	},
	{
		name: "Multiple different XML sections",
		content:
			"<system>system info</system>text<thinking>thoughts</thinking>more<attempt_completion>done</attempt_completion>",
	},
	{
		name: "Nested-like content",
		content: "<thinking>I need to use <tool_call>some tool</tool_call> here</thinking>result",
	},
	{
		name: "Unknown XML tags",
		content: 'before<custom_tag>custom content</custom_tag>after<new_tag attr="value">content</new_tag>end',
	},
]

testCases.forEach((testCase, index) => {
	console.log(`Test ${index + 1}: ${testCase.name}`)
	console.log(`Input:    "${testCase.content}"`)

	const result = filter.processText(testCase.content)
	console.log(`Filtered: "${result}"`)

	const sections = filter.getParsedSections()
	console.log(`Sections found: ${sections.length}`)

	sections.forEach((section, i) => {
		console.log(`  ${i + 1}. ${section.tagName}: "${section.content}"`)
	})

	// Test specific section retrieval
	const thinkingSections = filter.getSectionsByTag("thinking")
	if (thinkingSections.length > 0) {
		console.log(`Thinking sections: ${thinkingSections.length}`)
		thinkingSections.forEach((section, i) => {
			console.log(`  Thinking ${i + 1}: "${section.content}"`)
		})
	}

	console.log()
})

// Test with showThinking=true
console.log("=== Testing with showThinking=true ===\n")

const filterShow = new ClientContentFilter({ showThinking: true })

const testInput = "Before<thinking>visible thoughts</thinking>after<tool_call>tool data</tool_call>end"
console.log(`Input:    "${testInput}"`)

const result = filterShow.processText(testInput)
console.log(`Filtered: "${result}"`)

const sections = filterShow.getParsedSections()
console.log(`Sections found: ${sections.length}`)

sections.forEach((section, i) => {
	console.log(`  ${i + 1}. ${section.tagName}: "${section.content}"`)
})

console.log("\n🎉 Section Tracking Test Complete!")
