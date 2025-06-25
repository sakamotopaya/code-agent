#!/usr/bin/env node

// Test script to demonstrate CLI output logging functionality
const { CLILogger, initializeCLILogger } = require("./cli/services/CLILogger")
const { AutomationLogger } = require("./cli/services/AutomationLogger")

console.log("🧪 Testing CLI Output Logging")
console.log("==============================\n")

// Test 1: Basic CLILogger functionality
console.log("📝 Test 1: Basic CLILogger functionality")
console.log("-".repeat(40))

// Initialize logger with verbose mode to see all output
const logger = initializeCLILogger(true, false, true, false)

logger.info("Hello, this is a test message for CLI output logging")
logger.debug("Debug message: CLI logging system initialized")
logger.success("✅ CLI Logger test completed successfully")
logger.warn("⚠️ This is a warning message")
logger.error("❌ This is an error message (for testing)")
logger.progress("⏳ Processing test message...")

console.log("\n")

// Test 2: AutomationLogger with file output
console.log("📁 Test 2: AutomationLogger with file output")
console.log("-".repeat(40))

const automationLogger = new AutomationLogger({
	level: "INFO",
	format: "TEXT",
	destination: "BOTH", // Console and file
	includeTimestamps: true,
	includeMetrics: true,
})

// Log the test message
automationLogger.info("Hello, this is a test message for CLI output logging")
automationLogger.debug("Debug: AutomationLogger file logging test")
automationLogger.warn("Warning: This is a test warning")
automationLogger.error("Error: This is a test error")

console.log("✅ AutomationLogger test completed")
console.log("📄 Check the logs directory for output files")

console.log("\n")

// Test 3: Different log formats
console.log("🎨 Test 3: Different log formats")
console.log("-".repeat(40))

// JSON format logger
const jsonLogger = new AutomationLogger({
	level: "INFO",
	format: "JSON",
	destination: "CONSOLE",
	includeTimestamps: true,
})

console.log("JSON Format:")
jsonLogger.info("Hello, this is a test message for CLI output logging", {
	testType: "JSON format",
	timestamp: new Date().toISOString(),
})

// CSV format logger
const csvLogger = new AutomationLogger({
	level: "INFO",
	format: "CSV",
	destination: "CONSOLE",
	includeTimestamps: true,
})

console.log("\nCSV Format:")
csvLogger.info("Hello, this is a test message for CLI output logging", {
	testType: "CSV format",
})

console.log("\n")

// Test 4: Color and formatting
console.log("🌈 Test 4: Color and formatting")
console.log("-".repeat(40))

const colorLogger = new CLILogger(true, false, true, false)
colorLogger.info("🎨 Colored output test message")
colorLogger.success("✨ Success with colors!")
colorLogger.warn("⚠️ Warning with colors!")
colorLogger.error("🚨 Error with colors!")

console.log("\n✅ All CLI output logging tests completed!")
console.log("📊 Summary: Tested basic logging, file output, formats, and colors")
