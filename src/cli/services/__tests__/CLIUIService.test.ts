import { CLIUIService } from "../CLIUIService"
import { ColorManager } from "../ColorManager"
import { TableFormatter } from "../TableFormatter"
import { PromptManager } from "../PromptManager"
import { LogLevel } from "../../../core/interfaces/IUserInterface"

// Mock the dependencies
jest.mock("../ColorManager")
jest.mock("../TableFormatter")
jest.mock("../PromptManager")
jest.mock("../ProgressIndicator")

describe("CLIUIService", () => {
	let cliUIService: CLIUIService
	let mockColorManager: jest.Mocked<ColorManager>
	let mockTableFormatter: jest.Mocked<TableFormatter>
	let mockPromptManager: jest.Mocked<PromptManager>

	beforeEach(() => {
		// Clear all mocks
		jest.clearAllMocks()

		// Create mock instances
		mockColorManager = new ColorManager() as jest.Mocked<ColorManager>
		mockTableFormatter = new TableFormatter(mockColorManager) as jest.Mocked<TableFormatter>
		mockPromptManager = new PromptManager(mockColorManager) as jest.Mocked<PromptManager>

		// Mock the constructors to return our mock instances
		;(ColorManager as jest.MockedClass<typeof ColorManager>).mockImplementation(() => mockColorManager)
		;(TableFormatter as jest.MockedClass<typeof TableFormatter>).mockImplementation(() => mockTableFormatter)
		;(PromptManager as jest.MockedClass<typeof PromptManager>).mockImplementation(() => mockPromptManager)

		// Set up default mock implementations
		mockColorManager.info.mockImplementation((msg) => `INFO: ${msg}`)
		mockColorManager.warning.mockImplementation((msg) => `WARN: ${msg}`)
		mockColorManager.error.mockImplementation((msg) => `ERROR: ${msg}`)
		mockColorManager.success.mockImplementation((msg) => `SUCCESS: ${msg}`)
		mockColorManager.primary.mockImplementation((msg) => msg)
		mockColorManager.muted.mockImplementation((msg) => `MUTED: ${msg}`)

		cliUIService = new CLIUIService()
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	describe("Construction", () => {
		it("should create an instance with default parameters", () => {
			expect(cliUIService).toBeInstanceOf(CLIUIService)
			expect(ColorManager).toHaveBeenCalledWith(expect.any(Object), true)
		})

		it("should create an instance with custom parameters", () => {
			const customColorScheme = {
				success: "blue" as const,
				warning: "yellow" as const,
				error: "red" as const,
				info: "cyan" as const,
				highlight: "magenta" as const,
				muted: "gray" as const,
				primary: "white" as const,
			}
			const service = new CLIUIService(false, customColorScheme)
			expect(service).toBeInstanceOf(CLIUIService)
			expect(ColorManager).toHaveBeenCalledWith(customColorScheme, false)
		})
	})

	describe("IUserInterface Implementation", () => {
		let consoleSpy: jest.SpyInstance

		beforeEach(() => {
			consoleSpy = jest.spyOn(console, "info").mockImplementation()
		})

		afterEach(() => {
			consoleSpy.mockRestore()
		})

		describe("showInformation", () => {
			it("should display info message", async () => {
				await cliUIService.showInformation("Test info message")
				expect(mockColorManager.info).toHaveBeenCalledWith("Test info message")
				expect(console.info).toHaveBeenCalledWith("INFO: Test info message")
			})

			it("should handle actions when provided", async () => {
				mockPromptManager.promptSelect.mockResolvedValue("Action 1")

				await cliUIService.showInformation("Test message", {
					actions: ["Action 1", "Action 2"],
				})

				expect(mockPromptManager.promptSelect).toHaveBeenCalledWith({
					message: "Choose an action:",
					choices: [
						{ name: "Action 1", value: "Action 1" },
						{ name: "Action 2", value: "Action 2" },
					],
				})
			})
		})

		describe("showWarning", () => {
			beforeEach(() => {
				consoleSpy = jest.spyOn(console, "warn").mockImplementation()
			})

			it("should display warning message", async () => {
				await cliUIService.showWarning("Test warning")
				expect(mockColorManager.warning).toHaveBeenCalledWith("Test warning")
				expect(console.warn).toHaveBeenCalledWith("WARN: Test warning")
			})
		})

		describe("showError", () => {
			beforeEach(() => {
				consoleSpy = jest.spyOn(console, "error").mockImplementation()
			})

			it("should display error message", async () => {
				await cliUIService.showError("Test error")
				expect(mockColorManager.error).toHaveBeenCalledWith("Test error")
				expect(console.error).toHaveBeenCalledWith("ERROR: Test error")
			})
		})

		describe("askQuestion", () => {
			it("should prompt for selection from choices", async () => {
				mockPromptManager.promptSelect.mockResolvedValue("Choice 2")

				const result = await cliUIService.askQuestion("Select an option", {
					choices: ["Choice 1", "Choice 2", "Choice 3"],
				})

				expect(result).toBe("Choice 2")
				expect(mockPromptManager.promptSelect).toHaveBeenCalledWith({
					message: "Select an option",
					choices: [
						{ name: "Choice 1", value: "Choice 1" },
						{ name: "Choice 2", value: "Choice 2" },
						{ name: "Choice 3", value: "Choice 3" },
					],
				})
			})
		})

		describe("askConfirmation", () => {
			it("should prompt for confirmation", async () => {
				mockPromptManager.promptConfirm.mockResolvedValue(true)

				const result = await cliUIService.askConfirmation("Are you sure?")

				expect(result).toBe(true)
				expect(mockPromptManager.promptConfirm).toHaveBeenCalledWith({
					message: "Are you sure?",
					default: undefined,
				})
			})
		})

		describe("askInput", () => {
			it("should prompt for text input", async () => {
				mockPromptManager.promptText.mockResolvedValue("user input")

				const result = await cliUIService.askInput("Enter text:", {
					defaultValue: "default",
				})

				expect(result).toBe("user input")
				expect(mockPromptManager.promptText).toHaveBeenCalledWith({
					message: "Enter text:",
					default: "default",
				})
			})

			it("should prompt for password input", async () => {
				mockPromptManager.promptPassword.mockResolvedValue("secret")

				const result = await cliUIService.askInput("Enter password:", {
					password: true,
				})

				expect(result).toBe("secret")
				expect(mockPromptManager.promptPassword).toHaveBeenCalledWith({
					message: "Enter password:",
				})
			})
		})

		describe("log", () => {
			let debugSpy: jest.SpyInstance
			let warnSpy: jest.SpyInstance
			let errorSpy: jest.SpyInstance
			let logSpy: jest.SpyInstance

			beforeEach(() => {
				debugSpy = jest.spyOn(console, "debug").mockImplementation()
				warnSpy = jest.spyOn(console, "warn").mockImplementation()
				errorSpy = jest.spyOn(console, "error").mockImplementation()
				logSpy = jest.spyOn(console, "log").mockImplementation()
			})

			afterEach(() => {
				debugSpy.mockRestore()
				warnSpy.mockRestore()
				errorSpy.mockRestore()
				logSpy.mockRestore()
			})

			it("should log debug messages", async () => {
				await cliUIService.log("Debug message", LogLevel.DEBUG)
				expect(mockColorManager.muted).toHaveBeenCalledWith("[DEBUG] Debug message")
				expect(console.debug).toHaveBeenCalled()
			})

			it("should log info messages", async () => {
				await cliUIService.log("Info message", LogLevel.INFO)
				expect(mockColorManager.info).toHaveBeenCalledWith("[INFO] Info message")
				expect(console.info).toHaveBeenCalled()
			})

			it("should log warning messages", async () => {
				await cliUIService.log("Warning message", LogLevel.WARN)
				expect(mockColorManager.warning).toHaveBeenCalledWith("[WARN] Warning message")
				expect(console.warn).toHaveBeenCalled()
			})

			it("should log error messages", async () => {
				await cliUIService.log("Error message", LogLevel.ERROR)
				expect(mockColorManager.error).toHaveBeenCalledWith("[ERROR] Error message")
				expect(console.error).toHaveBeenCalled()
			})

			it("should log plain messages without level", async () => {
				await cliUIService.log("Plain message")
				expect(mockColorManager.primary).toHaveBeenCalledWith("Plain message")
				expect(console.log).toHaveBeenCalled()
			})
		})
	})

	describe("CLI-specific Methods", () => {
		describe("Progress Management", () => {
			it("should show and clear progress", async () => {
				const mockSpinner = {
					start: jest.fn(),
					stop: jest.fn(),
					text: "",
				}

				jest.spyOn(cliUIService, "showSpinner").mockReturnValue(mockSpinner as any)

				await cliUIService.showProgress("Processing...")
				expect(mockSpinner.start).toHaveBeenCalled()

				await cliUIService.clearProgress()
				expect(mockSpinner.stop).toHaveBeenCalled()
			})

			it("should update existing spinner text", async () => {
				const mockSpinner = {
					start: jest.fn(),
					stop: jest.fn(),
					text: "",
				}

				jest.spyOn(cliUIService, "showSpinner").mockReturnValue(mockSpinner as any)

				await cliUIService.showProgress("Processing...")
				await cliUIService.showProgress("Still processing...")

				expect(mockSpinner.text).toBe("Still processing...")
			})
		})

		describe("Colored Output", () => {
			let consoleSpy: jest.SpyInstance

			beforeEach(() => {
				consoleSpy = jest.spyOn(console, "log").mockImplementation()
			})

			afterEach(() => {
				consoleSpy.mockRestore()
			})

			it("should display success messages", () => {
				cliUIService.success("Operation completed")
				expect(mockColorManager.success).toHaveBeenCalledWith("Operation completed")
				expect(console.log).toHaveBeenCalledWith("SUCCESS: Operation completed")
			})

			it("should display warning messages", () => {
				consoleSpy = jest.spyOn(console, "warn").mockImplementation()
				cliUIService.warning("Warning message")
				expect(mockColorManager.warning).toHaveBeenCalledWith("Warning message")
				expect(console.warn).toHaveBeenCalledWith("WARN: Warning message")
				consoleSpy.mockRestore()
			})

			it("should display error messages", () => {
				consoleSpy = jest.spyOn(console, "error").mockImplementation()
				cliUIService.error("Error message")
				expect(mockColorManager.error).toHaveBeenCalledWith("Error message")
				expect(console.error).toHaveBeenCalledWith("ERROR: Error message")
				consoleSpy.mockRestore()
			})

			it("should display info messages", () => {
				consoleSpy = jest.spyOn(console, "info").mockImplementation()
				cliUIService.info("Info message")
				expect(mockColorManager.info).toHaveBeenCalledWith("Info message")
				expect(console.info).toHaveBeenCalledWith("INFO: Info message")
				consoleSpy.mockRestore()
			})

			it("should colorize text", () => {
				mockColorManager.colorize.mockReturnValue("colored text")
				const result = cliUIService.colorize("text", "red")
				expect(result).toBe("colored text")
				expect(mockColorManager.colorize).toHaveBeenCalledWith("text", "red")
			})
		})

		describe("Table Display", () => {
			let consoleSpy: jest.SpyInstance

			beforeEach(() => {
				consoleSpy = jest.spyOn(console, "log").mockImplementation()
				mockTableFormatter.formatTable.mockReturnValue("formatted table")
			})

			afterEach(() => {
				consoleSpy.mockRestore()
			})

			it("should show table", () => {
				const data = [{ name: "John", age: 30 }]
				const options = { head: ["Name", "Age"] }

				cliUIService.showTable(data, options)

				expect(mockTableFormatter.formatTable).toHaveBeenCalledWith(data, options)
				expect(console.log).toHaveBeenCalledWith("formatted table")
			})

			it("should show key-value table", () => {
				mockTableFormatter.formatKeyValueTable.mockReturnValue("key-value table")
				const data = { name: "John", age: 30 }

				cliUIService.showKeyValueTable(data, "User Info")

				expect(mockTableFormatter.formatKeyValueTable).toHaveBeenCalledWith(data)
				expect(console.log).toHaveBeenCalledWith("key-value table")
			})
		})

		describe("Box Display", () => {
			let consoleSpy: jest.SpyInstance

			beforeEach(() => {
				consoleSpy = jest.spyOn(console, "log").mockImplementation()
			})

			afterEach(() => {
				consoleSpy.mockRestore()
			})

			it("should show box with default options", () => {
				// Mock boxen
				const mockBoxen = jest.fn().mockReturnValue("boxed message")
				jest.doMock("boxen", () => mockBoxen)

				cliUIService.showBox("Test message")

				// Note: Due to how Jest handles dynamic imports, we need to test this differently
				expect(console.log).toHaveBeenCalled()
			})

			it("should show success box", () => {
				mockColorManager.success.mockReturnValue("SUCCESS: Test message")
				cliUIService.showSuccessBox("Test message", "Success Title")
				expect(mockColorManager.success).toHaveBeenCalledWith("Test message")
				expect(console.log).toHaveBeenCalled()
			})

			it("should show error box", () => {
				mockColorManager.error.mockReturnValue("ERROR: Test message")
				cliUIService.showErrorBox("Test message", "Error Title")
				expect(mockColorManager.error).toHaveBeenCalledWith("Test message")
				expect(console.log).toHaveBeenCalled()
			})
		})

		describe("Utility Methods", () => {
			let consoleSpy: jest.SpyInstance

			beforeEach(() => {
				consoleSpy = jest.spyOn(console, "clear").mockImplementation()
			})

			afterEach(() => {
				consoleSpy.mockRestore()
			})

			it("should clear screen", () => {
				cliUIService.clearScreen()
				expect(console.clear).toHaveBeenCalled()
			})

			it("should show separator", () => {
				consoleSpy = jest.spyOn(console, "log").mockImplementation()
				mockColorManager.muted.mockReturnValue("muted separator")

				cliUIService.showSeparator("=", 50)
				expect(mockColorManager.muted).toHaveBeenCalledWith("=".repeat(50))
				expect(console.log).toHaveBeenCalledWith("muted separator")
				consoleSpy.mockRestore()
			})

			it("should get color manager", () => {
				const colorManager = cliUIService.getColorManager()
				expect(colorManager).toBe(mockColorManager)
			})

			it("should get table formatter", () => {
				const tableFormatter = cliUIService.getTableFormatter()
				expect(tableFormatter).toBe(mockTableFormatter)
			})

			it("should get prompt manager", () => {
				const promptManager = cliUIService.getPromptManager()
				expect(promptManager).toBe(mockPromptManager)
			})
		})
	})

	describe("Webview Handling", () => {
		let consoleSpy: jest.SpyInstance

		beforeEach(() => {
			consoleSpy = jest.spyOn(console, "log").mockImplementation()
		})

		afterEach(() => {
			consoleSpy.mockRestore()
		})

		it("should handle webview display with warning", async () => {
			const warnSpy = jest.spyOn(cliUIService, "showWarning").mockImplementation()

			await cliUIService.showWebview({
				html: "<h1>Test</h1>",
				data: { test: "data" },
			})

			expect(warnSpy).toHaveBeenCalledWith("Webview content not supported in CLI mode")
			warnSpy.mockRestore()
		})

		it("should handle webview messages", async () => {
			const callback = jest.fn()
			cliUIService.onWebviewMessage(callback)

			await cliUIService.sendWebviewMessage({ type: "test", data: "message" })

			expect(callback).toHaveBeenCalledWith({ type: "test", data: "message" })
		})
	})
})
