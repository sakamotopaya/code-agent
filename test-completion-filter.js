#!/usr/bin/env node

/**
 * Test completion filtering functionality
 */

const { ClientContentFilter } = require("./test-api.js")

console.log("🧪 Testing Completion Filter")

// Test data
const testCases = [
	{
		name: "Basic attempt_completion tag",
		input: "<attempt_completion><result>Task complete</result></attempt_completion>",
		expectedDefault: "",
		expectedWithCompletion: "<attempt_completion><result>Task complete</result></attempt_completion>",
	},
	{
		name: "Mixed content with attempt_completion",
		input: "Starting work<attempt_completion><result>Done</result></attempt_completion>finishing up",
		expectedDefault: "Starting workfinishing up",
		expectedWithCompletion:
			"Starting work<attempt_completion><result>Done</result></attempt_completion>finishing up",
	},
	{
		name: "Multiple attempt_completion tags",
		input: "<attempt_completion><result>First</result></attempt_completion>between<attempt_completion><result>Second</result></attempt_completion>",
		expectedDefault: "between",
		expectedWithCompletion:
			"<attempt_completion><result>First</result></attempt_completion>between<attempt_completion><result>Second</result></attempt_completion>",
	},
	{
		name: "Nested attempt_completion with thinking",
		input: "<attempt_completion><result>Done <thinking>good job</thinking> successfully</result></attempt_completion>",
		expectedDefault: "",
		expectedWithCompletion: "<attempt_completion><result>Done  successfully</result></attempt_completion>",
	},
	{
		name: "No attempt_completion tags",
		input: "Just regular text with no tags",
		expectedDefault: "Just regular text with no tags",
		expectedWithCompletion: "Just regular text with no tags",
	},
]

console.log("\n=== Testing with showCompletion = false ===\n")

// Test with showCompletion = false (default)
const filterDefault = new ClientContentFilter({ showCompletion: false })

testCases.forEach((testCase, index) => {
	console.log(`Test ${index + 1}: ${testCase.name}`)
	console.log(`Input:    "${testCase.input}"`)
	console.log(`Expected: "${testCase.expectedDefault}"`)

	const result = filterDefault.processText(testCase.input)
	console.log(`Actual:   "${result}"`)

	const pass = result === testCase.expectedDefault
	console.log(`✅ Pass:   ${pass ? "YES" : "NO"}`)

	if (!pass) {
		console.log(`❌ FAILED: Expected "${testCase.expectedDefault}" but got "${result}"`)
	}

	console.log("")
})

console.log("\n=== Testing with showCompletion = true ===\n")

// Test with showCompletion = true
const filterWithCompletion = new ClientContentFilter({ showCompletion: true })

testCases.forEach((testCase, index) => {
	console.log(`Test ${index + 1}: ${testCase.name}`)
	console.log(`Input:    "${testCase.input}"`)
	console.log(`Expected: "${testCase.expectedWithCompletion}"`)

	const result = filterWithCompletion.processText(testCase.input)
	console.log(`Actual:   "${result}"`)

	const pass = result === testCase.expectedWithCompletion
	console.log(`✅ Pass:   ${pass ? "YES" : "NO"}`)

	if (!pass) {
		console.log(`❌ FAILED: Expected "${testCase.expectedWithCompletion}" but got "${result}"`)
	}

	console.log("")
})

console.log("🎉 Completion Filter Tests Complete!")
