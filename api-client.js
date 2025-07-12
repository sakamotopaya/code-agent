#!/usr/bin/env node

/**
 * Backward compatibility wrapper for the TypeScript API client
 * This script automatically uses the built TypeScript version when available
 */

const path = require("path")
const { spawn } = require("child_process")
const fs = require("fs")

// Check if built version exists
const builtClient = path.join(__dirname, "src", "dist", "tools", "api-client.js")

function checkBuiltVersion() {
	try {
		return fs.existsSync(builtClient) && fs.statSync(builtClient).isFile()
	} catch (error) {
		return false
	}
}

function showBuildInstructions() {
	console.error("❌ Built api-client not found.")
	console.error("")
	console.error("💡 To build the TypeScript version:")
	console.error("   cd src && npm run build")
	console.error("   # or for just the api-client:")
	console.error("   cd src && npm run build:api-client")
	console.error("")
	console.error("🔧 For development with auto-rebuild:")
	console.error("   cd src && npm run watch:api-client")
	console.error("")
}

function executeBuiltVersion() {
	// Execute built version with all arguments
	const child = spawn("node", [builtClient, ...process.argv.slice(2)], {
		stdio: "inherit",
		env: process.env,
	})

	// Handle process signals properly
	const signals = ["SIGINT", "SIGTERM", "SIGQUIT"]
	signals.forEach((signal) => {
		process.on(signal, () => {
			if (!child.killed) {
				child.kill(signal)
			}
		})
	})

	// Handle child process exit
	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal)
		} else {
			process.exit(code || 0)
		}
	})

	child.on("error", (error) => {
		console.error(`❌ Failed to execute api-client: ${error.message}`)
		process.exit(1)
	})
}

// Main execution
if (checkBuiltVersion()) {
	executeBuiltVersion()
} else {
	showBuildInstructions()
	process.exit(1)
}
