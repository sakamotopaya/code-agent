import inquirer from "inquirer"
import chalk from "chalk"
import ora, { Ora } from "ora"
import {
	IUserInterface,
	MessageOptions,
	QuestionOptions,
	ConfirmationOptions,
	InputOptions,
	LogLevel,
	WebviewContent,
	WebviewOptions,
} from "../../interfaces"

/**
 * CLI implementation of the IUserInterface
 * Provides terminal-based user interactions using inquirer, chalk, and ora
 */
export class CliUserInterface implements IUserInterface {
	private isInteractive: boolean
	private currentSpinner: Ora | null = null

	constructor(isInteractive: boolean = true) {
		this.isInteractive = isInteractive
	}

	async showInformation(message: string, options?: MessageOptions): Promise<void> {
		const coloredMessage = chalk.blue(`ℹ ${message}`)
		console.log(coloredMessage)

		if (options?.actions && options.actions.length > 0 && this.isInteractive) {
			const { action } = await inquirer.prompt([
				{
					type: "list",
					name: "action",
					message: "Choose an action:",
					choices: options.actions,
				},
			])
			return action
		}
	}

	async showWarning(message: string, options?: MessageOptions): Promise<void> {
		const coloredMessage = chalk.yellow(`⚠ ${message}`)
		console.log(coloredMessage)

		if (options?.actions && options.actions.length > 0 && this.isInteractive) {
			const { action } = await inquirer.prompt([
				{
					type: "list",
					name: "action",
					message: "Choose an action:",
					choices: options.actions,
				},
			])
			return action
		}
	}

	async showError(message: string, options?: MessageOptions): Promise<void> {
		const coloredMessage = chalk.red(`✖ ${message}`)
		console.error(coloredMessage)

		if (options?.actions && options.actions.length > 0 && this.isInteractive) {
			const { action } = await inquirer.prompt([
				{
					type: "list",
					name: "action",
					message: "Choose an action:",
					choices: options.actions,
				},
			])
			return action
		}
	}

	async askQuestion(question: string, options: QuestionOptions): Promise<string | undefined> {
		if (!this.isInteractive) {
			throw new Error("Cannot ask questions in non-interactive mode")
		}

		const { answer } = await inquirer.prompt([
			{
				type: "list",
				name: "answer",
				message: question,
				choices: options.choices,
				default: options.defaultChoice,
			},
		])

		return answer
	}

	async askConfirmation(message: string, options?: ConfirmationOptions): Promise<boolean> {
		if (!this.isInteractive) {
			throw new Error("Cannot ask for confirmation in non-interactive mode")
		}

		const { confirmed } = await inquirer.prompt([
			{
				type: "confirm",
				name: "confirmed",
				message: message,
				default: false,
			},
		])

		return confirmed
	}

	async askInput(prompt: string, options?: InputOptions): Promise<string | undefined> {
		if (!this.isInteractive) {
			throw new Error("Cannot ask for input in non-interactive mode")
		}

		const promptConfig: any = {
			type: options?.password ? "password" : "input",
			name: "input",
			message: prompt,
			default: options?.defaultValue,
		}

		if (options?.validate) {
			promptConfig.validate = (input: string) => {
				const validation = options.validate!(input)
				return validation || true
			}
		}

		const { input } = await inquirer.prompt([promptConfig])
		return input
	}

	async showProgress(message: string, progress?: number): Promise<void> {
		if (this.currentSpinner) {
			this.currentSpinner.stop()
		}

		const displayMessage = progress !== undefined ? `${message} (${progress}%)` : message

		this.currentSpinner = ora(displayMessage).start()
	}

	async clearProgress(): Promise<void> {
		if (this.currentSpinner) {
			this.currentSpinner.stop()
			this.currentSpinner = null
		}
	}

	async log(message: string, level?: LogLevel): Promise<void> {
		const timestamp = new Date().toISOString()
		let coloredMessage: string

		switch (level) {
			case "debug":
				coloredMessage = chalk.gray(`[${timestamp}] DEBUG: ${message}`)
				break
			case "info":
				coloredMessage = chalk.blue(`[${timestamp}] INFO: ${message}`)
				break
			case "warn":
				coloredMessage = chalk.yellow(`[${timestamp}] WARN: ${message}`)
				break
			case "error":
				coloredMessage = chalk.red(`[${timestamp}] ERROR: ${message}`)
				break
			default:
				coloredMessage = `[${timestamp}] ${message}`
		}

		console.log(coloredMessage)
	}

	async showWebview(content: WebviewContent, options?: WebviewOptions): Promise<void> {
		// In CLI environment, we can't show actual webviews
		// Instead, we'll show a message indicating webview content is available
		const message = options?.title ? `Webview content available: ${options.title}` : "Webview content available"

		console.log(chalk.cyan(`🌐 ${message}`))

		if (content.html && this.isInteractive) {
			const { viewContent } = await inquirer.prompt([
				{
					type: "confirm",
					name: "viewContent",
					message: "Would you like to view the HTML content?",
					default: false,
				},
			])

			if (viewContent) {
				console.log(chalk.dim("--- HTML Content ---"))
				console.log(content.html)
				console.log(chalk.dim("--- End HTML Content ---"))
			}
		}
	}

	async sendWebviewMessage(message: any): Promise<void> {
		// In CLI environment, we'll just log the message that would be sent to webview
		console.log(chalk.dim(`📤 Webview message: ${JSON.stringify(message)}`))
	}

	onWebviewMessage(callback: (message: any) => void): void {
		// In CLI environment, webview messages are not supported
		// We'll log that the listener was registered but won't actually listen
		console.log(chalk.dim("📥 Webview message listener registered (CLI mode - no actual messages)"))
	}
}
