import inquirer from "inquirer"
import {
	Choice,
	TextPromptOptions,
	PasswordPromptOptions,
	ConfirmPromptOptions,
	SelectPromptOptions,
	MultiSelectPromptOptions,
	NumberPromptOptions,
	PromptResult,
} from "../types/prompt-types"
import { ColorManager } from "./ColorManager"

export class PromptManager {
	private colorManager: ColorManager

	constructor(colorManager: ColorManager) {
		this.colorManager = colorManager
	}

	/**
	 * Prompt for text input
	 */
	async promptText(options: TextPromptOptions): Promise<string> {
		const result = await inquirer.prompt({
			type: "input",
			name: "value",
			message: this.colorManager.primary(options.message),
			default: options.default,
		})
		return result.value
	}

	/**
	 * Prompt for password input
	 */
	async promptPassword(options: PasswordPromptOptions): Promise<string> {
		const result = await inquirer.prompt({
			type: "password",
			name: "value",
			message: this.colorManager.primary(options.message),
			default: options.default,
			mask: "*",
		})
		return result.value
	}

	/**
	 * Prompt for confirmation (yes/no)
	 */
	async promptConfirm(options: ConfirmPromptOptions): Promise<boolean> {
		const result = await inquirer.prompt({
			type: "confirm",
			name: "value",
			message: this.colorManager.primary(options.message),
			default: options.default ?? false,
		})
		return result.value
	}

	/**
	 * Prompt for single selection from list
	 */
	async promptSelect(options: SelectPromptOptions): Promise<string> {
		const result = await inquirer.prompt({
			type: "list",
			name: "value",
			message: this.colorManager.primary(options.message),
			choices: this.formatChoices(options.choices),
			default: options.default,
			pageSize: options.pageSize || 10,
		})
		return result.value
	}

	/**
	 * Prompt for multiple selections from list
	 */
	async promptMultiSelect(options: MultiSelectPromptOptions): Promise<string[]> {
		const result = await inquirer.prompt({
			type: "checkbox",
			name: "value",
			message: this.colorManager.primary(options.message),
			choices: this.formatChoices(options.choices),
			default: options.default,
			pageSize: options.pageSize || 10,
		})
		return result.value
	}

	/**
	 * Prompt for number input
	 */
	async promptNumber(options: NumberPromptOptions): Promise<number> {
		const result = await inquirer.prompt({
			type: "input",
			name: "value",
			message: this.colorManager.primary(options.message),
			default: options.default?.toString(),
			validate: (input: string) => {
				const num = parseFloat(input)
				if (isNaN(num)) {
					return "Please enter a valid number"
				}
				if (options.min !== undefined && num < options.min) {
					return `Value must be at least ${options.min}`
				}
				if (options.max !== undefined && num > options.max) {
					return `Value must be at most ${options.max}`
				}
				return true
			},
			filter: (input: string) => parseFloat(input),
		})
		return result.value
	}

	/**
	 * Prompt with custom inquirer questions
	 */
	async promptCustom(questions: any[]): Promise<PromptResult> {
		const formattedQuestions = questions.map((q) => ({
			...q,
			message: this.colorManager.primary(q.message),
		}))

		return await inquirer.prompt(formattedQuestions)
	}

	/**
	 * Prompt for API key with validation
	 */
	async promptApiKey(provider: string, existing?: string): Promise<string> {
		const message = existing
			? `Update ${provider} API key (leave blank to keep current):`
			: `Enter your ${provider} API key:`

		const result = await this.promptPassword({
			message,
			validate: (input: string) => {
				if (!existing && (!input || input.trim().length === 0)) {
					return "API key is required"
				}
				if (input && input.length < 10) {
					return "API key seems too short"
				}
				return true
			},
		})

		return result || existing || ""
	}

	/**
	 * Prompt for model selection with categories
	 */
	async promptModelSelection(models: Record<string, string[]>): Promise<string> {
		const choices: any[] = []

		Object.entries(models).forEach(([category, modelList]) => {
			choices.push(new inquirer.Separator(this.colorManager.highlight(`--- ${category} ---`)))
			modelList.forEach((model) => {
				choices.push({
					name: model,
					value: model,
				})
			})
		})

		return await this.promptSelect({
			message: "Select a model:",
			choices: choices as Choice[],
		})
	}

	/**
	 * Prompt for configuration setup
	 */
	async promptConfigSetup(): Promise<{
		provider: string
		model: string
		apiKey: string
		baseUrl?: string
	}> {
		const provider = await this.promptSelect({
			message: "Select AI provider:",
			choices: [
				{ name: "OpenAI", value: "openai" },
				{ name: "Anthropic", value: "anthropic" },
				{ name: "Azure OpenAI", value: "azure" },
				{ name: "OpenRouter", value: "openrouter" },
				{ name: "Ollama (Local)", value: "ollama" },
				{ name: "Other", value: "other" },
			],
		})

		let model: string
		let apiKey: string
		let baseUrl: string | undefined

		switch (provider) {
			case "openai": {
				model = await this.promptSelect({
					message: "Select OpenAI model:",
					choices: [
						{ name: "GPT-4", value: "gpt-4" },
						{ name: "GPT-4 Turbo", value: "gpt-4-turbo" },
						{ name: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
					],
				})
				apiKey = await this.promptApiKey("OpenAI")
				break
			}

			case "anthropic": {
				model = await this.promptSelect({
					message: "Select Anthropic model:",
					choices: [
						{ name: "Claude 3 Opus", value: "claude-3-opus-20240229" },
						{ name: "Claude 3 Sonnet", value: "claude-3-sonnet-20240229" },
						{ name: "Claude 3 Haiku", value: "claude-3-haiku-20240307" },
					],
				})
				apiKey = await this.promptApiKey("Anthropic")
				break
			}

			case "ollama": {
				model = await this.promptText({
					message: "Enter Ollama model name:",
					default: "llama2",
				})
				baseUrl = await this.promptText({
					message: "Enter Ollama base URL:",
					default: "http://localhost:11434",
				})
				apiKey = "" // Ollama doesn't require API key
				break
			}

			default: {
				model = await this.promptText({
					message: "Enter model name:",
				})
				apiKey = await this.promptApiKey(provider)
				const needsBaseUrl = await this.promptConfirm({
					message: "Do you need to specify a custom base URL?",
				})
				if (needsBaseUrl) {
					baseUrl = await this.promptText({
						message: "Enter base URL:",
					})
				}
			}
		}

		return { provider, model, apiKey, baseUrl }
	}

	/**
	 * Format choices for inquirer
	 */
	private formatChoices(choices: Choice[]): any[] {
		return choices.map((choice) => {
			if (typeof choice === "string") {
				return choice
			}

			const formatted: any = {
				name: choice.name,
				value: choice.value,
			}

			if (choice.short) {
				formatted.short = choice.short
			}

			if (choice.disabled !== undefined) {
				formatted.disabled = choice.disabled
			}

			if (choice.checked !== undefined) {
				formatted.checked = choice.checked
			}

			return formatted
		})
	}

	/**
	 * Show a confirmation with styled message
	 */
	async confirmAction(message: string, defaultValue = false): Promise<boolean> {
		return await this.promptConfirm({
			message,
			default: defaultValue,
		})
	}

	/**
	 * Show an input with validation
	 */
	async getInput(
		message: string,
		defaultValue?: string,
		validator?: (input: string) => boolean | string,
	): Promise<string> {
		return await this.promptText({
			message,
			default: defaultValue,
			validate: validator,
		})
	}

	/**
	 * Show a list selection
	 */
	async selectFromList(message: string, options: string[]): Promise<string> {
		const choices = options.map((option) => ({ name: option, value: option }))
		return await this.promptSelect({
			message,
			choices,
		})
	}

	/**
	 * Show a multi-selection list
	 */
	async selectMultipleFromList(message: string, options: string[]): Promise<string[]> {
		const choices = options.map((option) => ({ name: option, value: option }))
		return await this.promptMultiSelect({
			message,
			choices,
		})
	}
}
