/**
 * QuestionEventHandler - AC-002: Question Event Handler Infrastructure
 *
 * Manages question processing state, queuing, and coordination with answer submission.
 * Integrates with StreamProcessor to pause/resume stream processing during questions.
 */

import { QuestionEventData, QuestionHandlerState, ApiClientOptions } from "./types/api-client-types"
import inquirer from "inquirer"

export class QuestionEventHandler {
	private static instance: QuestionEventHandler | null = null
	private state: QuestionHandlerState
	private options: ApiClientOptions
	private baseUrl: string
	private processedQuestions = new Set<string>()

	constructor(options: ApiClientOptions) {
		this.options = options
		this.baseUrl = `http://${options.host}:${options.port}`
		this.state = {
			currentQuestion: null,
			isProcessing: false,
			questionQueue: [],
		}
	}

	/**
	 * Get singleton instance (creates with default options if not exists)
	 */
	static getInstance(options?: ApiClientOptions): QuestionEventHandler {
		if (!QuestionEventHandler.instance) {
			if (!options) {
				// Default options for singleton
				options = {
					useStream: true,
					host: "localhost",
					port: 3000,
					mode: "code",
					restartTask: false,
					replMode: false,
					verbose: false,
					showThinking: false,
					showTools: false,
					showSystem: false,
					showResponse: false,
					showCompletion: false,
					showMcpUse: false,
					showTokenUsage: false,
					hideTokenUsage: false,
					showTiming: false,
					logSystemPrompt: false,
					logLlm: false,
				}
			}
			QuestionEventHandler.instance = new QuestionEventHandler(options)
		}
		return QuestionEventHandler.instance
	}

	/**
	 * Reset singleton instance (useful for testing)
	 */
	static resetInstance(): void {
		QuestionEventHandler.instance = null
	}

	/**
	 * Handle a question event from the SSE stream
	 * AC-007: Enhanced error handling and edge cases
	 */
	async handleQuestionEvent(questionData: QuestionEventData): Promise<void> {
		try {
			// AC-007.1: Comprehensive question data validation
			const validationResult = this.validateQuestionData(questionData)
			if (!validationResult.isValid) {
				throw new Error(`Invalid question data: ${validationResult.errors.join(", ")}`)
			}

			// AC-007.4: Check for duplicate questions
			if (this.isDuplicateQuestion(questionData.questionId)) {
				if (this.options.verbose) {
					console.log(`⚠️  Duplicate question detected: ${questionData.questionId}`)
				}
				return
			}

			// AC-007.3: Handle rapid fire questions (queue management)
			if (this.state.isProcessing) {
				this.addToQueue(questionData)
				if (this.options.verbose) {
					console.log(
						`⏳ Question queued (${this.state.questionQueue.length} in queue): ${questionData.questionId}`,
					)
				}
				return
			}

			// AC-007.4: Handle questions with very long text or large choice lists
			this.validateQuestionSize(questionData)

			await this.processQuestion(questionData)
		} catch (error) {
			this.handleQuestionError(error, questionData)
		}
	}

	/**
	 * Process a single question
	 */
	async processQuestion(questionData: QuestionEventData, verbose?: boolean): Promise<void> {
		// Use provided verbose or fall back to instance options
		const useVerbose = verbose !== undefined ? verbose : this.options.verbose
		this.state.isProcessing = true
		this.state.currentQuestion = questionData

		// Add to processed questions set
		this.addToProcessedQuestions(questionData.questionId)

		try {
			if (useVerbose) {
				console.log(`🤔 Processing ${questionData.questionType} question: ${questionData.questionId}`)
			}

			// Present question to user
			const answer = await this.presentQuestion(questionData)

			// Submit answer to server
			console.log("📤 Submitting answer...")
			await this.submitAnswer(questionData.questionId, answer)

			console.log("✅ Question completed successfully")
		} catch (error) {
			console.error(`❌ Question processing failed: ${error}`)
			throw error
		} finally {
			this.state.isProcessing = false
			this.state.currentQuestion = null

			// Process next queued question
			if (this.state.questionQueue.length > 0) {
				const nextQuestion = this.state.questionQueue.shift()!
				setImmediate(() => this.processQuestion(nextQuestion))
			}
		}
	}

	/**
	 * Present question to user using appropriate interactive prompt
	 * AC-003: Select questions, AC-004: Input questions, AC-005: Confirmation questions
	 */
	private async presentQuestion(questionData: QuestionEventData): Promise<string> {
		console.log("") // Add spacing before question

		switch (questionData.questionType) {
			case "select":
				return await this.presentSelectQuestion(questionData)
			case "input":
				return await this.presentInputQuestion(questionData)
			case "confirmation":
				return await this.presentConfirmationQuestion(questionData)
			default:
				throw new Error(`Unsupported question type: ${questionData.questionType}`)
		}
	}

	/**
	 * AC-003: Present interactive select question using inquirer.js list prompt
	 */
	private async presentSelectQuestion(questionData: QuestionEventData): Promise<string> {
		if (!questionData.choices || !Array.isArray(questionData.choices) || questionData.choices.length === 0) {
			throw new Error("Select questions must have choices array")
		}

		// Check for custom answer option
		const hasCustomOption = questionData.choices.some(
			(choice) => choice.toLowerCase().includes("custom") || choice.includes("(") || choice.includes("Other"),
		)

		try {
			const answer = await inquirer.prompt([
				{
					type: "list",
					name: "selection",
					message: questionData.question,
					choices: questionData.choices,
					pageSize: Math.min(10, questionData.choices.length + 2), // Limit visible choices
				},
			])

			const selectedChoice = answer.selection

			// Handle custom answer option
			if (
				hasCustomOption &&
				(selectedChoice.toLowerCase().includes("custom") ||
					selectedChoice.includes("(") ||
					selectedChoice.toLowerCase().includes("other"))
			) {
				// Prompt for custom input
				const customAnswer = await inquirer.prompt([
					{
						type: "input",
						name: "customValue",
						message: "Please enter your custom answer:",
						validate: (input: string) => {
							return input.trim().length > 0 || "Please enter a valid answer"
						},
					},
				])

				return customAnswer.customValue.trim()
			}

			// For regular choices, return the zero-based index
			const choiceIndex = questionData.choices.indexOf(selectedChoice)
			if (choiceIndex === -1) {
				throw new Error(`Selected choice "${selectedChoice}" not found in choices array`)
			}

			return choiceIndex.toString()
		} catch (error) {
			// Handle Ctrl+C or other cancellation
			if (error && typeof error === "object" && "isTtyError" in error) {
				throw new Error("Question prompt was cancelled by user")
			}
			throw error
		}
	}

	/**
	 * AC-004: Present interactive input question using inquirer.js input prompt
	 */
	private async presentInputQuestion(questionData: QuestionEventData): Promise<string> {
		try {
			const promptConfig: any = {
				type: "input",
				name: "userInput",
				message: questionData.question,
				validate: (input: string) => {
					const trimmed = input.trim()

					// Check if input is required (assume required by default)
					if (trimmed.length === 0) {
						return "Please enter a valid answer (input cannot be empty)"
					}

					// Basic length validation (reasonable limits)
					if (trimmed.length > 500) {
						return "Input is too long (maximum 500 characters)"
					}

					return true
				},
				filter: (input: string) => {
					// Trim whitespace from input
					return input.trim()
				},
			}

			// Add default value if provided in question data
			if (questionData.defaultValue) {
				promptConfig.default = questionData.defaultValue
			}

			// Add placeholder if available (for display purposes)
			if (questionData.placeholder) {
				promptConfig.message = `${questionData.question} ${questionData.placeholder}`
			}

			const answer = await inquirer.prompt([promptConfig])
			return answer.userInput
		} catch (error) {
			// Handle Ctrl+C or other cancellation
			if (error && typeof error === "object" && "isTtyError" in error) {
				throw new Error("Input prompt was cancelled by user")
			}
			throw error
		}
	}

	/**
	 * AC-005: Present interactive confirmation question using inquirer.js confirm prompt
	 */
	private async presentConfirmationQuestion(questionData: QuestionEventData): Promise<string> {
		try {
			// Determine default value (typically 'false' for destructive actions, 'true' for proceed actions)
			let defaultValue = true

			// Check for destructive keywords to default to 'false'
			const destructiveKeywords = ["delete", "remove", "destroy", "clear", "reset", "wipe", "erase"]
			const questionLower = questionData.question.toLowerCase()
			if (destructiveKeywords.some((keyword) => questionLower.includes(keyword))) {
				defaultValue = false
			}

			// Override with explicit default if provided
			if (questionData.defaultValue !== undefined) {
				defaultValue = questionData.defaultValue === "true" || questionData.defaultValue === true
			}

			const answer = await inquirer.prompt([
				{
					type: "confirm",
					name: "confirmation",
					message: questionData.question,
					default: defaultValue,
				},
			])

			// Convert boolean response to text format that server expects
			// Check if question data specifies custom yes/no text
			if (questionData.yesText && questionData.noText) {
				return answer.confirmation ? questionData.yesText : questionData.noText
			}

			// Return standard text response
			return answer.confirmation ? "Yes" : "No"
		} catch (error) {
			// Handle Ctrl+C or other cancellation
			if (error && typeof error === "object" && "isTtyError" in error) {
				throw new Error("Confirmation prompt was cancelled by user")
			}
			throw error
		}
	}

	/**
	 * AC-006: Submit answer to server via HTTP POST
	 */
	private async submitAnswer(questionId: string, answer: string): Promise<void> {
		const url = `${this.baseUrl}/api/questions/${questionId}/answer`
		const payload = JSON.stringify({ answer })

		if (this.options.verbose) {
			console.log(`📤 Submitting answer to ${url}`)
			console.log(`   Answer: ${answer}`)
		}

		// Retry configuration
		const maxRetries = 3
		const baseDelay = 1000 // 1 second

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const response = await this.makeHttpRequest(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: payload,
				})

				// Check response status
				if (response.statusCode >= 200 && response.statusCode < 300) {
					if (this.options.verbose) {
						console.log(`✅ Answer submitted successfully (HTTP ${response.statusCode})`)
					}
					return
				} else {
					throw new Error(`HTTP ${response.statusCode}: ${response.body}`)
				}
			} catch (error) {
				const isLastAttempt = attempt === maxRetries
				const errorMessage = error instanceof Error ? error.message : String(error)

				if (this.options.verbose) {
					console.log(`❌ Answer submission attempt ${attempt}/${maxRetries} failed: ${errorMessage}`)
				}

				if (isLastAttempt) {
					throw new Error(`Failed to submit answer after ${maxRetries} attempts: ${errorMessage}`)
				}

				// Exponential backoff: wait before retrying
				const delay = baseDelay * Math.pow(2, attempt - 1)
				if (this.options.verbose) {
					console.log(`⏳ Retrying in ${delay}ms...`)
				}
				await this.sleep(delay)
			}
		}
	}

	/**
	 * Make HTTP request using Node.js built-in modules
	 */
	private async makeHttpRequest(
		url: string,
		options: {
			method: string
			headers: Record<string, string>
			body?: string
		},
	): Promise<{ statusCode: number; body: string }> {
		const https = await import("https")
		const http = await import("http")
		const { URL } = await import("url")

		const parsedUrl = new URL(url)
		const isHttps = parsedUrl.protocol === "https:"
		const client = isHttps ? https : http

		return new Promise((resolve, reject) => {
			const requestOptions = {
				hostname: parsedUrl.hostname,
				port: parsedUrl.port || (isHttps ? 443 : 80),
				path: parsedUrl.pathname + parsedUrl.search,
				method: options.method,
				headers: options.headers,
				timeout: 10000, // 10 second timeout
			}

			const req = client.request(requestOptions, (res) => {
				let body = ""
				res.on("data", (chunk) => (body += chunk))
				res.on("end", () => {
					resolve({
						statusCode: res.statusCode || 0,
						body: body,
					})
				})
			})

			req.on("error", (error) => {
				reject(new Error(`Network error: ${error.message}`))
			})

			req.on("timeout", () => {
				req.destroy()
				reject(new Error("Request timeout"))
			})

			if (options.body) {
				req.write(options.body)
			}

			req.end()
		})
	}

	/**
	 * Validate question data structure
	 */
	private validateQuestionData(data: any): { isValid: boolean; errors: string[] } {
		const errors: string[] = []

		// Basic structure validation
		if (!data || typeof data !== "object") {
			errors.push("Question data must be an object")
			return { isValid: false, errors }
		}

		// Required fields
		if (!data.questionId || typeof data.questionId !== "string") {
			errors.push("questionId is required and must be a string")
		}

		if (!data.questionType || typeof data.questionType !== "string") {
			errors.push("questionType is required and must be a string")
		}

		if (!data.question || typeof data.question !== "string") {
			errors.push("question is required and must be a string")
		}

		// Validate question type
		const validTypes = ["select", "input", "confirmation", "password"]
		if (data.questionType && !validTypes.includes(data.questionType)) {
			errors.push(`questionType must be one of: ${validTypes.join(", ")}`)
		}

		// Type-specific validation
		if (data.questionType === "select") {
			if (!Array.isArray(data.choices) || data.choices.length === 0) {
				errors.push("Select questions must have a non-empty choices array")
			}

			if (data.choices && data.choices.length > 50) {
				errors.push("Too many choices (max 50)")
			}
		}

		// Length validation
		if (data.question && data.question.length > 1000) {
			errors.push("Question text is too long (max 1000 characters)")
		}

		return { isValid: errors.length === 0, errors }
	}
	/**
	 * AC-007.4: Validate question size limits to prevent memory issues
	 */
	private validateQuestionSize(data: QuestionEventData): void {
		const MAX_QUESTION_LENGTH = 1000
		const MAX_CHOICE_COUNT = 50
		const MAX_CHOICE_LENGTH = 200

		// Check question text length
		if (data.question.length > MAX_QUESTION_LENGTH) {
			throw new Error(`Question text too long (${data.question.length} chars, max ${MAX_QUESTION_LENGTH})`)
		}

		// Check choice list size for select questions
		if (data.questionType === "select" && data.choices) {
			if (data.choices.length > MAX_CHOICE_COUNT) {
				throw new Error(`Too many choices (${data.choices.length}, max ${MAX_CHOICE_COUNT})`)
			}

			// Check individual choice length
			for (const choice of data.choices) {
				if (choice.length > MAX_CHOICE_LENGTH) {
					throw new Error(
						`Choice text too long: "${choice.substring(0, 50)}..." (${choice.length} chars, max ${MAX_CHOICE_LENGTH})`,
					)
				}
			}
		}
	}

	/**
	 * Check if question has already been processed
	 */
	private isDuplicateQuestion(questionId: string): boolean {
		return this.processedQuestions.has(questionId)
	}

	/**
	 * Add question to processed set with memory management
	 */
	private addToProcessedQuestions(questionId: string): void {
		this.processedQuestions.add(questionId)

		// Limit size to prevent memory leaks
		if (this.processedQuestions.size > 1000) {
			const oldestEntries = Array.from(this.processedQuestions).slice(0, 500)
			oldestEntries.forEach((id) => this.processedQuestions.delete(id))
		}
	}

	/**
	 * Add question to processing queue
	 */
	private addToQueue(questionData: QuestionEventData): void {
		if (this.state.questionQueue.length >= 10) {
			console.warn("⚠️  Question queue is full, dropping oldest question")
			this.state.questionQueue.shift()
		}

		this.state.questionQueue.push(questionData)

		if (this.options.verbose) {
			console.log(`📝 Question queued: ${questionData.questionId} (${this.state.questionQueue.length} in queue)`)
		}
	}

	/**
	 * Handle question processing errors
	 */
	private handleQuestionError(error: any, questionData?: QuestionEventData): void {
		console.error(`❌ Question handling failed: ${error.message || error}`)

		if (this.options.verbose) {
			console.error(`   Stack: ${error.stack}`)
			if (questionData) {
				console.error(`   Question data: ${JSON.stringify(questionData, null, 2)}`)
			}
		}
	}

	/**
	 * Utility sleep function
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	/**
	 * Public getters for state inspection
	 */
	public isProcessing(): boolean {
		return this.state.isProcessing
	}

	public getCurrentQuestion(): QuestionEventData | null {
		return this.state.currentQuestion
	}

	public getQueueLength(): number {
		return this.state.questionQueue.length
	}
}
