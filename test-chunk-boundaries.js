#!/usr/bin/env node

// Test script to verify XML tag filtering works across chunk boundaries
const { ClientContentFilter } = require("./api-client.js")

console.log("🧪 Testing ClientContentFilter Chunk Boundary Handling\n")

// Test 1: Opening tag split across chunks
console.log("Test 1: Opening tag split across chunks")
const filter1 = new ClientContentFilter({ showThinking: false })
const result1a = filter1.processText("<thin")
const result1b = filter1.processText("king>content</thinking>")
const combinedResult1 = result1a + result1b
console.log(`Chunk 1:  "<thin"`)
console.log(`Chunk 2:  "king>content</thinking>"`)
console.log(`Expected: ""`)
console.log(`Actual:   "${combinedResult1}"`)
console.log(`✅ Pass:   ${combinedResult1 === "" ? "YES" : "NO"}\n`)

// Test 2: Closing tag split across chunks
console.log("Test 2: Closing tag split across chunks")
const filter2 = new ClientContentFilter({ showThinking: false })
const result2a = filter2.processText("<thinking>content</thin")
const result2b = filter2.processText("king>")
const combinedResult2 = result2a + result2b
console.log(`Chunk 1:  "<thinking>content</thin"`)
console.log(`Chunk 2:  "king>"`)
console.log(`Expected: ""`)
console.log(`Actual:   "${combinedResult2}"`)
console.log(`✅ Pass:   ${combinedResult2 === "" ? "YES" : "NO"}\n`)

// Test 3: Content split across chunks
console.log("Test 3: Content split across chunks")
const filter3 = new ClientContentFilter({ showThinking: false })
const result3a = filter3.processText("<thinking>part1")
const result3b = filter3.processText("part2</thinking>")
const combinedResult3 = result3a + result3b
console.log(`Chunk 1:  "<thinking>part1"`)
console.log(`Chunk 2:  "part2</thinking>"`)
console.log(`Expected: ""`)
console.log(`Actual:   "${combinedResult3}"`)
console.log(`✅ Pass:   ${combinedResult3 === "" ? "YES" : "NO"}\n`)

// Test 4: Tag name split across chunks
console.log("Test 4: Tag name split across chunks")
const filter4 = new ClientContentFilter({ showThinking: false })
const result4a = filter4.processText("<")
const result4b = filter4.processText("thinking>content</thinking>")
const combinedResult4 = result4a + result4b
console.log(`Chunk 1:  "<"`)
console.log(`Chunk 2:  "thinking>content</thinking>"`)
console.log(`Expected: ""`)
console.log(`Actual:   "${combinedResult4}"`)
console.log(`✅ Pass:   ${combinedResult4 === "" ? "YES" : "NO"}\n`)

// Test 5: Mixed content with split tag
console.log("Test 5: Mixed content with split tag")
const filter5 = new ClientContentFilter({ showThinking: false })
const result5a = filter5.processText("before<thin")
const result5b = filter5.processText("king>hidden</thin")
const result5c = filter5.processText("king>after")
const combinedResult5 = result5a + result5b + result5c
console.log(`Chunk 1:  "before<thin"`)
console.log(`Chunk 2:  "king>hidden</thin"`)
console.log(`Chunk 3:  "king>after"`)
console.log(`Expected: "beforeafter"`)
console.log(`Actual:   "${combinedResult5}"`)
console.log(`✅ Pass:   ${combinedResult5 === "beforeafter" ? "YES" : "NO"}\n`)

// Test 6: Show thinking with chunk boundaries
console.log("Test 6: Show thinking with chunk boundaries")
const filter6 = new ClientContentFilter({ showThinking: true })
const result6a = filter6.processText("before<thin")
const result6b = filter6.processText("king>visible</thin")
const result6c = filter6.processText("king>after")
const combinedResult6 = result6a + result6b + result6c
console.log(`Chunk 1:  "before<thin"`)
console.log(`Chunk 2:  "king>visible</thin"`)
console.log(`Chunk 3:  "king>after"`)
console.log(`Expected: "before<thinking>visible</thinking>after"`)
console.log(`Actual:   "${combinedResult6}"`)
console.log(`✅ Pass:   ${combinedResult6 === "before<thinking>visible</thinking>after" ? "YES" : "NO"}\n`)

// Test 7: Parser state management
console.log("Test 7: Parser state management")
const filter7 = new ClientContentFilter({ showThinking: false })
console.log(`Initial state: ${filter7.getParserState()}`)

filter7.processText("<thin")
console.log(`After "<thin": ${filter7.getParserState()}`)

filter7.processText("king>content</thinking>")
console.log(`After completion: ${filter7.getParserState()}`)

const stateCorrect = filter7.getParserState() === "NORMAL"
console.log(`✅ State Reset: ${stateCorrect ? "YES" : "NO"}\n`)

console.log("🎉 Chunk Boundary Tests Complete!")
