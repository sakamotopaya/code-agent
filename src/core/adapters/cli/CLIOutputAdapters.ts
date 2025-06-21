import * as fs from "fs/promises"
import * as path from "path"
import chalk from "chalk"
import { IOutputAdapter, IStreamingAdapter, IContentOutputAdapter } from "../../interfaces/IOutputAdapter"
import { ProcessedContent, IContentProcessor } from "../../interfaces/IContentProcessor"
import { ClineMessage, HistoryItem } from "@roo-code/types"
import { SharedContentProcessor } from "../../content/SharedContentProcessor"

/**
 * Comprehensive CLI output adapter implementing all functionality
 * Handles console output, state persistence, and data storage for CLI mode
 */
export class CLIOutputAdapter implements IOutputAdapter {
	private contentProcessor: IContentProcessor
	private useColor: boolean
	private configFile: string
	private historyFile: string

	constructor(globalStoragePath: string, useColor: boolean = true) {
		this.useColor = useColor
		this.contentProcessor = new SharedContentProcessor()
		this.configFile = path.join(globalStoragePath, "cli-state.json")
		this.historyFile = path.join(globalStoragePath, "task-history.json")

		// Ensure storage directory exists
		this.ensureStorageDirectory(globalStoragePath)
	}

	private async ensureStorageDirectory(storagePath: string): Promise<void> {
		try {
			await fs.mkdir(storagePath, { recursive: true })
		} catch (error) {
			console.error(`❌ Failed to create storage directory: ${error}`)
		}
	}

	// Content Output
	async outputContent(message: ClineMessage): Promise<void> {
		if (!message.text) return

		// 1. Immediate console output for user feedback
		process.stdout.write(message.text)

		// 2. Process content for structured display if needed
		try {
			const processedContent = await this.contentProcessor.processContent(message.text)
			for (const item of processedContent) {
				if (item.shouldDisplay) {
					const formatted = this.applyCLIFormatting(item)
					if (formatted && formatted !== message.text) {
						console.log(formatted)
					}
				}
			}
		} catch (error) {
			// If processing fails, continue with raw output
			console.error(`Warning: Content processing failed: ${error}`)
		}
	}

	async outputPartialContent(partialMessage: ClineMessage): Promise<void> {
		if (!partialMessage.text) return
		// For CLI, partial content is the same as regular content
		process.stdout.write(partialMessage.text)
	}

	async streamChunk(chunk: string): Promise<void> {
		// Direct console output for immediate real-time streaming
		process.stdout.write(chunk)
	}

	// Message Communication
	async sendMessage(message: any): Promise<void> {
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
		// CLI doesn't need separate partial message handling
		// Just output the content
		if (partialMessage.text) {
			process.stdout.write(partialMessage.text)
		}
	}

	// State Management
	async syncState(state: any): Promise<void> {
		try {
			// Save complete state to file for persistence
			await fs.writeFile(this.configFile, JSON.stringify(state, null, 2))

			// Show key state info to console
			console.log(
				`📊 State synchronized - Mode: ${state.mode}, API: ${state.apiConfiguration?.apiProvider || "None"}`,
			)
		} catch (error) {
			console.error(`❌ Failed to save state: ${error}`)
		}
	}

	async notifyStateChange(changeType: string, data?: any): Promise<void> {
		console.log(`📊 State changed: ${changeType}${data ? ` - ${JSON.stringify(data)}` : ""}`)
	}

	// Data Persistence
	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
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

	// Lifecycle
	reset(): void {
		this.contentProcessor.reset()
	}

	async dispose(): Promise<void> {
		// CLI doesn't need special disposal, but we could flush any pending writes
		this.reset()
	}
}

/**
 * @deprecated Use CLIOutputAdapter instead
 * CLI implementation of immediate streaming adapter
 * Provides raw output to console without processing delays
 */
export class CLIStreamingAdapter implements IStreamingAdapter {
	async streamRawChunk(chunk: string): Promise<void> {
		// Direct console output for immediate feedback
		process.stdout.write(chunk)
	}

	reset(): void {
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
