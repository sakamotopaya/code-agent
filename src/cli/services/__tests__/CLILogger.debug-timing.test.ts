/**
 * Test file for debug timing functionality
 */

import { CLILogger, formatDebugMessage } from "../CLILogger"

describe("CLILogger Debug Timing", () => {
	let originalConsoleError: jest.SpyInstance
	let originalConsoleLog: jest.SpyInstance

	beforeEach(() => {
		originalConsoleError = jest.spyOn(console, "error").mockImplementation()
		originalConsoleLog = jest.spyOn(console, "log").mockImplementation()
	})

	afterEach(() => {
		originalConsoleError.mockRestore()
		originalConsoleLog.mockRestore()
	})

	test("formatDebugMessage should include timing information", () => {
		// First call should show +0ms
		const firstMessage = formatDebugMessage("First debug message", false)
		expect(firstMessage).toMatch(/\[DEBUG\] \[\+0ms\] First debug message/)

		// Simulate some time passing
		const delay = 50
		const start = Date.now()
		while (Date.now() - start < delay) {
			// Busy wait
		}

		// Second call should show elapsed time
		const secondMessage = formatDebugMessage("Second debug message", false)
		expect(secondMessage).toMatch(/\[DEBUG\] \[\+\d+ms\] Second debug message/)

		// Should show at least the delay time (with some tolerance)
		const match = secondMessage.match(/\[\+(\d+)ms\]/)
		expect(match).toBeTruthy()
		if (match) {
			const elapsed = parseInt(match[1])
			expect(elapsed).toBeGreaterThanOrEqual(delay - 10) // 10ms tolerance
		}
	})

	test("formatDebugMessage should support colored output", () => {
		const coloredMessage = formatDebugMessage("Test message", true)
		expect(coloredMessage).toContain("Test message")
		// Should contain ANSI color codes for gray and dim
		// eslint-disable-next-line no-control-regex
		expect(coloredMessage).toMatch(/\u001b\[\d+m/)
	})

	test("CLILogger.debug should use timing format", () => {
		const logger = new CLILogger(true, false, false) // verbose, not quiet, no color

		logger.debug("Test debug message")

		expect(originalConsoleError).toHaveBeenCalledWith(
			expect.stringMatching(/\[DEBUG\] \[\+\d+ms\] Test debug message/),
		)
	})

	test("CLILogger.debug should not output when not verbose", () => {
		const logger = new CLILogger(false, false, false) // not verbose

		logger.debug("This should not appear")

		expect(originalConsoleError).not.toHaveBeenCalled()
	})

	test("CLILogger.debug should not output when quiet", () => {
		const logger = new CLILogger(true, true, false) // verbose but quiet

		logger.debug("This should not appear")

		expect(originalConsoleError).not.toHaveBeenCalled()
	})

	test("sequential debug calls should show increasing elapsed times", () => {
		const logger = new CLILogger(true, false, false) // verbose, not quiet, no color

		logger.debug("First message")

		// Small delay
		const delay = 25
		const start = Date.now()
		while (Date.now() - start < delay) {
			// Busy wait
		}

		logger.debug("Second message")

		expect(originalConsoleError).toHaveBeenCalledTimes(2)

		const firstCall = originalConsoleError.mock.calls[0][0]
		const secondCall = originalConsoleError.mock.calls[1][0]

		// First call should be +0ms (or very small)
		expect(firstCall).toMatch(/\[\+\d+ms\]/)

		// Second call should show elapsed time
		expect(secondCall).toMatch(/\[\+\d+ms\]/)

		// Extract elapsed times
		const firstMatch = firstCall.match(/\[\+(\d+)ms\]/)
		const secondMatch = secondCall.match(/\[\+(\d+)ms\]/)

		expect(firstMatch).toBeTruthy()
		expect(secondMatch).toBeTruthy()

		if (firstMatch && secondMatch) {
			const firstElapsed = parseInt(firstMatch[1])
			const secondElapsed = parseInt(secondMatch[1])

			// Second elapsed should be >= delay time (with tolerance)
			expect(secondElapsed).toBeGreaterThanOrEqual(delay - 10)
		}
	})
})
