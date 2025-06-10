/**
 * Integration test for execute_command CLI implementation
 * This test can be run manually to verify the CLI adapter works correctly
 */

import { CLITerminalAdapter } from "../CLITerminalAdapter"
import { executeCommand } from "../../../tools/executeCommandTool"
import { Task } from "../../../task/Task"
import { CliTerminal } from "../CliTerminal"

// Simple manual test function
export async function testExecuteCommandCLI(): Promise<void> {
	console.log("🧪 Testing execute_command CLI implementation...")

	try {
		// Create a mock Task with CLI terminal
		const cliTerminal = new CliTerminal()
		const mockTask = {
			term: cliTerminal,
			cwd: process.cwd(),
			fs: {
				isAbsolute: (path: string) => path.startsWith("/"),
				resolve: (path: string) => path,
				exists: () => Promise.resolve(true),
			},
		} as any

		// Test parameters
		const options = {
			executionId: "test-123",
			command: "echo 'Hello from CLI execute_command!'",
			customCwd: undefined,
			terminalShellIntegrationDisabled: false,
			terminalOutputLineLimit: 500,
		}

		console.log(`📋 Executing command: ${options.command}`)

		// Execute the command using our implementation
		const [rejected, result] = await executeCommand(mockTask, options)

		// Check results
		if (rejected) {
			console.log("❌ Command was rejected")
			console.log("Result:", result)
		} else {
			console.log("✅ Command executed successfully!")
			console.log("Result:", result)
		}

		return Promise.resolve()
	} catch (error) {
		console.error("❌ Test failed:", error)
		throw error
	}
}

// Test the CLI terminal adapter directly
export async function testCLITerminalAdapter(): Promise<void> {
	console.log("🧪 Testing CLITerminalAdapter directly...")

	try {
		const cliTerminal = new CliTerminal()
		const adapter: CLITerminalAdapter = new CLITerminalAdapter(cliTerminal, process.cwd(), 999, "test-task")

		console.log("📋 Adapter properties:")
		console.log(`  Provider: ${adapter.provider}`)
		console.log(`  ID: ${adapter.id}`)
		console.log(`  CWD: ${adapter.getCurrentWorkingDirectory()}`)
		console.log(`  Closed: ${adapter.isClosed()}`)

		// Test command execution
		const callbacks = {
			onLine: (line: string) => console.log("📤 Output:", line.trim()),
			onCompleted: (output: string | undefined) =>
				console.log("✅ Completed with output:", output?.length, "chars"),
			onShellExecutionStarted: (pid: number | undefined) => console.log("🚀 Started with PID:", pid),
			onShellExecutionComplete: (details: any) => console.log("🏁 Finished with exit code:", details.exitCode),
		}

		console.log("📋 Running test command: echo 'CLI Adapter Test'")
		const terminalProcess = adapter.runCommand("echo 'CLI Adapter Test'", callbacks)

		await terminalProcess

		console.log("✅ CLITerminalAdapter test completed successfully!")
	} catch (error) {
		console.error("❌ CLITerminalAdapter test failed:", error)
		throw error
	}
}

// Main test function
if (require.main === module) {
	async function runTests() {
		try {
			await testCLITerminalAdapter()
			console.log("")
			await testExecuteCommandCLI()
			console.log("\n🎉 All tests passed!")
		} catch (error) {
			console.error("\n💥 Tests failed:", error)
			process.exit(1)
		}
	}

	runTests()
}
