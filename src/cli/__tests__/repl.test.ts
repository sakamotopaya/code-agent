import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals"

// Mock chalk
jest.mock("chalk", () => ({
	cyan: { bold: jest.fn((str: string) => str) },
	yellow: jest.fn((str: string) => str),
	green: jest.fn((str: string) => str),
	red: jest.fn((str: string) => str),
	white: { bold: jest.fn((str: string) => str) },
	gray: jest.fn((str: string) => str),
	blue: jest.fn((str: string) => str),
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

jest.mock("../../core/task/Task", () => ({
	Task: jest.fn().mockImplementation(() => ({
		on: jest.fn(),
		abort: false,
	})),
}))

// Mock readline
const mockRlInterface = {
	setPrompt: jest.fn(),
	prompt: jest.fn(),
	close: jest.fn(),
	on: jest.fn(),
	emit: jest.fn(),
}

jest.mock("readline", () => ({
	createInterface: jest.fn(() => mockRlInterface),
}))

import { CliRepl } from "../repl"

describe("CliRepl", () => {
	let repl: CliRepl
	const mockOptions = {
		cwd: "/test/dir",
		verbose: false,
		color: true,
	}

	beforeEach(() => {
		jest.clearAllMocks()
		process.env.ANTHROPIC_API_KEY = "test-api-key"
		repl = new CliRepl(mockOptions)
	})

	afterEach(() => {
		delete process.env.ANTHROPIC_API_KEY
	})

	describe("constructor", () => {
		it("should create instance with options", () => {
			expect(repl).toBeInstanceOf(CliRepl)
		})
	})

	describe("start", () => {
		it("should setup event handlers", async () => {
			const startPromise = repl.start()

			// Simulate close event to resolve promise
			setTimeout(() => {
				mockRlInterface.emit("close")
			}, 10)

			await startPromise

			expect(mockRlInterface.on).toHaveBeenCalledWith("line", expect.any(Function))
			expect(mockRlInterface.on).toHaveBeenCalledWith("SIGINT", expect.any(Function))
			expect(mockRlInterface.prompt).toHaveBeenCalled()
		})

		it("should handle missing API key", async () => {
			delete process.env.ANTHROPIC_API_KEY
			const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {})

			const startPromise = repl.start()

			setTimeout(() => {
				mockRlInterface.emit("close")
			}, 10)

			await startPromise

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("API configuration required"))
			consoleSpy.mockRestore()
		})
	})

	describe("configuration", () => {
		it("should use environment variable for API key", () => {
			process.env.ANTHROPIC_API_KEY = "test-key"
			const newRepl = new CliRepl(mockOptions)
			expect(newRepl).toBeInstanceOf(CliRepl)
		})
	})
})
