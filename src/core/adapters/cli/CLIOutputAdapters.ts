import * as fs from "fs/promises"
import * as path from "path"
import chalk from "chalk"
import { IOutputAdapter, IStreamingAdapter, IContentOutputAdapter } from "../../interfaces/IOutputAdapter"
import { ProcessedContent, IContentProcessor } from "../../interfaces/IContentProcessor"
import { ClineMessage, HistoryItem } from "@roo-code/types"
import { SharedContentProcessor } from "../../content/SharedContentProcessor"
import { ILogger, NoOpLogger } from "../../interfaces/ILogger"
import { CLIOutputLogger, getGlobalCLIOutputLogger } from "./CLIOutputLogger"
import { CLIStreamProcessor, CLIStreamOptions } from "./CLIStreamProcessor"

/**
 * Comprehensive CLI output adapter implementing all functionality
 * Handles console output, state persistence, and data storage for CLI mode
 */
export class CLIOutputAdapter implements IOutputAdapter {
	private contentProcessor: IContentProcessor
	private useColor: boolean
	private configFile: string
	private historyFile: string
	private logger: ILogger
	private outputLogger: CLIOutputLogger
	private streamProcessor: CLIStreamProcessor

	constructor(
		globalStoragePath: string,
		useColor: boolean = true,
		logger?: ILogger,
		cliOptions?: { showThinking?: boolean; showTools?: boolean },
	) {
		this.useColor = useColor
		this.contentProcessor = new SharedContentProcessor()
		this.configFile = path.join(globalStoragePath, "cli-state.json")
		this.historyFile = path.join(globalStoragePath, "task-history.json")
		this.logger = logger || new NoOpLogger()
		this.outputLogger = getGlobalCLIOutputLogger()

		// Initialize XML-aware stream processor
		this.streamProcessor = new CLIStreamProcessor({
			showThinking: cliOptions?.showThinking || false,
			showTools: cliOptions?.showTools || false,
			useColor,
		})

		// Initialize the output logger
		this.outputLogger.initialize().catch((error) => {
			console.error(`Failed to initialize CLI output logger: ${error}`)
		})

		// Ensure storage directory exists
		this.ensureStorageDirectory(globalStoragePath)
	}

	private async ensureStorageDirectory(storagePath: string): Promise<void> {
		try {
			await fs.mkdir(storagePath, { recursive: true })
		} catch (error) {
			this.logger.error(`Failed to create storage directory: ${error}`)
		}
	}

	// Content Output
	async outputContent(message: ClineMessage): Promise<void> {
		// Log the method call
		// await this.outputLogger.logMethodCall('outputContent', message.text, { type: message.type })
		// if (!message.text) return
		// // 1. Immediate console output for user feedback
		//process.stdout.write(<string>message.text);
		// // 2. Process content for structured display if needed
		// try {
		// 	const processedContent = await this.contentProcessor.processContent(message.text)
		// 	for (const item of processedContent) {
		// 		if (item.shouldDisplay) {
		// 			const formatted = this.applyCLIFormatting(item)
		// 			if (formatted && formatted !== message.text) {
		// 				console.log(formatted)
		// 			}
		// 		}
		// 	}
		// } catch (error) {
		// 	// If processing fails, continue with raw output
		// 	console.error(`Warning: Content processing failed: ${error}`)
		// }
	}

	async outputPartialContent(partialMessage: ClineMessage): Promise<void> {
		// Log the method call
		await this.outputLogger.logMethodCall("outputPartialContent", partialMessage.text, {
			type: partialMessage.type,
		})

		if (!partialMessage.text) return

		// Process content through XML-aware stream processor
		const result = this.streamProcessor.processChunk(partialMessage.text)

		// Only output if there's actual user-visible content
		if (result.hasOutput) {
			process.stdout.write(result.content)
		}
	}

	async streamChunk(chunk: string): Promise<void> {
		// Log the method call
		//await this.outputLogger.logMethodCall('streamChunk', chunk)

		// Process content through XML-aware stream processor
		const result = this.streamProcessor.processChunk(chunk)

		// Only output if there's actual user-visible content
		if (result.hasOutput) {
			process.stdout.write(result.content)
		}
	}

	// Message Communication
	async sendMessage(message: any): Promise<void> {
		// Log the method call
		const messageText = message.text || message.message || JSON.stringify(message)
		await this.outputLogger.logMethodCall("sendMessage", messageText, {
			type: message.type,
			toolName: message.toolName,
		})

		// Output ALL messages appropriately to console
		switch (message.type) {
			case "error":
				console.error(`❌ Error: ${message.text || message.message || JSON.stringify(message)}`)
				break
			case "success":
				console.log(`✅ ${message.text || message.message || "Success"}`)
				break
			case "warning":
				console.warn(`⚠️  Warning: ${message.text || message.message || JSON.stringify(message)}`)
				break
			case "info":
				console.log(`ℹ️  ${message.text || message.message || JSON.stringify(message)}`)
				break
			case "progress":
				console.log(`⏳ ${message.text || message.message || JSON.stringify(message)}`)
				break
			case "tool_use":
				console.log(`🔧 Tool: ${message.toolName || "Unknown"} - ${message.text || message.message || ""}`)
				break
			case "state": {
				// Don't spam console with full state, but show key info
				const state = message.state || message
				console.log(`📊 State updated - Mode: ${state?.mode}, Tasks: ${state?.taskHistory?.length || 0}`)
				break
			}
			case "reasoning":
				if (this.useColor) {
					console.log(chalk.gray(`🤔 ${message.text || message.message || ""}`))
				} else {
					console.log(`🤔 ${message.text || message.message || ""}`)
				}
				break
			default:
				console.log(message.text || message.message || JSON.stringify(message, null, 2))
		}
	}

	async sendPartialUpdate(partialMessage: any): Promise<void> {
		// Log the method call
		//await this.outputLogger.logMethodCall('sendPartialUpdate', partialMessage.text, { type: partialMessage.type })

		// CLI doesn't need separate partial message handling
		// This is handled by streamChunk - avoid duplication
		if (partialMessage.text) {
			//process.stdout.write(`[CLIOutputAdapter.sendPartialUpdate] SKIPPED - ${partialMessage.text.substring(0, 20)}...`)
			//process.stdout.write(partialMessage.text);
		}
	}

	// State Management
	async syncState(state: any): Promise<void> {
		// Log the method call
		// await this.outputLogger.logMethodCall('syncState', 'State synchronization', {
		// 	mode: state.mode,
		// 	apiProvider: state.apiConfiguration?.apiProvider
		// })

		try {
			// Save complete state to file for persistence
			await fs.writeFile(this.configFile, JSON.stringify(state, null, 2))

			// Show key state info only in verbose mode
			this.logger.debug(
				`State synchronized - Mode: ${state.mode}, API: ${state.apiConfiguration?.apiProvider || "None"}`,
			)
		} catch (error) {
			this.logger.error(`Failed to save state: ${error}`)
		}
	}

	async notifyStateChange(changeType: string, data?: any): Promise<void> {
		// Log the method call
		await this.outputLogger.logMethodCall("notifyStateChange", `State changed: ${changeType}`, data)

		this.logger.debug(`State changed: ${changeType}${data ? ` - ${JSON.stringify(data)}` : ""}`)
	}

	/**
	 * Set or update the logger instance
	 */
	setLogger(logger: ILogger): void {
		this.logger = logger
	}

	/**
	 * Get the current logger instance
	 */
	getLogger(): ILogger {
		return this.logger
	}

	// Data Persistence
	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		// Log the method call
		await this.outputLogger.logMethodCall("updateTaskHistory", item.task, { id: item.id })

		try {
			// Load existing history
			const history = await this.loadHistory()

			// Find existing item or add new one
			const existingIndex = history.findIndex((h) => h.id === item.id)
			let updatedHistory: HistoryItem[]

			if (existingIndex !== -1) {
				updatedHistory = [...history]
				updatedHistory[existingIndex] = item
			} else {
				updatedHistory = [item, ...history]
			}

			// Save to file
			await fs.writeFile(this.historyFile, JSON.stringify(updatedHistory, null, 2))

			// Show in console
			console.log(
				`📝 Task added to history: ${item.task?.substring(0, 50) || item.id}${(item.task?.length || 0) > 50 ? "..." : ""}`,
			)

			return updatedHistory
		} catch (error) {
			console.error(`❌ Failed to update task history: ${error}`)
			return [item] // Return at least the current item
		}
	}

	async updatePersistentData(key: string, data: any): Promise<void> {
		// Log the method call
		await this.outputLogger.logMethodCall("updatePersistentData", `Updating persistent data for key: ${key}`, {
			key,
			dataType: typeof data,
		})

		try {
			// Load current state
			let currentState: any = {}
			try {
				const stateContent = await fs.readFile(this.configFile, "utf-8")
				currentState = JSON.parse(stateContent)
			} catch (error) {
				// File doesn't exist yet, that's okay
			}

			// Update the specific key
			currentState[key] = data

			// Save back to file
			await fs.writeFile(this.configFile, JSON.stringify(currentState, null, 2))
		} catch (error) {
			console.error(`❌ Failed to update persistent data for key '${key}': ${error}`)
		}
	}

	getPersistentData<T>(key: string): T | undefined {
		// Log the method call (not awaited since this is a sync method)
		this.outputLogger
			.logMethodCall("getPersistentData", `Getting persistent data for key: ${key}`, { key })
			.catch(() => {})

		try {
			// This is sync because it's a getter, but we'll need to implement async loading
			// For now, return undefined and rely on async state loading
			return undefined
		} catch (error) {
			console.error(`❌ Failed to get persistent data for key '${key}': ${error}`)
			return undefined
		}
	}

	// Helper Methods
	private async loadHistory(): Promise<HistoryItem[]> {
		try {
			const historyContent = await fs.readFile(this.historyFile, "utf-8")
			return JSON.parse(historyContent)
		} catch (error) {
			// File doesn't exist yet, return empty array
			return []
		}
	}

	private applyCLIFormatting(content: ProcessedContent): string {
		if (!content.content) {
			return ""
		}

		// Handle tool indicators with special formatting
		if (content.isToolIndicator && content.toolName) {
			const toolDisplay = this.useColor ? chalk.yellow(`🔧 ${content.toolName}...`) : `🔧 ${content.toolName}...`
			return `\n${toolDisplay}\n`
		}

		// Handle different content types
		switch (content.contentType) {
			case "content":
				return content.content

			case "tool_call":
				// Tool call content with formatting
				if (this.useColor) {
					return chalk.blue(`🔧 ${content.content}`)
				}
				return `🔧 ${content.content}`

			case "thinking":
				// Thinking content with special formatting
				if (this.useColor) {
					return chalk.gray(`🤔 [Thinking] ${content.content}`)
				}
				return `🤔 [Thinking] ${content.content}`

			default:
				return content.content
		}
	}

	// Tool Support Methods
	/**
	 * Display tool results in CLI format
	 */
	showToolResult(result: string): void {
		const formatted = this.formatToolResult(result)
		console.log(formatted)
	}

	/**
	 * Display error messages in CLI format
	 */
	async showError(errorMessage: string): Promise<void> {
		await this.outputLogger.logMethodCall("showError", errorMessage)

		if (this.useColor) {
			console.error(chalk.red(`❌ ${errorMessage}`))
		} else {
			console.error(`❌ ${errorMessage}`)
		}
	}

	/**
	 * Check if CLI is in interactive mode
	 */
	isInteractive(): boolean {
		return process.stdin.isTTY && !process.env.CI && !process.env.NON_INTERACTIVE
	}

	/**
	 * Prompt user for input in interactive mode
	 */
	async promptUser(message: string): Promise<boolean> {
		if (!this.isInteractive()) {
			return true // Auto-approve in non-interactive mode
		}

		// TODO: Implement interactive prompting
		// For now, auto-approve
		console.log(this.useColor ? chalk.yellow(`❓ ${message}`) : `❓ ${message}`)
		console.log(this.useColor ? chalk.gray("(Auto-approved)") : "(Auto-approved)")
		return true
	}

	/**
	 * Format tool results for CLI display
	 */
	private formatToolResult(result: string): string {
		if (this.useColor) {
			return chalk.green("✓ ") + chalk.gray(result)
		}
		return "✓ " + result
	}

	// Lifecycle
	reset(): void {
		// Log the method call (not awaited since this is a sync method)
		this.outputLogger.logMethodCall("reset", "Resetting CLI output adapter").catch(() => {})
		this.contentProcessor.reset()
		this.streamProcessor.reset()
	}

	async dispose(): Promise<void> {
		// Log the method call
		await this.outputLogger.logMethodCall("dispose", "Disposing CLI output adapter")

		// CLI doesn't need special disposal, but we could flush any pending writes
		this.reset()

		// Close the output logger
		await this.outputLogger.close()
	}
}

/**
 * @deprecated Use CLIOutputAdapter instead
 * CLI implementation of immediate streaming adapter
 * Provides raw output to console without processing delays
 */
export class CLIStreamingAdapter implements IStreamingAdapter {
	async streamRawChunk(chunk: string): Promise<void> {
		// Log the method call using global logger
		const logger = getGlobalCLIOutputLogger()
		await logger.logMethodCall("CLIStreamingAdapter.streamRawChunk", chunk)

		// Direct console output for immediate feedback
		process.stdout.write(`[CLIStreamingAdapter.streamRawChunk] ${chunk}`)
	}

	reset(): void {
		// Log the method call using global logger (not awaited since this is a sync method)
		const logger = getGlobalCLIOutputLogger()
		logger.logMethodCall("CLIStreamingAdapter.reset", "Resetting streaming adapter").catch(() => {})

		// No state to reset for raw streaming
	}
}

/**
 * @deprecated Use CLIOutputAdapter instead
 * CLI implementation of content output adapter
 * Handles formatted content output with CLI-specific formatting
 */
export class CLIContentOutputAdapter implements IContentOutputAdapter {
	private useColor: boolean

	constructor(useColor: boolean = true) {
		this.useColor = useColor
	}

	async outputProcessedContent(content: ProcessedContent[]): Promise<void> {
		// Log the method call using global logger
		const logger = getGlobalCLIOutputLogger()
		await logger.logMethodCall(
			"CLIContentOutputAdapter.outputProcessedContent",
			`Processing ${content.length} content items`,
		)

		for (const item of content) {
			if (item.shouldDisplay) {
				// Apply CLI-specific formatting (colors, etc.)
				const formatted = this.applyCLIFormatting(item)
				if (formatted) {
					console.log(formatted)
				}
			}
		}
	}

	reset(): void {
		// Log the method call using global logger (not awaited since this is a sync method)
		const logger = getGlobalCLIOutputLogger()
		logger.logMethodCall("CLIContentOutputAdapter.reset", "Resetting content output adapter").catch(() => {})

		// No state to reset for CLI output
	}

	/**
	 * Apply CLI-specific formatting including colors and structure
	 */
	private applyCLIFormatting(content: ProcessedContent): string {
		if (!content.content) {
			return ""
		}

		// Handle tool indicators with special formatting
		if (content.isToolIndicator && content.toolName) {
			const toolDisplay = this.useColor ? chalk.yellow(`${content.toolName}...`) : `${content.toolName}...`
			return `\n${toolDisplay}\n`
		}

		// Handle different content types
		switch (content.contentType) {
			case "content":
				return content.content

			case "tool_call":
				// Tool call content (not indicators) - display as-is
				return content.content

			case "thinking":
				// Thinking content with special formatting
				if (this.useColor) {
					return chalk.gray(`[Thinking] ${content.content}`)
				}
				return `[Thinking] ${content.content}`

			default:
				return content.content
		}
	}
}
