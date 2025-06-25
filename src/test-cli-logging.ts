#!/usr/bin/env ts-node

// Test script to demonstrate CLI output logging functionality
import { CLILogger, initializeCLILogger } from "./cli/services/CLILogger"
import { AutomationLogger } from "./cli/services/AutomationLogger"
import { LogLevel, LogFormat, LogDestination } from "./cli/types/automation-types"

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

// Test 2: AutomationLogger with console output
console.log("📁 Test 2: AutomationLogger with console output")
console.log("-".repeat(40))

const automationLogger = new AutomationLogger({
	level: LogLevel.INFO,
	format: LogFormat.TEXT,
	destination: LogDestination.CONSOLE,
	includeTimestamps: true,
	includeMetrics: true,
})

// Log the test message
await automationLogger.info("Hello, this is a test message for CLI output logging")
await automationLogger.debug("Debug: AutomationLogger console logging test")
await automationLogger.warn("Warning: This is a test warning")
await automationLogger.error("Error: This is a test error")

console.log("✅ AutomationLogger console test completed")

console.log("\n")

// Test 3: Different log formats
console.log("🎨 Test 3: Different log formats")
console.log("-".repeat(40))

// JSON format logger
const jsonLogger = new AutomationLogger({
	level: LogLevel.INFO,
	format: LogFormat.JSON,
	destination: LogDestination.CONSOLE,
	includeTimestamps: true,
})

console.log("JSON Format:")
await jsonLogger.info("Hello, this is a test message for CLI output logging", {
	testType: "JSON format",
	timestamp: new Date().toISOString(),
})

// CSV format logger
const csvLogger = new AutomationLogger({
	level: LogLevel.INFO,
	format: LogFormat.CSV,
	destination: LogDestination.CONSOLE,
	includeTimestamps: true,
})

console.log("\nCSV Format:")
await csvLogger.info("Hello, this is a test message for CLI output logging", {
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

console.log("\n")

// Test 5: Debug timing
console.log("⏱️ Test 5: Debug timing functionality")
console.log("-".repeat(40))

const debugLogger = new CLILogger(true, false, true, false)
debugLogger.debug("First debug message - timing starts")
await new Promise((resolve) => setTimeout(resolve, 100)) // Wait 100ms
debugLogger.debug("Second debug message - should show +~100ms")
await new Promise((resolve) => setTimeout(resolve, 50)) // Wait 50ms
debugLogger.debug("Third debug message - should show +~50ms")

console.log("\n✅ All CLI output logging tests completed!")
console.log("📊 Summary: Tested basic logging, console output, formats, colors, and timing")
