#!/usr/bin/env node

// Test script to verify nested XML tag handling
const { ClientContentFilter } = require("./test-api.js")

console.log("🧪 Testing Nested XML Tag Handling\n")

const testCases = [
	{
		name: "Basic nested tags - attempt_completion with result",
		input: "<attempt_completion><result>content</result></attempt_completion>",
		expected: "<attempt_completion><result>content</result></attempt_completion>",
		description: "Should preserve attempt_completion and all nested content",
	},
	{
		name: "Multiple nested tags in attempt_completion",
		input: "<attempt_completion><result>data</result><status>done</status></attempt_completion>",
		expected: "<attempt_completion><result>data</result><status>done</status></attempt_completion>",
		description: "Should preserve all nested XML as content",
	},
	{
		name: "Deeply nested tags",
		input: "<outer><middle><inner>content</inner></middle></outer>",
		expected: "<outer><middle><inner>content</inner></middle></outer>",
		description: "Should handle multiple levels of nesting",
	},
	{
		name: "Thinking with nested content (should filter)",
		input: "<thinking>I need <tool>data</tool> here</thinking>after",
		expected: "after",
		expectedSections: [{ tagName: "thinking", content: "I need <tool>data</tool> here" }],
		description: "Should filter thinking but preserve nested structure in section",
	},
	{
		name: "Attempt completion with thinking inside",
		input: "<attempt_completion>Done <thinking>my thoughts</thinking> result</attempt_completion>",
		expected: "<attempt_completion>Done  result</attempt_completion>",
		description: "Should preserve outer tag but filter inner thinking",
	},
	{
		name: "Mixed content with multiple tag types",
		input: "before<attempt_completion><result>data</result></attempt_completion>middle<thinking>thoughts</thinking>after",
		expected: "before<attempt_completion><result>data</result></attempt_completion>middleafter",
		description: "Should handle mixed content correctly",
	},
	{
		name: "Self-closing tags inside outer tag",
		input: "<outer><self-close/>content</outer>",
		expected: "<outer><self-close/>content</outer>",
		description: "Should preserve self-closing tags as content",
	},
	{
		name: "Tags with attributes nested",
		input: '<outer attr="value"><inner id="test">content</inner></outer>',
		expected: '<outer attr="value"><inner id="test">content</inner></outer>',
		description: "Should preserve attributes in nested tags",
	},
	{
		name: "Malformed nested tags",
		input: "<outer><inner>content</outer></inner>",
		expected: "<outer><inner>content</outer></inner>",
		description: "Should handle malformed nesting gracefully",
	},
	{
		name: "Empty nested tags",
		input: "<outer><empty></empty>content</outer>",
		expected: "<outer><empty></empty>content</outer>",
		description: "Should handle empty nested tags",
	},
]

console.log("=== Testing with showThinking = false ===\n")

testCases.forEach((testCase, index) => {
	console.log(`Test ${index + 1}: ${testCase.name}`)
	console.log(`Description: ${testCase.description}`)
	console.log(`Input:    "${testCase.input}"`)
	console.log(`Expected: "${testCase.expected}"`)

	const filter = new ClientContentFilter({ showThinking: false })
	const result = filter.processText(testCase.input)
	console.log(`Actual:   "${result}"`)

	const passed = result === testCase.expected
	console.log(`✅ Pass:   ${passed ? "YES" : "NO"}`)

	if (!passed) {
		console.log(`❌ FAILED: Expected "${testCase.expected}" but got "${result}"`)
	}

	// Check sections if expected
	if (testCase.expectedSections) {
		const sections = filter.getParsedSections()
		console.log(`Sections found: ${sections.length}`)
		sections.forEach((section) => {
			console.log(`  - ${section.tagName}: "${section.content}"`)
		})

		// Verify expected sections
		testCase.expectedSections.forEach((expectedSection, i) => {
			const found = sections.find(
				(s) => s.tagName === expectedSection.tagName && s.content === expectedSection.content,
			)
			console.log(`  Expected section ${i + 1}: ${found ? "✅ Found" : "❌ Missing"}`)
		})
	}

	console.log()
})

console.log("=== Testing with showThinking = true ===\n")

const showThinkingCases = [
	{
		name: "Thinking with nested content (should show)",
		input: "<thinking>I need <tool>data</tool> here</thinking>after",
		expected: "<thinking>I need <tool>data</tool> here</thinking>after",
		description: "Should show thinking with preserved nested structure",
	},
	{
		name: "Attempt completion with thinking inside (both visible)",
		input: "<attempt_completion>Done <thinking>my thoughts</thinking> result</attempt_completion>",
		expected: "<attempt_completion>Done <thinking>my thoughts</thinking> result</attempt_completion>",
		description: "Should show both outer and inner tags",
	},
]

showThinkingCases.forEach((testCase, index) => {
	console.log(`Show Thinking Test ${index + 1}: ${testCase.name}`)
	console.log(`Description: ${testCase.description}`)
	console.log(`Input:    "${testCase.input}"`)
	console.log(`Expected: "${testCase.expected}"`)

	const filter = new ClientContentFilter({ showThinking: true })
	const result = filter.processText(testCase.input)
	console.log(`Actual:   "${result}"`)

	const passed = result === testCase.expected
	console.log(`✅ Pass:   ${passed ? "YES" : "NO"}`)

	if (!passed) {
		console.log(`❌ FAILED: Expected "${testCase.expected}" but got "${result}"`)
	}

	console.log()
})

console.log("🎉 Nested XML Tag Tests Complete!")
