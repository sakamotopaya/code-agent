"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
exports.SlidingTimeoutDemo = void 0
const events_1 = require("events")
// Simple demonstration of the sliding timeout logic
class SlidingTimeoutDemo extends events_1.EventEmitter {
	constructor() {
		super()
		this.timeoutMs = 5000 // 5 seconds for demo
		this.setupSlidingTimeout()
	}
	setupSlidingTimeout() {
		this.resetTimeout()
		// Set up activity event listeners
		this.on("activity", () => {
			console.log("Activity detected - resetting timeout")
			this.resetTimeout()
		})
		this.on("completed", () => {
			console.log("Task completed - clearing timeout")
			this.clearTimeout()
		})
	}
	resetTimeout() {
		if (this.timeout) {
			clearTimeout(this.timeout)
		}
		this.timeout = setTimeout(() => {
			console.log(`Task timed out after ${this.timeoutMs}ms of inactivity`)
			this.emit("timeout")
		}, this.timeoutMs)
		console.log(`Timeout reset - task has ${this.timeoutMs}ms of inactivity before timeout`)
	}
	clearTimeout() {
		if (this.timeout) {
			clearTimeout(this.timeout)
			console.log("Timeout cleared")
		}
	}
	// Simulate activity
	simulateActivity() {
		this.emit("activity")
	}
	// Simulate completion
	simulateCompletion() {
		this.emit("completed")
	}
}
exports.SlidingTimeoutDemo = SlidingTimeoutDemo
// Demo function
async function runDemo() {
	console.log("=== Sliding Timeout Demo ===\n")
	const demo = new SlidingTimeoutDemo()
	demo.on("timeout", () => {
		console.log("❌ Task timed out due to inactivity!\n")
	})
	console.log("Scenario 1: Task times out after 5 seconds of inactivity")
	await new Promise((resolve) => setTimeout(resolve, 6000))
	console.log("\nScenario 2: Task with periodic activity")
	const demo2 = new SlidingTimeoutDemo()
	demo2.on("timeout", () => {
		console.log("❌ Task timed out due to inactivity!")
	})
	// Simulate activity every 3 seconds
	const activityInterval = setInterval(() => {
		demo2.simulateActivity()
	}, 3000)
	// Stop activity after 12 seconds and let it timeout
	setTimeout(() => {
		clearInterval(activityInterval)
		console.log("Stopping activity simulation...")
	}, 12000)
	// Wait for timeout
	await new Promise((resolve) => setTimeout(resolve, 8000))
	console.log("\nScenario 3: Task completes before timeout")
	const demo3 = new SlidingTimeoutDemo()
	demo3.on("timeout", () => {
		console.log("❌ Task timed out due to inactivity!")
	})
	// Complete the task after 2 seconds
	setTimeout(() => {
		demo3.simulateCompletion()
		console.log("✅ Task completed successfully before timeout")
	}, 2000)
	await new Promise((resolve) => setTimeout(resolve, 3000))
	console.log("\n=== Demo Complete ===")
}
// Run the demo if this file is executed directly
if (require.main === module) {
	runDemo().catch(console.error)
}
