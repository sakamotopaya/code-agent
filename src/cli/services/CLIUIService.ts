import boxen from "boxen"
import {
	IUserInterface,
	MessageOptions,
	QuestionOptions,
	ConfirmationOptions,
	InputOptions,
	LogLevel,
	WebviewContent,
	WebviewOptions,
} from "../../core/interfaces/IUserInterface"
import { ColorManager } from "./ColorManager"
import { TableFormatter } from "./TableFormatter"
import { PromptManager } from "./PromptManager"
import { ProgressIndicatorFactory, SpinnerWrapper, ProgressBarWrapper } from "./ProgressIndicator"
import {
	ISpinner,
	IProgressBar,
	ChalkColor,
	BoxOptions,
	TableData,
	TableOptions,
	TableColumn,
	ColorScheme,
	DEFAULT_COLOR_SCHEME,
} from "../types/ui-types"
import {
	Choice,
	TextPromptOptions,
	PasswordPromptOptions,
	ConfirmPromptOptions,
	SelectPromptOptions,
	MultiSelectPromptOptions,
} from "../types/prompt-types"

export interface ICLIUIService extends IUserInterface {
	// Progress indicators
	showSpinner(message: string): ISpinner
	showProgressBar(total: number, message: string): IProgressBar

	// Colored output
	colorize(text: string, color: ChalkColor): string
	success(message: string): void
	warning(message: string): void
	error(message: string): void
	info(message: string): void

	// Formatted output
	showBox(message: string, options?: BoxOptions): void
	showTable(data: TableData, options?: TableOptions): void

	// Interactive prompts
	promptText(message: string, defaultValue?: string): Promise<string>
	promptPassword(message: string): Promise<string>
	promptConfirm(message: string, defaultValue?: boolean): Promise<boolean>
	promptSelect(message: string, choices: Choice[]): Promise<string>
	promptMultiSelect(message: string, choices: Choice[]): Promise<string[]>
}

export class CLIUIService implements ICLIUIService {
	private colorManager: ColorManager
	private tableFormatter: TableFormatter
	private promptManager: PromptManager
	private currentSpinner?: ISpinner
	private webviewCallbacks: ((message: any) => void)[] = []

	constructor(enableColors: boolean = true, colorScheme?: ColorScheme) {
		this.colorManager = new ColorManager(colorScheme || DEFAULT_COLOR_SCHEME, enableColors)
		this.tableFormatter = new TableFormatter(this.colorManager)
		this.promptManager = new PromptManager(this.colorManager)
	}

	// IUserInterface implementation
	async showInformation(message: string, options?: MessageOptions): Promise<void> {
		console.info(this.colorManager.info(message))
		if (options?.actions && options.actions.length > 0) {
			const action = await this.promptSelect(
				"Choose an action:",
				options.actions.map((a) => ({ name: a, value: a })),
			)
			// Handle action if needed
		}
	}

	async showWarning(message: string, options?: MessageOptions): Promise<void> {
		console.warn(this.colorManager.warning(message))
		if (options?.actions && options.actions.length > 0) {
			const action = await this.promptSelect(
				"Choose an action:",
				options.actions.map((a) => ({ name: a, value: a })),
			)
			// Handle action if needed
		}
	}

	async showError(message: string, options?: MessageOptions): Promise<void> {
		console.error(this.colorManager.error(message))
		if (options?.actions && options.actions.length > 0) {
			const action = await this.promptSelect(
				"Choose an action:",
				options.actions.map((a) => ({ name: a, value: a })),
			)
			// Handle action if needed
		}
	}

	async askQuestion(question: string, options: QuestionOptions): Promise<string | undefined> {
		const choices = options.choices.map((choice) => ({ name: choice, value: choice }))
		return await this.promptSelect(question, choices)
	}

	async askConfirmation(message: string, options?: ConfirmationOptions): Promise<boolean> {
		return await this.promptConfirm(message, undefined)
	}

	async askInput(prompt: string, options?: InputOptions): Promise<string | undefined> {
		if (options?.password) {
			return await this.promptPassword(prompt)
		}
		return await this.promptText(prompt, options?.defaultValue)
	}

	async showProgress(message: string, progress?: number): Promise<void> {
		if (this.currentSpinner) {
			this.currentSpinner.text = message
		} else {
			this.currentSpinner = this.showSpinner(message)
			this.currentSpinner.start()
		}
	}

	async clearProgress(): Promise<void> {
		if (this.currentSpinner) {
			this.currentSpinner.stop()
			this.currentSpinner = undefined
		}
	}

	async log(message: string, level?: LogLevel): Promise<void> {
		switch (level) {
			case LogLevel.DEBUG:
				console.debug(this.colorManager.muted(`[DEBUG] ${message}`))
				break
			case LogLevel.INFO:
				console.info(this.colorManager.info(`[INFO] ${message}`))
				break
			case LogLevel.WARN:
				console.warn(this.colorManager.warning(`[WARN] ${message}`))
				break
			case LogLevel.ERROR:
				console.error(this.colorManager.error(`[ERROR] ${message}`))
				break
			default:
				console.log(this.colorManager.primary(message))
		}
	}

	async showWebview(content: WebviewContent, options?: WebviewOptions): Promise<void> {
		// CLI doesn't support webviews, so we'll just log the content
		this.showWarning("Webview content not supported in CLI mode")
		if (content.html) {
			console.log(this.colorManager.muted("HTML content would be displayed in webview"))
		}
		if (content.data) {
			console.log(this.colorManager.muted("Data:"), JSON.stringify(content.data, null, 2))
		}
	}

	async sendWebviewMessage(message: any): Promise<void> {
		// CLI doesn't support webviews, simulate message handling
		this.webviewCallbacks.forEach((callback) => callback(message))
	}

	onWebviewMessage(callback: (message: any) => void): void {
		this.webviewCallbacks.push(callback)
	}

	// Progress indicators
	showSpinner(message: string): ISpinner {
		return ProgressIndicatorFactory.createSpinner(message)
	}

	showProgressBar(total: number, message: string = "Processing..."): IProgressBar {
		return ProgressIndicatorFactory.createProgressBar({ total, message })
	}

	// Colored output
	colorize(text: string, color: ChalkColor): string {
		return this.colorManager.colorize(text, color)
	}

	success(message: string): void {
		console.log(this.colorManager.success(message))
	}

	warning(message: string): void {
		console.warn(this.colorManager.warning(message))
	}

	error(message: string): void {
		console.error(this.colorManager.error(message))
	}

	info(message: string): void {
		console.info(this.colorManager.info(message))
	}

	// Formatted output
	showBox(message: string, options: BoxOptions = {}): void {
		const boxOptions: any = {
			padding: options.padding || 1,
			margin: options.margin || 0,
			borderStyle: options.borderStyle || "single",
			textAlignment: options.textAlignment || "left",
			width: options.width,
			float: options.float,
		}

		if (options.title) {
			boxOptions.title = options.title
		}

		if (options.borderColor && this.colorManager.isColorsEnabled()) {
			boxOptions.borderColor = options.borderColor
		}

		if (options.backgroundColor && this.colorManager.isColorsEnabled()) {
			boxOptions.backgroundColor = options.backgroundColor
		}

		const boxedMessage = boxen(message, boxOptions)
		console.log(boxedMessage)
	}

	showTable(data: TableData, options: TableOptions = {}): void {
		const formattedTable = this.tableFormatter.formatTable(data, options)
		console.log(formattedTable)
	}

	// Interactive prompts
	async promptText(message: string, defaultValue?: string): Promise<string> {
		return await this.promptManager.promptText({ message, default: defaultValue })
	}

	async promptPassword(message: string): Promise<string> {
		return await this.promptManager.promptPassword({ message })
	}

	async promptConfirm(message: string, defaultValue?: boolean): Promise<boolean> {
		return await this.promptManager.promptConfirm({ message, default: defaultValue })
	}

	async promptSelect(message: string, choices: Choice[]): Promise<string> {
		return await this.promptManager.promptSelect({ message, choices })
	}

	async promptMultiSelect(message: string, choices: Choice[]): Promise<string[]> {
		return await this.promptManager.promptMultiSelect({ message, choices })
	}

	// Advanced UI methods
	/**
	 * Show a key-value table
	 */
	showKeyValueTable(data: Record<string, any>, title?: string): void {
		if (title) {
			this.showBox(title, { borderStyle: "double", textAlignment: "center" })
		}
		const formattedTable = this.tableFormatter.formatKeyValueTable(data)
		console.log(formattedTable)
	}

	/**
	 * Show a columnar table with custom columns
	 */
	showColumnarTable(data: Array<Record<string, any>>, columns: TableColumn[], title?: string): void {
		if (title) {
			this.showBox(title, { borderStyle: "double", textAlignment: "center" })
		}
		const formattedTable = this.tableFormatter.formatColumnarTable(data, columns)
		console.log(formattedTable)
	}

	/**
	 * Show a comparison table
	 */
	showComparisonTable(before: Record<string, any>, after: Record<string, any>, title?: string): void {
		if (title) {
			this.showBox(title, { borderStyle: "double", textAlignment: "center" })
		}
		const formattedTable = this.tableFormatter.formatComparisonTable(before, after)
		console.log(formattedTable)
	}

	/**
	 * Show a success box
	 */
	showSuccessBox(message: string, title?: string): void {
		this.showBox(this.colorManager.success(message), {
			title: title || "Success",
			borderStyle: "double",
			borderColor: "green",
			textAlignment: "center",
		})
	}

	/**
	 * Show an error box
	 */
	showErrorBox(message: string, title?: string): void {
		this.showBox(this.colorManager.error(message), {
			title: title || "Error",
			borderStyle: "double",
			borderColor: "red",
			textAlignment: "center",
		})
	}

	/**
	 * Show a warning box
	 */
	showWarningBox(message: string, title?: string): void {
		this.showBox(this.colorManager.warning(message), {
			title: title || "Warning",
			borderStyle: "double",
			borderColor: "yellow",
			textAlignment: "center",
		})
	}

	/**
	 * Show an info box
	 */
	showInfoBox(message: string, title?: string): void {
		this.showBox(this.colorManager.info(message), {
			title: title || "Information",
			borderStyle: "single",
			borderColor: "blue",
			textAlignment: "center",
		})
	}

	/**
	 * Clear the screen
	 */
	clearScreen(): void {
		console.clear()
	}

	/**
	 * Print a separator line
	 */
	showSeparator(char: string = "─", length: number = 80): void {
		console.log(this.colorManager.muted(char.repeat(length)))
	}

	/**
	 * Show a formatted header
	 */
	showHeader(title: string, subtitle?: string): void {
		const headerText = subtitle ? `${title}\n${subtitle}` : title
		this.showBox(headerText, {
			title: "Roo CLI",
			borderStyle: "double",
			borderColor: "cyan",
			textAlignment: "center",
			padding: 1,
			margin: 1,
		})
	}

	/**
	 * Show loading with dots animation
	 */
	showLoadingDots(message: string, duration: number = 3000): Promise<void> {
		return new Promise((resolve) => {
			let dots = ""
			const interval = setInterval(() => {
				dots = dots.length >= 3 ? "" : dots + "."
				process.stdout.write(`\r${this.colorManager.info(message)}${dots}   `)
			}, 500)

			setTimeout(() => {
				clearInterval(interval)
				process.stdout.write("\r" + " ".repeat(message.length + 6) + "\r")
				resolve()
			}, duration)
		})
	}

	/**
	 * Configure color scheme
	 */
	setColorScheme(scheme: Partial<ColorScheme>): void {
		this.colorManager.setColorScheme(scheme)
	}

	/**
	 * Enable or disable colors
	 */
	setColorsEnabled(enabled: boolean): void {
		this.colorManager.setColorsEnabled(enabled)
	}

	/**
	 * Get color manager for advanced color operations
	 */
	getColorManager(): ColorManager {
		return this.colorManager
	}

	/**
	 * Get table formatter for advanced table operations
	 */
	getTableFormatter(): TableFormatter {
		return this.tableFormatter
	}

	/**
	 * Get prompt manager for advanced prompt operations
	 */
	getPromptManager(): PromptManager {
		return this.promptManager
	}
}
