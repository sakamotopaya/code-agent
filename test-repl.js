#!/usr/bin/env node

/**
 * Test script for REPL functionality
 * This script simulates user input to test REPL commands
 */

const { spawn } = require("child_process")
const readline = require("readline")

async function testREPLCommands() {
	console.log("🧪 Testing REPL functionality...\n")

	// Test 1: Basic REPL startup
	console.log("Test 1: REPL startup and help command")

	const child = spawn("node", ["api-client.js", "--repl"], {
		stdio: ["pipe", "pipe", "pipe"],
		cwd: process.cwd(),
	})

	let output = ""
	let startupComplete = false

	child.stdout.on("data", (data) => {
		const text = data.toString()
		output += text
		console.log(text)

		// Check if REPL has started
		if (text.includes("roo-api [new] >") && !startupComplete) {
			startupComplete = true
			console.log("\n✅ REPL started successfully")

			// Send help command
			setTimeout(() => {
				console.log('\nSending "help" command...')
				child.stdin.write("help\n")

				// Wait for help output, then send exit
				setTimeout(() => {
					console.log('\nSending "exit" command...')
					child.stdin.write("exit\n")
				}, 1000)
			}, 500)
		}
	})

	child.stderr.on("data", (data) => {
		console.error("STDERR:", data.toString())
	})

	return new Promise((resolve, reject) => {
		child.on("close", (code) => {
			console.log(`\n🏁 REPL process exited with code ${code}`)

			// Validate output
			const hasStartupMessage = output.includes("🚀 Roo API Client REPL Mode")
			const hasPrompt = output.includes("roo-api [new] >")
			const hasHelpOutput = output.includes("REPL Commands:")
			const hasExitMessage = output.includes("👋 Goodbye!")

			console.log("\n📊 Test Results:")
			console.log(`  Startup message: ${hasStartupMessage ? "✅" : "❌"}`)
			console.log(`  Prompt display: ${hasPrompt ? "✅" : "❌"}`)
			console.log(`  Help command: ${hasHelpOutput ? "✅" : "❌"}`)
			console.log(`  Exit command: ${hasExitMessage ? "✅" : "❌"}`)

			if (hasStartupMessage && hasPrompt && hasHelpOutput && hasExitMessage) {
				console.log("\n🎉 All REPL tests passed!")
				resolve(true)
			} else {
				console.log("\n❌ Some REPL tests failed")
				resolve(false)
			}
		})

		child.on("error", (error) => {
			console.error("❌ Error starting REPL:", error)
			reject(error)
		})

		// Timeout after 10 seconds
		setTimeout(() => {
			console.log("\n⏰ Test timeout - killing process")
			child.kill()
			resolve(false)
		}, 10000)
	})
}

// Test 2: Validate that single command mode still works
async function testSingleCommandMode() {
	console.log("\n\nTest 2: Single command mode compatibility")

	return new Promise((resolve, reject) => {
		const child = spawn("node", ["api-client.js", "--verbose", "test basic functionality"], {
			stdio: ["pipe", "pipe", "pipe"],
			cwd: process.cwd(),
		})

		let output = ""

		child.stdout.on("data", (data) => {
			output += data.toString()
		})

		child.stderr.on("data", (data) => {
			output += data.toString()
		})

		child.on("close", (code) => {
			console.log(`Single command mode exited with code ${code}`)

			// Check if it attempted to connect to API (shows integration is working)
			const attemptedConnection =
				output.includes("Testing Roo Code Agent API") ||
				output.includes("GET /health") ||
				output.includes("POST /execute")

			console.log(`  API connection attempt: ${attemptedConnection ? "✅" : "❌"}`)

			resolve(attemptedConnection)
		})

		child.on("error", (error) => {
			console.error("❌ Error in single command mode:", error)
			reject(error)
		})

		// Timeout after 10 seconds
		setTimeout(() => {
			console.log("⏰ Single command test timeout - killing process")
			child.kill()
			resolve(false)
		}, 10000)
	})
}

// Run tests
async function main() {
	try {
		const replTestResult = await testREPLCommands()
		const singleCommandResult = await testSingleCommandMode()

		console.log("\n📋 Final Results:")
		console.log(`  REPL Mode: ${replTestResult ? "✅ PASS" : "❌ FAIL"}`)
		console.log(`  Single Command Mode: ${singleCommandResult ? "✅ PASS" : "❌ FAIL"}`)

		if (replTestResult && singleCommandResult) {
			console.log("\n🎉 All tests passed! REPL implementation is working correctly.")
			process.exit(0)
		} else {
			console.log("\n❌ Some tests failed. Please check the implementation.")
			process.exit(1)
		}
	} catch (error) {
		console.error("❌ Test execution failed:", error)
		process.exit(1)
	}
}

main()
