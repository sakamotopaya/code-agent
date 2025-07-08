#!/usr/bin/env node

/**
 * Test script to verify mode parameter logging
 * This will test both built-in and custom modes to see the logging output
 */

const http = require("http")

const host = "localhost"
const port = 3000

async function testModeLogging(mode, description) {
	console.log(`\n🧪 Testing ${description} (mode: ${mode})`)
	console.log("=".repeat(60))

	const task = "what is your current mode"

	const payload = JSON.stringify({
		task,
		mode,
		verbose: true,
	})

	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				hostname: host,
				port: port,
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
				console.log(`📡 Response status: ${res.statusCode}`)

				let buffer = ""
				let eventCount = 0

				res.on("data", (chunk) => {
					buffer += chunk.toString()

					// Process complete SSE messages
					const lines = buffer.split("\n")
					buffer = lines.pop() || ""

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							try {
								const data = JSON.parse(line.slice(6))
								eventCount++

								console.log(`📨 Event ${eventCount}: ${data.type}`)
								if (data.message) {
									console.log(
										`   Message: ${data.message.substring(0, 100)}${data.message.length > 100 ? "..." : ""}`,
									)
								}
								if (data.error) {
									console.log(`   Error: ${data.error}`)
								}

								// Complete on completion or error
								if (data.type === "complete" || data.type === "completion" || data.type === "error") {
									console.log(`✅ Test completed with ${eventCount} events`)
									res.destroy()
									resolve({ success: data.type !== "error", events: eventCount })
									return
								}
							} catch (error) {
								console.log(`❌ Failed to parse SSE data: ${error.message}`)
							}
						}
					}
				})

				res.on("end", () => {
					console.log(`🔚 Stream ended with ${eventCount} events`)
					resolve({ success: true, events: eventCount })
				})

				res.on("error", (error) => {
					console.log(`❌ Stream error: ${error.message}`)
					reject(error)
				})

				// Timeout after 30 seconds
				setTimeout(() => {
					console.log(`⏰ Test timed out after 30 seconds`)
					res.destroy()
					resolve({ success: false, events: eventCount, timeout: true })
				}, 30000)
			},
		)

		req.on("error", (error) => {
			console.log(`❌ Request error: ${error.message}`)
			reject(error)
		})

		req.write(payload)
		req.end()
	})
}

async function runTests() {
	console.log("🚀 Starting Mode Parameter Logging Tests")
	console.log(`📍 Testing API at http://${host}:${port}`)

	const tests = [
		{ mode: "code", description: "Built-in Code Mode" },
		{ mode: "debug", description: "Built-in Debug Mode" },
		{ mode: "architect", description: "Built-in Architect Mode" },
		{ mode: "ticket-oracle", description: "Custom Ticket Oracle Mode" },
		{ mode: "product-owner", description: "Custom Product Owner Mode" },
		{ mode: "invalid-mode", description: "Invalid Mode (should fail gracefully)" },
	]

	const results = []

	for (const test of tests) {
		try {
			const result = await testModeLogging(test.mode, test.description)
			results.push({ ...test, ...result })
		} catch (error) {
			console.log(`❌ Test failed: ${error.message}`)
			results.push({ ...test, success: false, error: error.message })
		}

		// Wait 2 seconds between tests
		await new Promise((resolve) => setTimeout(resolve, 2000))
	}

	// Summary
	console.log("\n📊 Test Results Summary")
	console.log("=".repeat(60))

	results.forEach((result) => {
		const status = result.success ? "✅ PASS" : "❌ FAIL"
		const details = result.timeout ? " (TIMEOUT)" : result.error ? ` (${result.error})` : ""
		console.log(`${status} ${result.description} - ${result.events || 0} events${details}`)
	})

	const passCount = results.filter((r) => r.success).length
	const totalCount = results.length

	console.log(`\n🎯 Overall: ${passCount}/${totalCount} tests passed`)

	if (passCount < totalCount) {
		console.log("\n💡 Check the server logs for detailed debugging information")
		console.log("   Look for [FastifyServer] and [Task] log entries")
	}
}

// Run the tests
runTests().catch((error) => {
	console.error("❌ Test runner failed:", error)
	process.exit(1)
})
