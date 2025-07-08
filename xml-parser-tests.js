#!/usr/bin/env node

/**
 * Comprehensive XML Parser Tests
 * Tests all XML parsing functionality including nested tags, filtering, and edge cases
 */

const { ClientContentFilter } = require("./api-client.js")

console.log("🧪 XML Parser Test Suite")
console.log("========================\n")

let totalTests = 0
let passedTests = 0

function runTest(name, input, expected, filterOptions = {}) {
	totalTests++
	console.log(`Test ${totalTests}: ${name}`)
	console.log(`Input:    "${input}"`)
	console.log(`Expected: "${expected}"`)

	const filter = new ClientContentFilter(filterOptions)
	const result = filter.processText(input)
	console.log(`Actual:   "${result}"`)

	const pass = result === expected
	console.log(`✅ Pass:   ${pass ? "YES" : "NO"}`)

	if (pass) {
		passedTests++
	} else {
		console.log(`❌ FAILED: Expected "${expected}" but got "${result}"`)
	}

	console.log("")
	return pass
}

// Test 1: Basic Nested XML Tags
console.log("=== 1. Basic Nested XML Tag Tests ===\n")

runTest(
	"Basic nested tags - attempt_completion with result",
	"<attempt_completion><result>content</result></attempt_completion>",
	"<attempt_completion><result>content</result></attempt_completion>",
	{ showCompletion: true },
)

runTest(
	"Multiple nested tags in attempt_completion",
	"<attempt_completion><result>data</result><status>done</status></attempt_completion>",
	"<attempt_completion><result>data</result><status>done</status></attempt_completion>",
	{ showCompletion: true },
)

runTest(
	"Deeply nested tags",
	"<outer><middle><inner>content</inner></middle></outer>",
	"<outer><middle><inner>content</inner></middle></outer>",
)

// Test 2: Thinking Tag Filtering
console.log("=== 2. Thinking Tag Filtering Tests ===\n")

runTest(
	"Basic thinking tag filtering (hidden by default)",
	"<thinking>I need to think about this</thinking>after",
	"after",
)

runTest(
	"Thinking tag with showThinking=true",
	"<thinking>I need to think about this</thinking>after",
	"<thinking>I need to think about this</thinking>after",
	{ showThinking: true },
)

runTest(
	"Thinking with nested content (should filter)",
	"<thinking>I need <tool>data</tool> here</thinking>after",
	"after",
)

runTest(
	"Attempt completion with thinking inside (nested filtering)",
	"<attempt_completion>Done <thinking>my thoughts</thinking> result</attempt_completion>",
	"<attempt_completion>Done  result</attempt_completion>",
	{ showCompletion: true },
)

// Test 3: Attempt Completion Tag Filtering
console.log("=== 3. Attempt Completion Tag Filtering Tests ===\n")

runTest(
	"Basic attempt_completion filtering (hidden by default)",
	"<attempt_completion><result>Task complete</result></attempt_completion>",
	"",
)

runTest(
	"Attempt completion with showCompletion=true",
	"<attempt_completion><result>Task complete</result></attempt_completion>",
	"<attempt_completion><result>Task complete</result></attempt_completion>",
	{ showCompletion: true },
)

runTest(
	"Mixed content with attempt_completion",
	"Starting work<attempt_completion><result>Done</result></attempt_completion>finishing up",
	"Starting workfinishing up",
)

runTest(
	"Multiple attempt_completion tags",
	"<attempt_completion><result>First</result></attempt_completion>between<attempt_completion><result>Second</result></attempt_completion>",
	"between",
)

runTest(
	"Nested attempt_completion with thinking",
	"<attempt_completion><result>Done <thinking>good job</thinking> successfully</result></attempt_completion>",
	"",
)

// Test 4: Use MCP Tool Tag Filtering Tests
console.log("=== 4. Use MCP Tool Tag Filtering Tests ===\n")

runTest(
	"Basic use_mcp_tool filtering (hidden by default)",
	"<use_mcp_tool><server_name>test</server_name><tool_name>echo</tool_name></use_mcp_tool>",
	"",
)

runTest(
	"Use MCP tool with showMcpUse=true",
	"<use_mcp_tool><server_name>test</server_name><tool_name>echo</tool_name></use_mcp_tool>",
	"<use_mcp_tool><server_name>test</server_name><tool_name>echo</tool_name></use_mcp_tool>",
	{ showMcpUse: true },
)

runTest(
	"Mixed content with use_mcp_tool",
	"Starting work<use_mcp_tool><server_name>test</server_name></use_mcp_tool>finishing up",
	"Starting workfinishing up",
)

runTest(
	"Multiple use_mcp_tool tags",
	"<use_mcp_tool><server_name>server1</server_name></use_mcp_tool>between<use_mcp_tool><server_name>server2</server_name></use_mcp_tool>",
	"between",
)

runTest(
	"Nested use_mcp_tool with thinking",
	"<use_mcp_tool><arguments><thinking>planning call</thinking>data</arguments></use_mcp_tool>",
	"",
)

// Test 5: Complex Nested Scenarios
console.log("=== 5. Complex Nested Scenarios ===\n")

runTest(
	"Mixed content with multiple tag types",
	"before<attempt_completion><result>data</result></attempt_completion>middle<thinking>thoughts</thinking><use_mcp_tool><server_name>test</server_name></use_mcp_tool>after",
	"beforemiddleafter",
)

runTest(
	"Mixed content with showCompletion=true",
	"before<attempt_completion><result>data</result></attempt_completion>middle<thinking>thoughts</thinking><use_mcp_tool><server_name>test</server_name></use_mcp_tool>after",
	"before<attempt_completion><result>data</result></attempt_completion>middleafter",
	{ showCompletion: true },
)

runTest(
	"Mixed content with showThinking=true",
	"before<attempt_completion><result>data</result></attempt_completion>middle<thinking>thoughts</thinking><use_mcp_tool><server_name>test</server_name></use_mcp_tool>after",
	"beforemiddle<thinking>thoughts</thinking>after",
	{ showThinking: true },
)

runTest(
	"Mixed content with showMcpUse=true",
	"before<attempt_completion><result>data</result></attempt_completion>middle<thinking>thoughts</thinking><use_mcp_tool><server_name>test</server_name></use_mcp_tool>after",
	"beforemiddle<use_mcp_tool><server_name>test</server_name></use_mcp_tool>after",
	{ showMcpUse: true },
)

runTest(
	"Mixed content with all flags=true",
	"before<attempt_completion><result>data</result></attempt_completion>middle<thinking>thoughts</thinking><use_mcp_tool><server_name>test</server_name></use_mcp_tool>after",
	"before<attempt_completion><result>data</result></attempt_completion>middle<thinking>thoughts</thinking><use_mcp_tool><server_name>test</server_name></use_mcp_tool>after",
	{ showCompletion: true, showThinking: true, showMcpUse: true },
)

// Test 6: Edge Cases
console.log("=== 6. Edge Cases ===\n")

runTest(
	"Self-closing tags inside outer tag",
	"<outer><self-close/>content</outer>",
	"<outer><self-close/>content</outer>",
)

runTest(
	"Tags with attributes nested",
	'<outer attr="value"><inner id="test">content</inner></outer>',
	'<outer attr="value"><inner id="test">content</inner></outer>',
)

runTest("Malformed nested tags", "<outer><inner>content</outer></inner>", "<outer><inner>content</outer></inner>")

runTest("Empty nested tags", "<outer><empty></empty>content</outer>", "<outer><empty></empty>content</outer>")

runTest("No XML tags", "Just regular text with no tags", "Just regular text with no tags")

// Test 7: Section Tracking
console.log("=== 7. Section Tracking Tests ===\n")

const sectionFilter = new ClientContentFilter({ showThinking: false })
const sectionResult = sectionFilter.processText("<thinking>I need to analyze this</thinking>result")
const sections = sectionFilter.getParsedSections()

totalTests++
console.log(`Test ${totalTests}: Section tracking for thinking tag`)
console.log(`Input:    "<thinking>I need to analyze this</thinking>result"`)
console.log(`Expected: 1 section found`)
console.log(`Actual:   ${sections.length} sections found`)

const sectionPass =
	sections.length === 1 && sections[0].tagName === "thinking" && sections[0].content === "I need to analyze this"
console.log(`✅ Pass:   ${sectionPass ? "YES" : "NO"}`)

if (sectionPass) {
	passedTests++
	console.log(`  - Section: ${sections[0].tagName} = "${sections[0].content}"`)
} else {
	console.log(`❌ FAILED: Expected 1 thinking section but got ${sections.length} sections`)
	if (sections.length > 0) {
		console.log(`  - Found: ${sections[0].tagName} = "${sections[0].content}"`)
	}
}

console.log("")

// Test 8: Realistic Processing Tests
console.log("=== 8. Realistic Processing Tests ===\n")

// Test realistic scenario: complete XML tags in separate processing calls
const realisticFilter = new ClientContentFilter({ showThinking: false })
const realisticChunks = [
	"Starting work",
	"<thinking>analyzing problem</thinking>",
	"continuing with solution",
	"<thinking>final review</thinking>",
	"completed successfully",
]

let realisticResult = ""
realisticChunks.forEach((chunk) => {
	realisticResult += realisticFilter.processText(chunk)
})

totalTests++
console.log(`Test ${totalTests}: Realistic chunk processing`)
console.log(`Input:    ${JSON.stringify(realisticChunks)}`)
console.log(`Expected: "Starting workcontinuing with solutioncompleted successfully"`)
console.log(`Actual:   "${realisticResult}"`)

const realisticPass = realisticResult === "Starting workcontinuing with solutioncompleted successfully"
console.log(`✅ Pass:   ${realisticPass ? "YES" : "NO"}`)

if (realisticPass) {
	passedTests++
} else {
	console.log(`❌ FAILED: Realistic chunk processing test failed`)
}

console.log("")

// Final Results
console.log("🎉 Test Results Summary")
console.log("======================")
console.log(`Total Tests: ${totalTests}`)
console.log(`Passed: ${passedTests}`)
console.log(`Failed: ${totalTests - passedTests}`)
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`)

if (passedTests === totalTests) {
	console.log("✅ All tests passed!")
} else {
	console.log("❌ Some tests failed.")
	process.exit(1)
}
