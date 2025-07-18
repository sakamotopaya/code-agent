import { SSEOutputAdapter } from "../streaming/SSEOutputAdapter"
import { ApiQuestionManager } from "../questions/ApiQuestionManager"
import {
	Choice,
	TextPromptOptions,
	PasswordPromptOptions,
	ConfirmPromptOptions,
	SelectPromptOptions,
	MultiSelectPromptOptions,
	NumberPromptOptions,
	PromptResult,
} from "../../cli/types/prompt-types"

/**
 * SSE-based PromptManager that implements the same interface as CLI PromptManager
 * but uses SSE streams to send questions and API endpoints to collect answers
 */
export class SSEPromptManager {
	private questionCounter = 0

	constructor(
		private sseAdapter: SSEOutputAdapter,
		private questionManager: ApiQuestionManager,
		private jobId: string,
	) {}

	/**
	 * Prompt for text input via SSE
	 */
	async promptText(options: TextPromptOptions): Promise<string> {
		// Create question in ApiQuestionManager
		const result = await this.questionManager.createQuestion(
			this.jobId,
			options.message,
			[], // No suggestions for text input
		)

		// Send question via SSE
		const questionEvent = {
			type: "question",
			questionId: result.questionId,
			questionType: "input",
			question: options.message,
			placeholder: options.default,
			timestamp: new Date().toISOString(),
		}

		await this.sseAdapter.log(`QUESTION_EVENT: ${JSON.stringify(questionEvent)}`)

		// Block until client responds
		return result.promise
	}

	/**
	 * Prompt for password input via SSE
	 */
	async promptPassword(options: PasswordPromptOptions): Promise<string> {
		const result = await this.questionManager.createQuestion(this.jobId, options.message, [])

		const questionEvent = {
			type: "question",
			questionId: result.questionId,
			questionType: "password",
			question: options.message,
			password: true,
			timestamp: new Date().toISOString(),
		}

		await this.sseAdapter.log(`QUESTION_EVENT: ${JSON.stringify(questionEvent)}`)
		return result.promise
	}

	/**
	 * Prompt for confirmation (yes/no) via SSE
	 */
	async promptConfirm(options: ConfirmPromptOptions): Promise<boolean> {
		const suggestions = [{ answer: "Yes" }, { answer: "No" }]

		const result = await this.questionManager.createQuestion(this.jobId, options.message, suggestions)

		const questionEvent = {
			type: "question",
			questionId: result.questionId,
			questionType: "confirmation",
			question: options.message,
			choices: ["Yes", "No"],
			yesText: "Yes",
			noText: "No",
			timestamp: new Date().toISOString(),
		}

		await this.sseAdapter.log(`QUESTION_EVENT: ${JSON.stringify(questionEvent)}`)

		const answer = await result.promise
		return answer.toLowerCase() === "yes"
	}

	/**
	 * Prompt for single selection from list via SSE
	 */
	async promptSelect(options: SelectPromptOptions): Promise<string> {
		// Convert choices to suggestions format
		const suggestions = options.choices.map((choice) => ({
			answer: typeof choice === "string" ? choice : choice.value,
		}))

		const result = await this.questionManager.createQuestion(this.jobId, options.message, suggestions)

		// Convert choices for SSE event
		const choices = options.choices.map((choice) => {
			if (typeof choice === "string") {
				return choice
			}
			return choice.name || choice.value
		})

		const questionEvent = {
			type: "question",
			questionId: result.questionId,
			questionType: "select",
			question: options.message,
			choices,
			defaultChoice: options.default,
			timestamp: new Date().toISOString(),
		}

		await this.sseAdapter.log(`QUESTION_EVENT: ${JSON.stringify(questionEvent)}`)
		return result.promise
	}

	/**
	 * Prompt for multiple selections from list via SSE
	 */
	async promptMultiSelect(options: MultiSelectPromptOptions): Promise<string[]> {
		const suggestions = options.choices.map((choice) => ({
			answer: typeof choice === "string" ? choice : choice.value,
		}))

		const result = await this.questionManager.createQuestion(this.jobId, options.message, suggestions)

		const choices = options.choices.map((choice) => {
			if (typeof choice === "string") {
				return choice
			}
			return choice.name || choice.value
		})

		const questionEvent = {
			type: "question",
			questionId: result.questionId,
			questionType: "multiselect",
			question: options.message,
			choices,
			defaultChoices: options.default,
			timestamp: new Date().toISOString(),
		}

		await this.sseAdapter.log(`QUESTION_EVENT: ${JSON.stringify(questionEvent)}`)

		const answer = await result.promise
		// Parse comma-separated values or JSON array
		try {
			return JSON.parse(answer)
		} catch {
			return answer
				.split(",")
				.map((s: string) => s.trim())
				.filter((s: string) => s.length > 0)
		}
	}

	/**
	 * Prompt for number input via SSE
	 */
	async promptNumber(options: NumberPromptOptions): Promise<number> {
		const result = await this.questionManager.createQuestion(this.jobId, options.message, [])

		const questionEvent = {
			type: "question",
			questionId: result.questionId,
			questionType: "number",
			question: options.message,
			defaultValue: options.default?.toString(),
			min: options.min,
			max: options.max,
			timestamp: new Date().toISOString(),
		}

		await this.sseAdapter.log(`QUESTION_EVENT: ${JSON.stringify(questionEvent)}`)

		const answer = await result.promise
		const num = parseFloat(answer)

		if (isNaN(num)) {
			throw new Error(`Invalid number input: ${answer}`)
		}

		return num
	}

	/**
	 * Prompt with custom questions via SSE
	 */
	async promptCustom(questions: any[]): Promise<PromptResult> {
		const results: PromptResult = {}

		// Process each question sequentially
		for (const q of questions) {
			const name = q.name || `question_${Date.now()}`

			const result = await this.questionManager.createQuestion(
				this.jobId,
				q.message,
				q.choices ? q.choices.map((c: any) => ({ answer: c.value || c })) : [],
			)

			const questionEvent = {
				type: "question",
				questionId: result.questionId,
				questionType: q.type || "input",
				question: q.message,
				choices: q.choices,
				defaultValue: q.default,
				timestamp: new Date().toISOString(),
			}

			await this.sseAdapter.log(`QUESTION_EVENT: ${JSON.stringify(questionEvent)}`)

			const answer = await result.promise
			await this.sseAdapter.log(`ANSWER_RECEIVED: ${JSON.stringify({ name, answer })}`)
			results[name] = answer
		}

		return results
	}

	/**
	 * Prompt for API key with validation via SSE
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
	 * Prompt for model selection with categories via SSE
	 */
	async promptModelSelection(models: Record<string, string[]>): Promise<string> {
		const choices: Choice[] = []

		Object.entries(models).forEach(([category, modelList]) => {
			// Add category separator
			choices.push({
				name: `--- ${category} ---`,
				value: `separator_${category}`,
				disabled: true,
			})

			// Add models in this category
			modelList.forEach((model) => {
				choices.push({
					name: model,
					value: model,
				})
			})
		})

		return await this.promptSelect({
			message: "Select a model:",
			choices,
		})
	}

	/**
	 * Prompt for configuration setup via SSE
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

		// Note: For simplicity, just getting basic info
		// Full implementation would have provider-specific model lists
		const model = await this.promptText({
			message: "Enter model name:",
			default: provider === "openai" ? "gpt-4" : "claude-3-sonnet-20240229",
		})

		const apiKey = await this.promptApiKey(provider)

		let baseUrl: string | undefined
		if (provider === "other" || provider === "ollama") {
			baseUrl = await this.promptText({
				message: "Enter base URL:",
			})
		}

		return { provider, model, apiKey, baseUrl }
	}

	/**
	 * Generate unique question ID
	 */
	private generateQuestionId(): string {
		return `sse_prompt_${Date.now()}_${++this.questionCounter}`
	}

	/**
	 * Format choices for inquirer compatibility
	 */
	private formatChoices(choices: Choice[]): Choice[] {
		return choices.map((choice) => {
			if (typeof choice === "string") {
				return {
					name: choice,
					value: choice,
				}
			}
			return choice
		})
	}
}
