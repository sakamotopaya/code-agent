import { CliUserInterface } from "../CliUserInterface"
import type { LogLevel } from "../../../interfaces"

// Mock inquirer
jest.mock("inquirer", () => ({
	prompt: jest.fn(),
}))

// Mock chalk
jest.mock("chalk", () => ({
	blue: jest.fn((text) => `BLUE:${text}`),
	yellow: jest.fn((text) => `YELLOW:${text}`),
	red: jest.fn((text) => `RED:${text}`),
	green: jest.fn((text) => `GREEN:${text}`),
	gray: jest.fn((text) => `GRAY:${text}`),
	cyan: jest.fn((text) => `CYAN:${text}`),
	dim: jest.fn((text) => `DIM:${text}`),
}))

// Mock ora
jest.mock("ora", () => ({
	__esModule: true,
	default: jest.fn(() => ({
		start: jest.fn(),
		stop: jest.fn(),
		isSpinning: false,
	})),
}))

describe("CliUserInterface", () => {
	let userInterface: CliUserInterface
	let consoleLogSpy: jest.SpyInstance
	let consoleErrorSpy: jest.SpyInstance

	beforeEach(() => {
		userInterface = new CliUserInterface(true)
		consoleLogSpy = jest.spyOn(console, "log").mockImplementation()
		consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
		consoleErrorSpy.mockRestore()
		jest.clearAllMocks()
	})

	describe("showInformation", () => {
		it("should display info message with blue color", async () => {
			await userInterface.showInformation("Test info message")

			expect(consoleLogSpy).toHaveBeenCalledWith("BLUE:ℹ Test info message")
		})

		it("should handle actions when interactive", async () => {
			const inquirer = require("inquirer")
			inquirer.prompt.mockResolvedValue({ action: "selected-action" })

			const result = await userInterface.showInformation("Test message", {
				actions: ["Action 1", "Action 2"],
			})

			expect(inquirer.prompt).toHaveBeenCalledWith([
				{
					type: "list",
					name: "action",
					message: "Choose an action:",
					choices: ["Action 1", "Action 2"],
				},
			])
		})
	})

	describe("showWarning", () => {
		it("should display warning message with yellow color", async () => {
			await userInterface.showWarning("Test warning message")

			expect(consoleLogSpy).toHaveBeenCalledWith("YELLOW:⚠ Test warning message")
		})
	})

	describe("showError", () => {
		it("should display error message with red color", async () => {
			await userInterface.showError("Test error message")

			expect(consoleErrorSpy).toHaveBeenCalledWith("RED:✖ Test error message")
		})
	})

	describe("askQuestion", () => {
		it("should prompt user with choices", async () => {
			const inquirer = require("inquirer")
			inquirer.prompt.mockResolvedValue({ answer: "choice1" })

			const result = await userInterface.askQuestion("Select an option", {
				choices: ["choice1", "choice2"],
				defaultChoice: "choice1",
			})

			expect(inquirer.prompt).toHaveBeenCalledWith([
				{
					type: "list",
					name: "answer",
					message: "Select an option",
					choices: ["choice1", "choice2"],
					default: "choice1",
				},
			])
			expect(result).toBe("choice1")
		})

		it("should throw error when not interactive", async () => {
			const nonInteractiveUI = new CliUserInterface(false)

			await expect(nonInteractiveUI.askQuestion("Test?", { choices: ["yes", "no"] })).rejects.toThrow(
				"Cannot ask questions in non-interactive mode",
			)
		})
	})

	describe("askConfirmation", () => {
		it("should prompt for confirmation", async () => {
			const inquirer = require("inquirer")
			inquirer.prompt.mockResolvedValue({ confirmed: true })

			const result = await userInterface.askConfirmation("Are you sure?")

			expect(inquirer.prompt).toHaveBeenCalledWith([
				{
					type: "confirm",
					name: "confirmed",
					message: "Are you sure?",
					default: false,
				},
			])
			expect(result).toBe(true)
		})
	})

	describe("askInput", () => {
		it("should prompt for text input", async () => {
			const inquirer = require("inquirer")
			inquirer.prompt.mockResolvedValue({ input: "user input" })

			const result = await userInterface.askInput("Enter text:", {
				defaultValue: "default",
			})

			expect(inquirer.prompt).toHaveBeenCalledWith([
				{
					type: "input",
					name: "input",
					message: "Enter text:",
					default: "default",
				},
			])
			expect(result).toBe("user input")
		})

		it("should handle password input", async () => {
			const inquirer = require("inquirer")
			inquirer.prompt.mockResolvedValue({ input: "secret" })

			await userInterface.askInput("Enter password:", { password: true })

			expect(inquirer.prompt).toHaveBeenCalledWith([
				expect.objectContaining({
					type: "password",
				}),
			])
		})
	})

	describe("log", () => {
		it("should log with timestamp and level colors", async () => {
			await userInterface.log("Test message", "error" as LogLevel)

			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("RED:"))
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("ERROR: Test message"))
		})

		it("should handle different log levels", async () => {
			await userInterface.log("Debug message", "debug" as LogLevel)
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("GRAY:"))

			await userInterface.log("Info message", "info" as LogLevel)
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("BLUE:"))

			await userInterface.log("Warn message", "warn" as LogLevel)
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("YELLOW:"))
		})
	})

	describe("showWebview", () => {
		it("should display webview message for CLI", async () => {
			await userInterface.showWebview({ html: "<div>Test</div>" }, { title: "Test Webview" })

			expect(consoleLogSpy).toHaveBeenCalledWith("CYAN:🌐 Webview content available: Test Webview")
		})
	})

	describe("progress functionality", () => {
		it("should show and clear progress", async () => {
			const ora = require("ora")
			const mockSpinner = {
				start: jest.fn(),
				stop: jest.fn(),
				isSpinning: false,
			}
			ora.default.mockReturnValue(mockSpinner)

			await userInterface.showProgress("Loading...", 50)
			expect(ora.default).toHaveBeenCalledWith("Loading... (50%)")
			expect(mockSpinner.start).toHaveBeenCalled()

			await userInterface.clearProgress()
			expect(mockSpinner.stop).toHaveBeenCalled()
		})
	})
})
