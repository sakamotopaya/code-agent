import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals"

// Mock chalk
const mockChalk = {
	cyan: { bold: jest.fn((str: string) => str) },
	white: { bold: jest.fn((str: string) => str) },
	gray: jest.fn((str: string) => str),
	yellow: jest.fn((str: string) => str),
}

jest.mock("chalk", () => mockChalk)

import { showBanner } from "../utils/banner"

describe("showBanner", () => {
	let consoleSpy: jest.SpiedFunction<typeof console.log>

	beforeEach(() => {
		consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleSpy.mockRestore()
		jest.clearAllMocks()
	})

	it("should display the banner with colored output", () => {
		showBanner()

		// Verify console.log was called multiple times for the banner
		expect(consoleSpy).toHaveBeenCalledTimes(12) // Including empty lines

		// Verify chalk functions were called for coloring
		expect(mockChalk.cyan.bold).toHaveBeenCalled()
		expect(mockChalk.white.bold).toHaveBeenCalled()
		expect(mockChalk.gray).toHaveBeenCalled()
		expect(mockChalk.yellow).toHaveBeenCalled()
	})

	it("should include expected banner text", () => {
		showBanner()

		// Check that banner includes expected text elements
		const allLogCalls = consoleSpy.mock.calls.flat()
		const allText = allLogCalls.join("")

		expect(allText).toContain("Roo Code Agent CLI")
		expect(allText).toContain("Interactive coding assistant")
		expect(allText).toContain("help")
		expect(allText).toContain("exit")
		expect(allText).toContain("quit")
		expect(allText).toContain("Ctrl+C")
	})

	it("should display ASCII art", () => {
		showBanner()

		// Check that some ASCII art characters are present
		const allLogCalls = consoleSpy.mock.calls.flat()
		const allText = allLogCalls.join("")

		// The banner should contain ASCII art characters
		expect(allText).toMatch(/[_|\/\\]+/)
	})

	it("should start and end with empty lines", () => {
		showBanner()

		// First and last calls should be empty lines
		expect(consoleSpy.mock.calls[0]).toEqual([])
		expect(consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1]).toEqual([])
	})

	it("should provide usage instructions", () => {
		showBanner()

		const allLogCalls = consoleSpy.mock.calls.flat()
		const allText = allLogCalls.join("")

		// Check for usage instructions
		expect(allText).toContain("Type")
		expect(allText).toContain("for available commands")
		expect(allText).toContain("to leave")
		expect(allText).toContain("force exit")
	})
})
