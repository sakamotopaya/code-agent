#!/usr/bin/env node

/**
 * Test script for question blocking functionality
 * This script tests that the API client properly pauses stream processing
 * when questions are asked and resumes after answers are submitted.
 */

const { spawn } = require("child_process")
const path = require("path")

console.log("🧪 Testing Question Blocking Functionality\n")

// Test configuration
const testConfig = {
	host: "localhost",
	port: 3000,
	mode: "ask", // Use ask mode which is more likely to generate questions
	task: "Ask me a question with choices, then continue with your response",
	verbose: true,
	stream: true,
}

function runApiClient(task, options = {}) {
	return new Promise((resolve, reject) => {
		const args = [
			"api-client.js",
			"--stream",
			"--verbose",
			"--mode",
			testConfig.mode,
			"--host",
			testConfig.host,
			"--port",
			testConfig.port.toString(),
			task,
		]

		if (options.showThinking) args.push("--show-thinking")
		if (options.showTools) args.push("--show-tools")
		if (options.showResponse) args.push("--show-response")

		console.log(`🚀 Running: node ${args.join(" ")}\n`)

		const child = spawn("node", args, {
			stdio: ["pipe", "pipe", "pipe"],
			cwd: __dirname,
		})

		let stdout = ""
		let stderr = ""
		let questionDetected = false
		let streamPausedDetected = false
		let streamResumedDetected = false

		child.stdout.on("data", (data) => {
			const output = data.toString()
			stdout += output

			// Check for question detection
			if (output.includes("❓ QUESTION") || output.includes("Question:")) {
				questionDetected = true
				console.log("✅ Question detected in output")
			}

			// Check for stream pausing
			if (output.includes("⏸️  Stream paused")) {
				streamPausedDetected = true
				console.log("✅ Stream pausing detected")
			}

			// Check for stream resuming
			if (output.includes("▶️  Stream resumed")) {
				streamResumedDetected = true
				console.log("✅ Stream resuming detected")
			}

			// Check for question logging
			if (output.includes("[QUESTION-LOG]")) {
				console.log("✅ Question logging detected")
			}

			// Auto-answer questions for testing
			if (output.includes("Your answer:") || output.includes("Enter your choice")) {
				setTimeout(() => {
					child.stdin.write("Yes\n")
				}, 100)
			}

			process.stdout.write(output)
		})

		child.stderr.on("data", (data) => {
			stderr += data.toString()
			process.stderr.write(data)
		})

		child.on("close", (code) => {
			const result = {
				code,
				stdout,
				stderr,
				questionDetected,
				streamPausedDetected,
				streamResumedDetected,
			}

			if (code === 0) {
				resolve(result)
			} else {
				reject(new Error(`Process exited with code ${code}\nStderr: ${stderr}`))
			}
		})

		child.on("error", reject)

		// Auto-close after 30 seconds to prevent hanging
		setTimeout(() => {
			console.log("\n⏰ Test timeout - killing process")
			child.kill("SIGTERM")
		}, 30000)
	})
}

async function runTests() {
	console.log("📋 Test Plan:")
	console.log("1. Test basic question asking functionality")
	console.log("2. Verify stream pausing behavior")
	console.log("3. Verify stream resuming behavior")
	console.log("4. Check question logging")
	console.log("")

	try {
		console.log("🏃 Running Test: Question Blocking Functionality\n")

		const result = await runApiClient(testConfig.task, {
			showThinking: true,
			showTools: true,
			showResponse: true,
		})

		console.log("\n📊 Test Results:")
		console.log(`Exit Code: ${result.code}`)
		console.log(`Question Detected: ${result.questionDetected ? "✅" : "❌"}`)
		console.log(`Stream Paused: ${result.streamPausedDetected ? "✅" : "❌"}`)
		console.log(`Stream Resumed: ${result.streamResumedDetected ? "✅" : "❌"}`)

		const passed = result.code === 0 && result.questionDetected

		if (passed) {
			console.log("\n🎉 Test PASSED - Question blocking functionality is working!")
		} else {
			console.log("\n❌ Test FAILED - Issues detected with question blocking")
		}

		return passed
	} catch (error) {
		console.error("\n❌ Test FAILED with error:", error.message)
		return false
	}
}

// Check if API server is running
async function checkServerHealth() {
	const http = require("http")

	return new Promise((resolve) => {
		const req = http.request(
			{
				hostname: testConfig.host,
				port: testConfig.port,
				path: "/health",
				method: "GET",
				timeout: 5000,
			},
			(res) => {
				resolve(res.statusCode === 200)
			},
		)

		req.on("error", () => resolve(false))
		req.on("timeout", () => {
			req.destroy()
			resolve(false)
		})

		req.end()
	})
}

async function main() {
	console.log("🔍 Checking if API server is running...")

	const serverRunning = await checkServerHealth()

	if (!serverRunning) {
		console.log(`❌ API server is not running on ${testConfig.host}:${testConfig.port}`)
		console.log("💡 Please start the server with: ./run-api.sh")
		process.exit(1)
	}

	console.log("✅ API server is running\n")

	const testPassed = await runTests()

	process.exit(testPassed ? 0 : 1)
}

if (require.main === module) {
	main().catch((error) => {
		console.error("Fatal error:", error)
		process.exit(1)
	})
}

module.exports = { runApiClient, checkServerHealth }
