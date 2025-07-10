#!/usr/bin/env node

/**
 * Test script to validate both SSE fixes:
 * 1. No duplicate completion events
 * 2. Content displays correctly from log events
 */

const http = require("http")

console.log("🧪 Testing Both SSE Fixes")
console.log("==========================")

const testConfig = {
	host: "localhost",
	port: 3000,
	task: "write a simple release note for ticket 123456",
}

let events = []
let logEventCount = 0
let completionEventCount = 0
let streamEndEventCount = 0
let actualContentReceived = ""

function testBothFixes() {
	return new Promise((resolve, reject) => {
		const payload = JSON.stringify({
			task: testConfig.task,
			mode: "code",
			verbose: false,
		})

		const req = http.request(
			{
				hostname: testConfig.host,
				port: testConfig.port,
				path: "/execute/stream",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(payload),
					Accept: "text/event-stream",
					"Cache-Control": "no-cache",
				},
			},
			(res) => {
				console.log(`📡 Connected - Status: ${res.statusCode}`)

				let buffer = ""

				res.on("data", (chunk) => {
					buffer += chunk.toString()

					const lines = buffer.split("\n")
					buffer = lines.pop() || ""

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							try {
								const data = JSON.parse(line.slice(6))
								events.push(data)

								console.log(`📨 Event: ${data.type} (${new Date(data.timestamp).toLocaleTimeString()})`)

								// Count event types
								if (data.type === "log") {
									logEventCount++
									// Collect actual content from log events
									if (data.message && data.message.length > 10) {
										actualContentReceived += data.message
									}
									console.log(
										`   📝 Log content: "${data.message?.substring(0, 50)}${data.message?.length > 50 ? "..." : ""}"`,
									)
								}

								if (data.type === "completion") {
									completionEventCount++
									console.log(`   ✅ Completion: "${data.message}"`)
								}

								if (data.type === "stream_end") {
									streamEndEventCount++
									console.log(`   🔚 Stream end: "${data.message}"`)
								}
							} catch (e) {
								// Ignore parse errors
							}
						}
					}
				})

				res.on("end", () => {
					console.log("")
					console.log("📊 Test Results:")
					console.log("================")
					console.log(`📈 Total events: ${events.length}`)
					console.log(`📝 Log events: ${logEventCount}`)
					console.log(`✅ Completion events: ${completionEventCount}`)
					console.log(`🔚 Stream end events: ${streamEndEventCount}`)
					console.log(`📄 Content received: ${actualContentReceived.length} chars`)
					console.log("")

					// Check Fix 1: No duplicate completions
					if (completionEventCount === 1) {
						console.log("✅ Fix 1 SUCCESS: Only one completion event (no duplicates)")
					} else {
						console.log(`❌ Fix 1 FAILED: Expected 1 completion event, got ${completionEventCount}`)
					}

					// Check Fix 1: No duplicate stream_end
					if (streamEndEventCount === 1) {
						console.log("✅ Fix 1 SUCCESS: Only one stream_end event (no duplicates)")
					} else {
						console.log(`❌ Fix 1 FAILED: Expected 1 stream_end event, got ${streamEndEventCount}`)
					}

					// Check Fix 2: Content received from log events
					if (actualContentReceived.length > 50) {
						console.log("✅ Fix 2 SUCCESS: Content received from log events")
						console.log(`📄 Content preview: "${actualContentReceived.substring(0, 100)}..."`)
					} else {
						console.log("❌ Fix 2 FAILED: No meaningful content received from log events")
					}

					const success =
						completionEventCount === 1 && streamEndEventCount === 1 && actualContentReceived.length > 50

					if (success) {
						console.log("")
						console.log("🎉 ALL FIXES SUCCESSFUL!")
						console.log("✅ No duplicate completion events")
						console.log("✅ No duplicate stream_end events")
						console.log("✅ Content displays correctly from log events")
					} else {
						console.log("")
						console.log("❌ SOME FIXES FAILED - see details above")
					}

					resolve({
						success,
						events,
						logEventCount,
						completionEventCount,
						streamEndEventCount,
						actualContentReceived,
					})
				})

				res.on("error", (error) => {
					console.log(`❌ Stream error: ${error.message}`)
					reject(error)
				})
			},
		)

		req.on("error", (error) => {
			console.log(`❌ Request failed: ${error.message}`)
			console.log("💡 Make sure the API server is running: ./run-api.sh")
			reject(error)
		})

		req.write(payload)
		req.end()
	})
}

// Run the test
testBothFixes()
	.then((result) => {
		process.exit(result.success ? 0 : 1)
	})
	.catch((error) => {
		console.error("💥 Test failed:", error.message)
		process.exit(1)
	})
