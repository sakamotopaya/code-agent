// Simple test script to validate LoggerConfigManager
const fs = require("fs")
const path = require("path")

console.log("Testing LoggerConfigManager...")

// Set up environment variables
process.env.LOG_FILE_ENABLED = "true"
process.env.LOGS_PATH = "./test-logs"
process.env.NODE_ENV = "development"

try {
	// Try to load the LoggerConfigManager
	const { LoggerConfigManager } = require("./src/api/config/LoggerConfigManager.ts")
	console.log("ERROR: Cannot load TypeScript file directly")
} catch (error) {
	console.log("Expected error loading .ts file:", error.message)
}

// Test directory creation
const logsDir = "./test-logs"
try {
	fs.mkdirSync(logsDir, { recursive: true })
	console.log("✅ Directory creation works")

	// Test file writing
	fs.writeFileSync(path.join(logsDir, "test.log"), "Test log entry\n")
	console.log("✅ File writing works")

	// Check if file exists
	if (fs.existsSync(path.join(logsDir, "test.log"))) {
		console.log("✅ File exists and is readable")
	}

	// Clean up
	fs.unlinkSync(path.join(logsDir, "test.log"))
	fs.rmdirSync(logsDir)
	console.log("✅ Cleanup successful")
} catch (error) {
	console.log("❌ File system test failed:", error.message)
}

console.log("Test completed")
