/**
 * Interface for user interaction abstraction.
 * Provides methods for displaying information, asking questions, and handling user input
 * in both VS Code extension and CLI environments.
 */
export interface IUserInterface {
	/**
	 * Display an informational message to the user
	 * @param message The message to display
	 * @param options Optional display options
	 */
	showInformation(message: string, options?: MessageOptions): Promise<void>

	/**
	 * Display a warning message to the user
	 * @param message The warning message to display
	 * @param options Optional display options
	 */
	showWarning(message: string, options?: MessageOptions): Promise<void>

	/**
	 * Display an error message to the user
	 * @param message The error message to display
	 * @param options Optional display options
	 */
	showError(message: string, options?: MessageOptions): Promise<void>

	/**
	 * Ask the user a question and wait for their response
	 * @param question The question to ask
	 * @param options Available response options
	 * @returns The user's selected response
	 */
	askQuestion(question: string, options: QuestionOptions): Promise<string | undefined>

	/**
	 * Ask the user for confirmation (yes/no)
	 * @param message The confirmation message
	 * @param options Optional confirmation options
	 * @returns True if user confirms, false otherwise
	 */
	askConfirmation(message: string, options?: ConfirmationOptions): Promise<boolean>

	/**
	 * Ask the user for text input
	 * @param prompt The input prompt
	 * @param options Optional input options
	 * @returns The user's input text
	 */
	askInput(prompt: string, options?: InputOptions): Promise<string | undefined>

	/**
	 * Display progress information to the user
	 * @param message The progress message
	 * @param progress Progress percentage (0-100)
	 */
	showProgress(message: string, progress?: number): Promise<void>

	/**
	 * Clear any displayed progress
	 */
	clearProgress(): Promise<void>

	/**
	 * Log a message to the output/console
	 * @param message The message to log
	 * @param level The log level
	 */
	log(message: string, level?: LogLevel): Promise<void>

	/**
	 * Display content in a webview or equivalent interface
	 * @param content The content to display
	 * @param options Optional webview options
	 */
	showWebview(content: WebviewContent, options?: WebviewOptions): Promise<void>

	/**
	 * Send a message to the webview
	 * @param message The message to send
	 */
	sendWebviewMessage(message: any): Promise<void>

	/**
	 * Listen for messages from the webview
	 * @param callback The callback to handle received messages
	 */
	onWebviewMessage(callback: (message: any) => void): void
}

/**
 * Options for displaying messages
 */
export interface MessageOptions {
	/** Whether the message should be modal */
	modal?: boolean
	/** Additional actions the user can take */
	actions?: string[]
}

/**
 * Options for asking questions
 */
export interface QuestionOptions {
	/** Available response options */
	choices: string[]
	/** Default selection */
	defaultChoice?: string
	/** Whether the question is modal */
	modal?: boolean
}

/**
 * Options for confirmation dialogs
 */
export interface ConfirmationOptions {
	/** Custom text for the "yes" option */
	yesText?: string
	/** Custom text for the "no" option */
	noText?: string
	/** Whether the confirmation is modal */
	modal?: boolean
}

/**
 * Options for text input
 */
export interface InputOptions {
	/** Placeholder text */
	placeholder?: string
	/** Default value */
	defaultValue?: string
	/** Whether the input should be masked (for passwords) */
	password?: boolean
	/** Validation function */
	validate?: (value: string) => string | undefined
}

/**
 * Log levels for output
 */
export enum LogLevel {
	DEBUG = "debug",
	INFO = "info",
	WARN = "warn",
	ERROR = "error",
}

/**
 * Content for webview display
 */
export interface WebviewContent {
	/** HTML content */
	html?: string
	/** JavaScript content */
	script?: string
	/** CSS content */
	style?: string
	/** Data to pass to the webview */
	data?: any
}

/**
 * Options for webview configuration
 */
export interface WebviewOptions {
	/** Title of the webview */
	title?: string
	/** Whether the webview should be retained when hidden */
	retainContextWhenHidden?: boolean
	/** Enable scripts in the webview */
	enableScripts?: boolean
	/** Local resource roots */
	localResourceRoots?: string[]
}
