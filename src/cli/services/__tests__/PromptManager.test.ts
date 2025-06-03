import { PromptManager } from "../PromptManager"
import { ColorManager } from "../ColorManager"
import inquirer from "inquirer"

// Mock inquirer
jest.mock("inquirer")

describe("PromptManager", () => {
	let promptManager: PromptManager
	let mockColorManager: jest.Mocked<ColorManager>
	let mockInquirer: jest.Mocked<typeof inquirer>

	beforeEach(() => {
		// Create mock color manager
		mockColorManager = {
			primary: jest.fn((text) => `PRIMARY:${text}`),
			success: jest.fn((text) => `SUCCESS:${text}`),
			error: jest.fn((text) => `ERROR:${text}`),
			warning: jest.fn((text) => `WARNING:${text}`),
			info: jest.fn((text) => `INFO:${text}`),
			highlight: jest.fn((text) => `HIGHLIGHT:${text}`),
		} as any

		// Mock inquirer
		mockInquirer = inquirer as jest.Mocked<typeof inquirer>
		mockInquirer.prompt = jest.fn() as any
		mockInquirer.Separator = jest.fn().mockImplementation((text) => ({ type: "separator", line: text })) as any

		promptManager = new PromptManager(mockColorManager)
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe("Construction", () => {
		it("should create an instance with color manager", () => {
			expect(promptManager).toBeInstanceOf(PromptManager)
		})
	})

	describe("promptText", () => {
		it("should prompt for text input", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: "user input" })

			const result = await promptManager.promptText({
				message: "Enter text:",
				default: "default value",
			})

			expect(result).toBe("user input")
			expect(mockInquirer.prompt).toHaveBeenCalledWith({
				type: "input",
				name: "value",
				message: "PRIMARY:Enter text:",
				default: "default value",
			})
		})

		it("should handle text input without default", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: "user input" })

			const result = await promptManager.promptText({
				message: "Enter text:",
			})

			expect(result).toBe("user input")
			expect(mockInquirer.prompt).toHaveBeenCalledWith({
				type: "input",
				name: "value",
				message: "PRIMARY:Enter text:",
				default: undefined,
			})
		})
	})

	describe("promptPassword", () => {
		it("should prompt for password input", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: "secret" })

			const result = await promptManager.promptPassword({
				message: "Enter password:",
			})

			expect(result).toBe("secret")
			expect(mockInquirer.prompt).toHaveBeenCalledWith({
				type: "password",
				name: "value",
				message: "PRIMARY:Enter password:",
				default: undefined,
				mask: "*",
			})
		})

		it("should handle password with default", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: "secret" })

			const result = await promptManager.promptPassword({
				message: "Enter password:",
				default: "default",
			})

			expect(result).toBe("secret")
			expect(mockInquirer.prompt).toHaveBeenCalledWith({
				type: "password",
				name: "value",
				message: "PRIMARY:Enter password:",
				default: "default",
				mask: "*",
			})
		})
	})

	describe("promptConfirm", () => {
		it("should prompt for confirmation", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: true })

			const result = await promptManager.promptConfirm({
				message: "Are you sure?",
			})

			expect(result).toBe(true)
			expect(mockInquirer.prompt).toHaveBeenCalledWith({
				type: "confirm",
				name: "value",
				message: "PRIMARY:Are you sure?",
				default: false,
			})
		})

		it("should handle confirmation with default true", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: false })

			const result = await promptManager.promptConfirm({
				message: "Are you sure?",
				default: true,
			})

			expect(result).toBe(false)
			expect(mockInquirer.prompt).toHaveBeenCalledWith({
				type: "confirm",
				name: "value",
				message: "PRIMARY:Are you sure?",
				default: true,
			})
		})
	})

	describe("promptSelect", () => {
		it("should prompt for single selection", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: "option2" })

			const choices = [
				{ name: "Option 1", value: "option1" },
				{ name: "Option 2", value: "option2" },
			]

			const result = await promptManager.promptSelect({
				message: "Choose an option:",
				choices,
			})

			expect(result).toBe("option2")
			expect(mockInquirer.prompt).toHaveBeenCalledWith({
				type: "list",
				name: "value",
				message: "PRIMARY:Choose an option:",
				choices,
				default: undefined,
				pageSize: 10,
			})
		})

		it("should handle string choices", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: "Option 2" })

			const choices = ["Option 1", "Option 2"] as any

			const result = await promptManager.promptSelect({
				message: "Choose an option:",
				choices,
			})

			expect(result).toBe("Option 2")
		})

		it("should format complex choices", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: "value1" })

			const choices = [
				{
					name: "Choice 1",
					value: "value1",
					short: "C1",
					disabled: false,
					checked: true,
				},
			]

			await promptManager.promptSelect({
				message: "Choose:",
				choices,
			})

			expect(mockInquirer.prompt).toHaveBeenCalledWith(
				expect.objectContaining({
					choices: [
						{
							name: "Choice 1",
							value: "value1",
							short: "C1",
							disabled: false,
							checked: true,
						},
					],
				}),
			)
		})
	})

	describe("promptMultiSelect", () => {
		it("should prompt for multiple selections", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: ["option1", "option2"] })

			const choices = [
				{ name: "Option 1", value: "option1" },
				{ name: "Option 2", value: "option2" },
				{ name: "Option 3", value: "option3" },
			]

			const result = await promptManager.promptMultiSelect({
				message: "Choose options:",
				choices,
			})

			expect(result).toEqual(["option1", "option2"])
			expect(mockInquirer.prompt).toHaveBeenCalledWith({
				type: "checkbox",
				name: "value",
				message: "PRIMARY:Choose options:",
				choices,
				default: undefined,
				pageSize: 10,
			})
		})

		it("should handle default selections", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: ["option1"] })

			const choices = [
				{ name: "Option 1", value: "option1" },
				{ name: "Option 2", value: "option2" },
			]

			const result = await promptManager.promptMultiSelect({
				message: "Choose options:",
				choices,
				default: ["option1"],
			})

			expect(result).toEqual(["option1"])
			expect(mockInquirer.prompt).toHaveBeenCalledWith(
				expect.objectContaining({
					default: ["option1"],
				}),
			)
		})
	})

	describe("promptNumber", () => {
		it("should prompt for number input", async () => {
			mockInquirer.prompt.mockResolvedValue({ value: 42 })

			const result = await promptManager.promptNumber({
				message: "Enter a number:",
				default: 0,
				min: 0,
				max: 100,
			})

			expect(result).toBe(42)
			expect(mockInquirer.prompt).toHaveBeenCalledWith({
				type: "input",
				name: "value",
				message: "PRIMARY:Enter a number:",
				default: "0",
				validate: expect.any(Function),
				filter: expect.any(Function),
			})
		})

		it("should validate number input", async () => {
			// Just verify that the function is called with validation
			mockInquirer.prompt.mockResolvedValue({ value: 50 })

			await promptManager.promptNumber({
				message: "Enter a number:",
				min: 0,
				max: 100,
			})

			expect(mockInquirer.prompt).toHaveBeenCalledWith(
				expect.objectContaining({
					validate: expect.any(Function),
				}),
			)
		})

		it("should filter number input", async () => {
			// Just verify that the function is called with filter
			mockInquirer.prompt.mockResolvedValue({ value: 42 })

			await promptManager.promptNumber({
				message: "Enter a number:",
			})

			expect(mockInquirer.prompt).toHaveBeenCalledWith(
				expect.objectContaining({
					filter: expect.any(Function),
				}),
			)
		})
	})

	describe("promptCustom", () => {
		it("should handle custom inquirer questions", async () => {
			mockInquirer.prompt.mockResolvedValue({ name: "John", age: 30 })

			const questions = [
				{ type: "input", name: "name", message: "Name:" },
				{ type: "number", name: "age", message: "Age:" },
			]

			const result = await promptManager.promptCustom(questions)

			expect(result).toEqual({ name: "John", age: 30 })
			expect(mockInquirer.prompt).toHaveBeenCalledWith([
				{ type: "input", name: "name", message: "PRIMARY:Name:" },
				{ type: "number", name: "age", message: "PRIMARY:Age:" },
			])
		})
	})

	describe("promptApiKey", () => {
		it("should prompt for new API key", async () => {
			const mockPromptPassword = jest.spyOn(promptManager, "promptPassword")
			mockPromptPassword.mockResolvedValue("new-api-key")

			const result = await promptManager.promptApiKey("OpenAI")

			expect(result).toBe("new-api-key")
			expect(mockPromptPassword).toHaveBeenCalledWith({
				message: "Enter your OpenAI API key:",
				validate: expect.any(Function),
			})
		})

		it("should prompt to update existing API key", async () => {
			const mockPromptPassword = jest.spyOn(promptManager, "promptPassword")
			mockPromptPassword.mockResolvedValue("") // Empty input to keep existing

			const result = await promptManager.promptApiKey("OpenAI", "existing-key")

			expect(result).toBe("existing-key")
			expect(mockPromptPassword).toHaveBeenCalledWith({
				message: "Update OpenAI API key (leave blank to keep current):",
				validate: expect.any(Function),
			})
		})

		it("should validate API key requirements", async () => {
			const mockPromptPassword = jest.spyOn(promptManager, "promptPassword")
			mockPromptPassword.mockResolvedValue("valid-api-key-12345")

			await promptManager.promptApiKey("OpenAI")

			expect(mockPromptPassword).toHaveBeenCalledWith(
				expect.objectContaining({
					validate: expect.any(Function),
				}),
			)
		})
	})

	describe("promptModelSelection", () => {
		it("should prompt for model selection with categories", async () => {
			const mockPromptSelect = jest.spyOn(promptManager, "promptSelect")
			mockPromptSelect.mockResolvedValue("gpt-4")

			const models = {
				OpenAI: ["gpt-4", "gpt-3.5-turbo"],
				Anthropic: ["claude-3-opus", "claude-3-sonnet"],
			}

			const result = await promptManager.promptModelSelection(models)

			expect(result).toBe("gpt-4")
			expect(mockInquirer.Separator).toHaveBeenCalledWith("HIGHLIGHT:--- OpenAI ---")
			expect(mockInquirer.Separator).toHaveBeenCalledWith("HIGHLIGHT:--- Anthropic ---")
			expect(mockPromptSelect).toHaveBeenCalledWith({
				message: "Select a model:",
				choices: expect.arrayContaining([
					expect.objectContaining({ type: "separator" }),
					{ name: "gpt-4", value: "gpt-4" },
					{ name: "gpt-3.5-turbo", value: "gpt-3.5-turbo" },
				]),
			})
		})
	})

	describe("promptConfigSetup", () => {
		it("should setup OpenAI configuration", async () => {
			const mockPromptSelect = jest.spyOn(promptManager, "promptSelect")
			const mockPromptApiKey = jest.spyOn(promptManager, "promptApiKey")

			mockPromptSelect
				.mockResolvedValueOnce("openai") // Provider selection
				.mockResolvedValueOnce("gpt-4") // Model selection

			mockPromptApiKey.mockResolvedValue("openai-api-key")

			const result = await promptManager.promptConfigSetup()

			expect(result).toEqual({
				provider: "openai",
				model: "gpt-4",
				apiKey: "openai-api-key",
				baseUrl: undefined,
			})
		})

		it("should setup Anthropic configuration", async () => {
			const mockPromptSelect = jest.spyOn(promptManager, "promptSelect")
			const mockPromptApiKey = jest.spyOn(promptManager, "promptApiKey")

			mockPromptSelect
				.mockResolvedValueOnce("anthropic") // Provider selection
				.mockResolvedValueOnce("claude-3-opus-20240229") // Model selection

			mockPromptApiKey.mockResolvedValue("anthropic-api-key")

			const result = await promptManager.promptConfigSetup()

			expect(result).toEqual({
				provider: "anthropic",
				model: "claude-3-opus-20240229",
				apiKey: "anthropic-api-key",
				baseUrl: undefined,
			})
		})

		it("should setup Ollama configuration", async () => {
			const mockPromptSelect = jest.spyOn(promptManager, "promptSelect")
			const mockPromptText = jest.spyOn(promptManager, "promptText")

			mockPromptSelect.mockResolvedValueOnce("ollama") // Provider selection
			mockPromptText
				.mockResolvedValueOnce("llama2") // Model name
				.mockResolvedValueOnce("http://localhost:11434") // Base URL

			const result = await promptManager.promptConfigSetup()

			expect(result).toEqual({
				provider: "ollama",
				model: "llama2",
				apiKey: "",
				baseUrl: "http://localhost:11434",
			})
		})

		it("should setup custom provider with base URL", async () => {
			const mockPromptSelect = jest.spyOn(promptManager, "promptSelect")
			const mockPromptText = jest.spyOn(promptManager, "promptText")
			const mockPromptConfirm = jest.spyOn(promptManager, "promptConfirm")
			const mockPromptApiKey = jest.spyOn(promptManager, "promptApiKey")

			mockPromptSelect.mockResolvedValueOnce("other") // Provider selection
			mockPromptText
				.mockResolvedValueOnce("custom-model") // Model name
				.mockResolvedValueOnce("https://api.custom.com") // Base URL
			mockPromptConfirm.mockResolvedValueOnce(true) // Needs base URL
			mockPromptApiKey.mockResolvedValue("custom-api-key")

			const result = await promptManager.promptConfigSetup()

			expect(result).toEqual({
				provider: "other",
				model: "custom-model",
				apiKey: "custom-api-key",
				baseUrl: "https://api.custom.com",
			})
		})
	})

	describe("Utility Methods", () => {
		it("should confirm action", async () => {
			const mockPromptConfirm = jest.spyOn(promptManager, "promptConfirm")
			mockPromptConfirm.mockResolvedValue(true)

			const result = await promptManager.confirmAction("Proceed?", true)

			expect(result).toBe(true)
			expect(mockPromptConfirm).toHaveBeenCalledWith({
				message: "Proceed?",
				default: true,
			})
		})

		it("should get input", async () => {
			const mockPromptText = jest.spyOn(promptManager, "promptText")
			mockPromptText.mockResolvedValue("user input")

			const result = await promptManager.getInput("Enter value:", "default", () => true)

			expect(result).toBe("user input")
			expect(mockPromptText).toHaveBeenCalledWith({
				message: "Enter value:",
				default: "default",
				validate: expect.any(Function),
			})
		})

		it("should select from list", async () => {
			const mockPromptSelect = jest.spyOn(promptManager, "promptSelect")
			mockPromptSelect.mockResolvedValue("Option 2")

			const result = await promptManager.selectFromList("Choose:", ["Option 1", "Option 2"])

			expect(result).toBe("Option 2")
			expect(mockPromptSelect).toHaveBeenCalledWith({
				message: "Choose:",
				choices: [
					{ name: "Option 1", value: "Option 1" },
					{ name: "Option 2", value: "Option 2" },
				],
			})
		})

		it("should select multiple from list", async () => {
			const mockPromptMultiSelect = jest.spyOn(promptManager, "promptMultiSelect")
			mockPromptMultiSelect.mockResolvedValue(["Option 1", "Option 3"])

			const result = await promptManager.selectMultipleFromList("Choose:", ["Option 1", "Option 2", "Option 3"])

			expect(result).toEqual(["Option 1", "Option 3"])
			expect(mockPromptMultiSelect).toHaveBeenCalledWith({
				message: "Choose:",
				choices: [
					{ name: "Option 1", value: "Option 1" },
					{ name: "Option 2", value: "Option 2" },
					{ name: "Option 3", value: "Option 3" },
				],
			})
		})
	})

	describe("Choice Formatting", () => {
		it("should format disabled choices", async () => {
			const choices = [
				{ name: "Available", value: "available" },
				{ name: "Disabled", value: "disabled", disabled: true },
			]

			await promptManager.promptSelect({ message: "Choose:", choices })

			expect(mockInquirer.prompt).toHaveBeenCalledWith(
				expect.objectContaining({
					choices: [
						{ name: "Available", value: "available" },
						{ name: "Disabled", value: "disabled", disabled: true },
					],
				}),
			)
		})

		it("should format choices with short names", async () => {
			const choices = [{ name: "Very Long Option Name", value: "option1", short: "Option1" }]

			await promptManager.promptSelect({ message: "Choose:", choices })

			expect(mockInquirer.prompt).toHaveBeenCalledWith(
				expect.objectContaining({
					choices: [{ name: "Very Long Option Name", value: "option1", short: "Option1" }],
				}),
			)
		})
	})
})
