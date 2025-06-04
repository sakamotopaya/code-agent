import { CommandExecutor } from "../CommandExecutor"
import { BatchCommand } from "../../types/batch-types"
import { AutomationContext } from "../../types/automation-types"
import { spawn } from "child_process"
import { EventEmitter } from "events"

// Mock child_process
jest.mock("child_process")
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>

describe("CommandExecutor", () => {
	let executor: CommandExecutor
	let mockContext: AutomationContext

	beforeEach(() => {
		mockContext = {
			isInteractive: false,
			defaults: {
				confirmations: false,
				fileOverwrite: false,
				createDirectories: true,
				timeout: 30000,
				retryCount: 3,
			},
			timeout: 30000,
			retryCount: 3,
			continueOnError: false,
			dryRun: false,
		}
		executor = new CommandExecutor(mockContext)
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe("execute", () => {
		it("should execute a simple command successfully", async () => {
			const command: BatchCommand = {
				id: "test1",
				command: "echo",
				args: ["hello"],
			}

			// Mock child process
			const mockChildProcess = new EventEmitter() as any
			mockChildProcess.stdout = new EventEmitter()
			mockChildProcess.stderr = new EventEmitter()
			mockChildProcess.kill = jest.fn()
			mockChildProcess.killed = false

			mockSpawn.mockReturnValue(mockChildProcess)

			// Execute the command
			const executePromise = executor.execute(command)

			// Simulate successful execution
			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("hello"))
				mockChildProcess.emit("exit", 0, null)
			}, 10)

			const result = await executePromise

			expect(result.id).toBe("test1")
			expect(result.success).toBe(true)
			expect(result.exitCode).toBe(0)
			expect(result.stdout).toBe("hello")
		})

		it("should handle command failure", async () => {
			const command: BatchCommand = {
				id: "test2",
				command: "false",
				args: [],
			}

			const mockChildProcess = new EventEmitter() as any
			mockChildProcess.stdout = new EventEmitter()
			mockChildProcess.stderr = new EventEmitter()
			mockChildProcess.kill = jest.fn()
			mockChildProcess.killed = false

			mockSpawn.mockReturnValue(mockChildProcess)

			const executePromise = executor.execute(command)

			// Simulate command failure
			setTimeout(() => {
				mockChildProcess.stderr.emit("data", Buffer.from("Command failed"))
				mockChildProcess.emit("exit", 1, null)
			}, 10)

			const result = await executePromise

			expect(result.success).toBe(false)
			expect(result.exitCode).toBe(1)
			expect(result.stderr).toBe("Command failed")
		})

		it("should handle command timeout", async () => {
			const command: BatchCommand = {
				id: "test3",
				command: "sleep",
				args: ["60"],
				timeout: 100, // Very short timeout
			}

			const mockChildProcess = new EventEmitter() as any
			mockChildProcess.stdout = new EventEmitter()
			mockChildProcess.stderr = new EventEmitter()
			mockChildProcess.kill = jest.fn()
			mockChildProcess.killed = false

			mockSpawn.mockReturnValue(mockChildProcess)

			const executePromise = executor.execute(command)

			const result = await executePromise

			expect(result.success).toBe(false)
			expect(result.error?.message).toContain("timed out")
			expect(mockChildProcess.kill).toHaveBeenCalledWith("SIGTERM")
		})

		it("should handle spawn errors", async () => {
			const command: BatchCommand = {
				id: "test4",
				command: "nonexistent-command",
				args: [],
			}

			const mockChildProcess = new EventEmitter() as any
			mockChildProcess.stdout = new EventEmitter()
			mockChildProcess.stderr = new EventEmitter()
			mockChildProcess.kill = jest.fn()
			mockChildProcess.killed = false

			mockSpawn.mockReturnValue(mockChildProcess)

			const executePromise = executor.execute(command)

			// Simulate spawn error
			setTimeout(() => {
				mockChildProcess.emit("error", new Error("Command not found"))
			}, 10)

			const result = await executePromise

			expect(result.success).toBe(false)
			expect(result.error?.message).toContain("Failed to start command")
		})

		it("should handle dry run mode", async () => {
			const dryRunContext: AutomationContext = {
				...mockContext,
				dryRun: true,
			}
			const dryRunExecutor = new CommandExecutor(dryRunContext)

			const command: BatchCommand = {
				id: "test5",
				command: "rm",
				args: ["-rf", "/"],
			}

			const result = await dryRunExecutor.execute(command)

			expect(result.success).toBe(true)
			expect(result.stdout).toContain("[DRY RUN]")
			expect(mockSpawn).not.toHaveBeenCalled()
		})

		it("should use environment variables", async () => {
			const command: BatchCommand = {
				id: "test6",
				command: "echo",
				args: ["$TEST_VAR"],
				environment: {
					TEST_VAR: "test_value",
				},
			}

			const mockChildProcess = new EventEmitter() as any
			mockChildProcess.stdout = new EventEmitter()
			mockChildProcess.stderr = new EventEmitter()
			mockChildProcess.kill = jest.fn()
			mockChildProcess.killed = false

			mockSpawn.mockReturnValue(mockChildProcess)

			const executePromise = executor.execute(command)

			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("test_value"))
				mockChildProcess.emit("exit", 0, null)
			}, 10)

			const result = await executePromise
			expect(result.success).toBe(true)

			// Verify spawn was called with correct environment
			const spawnCall = mockSpawn.mock.calls[0]
			expect(spawnCall[2]).toEqual(
				expect.objectContaining({
					env: expect.objectContaining({
						TEST_VAR: "test_value",
					}),
				}),
			)
		})

		it("should use working directory", async () => {
			const command: BatchCommand = {
				id: "test7",
				command: "pwd",
				args: [],
				workingDirectory: "/tmp",
			}

			const mockChildProcess = new EventEmitter() as any
			mockChildProcess.stdout = new EventEmitter()
			mockChildProcess.stderr = new EventEmitter()
			mockChildProcess.kill = jest.fn()
			mockChildProcess.killed = false

			mockSpawn.mockReturnValue(mockChildProcess)

			const executePromise = executor.execute(command)

			setTimeout(() => {
				mockChildProcess.stdout.emit("data", Buffer.from("/tmp"))
				mockChildProcess.emit("exit", 0, null)
			}, 10)

			const result = await executePromise
			expect(result.success).toBe(true)

			// Verify spawn was called with correct working directory
			const spawnCall = mockSpawn.mock.calls[0]
			expect(spawnCall[2]).toEqual(
				expect.objectContaining({
					cwd: "/tmp",
				}),
			)
		})
	})

	describe("executeWithRetry", () => {
		it("should retry failed commands", async () => {
			const command: BatchCommand = {
				id: "test8",
				command: "flaky-command",
				args: [],
				retries: 2,
			}

			const mockChildProcess = new EventEmitter() as any
			mockChildProcess.stdout = new EventEmitter()
			mockChildProcess.stderr = new EventEmitter()
			mockChildProcess.kill = jest.fn()
			mockChildProcess.killed = false

			mockSpawn.mockReturnValue(mockChildProcess)

			let attemptCount = 0
			const executePromise = executor.executeWithRetry(command)

			// Mock multiple failed attempts followed by success
			const simulateAttempt = () => {
				attemptCount++
				setTimeout(() => {
					if (attemptCount < 3) {
						// First two attempts fail
						mockChildProcess.emit("exit", 1, null)
					} else {
						// Third attempt succeeds
						mockChildProcess.stdout.emit("data", Buffer.from("success"))
						mockChildProcess.emit("exit", 0, null)
					}
				}, 10)
			}

			simulateAttempt()

			const result = await executePromise
			expect(result.success).toBe(true)
		})

		it("should fail after max retries", async () => {
			const command: BatchCommand = {
				id: "test9",
				command: "always-fail",
				args: [],
				retries: 1,
			}

			const mockChildProcess = new EventEmitter() as any
			mockChildProcess.stdout = new EventEmitter()
			mockChildProcess.stderr = new EventEmitter()
			mockChildProcess.kill = jest.fn()
			mockChildProcess.killed = false

			mockSpawn.mockReturnValue(mockChildProcess)

			const executePromise = executor.executeWithRetry(command)

			// Simulate all attempts failing
			setTimeout(() => {
				mockChildProcess.stderr.emit("data", Buffer.from("Command failed"))
				mockChildProcess.emit("exit", 1, null)
			}, 10)

			const result = await executePromise
			expect(result.success).toBe(false)
		})
	})

	describe("parseCommand", () => {
		it("should parse command with separate args", () => {
			const result = (executor as any).parseCommand("git", ["add", "."])
			expect(result).toEqual(["git", "add", "."])
		})

		it("should parse command string with spaces", () => {
			const result = (executor as any).parseCommand("git add .", [])
			expect(result).toEqual(["git", "add", "."])
		})

		it("should parse command string with quoted arguments", () => {
			const result = (executor as any).parseCommand('echo "hello world"', [])
			expect(result).toEqual(["echo", "hello world"])
		})

		it("should parse command string with single quotes", () => {
			const result = (executor as any).parseCommand("echo 'hello world'", [])
			expect(result).toEqual(["echo", "hello world"])
		})

		it("should parse complex command string", () => {
			const result = (executor as any).parseCommand('git commit -m "Initial commit" --author="John Doe"', [])
			expect(result).toEqual(["git", "commit", "-m", "Initial commit", "--author=John Doe"])
		})
	})
})
