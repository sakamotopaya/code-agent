#!/usr/bin/env node

/**
 * Simple test script to validate SSE stream closing fix
 * Usage: node test-sse-fix.js
 */

const http = require("http")

console.log("🧪 Testing SSE Stream Closing Fix")
console.log("=================================")

const testConfig = {
	host: "localhost",
	port: 3000,
	task: "Hello, this is a test task for SSE stream closing",
}

console.log(`🎯 Testing against: ${testConfig.host}:${testConfig.port}`)
console.log(`📝 Task: "${testConfig.task}"`)
console.log("")

let eventCount = 0
let completionReceived = false
let streamEndReceived = false
let streamClosed = false

function testStreamingEndpoint() {
	return new Promise((resolve, reject) => {
		const payload = JSON.stringify({
			task: testConfig.task,
			mode: "code",
			verbose: false,
		})

		const startTime = Date.now()

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
								eventCount++

								console.log(
									`📨 Event ${eventCount}: ${data.type} (${new Date(data.timestamp).toLocaleTimeString()})`,
								)

								if (data.type === "completion") {
									completionReceived = true
									console.log(
										`   ✅ Completion received: "${data.message?.substring(0, 50)}${data.message?.length > 50 ? "..." : ""}"`,
									)
								}

								if (data.type === "stream_end") {
									streamEndReceived = true
									console.log(`   🔚 Stream end received: "${data.message}"`)
									// Don't close immediately - wait for server
								}

								if (data.type === "error") {
									console.log(`   ❌ Error received: ${data.error}`)
								}
							} catch (e) {
								console.log(`   📄 Raw line: ${line}`)
							}
						}
					}
				})

				res.on("end", () => {
					streamClosed = true
					const duration = Date.now() - startTime
					console.log("")
					console.log("📊 Test Results:")
					console.log("================")
					console.log(`📈 Total events received: ${eventCount}`)
					console.log(`✅ Completion received: ${completionReceived}`)
					console.log(`🔚 Stream end received: ${streamEndReceived}`)
					console.log(`⏱️  Total duration: ${duration}ms`)
					console.log("")

					if (completionReceived && streamEndReceived) {
						console.log("🎉 SUCCESS: Both completion and stream_end events received!")
						console.log("✅ SSE stream closing fix is working correctly")
					} else {
						console.log("❌ FAILURE: Missing expected events")
						if (!completionReceived) console.log("   - Missing completion event")
						if (!streamEndReceived) console.log("   - Missing stream_end event")
					}

					resolve({
						success: completionReceived && streamEndReceived,
						eventCount,
						completionReceived,
						streamEndReceived,
						duration,
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
testStreamingEndpoint()
	.then((result) => {
		process.exit(result.success ? 0 : 1)
	})
	.catch((error) => {
		console.error("💥 Test failed:", error.message)
		process.exit(1)
	})
