import { CLITerminalAdapter } from "../CLITerminalAdapter"
import { ITerminal, CommandResult, ExecuteCommandOptions } from "../../../interfaces/ITerminal"
import { RooTerminalCallbacks } from "../../../../integrations/terminal/types"

// Mock ITerminal implementation for testing
class MockCLITerminal implements ITerminal {
	async executeCommand(command: string, options?: ExecuteCommandOptions): Promise<CommandResult> {
		return {
			exitCode: 0,
			stdout: `Mock output for: ${command}`,
			stderr: "",
			success: true,
			command,
			cwd: options?.cwd || "/test/dir",
			executionTime: 100,
		}
	}

	async executeCommandStreaming(): Promise<CommandResult> {
		throw new Error("Not implemented in mock")
	}

	async createTerminal(): Promise<any> {
		throw new Error("Not implemented in mock")
	}

	async getTerminals(): Promise<any[]> {
		return []
	}

	async getCwd(): Promise<string> {
		return "/test/dir"
	}

	async setCwd(): Promise<void> {}

	async getEnvironment(): Promise<Record<string, string>> {
		return {}
	}

	async setEnvironmentVariable(): Promise<void> {}

	async isCommandAvailable(): Promise<boolean> {
		return true
	}

	async getShellType(): Promise<string> {
		return "bash"
	}

	async killProcess(): Promise<void> {}

	async getProcesses(): Promise<any[]> {
		return []
	}
}

describe("CLITerminalAdapter", () => {
	let mockTerminal: MockCLITerminal
	let adapter: CLITerminalAdapter

	beforeEach(() => {
		mockTerminal = new MockCLITerminal()
		adapter = new CLITerminalAdapter(mockTerminal, "/test/dir", 123, "test-task")
	})

	test("should implement RooTerminal interface correctly", () => {
		expect(adapter.provider).toBe("execa")
		expect(adapter.id).toBe(123)
		expect(adapter.busy).toBe(false)
		expect(adapter.running).toBe(false)
		expect(adapter.taskId).toBe("test-task")
		expect(adapter.getCurrentWorkingDirectory()).toBe("/test/dir")
		expect(adapter.isClosed()).toBe(false)
	})

	test("should execute commands through CLI terminal", async () => {
		const mockCallbacks: RooTerminalCallbacks = {
			onLine: jest.fn(),
			onCompleted: jest.fn(),
			onShellExecutionStarted: jest.fn(),
			onShellExecutionComplete: jest.fn(),
		}

		const promise = adapter.runCommand("echo test", mockCallbacks)

		// Should set busy state during execution
		expect(adapter.busy).toBe(true)
		expect(adapter.running).toBe(true)

		// Wait for command completion
		await promise

		// Should reset busy state after execution
		expect(adapter.busy).toBe(false)
		expect(adapter.running).toBe(false)

		// Should have called the appropriate callbacks
		expect(mockCallbacks.onShellExecutionStarted).toHaveBeenCalled()
		expect(mockCallbacks.onLine).toHaveBeenCalledWith("Mock output for: echo test\n", expect.any(Object))
		expect(mockCallbacks.onShellExecutionComplete).toHaveBeenCalledWith(
			{
				exitCode: 0,
				signal: undefined,
				signalName: undefined,
			},
			expect.any(Object),
		)
		expect(mockCallbacks.onCompleted).toHaveBeenCalledWith("Mock output for: echo test", expect.any(Object))
	})

	test("should handle command errors gracefully", async () => {
		// Mock terminal that throws an error
		const errorTerminal = new MockCLITerminal()
		errorTerminal.executeCommand = jest.fn().mockRejectedValue(new Error("Command failed"))

		const errorAdapter = new CLITerminalAdapter(errorTerminal, "/test/dir", 124)
		const mockCallbacks: RooTerminalCallbacks = {
			onLine: jest.fn(),
			onCompleted: jest.fn(),
			onShellExecutionStarted: jest.fn(),
			onShellExecutionComplete: jest.fn(),
		}

		try {
			const promise = errorAdapter.runCommand("failing-command", mockCallbacks)
			// Wait for command completion
			await promise
		} catch (error) {
			// Error is expected, just continue
		}

		// Should reset busy state even after error
		expect(errorAdapter.busy).toBe(false)
		expect(errorAdapter.running).toBe(false)
	})

	test("should manage process output retrieval", () => {
		// Initially no processes with output
		expect(adapter.getProcessesWithOutput()).toEqual([])
		expect(adapter.getUnretrievedOutput()).toBe("")
		expect(adapter.getLastCommand()).toBe("")

		// After command execution, should track the process
		// This would be set during runCommand execution
	})

	test("should handle shell execution completion", () => {
		const exitDetails = {
			exitCode: 0,
			signal: undefined,
			signalName: undefined,
		}

		// Should not throw when called without active process
		expect(() => adapter.shellExecutionComplete(exitDetails)).not.toThrow()

		// Should set running to false
		adapter.running = true
		adapter.shellExecutionComplete(exitDetails)
		expect(adapter.running).toBe(false)
	})

	test("should handle CLI-specific no-op methods", () => {
		// These methods are no-ops for CLI context but should not throw
		expect(() => adapter.setActiveStream(undefined)).not.toThrow()
		expect(() => adapter.cleanCompletedProcessQueue()).not.toThrow()
	})
})
