#!/usr/bin/env node

// Simple test script to verify XML tag filtering works
const { ClientContentFilter } = require("./test-api.js")

console.log("🧪 Testing ClientContentFilter XML Tag Filtering\n")

// Test 1: Basic thinking tag filtering (showThinking=false)
console.log("Test 1: Basic thinking tag filtering (showThinking=false)")
const filter1 = new ClientContentFilter({ showThinking: false })
const input1 = "before<thinking>hidden content</thinking>after"
const result1 = filter1.processText(input1)
console.log(`Input:    "${input1}"`)
console.log(`Expected: "beforeafter"`)
console.log(`Actual:   "${result1}"`)
console.log(`✅ Pass:   ${result1 === "beforeafter" ? "YES" : "NO"}\n`)

// Test 2: Basic thinking tag preservation (showThinking=true)
console.log("Test 2: Basic thinking tag preservation (showThinking=true)")
const filter2 = new ClientContentFilter({ showThinking: true })
const input2 = "before<thinking>visible content</thinking>after"
const result2 = filter2.processText(input2)
console.log(`Input:    "${input2}"`)
console.log(`Expected: "${input2}"`)
console.log(`Actual:   "${result2}"`)
console.log(`✅ Pass:   ${result2 === input2 ? "YES" : "NO"}\n`)

// Test 3: Non-thinking tags (should pass through)
console.log("Test 3: Non-thinking tags (should pass through)")
const filter3 = new ClientContentFilter({ showThinking: false })
const input3 = "before<other>content</other>after"
const result3 = filter3.processText(input3)
console.log(`Input:    "${input3}"`)
console.log(`Expected: "${input3}"`)
console.log(`Actual:   "${result3}"`)
console.log(`✅ Pass:   ${result3 === input3 ? "YES" : "NO"}\n`)

// Test 4: Empty thinking section
console.log("Test 4: Empty thinking section")
const filter4 = new ClientContentFilter({ showThinking: false })
const input4 = "before<thinking></thinking>after"
const result4 = filter4.processText(input4)
console.log(`Input:    "${input4}"`)
console.log(`Expected: "beforeafter"`)
console.log(`Actual:   "${result4}"`)
console.log(`✅ Pass:   ${result4 === "beforeafter" ? "YES" : "NO"}\n`)

// Test 5: Multiple thinking sections
console.log("Test 5: Multiple thinking sections")
const filter5 = new ClientContentFilter({ showThinking: false })
const input5 = "<thinking>first</thinking>middle<thinking>second</thinking>"
const result5 = filter5.processText(input5)
console.log(`Input:    "${input5}"`)
console.log(`Expected: "middle"`)
console.log(`Actual:   "${result5}"`)
console.log(`✅ Pass:   ${result5 === "middle" ? "YES" : "NO"}\n`)

// Test 6: Integration with processData
console.log("Test 6: Integration with processData")
const filter6 = new ClientContentFilter({ showThinking: false })
const mockData = {
	type: "progress",
	message: "public<thinking>private</thinking>content",
	contentType: "content",
	timestamp: "2024-01-01T00:00:00Z",
}
const result6 = filter6.processData(mockData)
console.log(`Input message:    "${mockData.message}"`)
console.log(`Expected message: "publiccontent"`)
console.log(`Actual message:   "${result6.content.message}"`)
console.log(`✅ Pass:          ${result6.content.message === "publiccontent" ? "YES" : "NO"}\n`)

console.log("🎉 XML Tag Filtering Tests Complete!")
