import { SpinnerWrapper, ProgressBarWrapper, ProgressIndicatorFactory } from "../ProgressIndicator"
import { ISpinner, IProgressBar } from "../../types/ui-types"
import ora from "ora"

// Mock ora
jest.mock("ora")

describe("ProgressIndicator", () => {
	describe("SpinnerWrapper", () => {
		let mockOraInstance: any
		let spinner: SpinnerWrapper

		beforeEach(() => {
			mockOraInstance = {
				start: jest.fn(),
				stop: jest.fn(),
				succeed: jest.fn(),
				fail: jest.fn(),
				warn: jest.fn(),
				info: jest.fn(),
				text: "initial text",
			}
			;(ora as jest.MockedFunction<typeof ora>).mockReturnValue(mockOraInstance)
			spinner = new SpinnerWrapper("Loading...")
		})

		afterEach(() => {
			jest.clearAllMocks()
		})

		it("should create spinner with message", () => {
			expect(ora).toHaveBeenCalledWith("Loading...")
		})

		it("should start spinner", () => {
			spinner.start()
			expect(mockOraInstance.start).toHaveBeenCalled()
		})

		it("should stop spinner", () => {
			spinner.stop()
			expect(mockOraInstance.stop).toHaveBeenCalled()
		})

		it("should succeed with default message", () => {
			spinner.succeed()
			expect(mockOraInstance.succeed).toHaveBeenCalledWith(undefined)
		})

		it("should succeed with custom message", () => {
			spinner.succeed("Success message")
			expect(mockOraInstance.succeed).toHaveBeenCalledWith("Success message")
		})

		it("should fail with default message", () => {
			spinner.fail()
			expect(mockOraInstance.fail).toHaveBeenCalledWith(undefined)
		})

		it("should fail with custom message", () => {
			spinner.fail("Error message")
			expect(mockOraInstance.fail).toHaveBeenCalledWith("Error message")
		})

		it("should warn with default message", () => {
			spinner.warn()
			expect(mockOraInstance.warn).toHaveBeenCalledWith(undefined)
		})

		it("should warn with custom message", () => {
			spinner.warn("Warning message")
			expect(mockOraInstance.warn).toHaveBeenCalledWith("Warning message")
		})

		it("should info with default message", () => {
			spinner.info()
			expect(mockOraInstance.info).toHaveBeenCalledWith(undefined)
		})

		it("should info with custom message", () => {
			spinner.info("Info message")
			expect(mockOraInstance.info).toHaveBeenCalledWith("Info message")
		})

		it("should get and set text", () => {
			expect(spinner.text).toBe("initial text")

			spinner.text = "new text"
			expect(mockOraInstance.text).toBe("new text")
		})
	})

	describe("ProgressBarWrapper", () => {
		let progressBar: ProgressBarWrapper
		let stdoutSpy: jest.SpyInstance

		beforeEach(() => {
			stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation()
			progressBar = new ProgressBarWrapper({ total: 100, message: "Processing..." })
		})

		afterEach(() => {
			stdoutSpy.mockRestore()
		})

		it("should create progress bar with options", () => {
			expect(progressBar.total).toBe(100)
			expect(progressBar.current).toBe(0)
		})

		it("should increment progress", () => {
			progressBar.increment()
			expect(progressBar.current).toBe(1)

			progressBar.increment(5)
			expect(progressBar.current).toBe(6)
		})

		it("should not exceed total when incrementing", () => {
			progressBar.increment(150)
			expect(progressBar.current).toBe(100)
		})

		it("should update progress to specific value", () => {
			progressBar.update(50)
			expect(progressBar.current).toBe(50)
		})

		it("should clamp update values to valid range", () => {
			progressBar.update(-10)
			expect(progressBar.current).toBe(0)

			progressBar.update(150)
			expect(progressBar.current).toBe(100)
		})

		it("should stop and complete progress", () => {
			progressBar.update(50)
			progressBar.stop()
			expect(progressBar.current).toBe(100)
			expect(stdoutSpy).toHaveBeenCalledWith("\n")
		})

		it("should render progress with correct format", () => {
			// Mock Date.now to control time calculations
			const mockDate = jest.spyOn(Date, "now")
			mockDate.mockReturnValue(1000) // Start time

			progressBar = new ProgressBarWrapper({ total: 100, message: "Test..." })

			mockDate.mockReturnValue(2000) // 1 second later
			progressBar.update(50)

			// Should have written progress to stdout
			expect(stdoutSpy).toHaveBeenCalled()
			const lastCall = stdoutSpy.mock.calls[stdoutSpy.mock.calls.length - 1][0]
			expect(lastCall).toMatch(/Test\.\.\./)
			expect(lastCall).toMatch(/50%/)
			expect(lastCall).toMatch(/50\/100/)

			mockDate.mockRestore()
		})

		it("should format time correctly", () => {
			const mockDate = jest.spyOn(Date, "now")
			mockDate.mockReturnValue(0)

			progressBar = new ProgressBarWrapper({ total: 100 })

			// Simulate 65 seconds (1:05)
			mockDate.mockReturnValue(65000)
			progressBar.update(50)

			const lastCall = stdoutSpy.mock.calls[stdoutSpy.mock.calls.length - 1][0]
			expect(lastCall).toMatch(/01:05/) // Should format as MM:SS

			mockDate.mockRestore()
		})

		it("should throttle updates", () => {
			const updateThreshold = 100 // ms
			const mockDate = jest.spyOn(Date, "now")

			mockDate.mockReturnValue(0)
			progressBar = new ProgressBarWrapper({ total: 100 })
			stdoutSpy.mockClear()

			// First update should render
			mockDate.mockReturnValue(50) // 50ms later
			progressBar.update(10)
			expect(stdoutSpy).not.toHaveBeenCalled() // Should be throttled

			// Update after threshold should render
			mockDate.mockReturnValue(150) // 150ms later
			progressBar.update(20)
			expect(stdoutSpy).toHaveBeenCalled()

			mockDate.mockRestore()
		})
	})

	describe("ProgressIndicatorFactory", () => {
		beforeEach(() => {
			// Clear ora mock
			;(ora as jest.MockedFunction<typeof ora>).mockClear()
		})

		it("should create spinner", () => {
			const spinner = ProgressIndicatorFactory.createSpinner("Loading...")
			expect(spinner).toBeInstanceOf(SpinnerWrapper)
			expect(ora).toHaveBeenCalledWith("Loading...")
		})

		it("should create progress bar", () => {
			const progressBar = ProgressIndicatorFactory.createProgressBar({
				total: 50,
				message: "Processing...",
			})
			expect(progressBar).toBeInstanceOf(ProgressBarWrapper)
			expect(progressBar.total).toBe(50)
		})

		it("should create progress bar with minimal options", () => {
			const progressBar = ProgressIndicatorFactory.createProgressBar({ total: 10 })
			expect(progressBar).toBeInstanceOf(ProgressBarWrapper)
			expect(progressBar.total).toBe(10)
		})
	})

	describe("Interface Compliance", () => {
		it("should implement ISpinner interface", () => {
			const spinner = new SpinnerWrapper("test")

			// Check that all ISpinner methods exist
			expect(typeof spinner.start).toBe("function")
			expect(typeof spinner.stop).toBe("function")
			expect(typeof spinner.succeed).toBe("function")
			expect(typeof spinner.fail).toBe("function")
			expect(typeof spinner.warn).toBe("function")
			expect(typeof spinner.info).toBe("function")
			expect(typeof spinner.text).toBe("string")
		})

		it("should implement IProgressBar interface", () => {
			const progressBar = new ProgressBarWrapper({ total: 100 })

			// Check that all IProgressBar methods exist
			expect(typeof progressBar.increment).toBe("function")
			expect(typeof progressBar.update).toBe("function")
			expect(typeof progressBar.stop).toBe("function")
			expect(typeof progressBar.total).toBe("number")
			expect(typeof progressBar.current).toBe("number")
		})
	})

	describe("Edge Cases", () => {
		let stdoutSpy: jest.SpyInstance

		beforeEach(() => {
			stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation()
		})

		afterEach(() => {
			stdoutSpy.mockRestore()
		})

		it("should handle zero total progress bar", () => {
			const progressBar = new ProgressBarWrapper({ total: 0 })
			expect(progressBar.total).toBe(0)

			progressBar.update(1)
			expect(progressBar.current).toBe(0) // Should be clamped to 0
		})

		it("should handle negative total", () => {
			const progressBar = new ProgressBarWrapper({ total: -10 })
			expect(progressBar.total).toBe(-10)

			// Should handle gracefully without errors
			expect(() => progressBar.update(5)).not.toThrow()
		})

		it("should handle very large numbers", () => {
			const progressBar = new ProgressBarWrapper({ total: Number.MAX_SAFE_INTEGER })
			expect(() => progressBar.update(1000000)).not.toThrow()
		})

		it("should handle rapid updates", () => {
			const progressBar = new ProgressBarWrapper({ total: 1000 })

			// Rapidly update progress
			for (let i = 0; i < 100; i++) {
				expect(() => progressBar.increment()).not.toThrow()
			}

			expect(progressBar.current).toBe(100)
		})
	})
})
