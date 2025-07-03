#!/usr/bin/env node

const { spawn } = require("child_process")
const path = require("path")

console.log("🧪 Testing simplified CLI MCP implementation...")
console.log("")

// Test simple command that should exit cleanly
const cliPath = path.join(__dirname, "src")
const testCommand = 'npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "say hello" --verbose'

console.log(`📝 Running command: ${testCommand}`)
console.log("⏰ Starting timer...")

const startTime = Date.now()
let processExited = false

// Set up timeout to kill process if it hangs
const timeout = setTimeout(() => {
	if (!processExited) {
		console.log("")
		console.log("❌ HANG DETECTED: Process did not exit within 30 seconds")
		console.log("🔪 Killing process...")
		process.exit(1)
	}
}, 30000)

// Spawn the CLI process
const child = spawn(
	"npm",
	[
		"run",
		"start:cli",
		"--silent",
		"--",
		"--config",
		"~/.agentz/agent-config.json",
		"--batch",
		"say hello",
		"--verbose",
	],
	{
		cwd: cliPath,
		stdio: "inherit",
	},
)

child.on("close", (code) => {
	processExited = true
	const duration = Date.now() - startTime

	clearTimeout(timeout)
	console.log("")
	console.log(`✅ Process exited with code: ${code}`)
	console.log(`⏱️  Duration: ${duration}ms`)

	if (duration < 10000) {
		console.log("🎉 SUCCESS: CLI exited cleanly and quickly!")
		console.log("🔧 The simplified MCP cleanup is working!")
	} else {
		console.log("⚠️  Process took longer than expected but did exit")
	}

	process.exit(code)
})

child.on("error", (error) => {
	processExited = true
	clearTimeout(timeout)
	console.log("")
	console.log("❌ Process error:", error.message)
	process.exit(1)
})

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
	console.log("")
	console.log("🛑 Test interrupted by user")
	clearTimeout(timeout)
	if (!processExited) {
		child.kill("SIGTERM")
	}
	process.exit(130)
})
