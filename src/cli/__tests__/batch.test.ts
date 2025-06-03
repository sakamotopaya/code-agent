import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals"

// Mock chalk
jest.mock("chalk", () => ({
	blue: jest.fn((str: string) => str),
	green: jest.fn((str: string) => str),
	red: jest.fn((str: string) => str),
	gray: jest.fn((str: string) => str),
	yellow: jest.fn((str: string) => str),
}))

// Mock dependencies
jest.mock("../../core/adapters/cli", () => ({
	createCliAdapters: jest.fn(() => ({
		userInterface: {},
		fileSystem: {},
		terminal: {},
		browser: {},
	})),
}))

const mockTask = {
	on: jest.fn(),
	abort: false,
}

jest.mock("../../core/task/Task", () => ({
	Task: jest.fn().mockImplementation(() => mockTask),
}))

import { BatchProcessor } from "../commands/batch"

describe("BatchProcessor", () => {
	let batchProcessor: BatchProcessor
	const mockOptions = {
		cwd: "/test/dir",
		verbose: false,
		color: true,
	}

	beforeEach(() => {
		jest.clearAllMocks()
		process.env.ANTHROPIC_API_KEY = "test-api-key"
		batchProcessor = new BatchProcessor(mockOptions)
	})

	afterEach(() => {
		delete process.env.ANTHROPIC_API_KEY
	})

	describe("constructor", () => {
		it("should create instance with options", () => {
			expect(batchProcessor).toBeInstanceOf(BatchProcessor)
		})
	})

	describe("run", () => {
		it("should execute task successfully", async () => {
			const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {})

			// Mock successful task completion
			mockTask.on.mockImplementation((...args: any[]) => {
				const [event, callback] = args
				if (event === "taskCompleted") {
					setTimeout(callback, 10)
				}
			})

			await batchProcessor.run("Create a hello world function")

			expect(mockTask.on).toHaveBeenCalledWith("taskCompleted", expect.any(Function))
			expect(mockTask.on).toHaveBeenCalledWith("taskAborted", expect.any(Function))

			consoleSpy.mockRestore()
		})

		it("should handle task abortion", async () => {
			const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
			const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("process.exit called")
			})

			// Mock task abortion
			mockTask.on.mockImplementation((...args: any[]) => {
				const [event, callback] = args
				if (event === "taskAborted") {
					setTimeout(() => callback(), 10)
				}
			})

			try {
				await batchProcessor.run("Test task")
			} catch (error: any) {
				expect(error.message).toBe("process.exit called")
			}

			consoleSpy.mockRestore()
			exitSpy.mockRestore()
		})

		it("should handle missing API key", async () => {
			delete process.env.ANTHROPIC_API_KEY

			const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
			const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("process.exit called")
			})

			try {
				await batchProcessor.run("Test task")
			} catch (error: any) {
				expect(error.message).toBe("process.exit called")
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Configuration Error"),
				expect.stringContaining("API configuration required"),
			)

			consoleSpy.mockRestore()
			exitSpy.mockRestore()
		})

		it("should handle verbose mode", async () => {
			const verboseOptions = { ...mockOptions, verbose: true }
			const verboseBatchProcessor = new BatchProcessor(verboseOptions)
			const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {})

			// Mock successful task completion
			mockTask.on.mockImplementation((...args: any[]) => {
				const [event, callback] = args
				if (event === "taskCompleted") {
					setTimeout(callback, 10)
				}
			})

			await verboseBatchProcessor.run("Test task")

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Starting batch mode"))
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Task completed successfully"))

			consoleSpy.mockRestore()
		})

		it("should handle tool failures", async () => {
			const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
			const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
				throw new Error("process.exit called")
			})

			// Mock tool failure
			mockTask.on.mockImplementation((...args: any[]) => {
				const [event, callback] = args
				if (event === "taskToolFailed") {
					setTimeout(() => callback("task-id", "some-tool", "Tool error"), 10)
				}
			})

			try {
				await batchProcessor.run("Test task")
			} catch (error: any) {
				expect(error.message).toBe("process.exit called")
			}

			consoleSpy.mockRestore()
			exitSpy.mockRestore()
		})
	})

	describe("configuration loading", () => {
		it("should load configuration with API key from environment", () => {
			process.env.ANTHROPIC_API_KEY = "test-key"
			const processor = new BatchProcessor(mockOptions)
			expect(processor).toBeInstanceOf(BatchProcessor)
		})
	})
})
