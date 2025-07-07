#!/usr/bin/env node

/**
 * Test script to verify MessageBuffer bypass functionality
 * This script tests the API with and without MessageBuffer to isolate its impact
 */

const { spawn } = require("child_process")

async function testAPI(bypassMessageBuffer = false) {
	console.log(`\n${"=".repeat(80)}`)
	console.log(`🧪 Testing API with MessageBuffer ${bypassMessageBuffer ? "BYPASSED" : "ENABLED"}`)
	console.log(`${"=".repeat(80)}`)

	const env = { ...process.env }
	if (bypassMessageBuffer) {
		env.BYPASS_MESSAGE_BUFFER = "true"
		console.log(`🚫 Environment variable set: BYPASS_MESSAGE_BUFFER=true`)
	} else {
		delete env.BYPASS_MESSAGE_BUFFER
		console.log(`✅ Environment variable unset: MessageBuffer enabled`)
	}

	return new Promise((resolve, reject) => {
		const testProcess = spawn(
			"./test-api.js",
			["--stream", "--mode", "ticket-oracle", "list your mcp servers and available tools"],
			{
				env,
				stdio: "pipe",
			},
		)

		let output = ""
		let errorOutput = ""

		testProcess.stdout.on("data", (data) => {
			const chunk = data.toString()
			output += chunk
			process.stdout.write(chunk) // Show real-time output
		})

		testProcess.stderr.on("data", (data) => {
			const chunk = data.toString()
			errorOutput += chunk
			process.stderr.write(chunk) // Show real-time errors
		})

		testProcess.on("close", (code) => {
			console.log(`\n📊 Process exited with code: ${code}`)

			// Analyze the output for key indicators
			const hasToolExecution = output.includes("tool_use") || output.includes("MCP") || output.includes("servers")
			const hasCompletion = output.includes("Task completed") || output.includes("completion")
			const hasMessageBufferLogs = output.includes("MessageBuffer") || output.includes("🔄")
			const hasBypassLogs = output.includes("MessageBuffer bypassed") || output.includes("🚫")

			console.log(`\n📈 Analysis:`)
			console.log(`   Tool execution detected: ${hasToolExecution ? "✅" : "❌"}`)
			console.log(`   Task completion detected: ${hasCompletion ? "✅" : "❌"}`)
			console.log(`   MessageBuffer logs found: ${hasMessageBufferLogs ? "✅" : "❌"}`)
			console.log(`   Bypass logs found: ${hasBypassLogs ? "✅" : "❌"}`)

			resolve({
				code,
				output,
				errorOutput,
				hasToolExecution,
				hasCompletion,
				hasMessageBufferLogs,
				hasBypassLogs,
			})
		})

		testProcess.on("error", (error) => {
			console.error(`❌ Process error: ${error.message}`)
			reject(error)
		})

		// Kill process after 30 seconds to prevent hanging
		setTimeout(() => {
			if (!testProcess.killed) {
				console.log(`⏰ Killing process after 30 seconds timeout`)
				testProcess.kill("SIGTERM")
			}
		}, 30000)
	})
}

async function main() {
	console.log(`🚀 MessageBuffer Bypass Test`)
	console.log(`This script tests API behavior with and without MessageBuffer`)

	try {
		// Test 1: With MessageBuffer (current behavior)
		const withMessageBuffer = await testAPI(false)

		// Test 2: Without MessageBuffer (bypassed)
		const withoutMessageBuffer = await testAPI(true)

		// Compare results
		console.log(`\n${"=".repeat(80)}`)
		console.log(`📊 COMPARISON RESULTS`)
		console.log(`${"=".repeat(80)}`)

		console.log(`\n🔍 Tool Execution:`)
		console.log(`   With MessageBuffer:    ${withMessageBuffer.hasToolExecution ? "✅ SUCCESS" : "❌ FAILED"}`)
		console.log(`   Without MessageBuffer: ${withoutMessageBuffer.hasToolExecution ? "✅ SUCCESS" : "❌ FAILED"}`)

		console.log(`\n🏁 Task Completion:`)
		console.log(`   With MessageBuffer:    ${withMessageBuffer.hasCompletion ? "✅ SUCCESS" : "❌ FAILED"}`)
		console.log(`   Without MessageBuffer: ${withoutMessageBuffer.hasCompletion ? "✅ SUCCESS" : "❌ FAILED"}`)

		console.log(`\n🔧 Bypass Verification:`)
		console.log(
			`   MessageBuffer logs (with):    ${withMessageBuffer.hasMessageBufferLogs ? "✅ FOUND" : "❌ NOT FOUND"}`,
		)
		console.log(
			`   Bypass logs (without):        ${withoutMessageBuffer.hasBypassLogs ? "✅ FOUND" : "❌ NOT FOUND"}`,
		)

		// Determine if bypass fixed the issue
		const bypassFixedIssue = !withMessageBuffer.hasToolExecution && withoutMessageBuffer.hasToolExecution

		console.log(`\n🎯 CONCLUSION:`)
		if (bypassFixedIssue) {
			console.log(`   ✅ MessageBuffer bypass FIXED the tool execution issue!`)
			console.log(`   🔍 MessageBuffer was preventing tool execution`)
		} else if (withMessageBuffer.hasToolExecution && withoutMessageBuffer.hasToolExecution) {
			console.log(`   ℹ️  Both configurations work - MessageBuffer may not be the issue`)
		} else if (!withMessageBuffer.hasToolExecution && !withoutMessageBuffer.hasToolExecution) {
			console.log(`   ❌ Neither configuration works - issue may be elsewhere`)
		} else {
			console.log(`   ⚠️  Unexpected results - manual investigation needed`)
		}
	} catch (error) {
		console.error(`❌ Test failed: ${error.message}`)
		process.exit(1)
	}
}

// Run the test
main().catch(console.error)
