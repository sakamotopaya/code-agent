#!/usr/bin/env node

/**
 * Debug script to check stream termination behavior
 * Focus on completion and stream_end events only
 */

const http = require("http")

console.log("🔍 Debug: Stream Termination")
console.log("=============================")

const testConfig = {
	host: "localhost",
	port: 3000,
	task: "say hello", // Simple task that should complete quickly
}

let eventCounts = {
	start: 0,
	progress: 0,
	log: 0,
	completion: 0,
	stream_end: 0,
	error: 0,
}

let startTime = Date.now()
let slidingTimeoutId = null
let lastActivityTime = null

// Sliding timeout function - resets every time there's activity
function resetSlidingTimeout(res, reject) {
	// Clear existing timeout
	if (slidingTimeoutId) {
		clearTimeout(slidingTimeoutId)
	}

	// Update last activity time
	lastActivityTime = Date.now()

	// Set new timeout for 30 seconds from now
	slidingTimeoutId = setTimeout(() => {
		const inactiveTime = ((Date.now() - lastActivityTime) / 1000).toFixed(1)
		console.log("")
		console.log(
			`⏰ 30 second inactivity timeout reached (${inactiveTime}s since last activity) - forcibly ending stream`,
		)
		res.destroy()
		reject(new Error("Stream inactivity timeout"))
	}, 30000) // 30 seconds
}

function debugStreamTermination() {
	return new Promise((resolve, reject) => {
		const payload = JSON.stringify({
			task: testConfig.task,
			mode: "code",
			verbose: false,
		})

		console.log(`📡 Starting simple task: "${testConfig.task}"`)
		console.log(`⏰ Start time: ${new Date().toLocaleTimeString()}`)
		console.log("")

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

				// Initialize sliding timeout
				resetSlidingTimeout(res, reject)

				let buffer = ""

				res.on("data", (chunk) => {
					// Reset sliding timeout on any data activity
					resetSlidingTimeout(res, reject)
					buffer += chunk.toString()

					const lines = buffer.split("\n")
					buffer = lines.pop() || ""

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							try {
								const data = JSON.parse(line.slice(6))
								const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

								eventCounts[data.type] = (eventCounts[data.type] || 0) + 1

								console.log(
									`[${elapsed}s] 📨 ${data.type} (#${eventCounts[data.type]}) - "${data.message?.substring(0, 50) || "no message"}${data.message?.length > 50 ? "..." : ""}"`,
								)

								// Log critical events in detail
								if (data.type === "completion") {
									console.log(`   ⭐ COMPLETION EVENT #${eventCounts.completion}`)
									console.log(`   📄 Message: "${data.message}"`)
								}

								if (data.type === "stream_end") {
									console.log(`   🎯 STREAM_END EVENT #${eventCounts.stream_end}`)
									console.log(`   📄 Message: "${data.message}"`)
									console.log(`   ⏱️  Should close stream in ~0ms`)
								}
							} catch (e) {
								console.log(`❌ Parse error: ${e.message}`)
							}
						}
					}
				})

				res.on("end", () => {
					// Clear sliding timeout when stream ends normally
					if (slidingTimeoutId) {
						clearTimeout(slidingTimeoutId)
						slidingTimeoutId = null
					}

					const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
					console.log("")
					console.log("🏁 Stream Ended")
					console.log("================")
					console.log(`⏱️  Total time: ${totalTime}s`)
					console.log(`📊 Event counts:`)
					Object.entries(eventCounts).forEach(([type, count]) => {
						if (count > 0) {
							console.log(`   ${type}: ${count}`)
						}
					})
					console.log("")

					// Analysis
					if (eventCounts.completion > 1) {
						console.log("❌ PROBLEM: Multiple completion events detected!")
					} else if (eventCounts.completion === 1) {
						console.log("✅ Good: Single completion event")
					} else {
						console.log("❌ PROBLEM: No completion event received!")
					}

					if (eventCounts.stream_end > 1) {
						console.log("❌ PROBLEM: Multiple stream_end events detected!")
					} else if (eventCounts.stream_end === 1) {
						console.log("✅ Good: Single stream_end event")
					} else {
						console.log("❌ PROBLEM: No stream_end event received!")
					}

					resolve({ eventCounts, totalTime })
				})

				res.on("error", (error) => {
					// Clear sliding timeout on error
					if (slidingTimeoutId) {
						clearTimeout(slidingTimeoutId)
						slidingTimeoutId = null
					}
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

// Run the debug test
debugStreamTermination()
	.then((result) => {
		console.log("✅ Debug test completed")
		process.exit(0)
	})
	.catch((error) => {
		console.error("💥 Debug test failed:", error.message)
		process.exit(1)
	})
