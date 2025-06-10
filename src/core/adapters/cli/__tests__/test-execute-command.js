#!/usr/bin/env node

/**
 * Simple test to verify execute_command works in CLI context
 * Run with: node test-execute-command.js
 */

const { CLITerminalAdapter } = require("../CLITerminalAdapter")
const { CliTerminal } = require("../CliTerminal")

async function testExecuteCommand() {
	console.log("🧪 Testing execute_command CLI implementation...")

	try {
		// Create CLI terminal and adapter
		const cliTerminal = new CliTerminal()
		const adapter = new CLITerminalAdapter(cliTerminal, process.cwd(), 123, "test-task")

		console.log("✅ CLITerminalAdapter created successfully")
		console.log(`  Provider: ${adapter.provider}`)
		console.log(`  Working Directory: ${adapter.getCurrentWorkingDirectory()}`)

		// Test command execution
		const callbacks = {
			onLine: (line) => console.log(`📤 Output: ${line.trim()}`),
			onCompleted: (output) => console.log(`✅ Command completed. Output length: ${output?.length || 0} chars`),
			onShellExecutionStarted: (pid) => console.log(`🚀 Command started with PID: ${pid || "unknown"}`),
			onShellExecutionComplete: (details) =>
				console.log(`🏁 Command finished with exit code: ${details.exitCode}`),
		}

		console.log('\n📋 Executing test command: echo "Hello from CLI execute_command!"')
		const terminalProcess = adapter.runCommand('echo "Hello from CLI execute_command!"', callbacks)

		await terminalProcess

		console.log("\n🎉 Test completed successfully!")
		console.log("✅ execute_command tool is now working in CLI context")
	} catch (error) {
		console.error("❌ Test failed:", error.message)
		process.exit(1)
	}
}

if (require.main === module) {
	testExecuteCommand()
}
