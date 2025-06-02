import * as vscode from "vscode"
import {
	IUserInterface,
	MessageOptions,
	QuestionOptions,
	ConfirmationOptions,
	InputOptions,
	LogLevel,
	WebviewContent,
	WebviewOptions,
} from "../../interfaces/IUserInterface"

/**
 * VS Code implementation of the IUserInterface interface.
 * Provides user interaction capabilities using VS Code's native UI components.
 */
export class VsCodeUserInterface implements IUserInterface {
	private outputChannel: vscode.OutputChannel
	private webviewPanel?: vscode.WebviewPanel
	private webviewMessageCallback?: (message: any) => void

	constructor(private context: vscode.ExtensionContext) {
		this.outputChannel = vscode.window.createOutputChannel("Roo Code Agent")
	}

	async showInformation(message: string, options?: MessageOptions): Promise<void> {
		if (options?.actions && options.actions.length > 0) {
			await vscode.window.showInformationMessage(message, ...options.actions)
		} else {
			await vscode.window.showInformationMessage(message)
		}
	}

	async showWarning(message: string, options?: MessageOptions): Promise<void> {
		if (options?.actions && options.actions.length > 0) {
			await vscode.window.showWarningMessage(message, ...options.actions)
		} else {
			await vscode.window.showWarningMessage(message)
		}
	}

	async showError(message: string, options?: MessageOptions): Promise<void> {
		if (options?.actions && options.actions.length > 0) {
			await vscode.window.showErrorMessage(message, ...options.actions)
		} else {
			await vscode.window.showErrorMessage(message)
		}
	}

	async askQuestion(question: string, options: QuestionOptions): Promise<string | undefined> {
		const quickPickOptions: vscode.QuickPickOptions = {
			placeHolder: question,
			canPickMany: false,
		}

		const items = options.choices.map((choice) => ({
			label: choice,
			picked: choice === options.defaultChoice,
		}))

		const selected = await vscode.window.showQuickPick(items, quickPickOptions)
		return selected?.label
	}

	async askConfirmation(message: string, options?: ConfirmationOptions): Promise<boolean> {
		const yesText = options?.yesText || "Yes"
		const noText = options?.noText || "No"

		const result = await vscode.window.showInformationMessage(message, { modal: options?.modal }, yesText, noText)

		return result === yesText
	}

	async askInput(prompt: string, options?: InputOptions): Promise<string | undefined> {
		const inputBoxOptions: vscode.InputBoxOptions = {
			prompt,
			placeHolder: options?.placeholder,
			value: options?.defaultValue,
			password: options?.password,
			validateInput: options?.validate,
		}

		return await vscode.window.showInputBox(inputBoxOptions)
	}

	async showProgress(message: string, progress?: number): Promise<void> {
		// For simple progress display, we'll use the status bar
		if (progress !== undefined) {
			vscode.window.setStatusBarMessage(`${message} (${progress}%)`, 2000)
		} else {
			vscode.window.setStatusBarMessage(message, 2000)
		}
	}

	async clearProgress(): Promise<void> {
		// Clear status bar message
		vscode.window.setStatusBarMessage("")
	}

	async log(message: string, level: LogLevel = LogLevel.INFO): Promise<void> {
		const timestamp = new Date().toISOString()
		const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`

		this.outputChannel.appendLine(logMessage)

		// Show output channel for errors
		if (level === LogLevel.ERROR) {
			this.outputChannel.show(true)
		}
	}

	async showWebview(content: WebviewContent, options?: WebviewOptions): Promise<void> {
		// Dispose existing webview if any
		if (this.webviewPanel) {
			this.webviewPanel.dispose()
		}

		// Create new webview panel
		this.webviewPanel = vscode.window.createWebviewPanel(
			"rooCodeAgent",
			options?.title || "Roo Code Agent",
			vscode.ViewColumn.One,
			{
				enableScripts: options?.enableScripts ?? true,
				retainContextWhenHidden: options?.retainContextWhenHidden ?? true,
				localResourceRoots: options?.localResourceRoots?.map((root) => vscode.Uri.file(root)),
			},
		)

		// Build HTML content
		let htmlContent = content.html || ""

		if (content.style) {
			htmlContent = `<style>${content.style}</style>${htmlContent}`
		}

		if (content.script) {
			htmlContent += `<script>${content.script}</script>`
		}

		// Set webview content
		this.webviewPanel.webview.html = htmlContent

		// Handle messages from webview
		this.webviewPanel.webview.onDidReceiveMessage(
			(message) => {
				if (this.webviewMessageCallback) {
					this.webviewMessageCallback(message)
				}
			},
			undefined,
			this.context.subscriptions,
		)

		// Send initial data if provided
		if (content.data) {
			await this.sendWebviewMessage(content.data)
		}
	}

	async sendWebviewMessage(message: any): Promise<void> {
		if (this.webviewPanel) {
			await this.webviewPanel.webview.postMessage(message)
		}
	}

	onWebviewMessage(callback: (message: any) => void): void {
		this.webviewMessageCallback = callback
	}

	/**
	 * Dispose of resources
	 */
	dispose(): void {
		this.outputChannel.dispose()
		if (this.webviewPanel) {
			this.webviewPanel.dispose()
		}
	}
}
