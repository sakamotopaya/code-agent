#!/usr/bin/env node

/**
 * Test script for task restart functionality
 * Tests both new task creation and task restart
 */

const { spawn } = require("child_process")

console.log("🧪 Testing Task Restart Functionality\n")

// Test 1: Start a new task (should return a task ID)
console.log("📝 Test 1: Starting a new task...")
const newTaskProcess = spawn(
	"node",
	["api-client.js", "--stream", "--verbose", "Create a simple hello world application"],
	{
		stdio: "pipe",
		cwd: process.cwd(),
	},
)

let taskId = null

newTaskProcess.stdout.on("data", (data) => {
	const output = data.toString()
	console.log(`[NEW-TASK] ${output.trim()}`)

	// Look for task ID in the output
	const taskIdMatch = output.match(/taskId['":\s]+([a-f0-9-]{36})/i)
	if (taskIdMatch) {
		taskId = taskIdMatch[1]
		console.log(`✅ Found task ID: ${taskId}`)
	}
})

newTaskProcess.stderr.on("data", (data) => {
	console.log(`[NEW-TASK-ERROR] ${data.toString().trim()}`)
})

newTaskProcess.on("close", (code) => {
	console.log(`[NEW-TASK] Process exited with code ${code}\n`)

	if (taskId) {
		// Test 2: Restart the task
		console.log("🔄 Test 2: Restarting the task...")

		const restartProcess = spawn(
			"node",
			["api-client.js", "--stream", "--verbose", "--task", taskId, "Add user input functionality"],
			{
				stdio: "pipe",
				cwd: process.cwd(),
			},
		)

		restartProcess.stdout.on("data", (data) => {
			console.log(`[RESTART] ${data.toString().trim()}`)
		})

		restartProcess.stderr.on("data", (data) => {
			console.log(`[RESTART-ERROR] ${data.toString().trim()}`)
		})

		restartProcess.on("close", (code) => {
			console.log(`[RESTART] Process exited with code ${code}`)
			console.log("\n🎉 Task restart functionality test completed!")
		})

		// Kill restart test after 10 seconds
		setTimeout(() => {
			if (!restartProcess.killed) {
				console.log("[RESTART] Killing process after 10 seconds...")
				restartProcess.kill()
			}
		}, 10000)
	} else {
		console.log("❌ No task ID found, cannot test restart functionality")
	}
})

// Kill new task test after 10 seconds
setTimeout(() => {
	if (!newTaskProcess.killed) {
		console.log("[NEW-TASK] Killing process after 10 seconds...")
		newTaskProcess.kill()
	}
}, 10000)
