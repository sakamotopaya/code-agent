/**
 * Roo Code Agent API Client - TypeScript Implementation
 *
 * This is the TypeScript version of the API client that properly integrates
 * with the ReplHistoryService and other TypeScript modules.
 */

import * as http from "http"
import * as https from "https"
import * as readline from "readline"
import * as path from "path"
import * as os from "os"

// Import ReplHistoryService directly (no ts-node needed)
import { ReplHistoryService } from "../shared/services/ReplHistoryService"
import { getGlobalStoragePath } from "../shared/paths"

// Import ApiChunkLogger for raw chunk logging
import { ApiChunkLogger } from "../shared/logging/ApiChunkLogger"
import { ApiChunkLogContext } from "../shared/logging/types"

// Import our types
import type {
	ApiClientOptions,
	REPLSessionOptions,
	StreamProcessorOptions,
	ContentFilterOptions,
	ParsedArgs,
	StreamEvent,
	TokenUsage,
	QuestionEvent,
	AnswerSubmission,
	HttpRequestOptions,
	TimerRecord,
	StreamProcessingState,
	ContentFilterState,
	SupportedMode,
	QuestionEventData,
} from "./types/api-client-types"

// Import question handler
import { QuestionEventHandler } from "./QuestionEventHandler"

/**
 * Parse command line arguments into structured options
 */
function parseCommandLineArgs(): ParsedArgs {
	const args = process.argv.slice(2)

	const options: ApiClientOptions = {
		useStream: false,
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
		showTokenUsage: true,
		hideTokenUsage: false,
		showTiming: false,
		logSystemPrompt: false,
		logLlm: false,
		logRawChunks: false,
		rawChunkLogDir: undefined,
	}

	let task = "Test task from API client"
	let showHelp = false

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]

		switch (arg) {
			case "--stream":
				options.useStream = true
				break
			case "--mode":
				options.mode = args[++i] || "code"
				break
			case "--host":
				options.host = args[++i] || options.host
				break
			case "--port":
				options.port = parseInt(args[++i]) || options.port
				break
			case "--verbose":
			case "-v":
				options.verbose = true
				break
			case "--show-thinking":
				options.showThinking = true
				break
			case "--show-tools":
				options.showTools = true
				break
			case "--show-system":
				options.showSystem = true
				break
			case "--log-system-prompt":
				options.logSystemPrompt = true
				break
			case "--log-llm":
				options.logLlm = true
				break
			case "--log-raw-chunks":
				options.logRawChunks = true
				break
			case "--raw-chunk-log-dir":
				options.rawChunkLogDir = args[++i]
				if (!options.rawChunkLogDir) {
					console.error("Error: --raw-chunk-log-dir requires a directory path")
					process.exit(1)
				}
				break
			case "--show-response":
				options.showResponse = true
				break
			case "--show-completion":
				options.showCompletion = true
				break
			case "--show-mcp-use":
				options.showMcpUse = true
				break
			case "--show-token-usage":
				options.showTokenUsage = true
				options.hideTokenUsage = false
				break
			case "--hide-token-usage":
				options.showTokenUsage = false
				options.hideTokenUsage = true
				break
			case "--show-timing":
				options.showTiming = true
				break
			case "--task":
				options.task = args[++i]
				if (!options.task) {
					console.error("Error: --task requires a task ID")
					process.exit(1)
				}
				if (!validateTaskId(options.task)) {
					console.error("Error: Invalid task ID format. Expected UUID format.")
					process.exit(1)
				}
				options.restartTask = true
				break
			case "--repl":
				options.replMode = true
				break
			case "--help":
			case "-h":
				showHelp = true
				break
			default:
				if (!arg.startsWith("--")) {
					task = arg
				}
		}
	}

	return { options, task, showHelp }
}

/**
 * Validate task ID format (UUID)
 */
function validateTaskId(taskId: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
	return uuidRegex.test(taskId)
}

/**
 * Enhanced question logger for debugging and monitoring
 */
class QuestionLogger {
	private verbose: boolean

	constructor(verbose = false) {
		this.verbose = verbose
	}

	logEvent(event: string, data: Record<string, any>): void {
		if (!this.verbose) return

		const logEntry = {
			timestamp: new Date().toISOString(),
			event,
			...data,
		}
		console.log(`[QUESTION-LOG] ${JSON.stringify(logEntry)}`)
	}

	logQuestionReceived(questionId: string, question: string): void {
		this.logEvent("question_received", {
			questionId,
			question: question.substring(0, 100),
		})
	}

	logStreamPaused(): void {
		this.logEvent("stream_paused", {})
	}

	logStreamResumed(queuedEventsCount: number): void {
		this.logEvent("stream_resumed", { queuedEventsCount })
	}

	logAnswerSubmission(questionId: string, answer: string, attempt: number): void {
		this.logEvent("answer_submission", {
			questionId,
			answer: answer.substring(0, 50),
			attempt,
		})
	}

	logAnswerResult(questionId: string, success: boolean, error: string | null = null): void {
		this.logEvent("answer_result", {
			questionId,
			success,
			error,
		})
	}

	logQuestionCompleted(questionId: string, answer: string): void {
		this.logEvent("question_completed", {
			questionId,
			answer: answer.substring(0, 50),
		})
	}

	logQuestionError(questionId: string, error: Error | string): void {
		this.logEvent("question_error", {
			questionId,
			error: error instanceof Error ? error.message : error,
		})
	}

	logEventQueued(eventType: string): void {
		this.logEvent("event_queued", { eventType })
	}
}

/**
 * Stream processor that handles pausing/resuming during questions
 */
class StreamProcessor {
	private state: StreamProcessingState
	private questionLogger: QuestionLogger
	private verbose: boolean
	private maxRetries: number
	private baseDelay: number
	private questionHandler: QuestionEventHandler

	constructor(options: StreamProcessorOptions = {}, clientOptions: ApiClientOptions) {
		this.state = {
			isPaused: false,
			currentQuestion: null,
			eventQueue: [],
			finalTokenUsage: null,
			finalTokenTimestamp: null,
		}

		this.questionLogger = new QuestionLogger(options.verbose)
		this.verbose = options.verbose || false
		this.maxRetries = options.maxRetries || 3
		this.baseDelay = options.baseDelay || 1000

		// Initialize QuestionEventHandler (AC-002)
		this.questionHandler = new QuestionEventHandler(clientOptions)
	}

	/**
	 * Handle question event from SSE stream (AC-002)
	 */
	async handleQuestionEvent(questionData: QuestionEventData): Promise<void> {
		try {
			// Pause regular stream processing during question handling
			this.pauseProcessing()

			if (this.verbose) {
				console.log("⏸️  Stream processing paused for question")
			}

			// Delegate to question handler
			await this.questionHandler.handleQuestionEvent(questionData)
		} catch (error) {
			console.error(`❌ Question event handling failed: ${error}`)
		} finally {
			// Resume stream processing
			this.resumeProcessing()

			if (this.verbose) {
				console.log("▶️  Stream processing resumed")
			}
		}
	}

	async processEvent(event: StreamEvent, timestamp: string, contentFilter: ClientContentFilter): Promise<void> {
		// If paused and not a question event, queue it
		if (this.state.isPaused && event.type !== "question_ask") {
			this.state.eventQueue.push({ event, timestamp, contentFilter })
			this.questionLogger.logEventQueued(event.type)
			return
		}

		switch (event.type) {
			case "question_ask":
				await this.handleQuestion(event as QuestionEvent, timestamp)
				break
			default:
				await this.handleRegularEvent(event, timestamp, contentFilter)
		}
	}

	private async handleQuestion(event: QuestionEvent, timestamp: string): Promise<void> {
		this.questionLogger.logQuestionReceived(event.questionId, event.message)

		this.pauseProcessing()
		try {
			// Display question prominently
			this.displayQuestion(event, timestamp)

			// Get user input and submit answer with retry logic
			const answer = await this.promptUserWithRetry(event)
			await this.submitAnswerWithRetry(event.questionId, answer)

			this.questionLogger.logQuestionCompleted(event.questionId, answer)
		} catch (error) {
			this.questionLogger.logQuestionError(event.questionId, error as Error)
			console.error(`❌ Question handling failed: ${error instanceof Error ? error.message : String(error)}`)
		} finally {
			this.resumeProcessing()
		}
	}

	private async handleRegularEvent(
		event: StreamEvent,
		timestamp: string,
		contentFilter: ClientContentFilter,
	): Promise<void> {
		// Delegate all output formatting to ClientContentFilter
		contentFilter.formatAndOutputEvent(event, timestamp)
	}

	public pauseProcessing(): void {
		this.state.isPaused = true
		this.questionLogger.logStreamPaused()
		console.log("\n⏸️  Stream paused - waiting for your response...")
	}

	public resumeProcessing(): void {
		this.state.isPaused = false
		this.questionLogger.logStreamResumed(this.state.eventQueue.length)

		if (this.state.eventQueue.length > 0) {
			console.log(`\n▶️  Stream resumed - processing ${this.state.eventQueue.length} queued events...`)
		}

		// Process all queued events
		const queuedEvents = [...this.state.eventQueue]
		this.state.eventQueue = []

		// Process events sequentially to maintain order
		for (const { event, timestamp, contentFilter } of queuedEvents) {
			try {
				this.handleRegularEvent(event, timestamp, contentFilter)
			} catch (error) {
				console.error(
					`❌ Error processing queued event ${event.type}: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
	}

	private displayQuestion(event: QuestionEvent, timestamp: string): void {
		console.log(`\n🤔 [${timestamp}] Question from agent:`)
		console.log(`   ${event.message}`)
		if (event.choices && event.choices.length > 0) {
			console.log("\n   Suggested answers:")
			event.choices.forEach((choice, index) => {
				console.log(`   ${index + 1}. ${choice}`)
			})
		}
		console.log("")
	}

	private async promptUserWithRetry(event: QuestionEvent): Promise<string> {
		for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
			try {
				const answer = await promptUser(event.message, event.choices)
				return answer
			} catch (error) {
				console.error(`❌ Attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`)
				if (attempt === this.maxRetries) {
					throw error
				}
				await new Promise((resolve) => setTimeout(resolve, this.baseDelay * attempt))
			}
		}
		throw new Error("Max retry attempts reached")
	}

	private async submitAnswerWithRetry(questionId: string, answer: string): Promise<void> {
		for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
			try {
				this.questionLogger.logAnswerSubmission(questionId, answer, attempt)
				await submitAnswer(questionId, answer)
				this.questionLogger.logAnswerResult(questionId, true)
				return
			} catch (error) {
				this.questionLogger.logAnswerResult(
					questionId,
					false,
					error instanceof Error ? error.message : String(error),
				)
				if (attempt === this.maxRetries) {
					throw error
				}
				await new Promise((resolve) => setTimeout(resolve, this.baseDelay * attempt))
			}
		}
	}
}

/**
 * Execution timer for tracking performance
 */
class ExecutionTimer {
	private timers: Map<string, TimerRecord> = new Map()
	private verbose: boolean
	private showTiming: boolean

	constructor(verbose = false, showTiming = false) {
		this.verbose = verbose
		this.showTiming = showTiming
	}

	startTimer(operation: string, details = ""): void {
		const timer: TimerRecord = {
			operation,
			startTime: Date.now(),
			details,
		}
		this.timers.set(operation, timer)

		if (this.verbose || this.showTiming) {
			console.log(`⏱️  [TIMING] Started: ${operation} ${details}`)
		}
	}

	endTimer(operation: string, forceShow = false): void {
		const timer = this.timers.get(operation)
		if (!timer) return

		timer.endTime = Date.now()
		timer.duration = timer.endTime - timer.startTime

		if (this.verbose || this.showTiming || forceShow) {
			console.log(`⏱️  [TIMING] Completed: ${operation} in ${timer.duration}ms`)
		}
	}

	getTimer(operation: string): TimerRecord | undefined {
		return this.timers.get(operation)
	}

	getAllTimers(): TimerRecord[] {
		return Array.from(this.timers.values())
	}

	reset(): void {
		this.timers.clear()
	}
}

/**
 * REPL Session class with proper TypeScript integration
 */
class REPLSession {
	private historyService: ReplHistoryService | null = null
	private rl: readline.Interface
	private taskId: string | null = null
	private options: REPLSessionOptions
	private exitResolver: (() => void) | null = null

	constructor(options: REPLSessionOptions) {
		this.options = options
		this.taskId = options.taskId || null

		// Initialize history service with proper error handling
		try {
			this.historyService = new ReplHistoryService({
				storageDir: getGlobalStoragePath(),
				context: "api-client",
				maxHistorySize: 100,
				deduplication: true,
				autoSave: true,
			})
		} catch (error) {
			console.warn(
				`Failed to initialize history service: ${error instanceof Error ? error.message : String(error)}`,
			)
			this.historyService = null
		}

		// Initialize readline interface without history - we'll load it after initialization
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			history: [], // Will be populated with persistent history during start()
		})
	}

	async start(): Promise<void> {
		console.log("🚀 Roo API Client REPL Mode")
		console.log("Commands: exit (quit), newtask (clear task), help (show help), history (show history)")

		if (this.historyService) {
			await this.loadHistory()
			console.log('💡 History service enabled - use "history" command for options')
			console.log("💡 Use up/down arrows to navigate through command history")
		} else {
			console.log("⚠️  History service not available - history features disabled")
		}

		// Show raw chunk logging status if enabled
		if (this.options.logRawChunks) {
			const logDir = this.options.rawChunkLogDir || `${getGlobalStoragePath()}/logs`
			console.log(`📝 Raw chunk logging enabled - logs will be saved to: ${logDir}`)
			console.log(`💡 Log files are created when you send your first command`)
		}

		console.log("💡 First command will create a new task\n")

		// Create a promise that keeps the process alive until user exits
		return new Promise<void>((resolve) => {
			this.exitResolver = resolve
			this.promptUser()
		})
	}

	private async loadHistory(): Promise<void> {
		if (!this.historyService) return

		try {
			await this.historyService.initialize()
			const history = this.historyService.getHistory(50) // Get last 50 commands for readline history
			if (history.length > 0) {
				// Extract command strings and load them into readline history
				// ReplHistoryService returns newest first, which is exactly what we want for readline
				// so that up arrow shows the most recent command first
				const commands = history.map((entry) => entry.command)

				// Set the readline interface's history (accessing internal property)
				// TypeScript doesn't expose this but it's available at runtime
				;(this.rl as any).history = commands

				console.log(`📚 Loaded ${history.length} previous commands`)
			}
		} catch (error) {
			console.warn(`Failed to load history: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	private promptUser(): void {
		const prompt = this.getPrompt()
		this.rl.question(prompt, async (input) => {
			const shouldContinue = await this.handleInput(input.trim())
			if (shouldContinue) {
				this.promptUser()
			}
		})
	}

	private getPrompt(): string {
		const taskStatus = this.taskId ? `task:${this.taskId.substring(0, 8)}` : "new"
		return `roo-api [${taskStatus}] > `
	}

	setTaskId(taskId: string): void {
		this.taskId = taskId
	}

	clearTaskId(): void {
		this.taskId = null
	}

	private async handleInput(input: string): Promise<boolean> {
		if (!input) {
			return true
		}

		// Handle special commands
		if (input === "exit" || input === "quit") {
			console.log("👋 Goodbye!")
			if (this.historyService) {
				await this.historyService.flush()
			}
			// Close the readline interface
			this.rl.close()
			// Resolve the promise to allow process to exit gracefully
			if (this.exitResolver) {
				this.exitResolver()
			}
			return false // Don't continue prompting
		}

		if (input === "newtask") {
			this.taskId = null
			console.log("🆕 Cleared task ID - next command will create a new task")
			return true
		}

		if (input === "help") {
			this.showHelp()
			return true
		}

		if (input.startsWith("history")) {
			await this.handleHistoryCommand(input.split(" ").slice(1))
			return true
		}

		// Add to both persistent history and readline history
		if (this.historyService) {
			try {
				await this.historyService.addEntry(input, {
					context: "api-client",
					timestamp: new Date(),
				})
			} catch (error) {
				console.warn(`Failed to save to history: ${error instanceof Error ? error.message : String(error)}`)
			}
		}

		// Add to readline history for up/down arrow access
		// Note: readline automatically adds the current command to history, but we want to ensure
		// it's properly managed in case of deduplication logic
		try {
			const rlHistory = (this.rl as any).history as string[]
			if (rlHistory && rlHistory.length > 0 && rlHistory[0] !== input) {
				// Only add if it's not the same as the last command (deduplication)
				rlHistory.unshift(input)
				// Keep history size manageable
				if (rlHistory.length > 100) {
					rlHistory.splice(100)
				}
			}
		} catch (error) {
			// Silently ignore readline history errors - this is not critical functionality
		}

		// Execute the command
		await this.executeCommand(input)
		return true
	}

	private showHelp(): void {
		console.log(`
🔧 REPL Commands:
  exit, quit     - Exit the REPL
  newtask        - Clear current task ID (start fresh)
  help           - Show this help
  history        - Show command history
  history search <term> - Search history
  history clear  - Clear history
  history stats  - Show history statistics

💡 Any other input will be sent as a task to the API server.
`)
	}

	private async handleHistoryCommand(args: string[]): Promise<void> {
		if (!this.historyService) {
			console.log("❌ History service not available")
			return
		}

		const command = args[0] || "show"

		switch (command) {
			case "show":
			case "":
				await this.showHistory()
				break
			case "search":
				if (args[1]) {
					await this.searchHistory(args[1])
				} else {
					console.log("❌ Please provide a search term: history search <term>")
				}
				break
			case "clear":
				await this.clearHistory()
				break
			case "stats":
				await this.showHistoryStats()
				break
			default:
				console.log("❌ Unknown history command. Use: show, search, clear, stats")
		}
	}

	private async showHistory(): Promise<void> {
		if (!this.historyService) return

		const history = this.historyService.getHistory(20)
		if (history.length === 0) {
			console.log("📝 No command history available")
			return
		}

		console.log("📚 Recent Commands:")
		history.forEach((entry, index) => {
			const timeStr = entry.timestamp.toLocaleString()
			console.log(`  ${index + 1}. [${timeStr}] ${entry.command}`)
		})
	}

	private async clearHistory(): Promise<void> {
		if (!this.historyService) return

		try {
			await this.historyService.clearHistory()
			console.log("🗑️  Command history cleared")
		} catch (error) {
			console.error(`❌ Failed to clear history: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	private async searchHistory(term: string): Promise<void> {
		if (!this.historyService) return

		const results = this.historyService.searchHistory(term)
		if (results.length === 0) {
			console.log(`🔍 No commands found matching "${term}"`)
			return
		}

		console.log(`🔍 Found ${results.length} commands matching "${term}":`)
		results.forEach((entry, index) => {
			const timeStr = entry.timestamp.toLocaleString()
			console.log(`  ${index + 1}. [${timeStr}] ${entry.command}`)
		})
	}

	private async showHistoryStats(): Promise<void> {
		if (!this.historyService) return

		const stats = this.historyService.getStatistics()
		console.log("📊 History Statistics:")
		console.log(`  Total commands: ${stats.totalEntries}`)
		console.log(`  Unique commands: ${stats.uniqueCommands}`)
		console.log(`  Average length: ${stats.averageCommandLength.toFixed(1)} characters`)

		if (stats.mostUsedCommands.length > 0) {
			console.log("  Most used commands:")
			stats.mostUsedCommands.slice(0, 5).forEach((cmd, index) => {
				console.log(`    ${index + 1}. "${cmd.command}" (${cmd.count} times)`)
			})
		}

		if (stats.oldestEntry && stats.newestEntry) {
			console.log(
				`  Date range: ${stats.oldestEntry.toLocaleDateString()} - ${stats.newestEntry.toLocaleDateString()}`,
			)
		}
	}

	private async executeCommand(task: string): Promise<void> {
		const options: ApiClientOptions = {
			...this.options,
			task: this.taskId || undefined,
			restartTask: !!this.taskId,
			replMode: false, // We're executing a single command, not in REPL mode
			logSystemPrompt: false,
			logLlm: false,
		}

		try {
			if (this.options.useStream) {
				await executeStreamingRequest(options, task, this)
			} else {
				await executeBasicRequest(options, task, this)
			}
		} catch (error) {
			console.error(`❌ Error executing command: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}

/**
 * Client content filter for processing streaming content
 */
class ClientContentFilter {
	private options: ContentFilterOptions
	private state: ContentFilterState
	private finalTokenUsage: TokenUsage | null = null
	private finalTokenTimestamp: string | null = null

	constructor(options: ContentFilterOptions) {
		this.options = options
		this.state = {
			currentState: "normal",
			currentTag: "",
			currentSection: null,
			sectionStack: [],
		}
	}

	shouldShowContent(contentType: string): boolean {
		if (!contentType) return true

		switch (contentType) {
			case "thinking":
				return this.options.showThinking
			case "tool":
				return this.options.showTools
			case "system":
				return this.options.showSystem
			case "response":
				return this.options.showResponse
			case "completion":
				return this.options.showCompletion
			case "mcp_use":
				return this.options.showMcpUse
			default:
				return true
		}
	}

	processText(text: string): string {
		// Simple implementation - in a full implementation this would handle
		// XML tag filtering based on content type settings
		return text
	}

	isSystemMessage(text: string): boolean {
		if (!text) return false
		return text.includes("[SYSTEM]") || text.includes("[DEBUG]") || text.includes("[INTERNAL]")
	}

	getContentTypePrefix(contentType: string, toolName?: string): string {
		switch (contentType) {
			case "thinking":
				return "🤔 "
			case "tool":
				return toolName ? `🔧 ${toolName}: ` : "🔧 "
			case "system":
				return "⚙️  "
			case "response":
				return "💬 "
			case "completion":
				return "✅ "
			case "mcp_use":
				return "🔌 "
			default:
				return ""
		}
	}

	/**
	 * Main method to handle event output formatting
	 */
	formatAndOutputEvent(event: StreamEvent, timestamp: string): void {
		if (this.options.verbose) {
			this.outputVerboseEvent(event, timestamp)
		} else {
			this.outputSimpleEvent(event, timestamp)
		}
	}

	/**
	 * Verbose mode output - shows everything with timestamps
	 */
	private outputVerboseEvent(event: StreamEvent, timestamp: string): void {
		switch (event.type) {
			case "start":
				console.log(`     🚀 [${timestamp}] ${event.message}: ${event.result}`)
				break
			case "progress":
				console.log(`     ⏳ [${timestamp}] Step ${event.step}/${event.total}: ${event.message}`)
				break
			case "complete":
			case "completion":
				console.log(`     ✅ [${timestamp}] ${event.message}`)
				console.log(`     📋 Result: ${event.result}`)
				console.log("     ⏳ Task completed, waiting for stream_end signal...")
				break
			case "token_usage":
				if (this.options.verbose) {
					console.log(`[DEBUG-TOKEN-USAGE] 📊 Received token usage event at ${timestamp}`)
					console.log(`[DEBUG-TOKEN-USAGE] Raw event data:`, JSON.stringify(event, null, 2))
				}

				if (this.options.showTokenUsage && !this.options.hideTokenUsage) {
					this.finalTokenUsage = event.tokenUsage || null
					this.finalTokenTimestamp = timestamp
					if (this.options.verbose) {
						console.log(`[DEBUG-TOKEN-USAGE] ✅ Token usage accumulated for final display`)
					}
				}
				break
			case "stream_end":
				console.log("     🔚 Stream ended by server, closing connection...")
				if (this.finalTokenUsage && this.options.showTokenUsage && !this.options.hideTokenUsage) {
					displayTokenUsage(this.finalTokenUsage, this.finalTokenTimestamp!)
				}
				break
			case "error":
				console.log(`     ❌ [${timestamp}] Error: ${event.error}`)
				break
			default:
				console.log(`     📨 [${timestamp}] ${JSON.stringify(event)}`)
		}
	}

	/**
	 * Simple mode output - selective display based on content filtering
	 */
	private outputSimpleEvent(event: StreamEvent, timestamp: string): void {
		const shouldDisplay = this.shouldShowContent(event.contentType || "")
		const messageIsSystem = this.isSystemMessage(event.message || "")
		const resultIsSystem = this.isSystemMessage(event.result || "")

		switch (event.type) {
			case "start":
				// Don't output anything for start
				break
			case "error":
				if (event.error === "Invalid mode") {
					console.log(`❌ Invalid mode: ${event.message}`)
					console.log(`💡 Tip: Check available modes on the server or use a built-in mode`)
					return
				}
				console.log(`❌ Error: ${event.error || event.message}`)
				break
			case "progress":
			case "log":
				if (event.message && event.message !== "Processing..." && !messageIsSystem && shouldDisplay) {
					this.outputContentWithPrefix(event.message, event.contentType, event.toolName)
				}
				break
			case "complete":
			case "completion":
				if (event.result && !resultIsSystem && shouldDisplay) {
					const filteredResult = this.processText(event.result)
					process.stdout.write(filteredResult)
				}
				break
			case "token_usage":
				if (this.options.showTokenUsage && !this.options.hideTokenUsage) {
					this.finalTokenUsage = event.tokenUsage || null
					this.finalTokenTimestamp = timestamp
				}
				break
			case "stream_end":
				if (this.finalTokenUsage && this.options.showTokenUsage && !this.options.hideTokenUsage) {
					displayTokenUsage(this.finalTokenUsage, this.finalTokenTimestamp!)
				}
				break
		}
	}

	/**
	 * Helper method to output content with appropriate prefix
	 */
	private outputContentWithPrefix(message: string, contentType?: string, toolName?: string): void {
		if (contentType && contentType !== "content" && !message.match(/^<[^>]*>.*<\/[^>]*>$/)) {
			const prefix = this.getContentTypePrefix(contentType, toolName)
			if (prefix) {
				process.stdout.write(prefix)
			}
		}
		const filteredMessage = this.processText(message)
		process.stdout.write(filteredMessage)
	}

	/**
	 * Get final token usage for display
	 */
	getFinalTokenUsage(): { tokenUsage: TokenUsage | null; timestamp: string | null } {
		return {
			tokenUsage: this.finalTokenUsage,
			timestamp: this.finalTokenTimestamp,
		}
	}

	/**
	 * Reset token usage state
	 */
	resetTokenUsage(): void {
		this.finalTokenUsage = null
		this.finalTokenTimestamp = null
	}
}

// Utility functions (these would be implemented with the full logic from the original file)

/**
 * Handle QUESTION_EVENT detected in SSE message content
 * AC-002: Integration with QuestionEventHandler infrastructure
 */
async function handleQuestionEvent(
	message: string,
	verbose: boolean,
	streamProcessor?: StreamProcessor,
): Promise<void> {
	try {
		// Extract JSON payload after "QUESTION_EVENT:" prefix
		const questionEventPrefix = "QUESTION_EVENT: "
		const questionEventIndex = message.indexOf(questionEventPrefix)

		if (questionEventIndex === -1) {
			if (verbose) {
				console.log("⚠️  QUESTION_EVENT prefix not found in message")
			}
			return
		}

		const jsonStart = questionEventIndex + questionEventPrefix.length
		const jsonPayload = message.substring(jsonStart).trim()

		// Parse the question data
		const questionData = JSON.parse(jsonPayload) as QuestionEventData

		// Basic validation
		if (!questionData.type || !questionData.questionId || !questionData.questionType || !questionData.question) {
			if (verbose) {
				console.log("⚠️  Invalid question event structure:", questionData)
			}
			return
		}

		if (verbose) {
			console.log("\n🤔 Question detected from server:")
			console.log(`   Type: ${questionData.questionType}`)
			console.log(`   Question: ${questionData.question}`)
			console.log(`   ID: ${questionData.questionId}`)

			if (questionData.choices && Array.isArray(questionData.choices)) {
				console.log(`   Choices: ${questionData.choices.join(", ")}`)
			}

			console.log(`   Full question data:`, JSON.stringify(questionData, null, 2))
		}

		// AC-002: Process question through QuestionEventHandler
		const questionHandler = QuestionEventHandler.getInstance()

		// Pause stream processing if available
		if (streamProcessor) {
			streamProcessor.pauseProcessing()
			if (verbose) {
				console.log("⏸️  Stream processing paused for question handling")
			}
		}

		try {
			// Process the question (will be implemented in AC-003+)
			await questionHandler.processQuestion(questionData, verbose)

			if (verbose) {
				console.log("✅ Question processed successfully")
			}
		} finally {
			// Resume stream processing
			if (streamProcessor) {
				streamProcessor.resumeProcessing()
				if (verbose) {
					console.log("▶️  Stream processing resumed")
				}
			}
		}
	} catch (error) {
		if (verbose) {
			console.error("❌ Error handling QUESTION_EVENT:", error)
			console.error("   Raw message:", message)
		}

		// Ensure stream processing is resumed even on error
		if (streamProcessor) {
			streamProcessor.resumeProcessing()
		}
	}
}

/**
 * Generate a unique request ID for chunk logging
 */
function generateRequestId(): string {
	return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

async function executeStreamingRequest(
	options: ApiClientOptions,
	task: string,
	replSession?: REPLSession,
): Promise<void> {
	return new Promise((resolve, reject) => {
		if (options.verbose) {
			console.log("🌊 Testing POST /execute/stream (SSE)...\n")
		}

		const baseUrl = `http://${options.host}:${options.port}`

		// Initialize execution timer
		const executionTimer = new ExecutionTimer(options.verbose, options.showTiming)
		executionTimer.startTimer("streaming_request", `${baseUrl}/execute/stream`)

		// Create content filter instance
		const contentFilter = new ClientContentFilter({
			showResponse: options.showResponse,
			showThinking: options.showThinking,
			showTools: options.showTools,
			showSystem: options.showSystem,
			showCompletion: options.showCompletion,
			showMcpUse: options.showMcpUse,
			showTokenUsage: options.showTokenUsage,
			hideTokenUsage: options.hideTokenUsage,
			verbose: options.verbose,
		})

		// Create stream processor for handling question pausing
		const streamProcessor = new StreamProcessor(
			{
				verbose: options.verbose,
				maxRetries: 3,
				baseDelay: 1000,
			},
			options,
		)

		// Initialize chunk logger if enabled
		let chunkLogger: ApiChunkLogger | null = null
		if (options.logRawChunks) {
			chunkLogger = new ApiChunkLogger(true, options.rawChunkLogDir)

			// Prepare request context
			const requestContext: ApiChunkLogContext = {
				requestId: generateRequestId(),
				host: options.host,
				port: options.port,
				endpoint: "/execute/stream",
				timestamp: new Date().toISOString(),
				requestMetadata: {
					mode: options.mode,
					useStream: true,
					task: task.substring(0, 100), // Truncate for log
					logSystemPrompt: options.logSystemPrompt,
					logLlm: options.logLlm,
					verbose: options.verbose,
				},
			}

			// Initialize logger with context
			chunkLogger.initialize(requestContext).catch((error) => {
				if (options.verbose) {
					console.error("Failed to initialize chunk logger:", error)
				}
			})
		}

		let extractedTaskId: string | null = null

		const payload = JSON.stringify({
			task,
			mode: options.mode,
			verbose: options.verbose,
			logSystemPrompt: options.logSystemPrompt,
			logLlm: options.logLlm,
			...(options.restartTask && options.task
				? {
						taskId: options.task,
						restartTask: true,
					}
				: {}),
		})

		const req = http.request(
			{
				hostname: options.host,
				port: options.port,
				path: "/execute/stream",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(payload),
					Accept: "text/event-stream",
					"Cache-Control": "no-cache",
				},
			},
			(res) => {
				executionTimer.endTimer("streaming_request")

				if (options.verbose) {
					console.log(`   Status: ${res.statusCode}`)
					console.log(`   Content-Type: ${res.headers["content-type"]}`)
					console.log("   Events:")
				}

				let buffer = ""
				let firstDataReceived = false
				let firstEventProcessed = false

				// Add sliding timeout protection to prevent hanging connections
				const STREAM_TIMEOUT = 30000 // 30 seconds
				let streamTimeout: NodeJS.Timeout | null = null
				let lastActivityTime: number | null = null

				// Sliding timeout function - resets every time there's activity
				function resetSlidingTimeout() {
					// Clear existing timeout
					if (streamTimeout) {
						clearTimeout(streamTimeout)
					}

					// Update last activity time
					lastActivityTime = Date.now()

					// Set new timeout for 30 seconds from now
					streamTimeout = setTimeout(() => {
						const inactiveTime = lastActivityTime
							? ((Date.now() - lastActivityTime) / 1000).toFixed(1)
							: "0"
						if (options.verbose) {
							console.log(
								`     ⏰ 30 second inactivity timeout (${inactiveTime}s since last activity) - forcing closure`,
							)
						} else {
							console.log(
								`❌ 30 second inactivity timeout (${inactiveTime}s since last activity) - forcing closure`,
							)
						}
						res.destroy()
					}, STREAM_TIMEOUT)
				}

				// Initialize sliding timeout
				resetSlidingTimeout()

				res.on("data", (chunk) => {
					// Log raw chunk FIRST, before any processing
					if (chunkLogger) {
						chunkLogger.logChunk(chunk.toString()).catch((error) => {
							if (options.verbose) {
								console.error("Failed to log chunk:", error)
							}
						})
					}

					buffer += chunk.toString()
					resetSlidingTimeout()

					// Process complete SSE events
					const events = buffer.split("\n\n")
					buffer = events.pop() || ""

					for (const eventData of events) {
						if (!eventData.trim()) continue

						try {
							const lines = eventData.split("\n")
							let eventType: string | null = null
							let data: string | null = null

							for (const line of lines) {
								if (line.startsWith("event: ")) {
									eventType = line.substring(7).trim()
								} else if (line.startsWith("data: ")) {
									data = line.substring(6).trim()
								}
							}

							if (data) {
								const event = JSON.parse(data)
								const timestamp = new Date().toLocaleTimeString()

								// Check for QUESTION_EVENT in message content
								if (event.message && event.message.includes("QUESTION_EVENT:")) {
									try {
										// Handle question event without await for now (will be improved in AC-002)
										handleQuestionEvent(event.message, options.verbose)
									} catch (error) {
										if (options.verbose) {
											console.error("Error handling question event:", error)
										}
									}
									// Continue processing the event normally as well
								}

								// Extract task ID from start event
								if (event.type === "start" && event.taskId && !extractedTaskId) {
									extractedTaskId = event.taskId
									if (options.verbose) {
										console.log(`🆔 Task ID extracted: ${extractedTaskId}`)
									}

									// Immediately update REPL session if provided
									if (replSession && replSession.setTaskId && extractedTaskId) {
										replSession.setTaskId(extractedTaskId)
									}

									// Update chunk logger context with task ID
									if (chunkLogger && extractedTaskId) {
										chunkLogger.updateContext({ taskId: extractedTaskId })
									}
								}

								// Process event through stream processor
								streamProcessor.processEvent(event, timestamp, contentFilter)

								if (event.type === "stream_end") {
									if (streamTimeout) {
										clearTimeout(streamTimeout)
									}
									resolve()
									return
								}
							}
						} catch (error) {
							if (options.verbose) {
								console.error("Error parsing SSE event:", error)
							}
						}
					}
				})

				res.on("end", () => {
					if (streamTimeout) {
						clearTimeout(streamTimeout)
					}

					// Close chunk logger
					if (chunkLogger) {
						chunkLogger.close().catch((error) => {
							if (options.verbose) {
								console.error("Failed to close chunk logger:", error)
							}
						})
					}

					if (options.verbose) {
						console.log("\n📊 Stream ended")
						const timers = executionTimer.getAllTimers()
						console.log(`[DEBUG-TIMING] Statistics:`, {
							totalOperations: timers.length,
							timers: timers.map((t) => `${t.operation}: ${t.duration}ms`),
						})
					}

					// Always show final timing (unless in verbose mode where it's already shown)
					if (!options.verbose) {
						console.log(`✅ Stream completed`)
					}

					resolve()
				})

				res.on("error", (error) => {
					// Close chunk logger on error
					if (chunkLogger) {
						chunkLogger.close().catch((closeError) => {
							if (options.verbose) {
								console.error("Failed to close chunk logger on error:", closeError)
							}
						})
					}

					reject(error)
				})
			},
		)

		req.on("error", (error) => {
			reject(error)
		})

		req.write(payload)
		req.end()
	})
}

async function executeBasicRequest(options: ApiClientOptions, task: string, replSession?: REPLSession): Promise<void> {
	// Implementation would go here - this is a simplified version
	const timer = new ExecutionTimer(options.verbose, options.showTiming)
	timer.startTimer("basic_request")

	try {
		// Actual basic request implementation would go here
		console.log("📡 Basic request implementation...")
		timer.endTimer("basic_request")
	} catch (error) {
		timer.endTimer("basic_request")
		throw error
	}
}

function promptUser(question: string, choices: string[] = []): Promise<string> {
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})

		rl.question(`${question} `, (answer) => {
			rl.close()
			resolve(answer.trim())
		})
	})
}

async function submitAnswer(questionId: string, answer: string): Promise<void> {
	// Implementation would go here
	console.log(`📤 Submitting answer for question ${questionId}: ${answer}`)
}

function displayTokenUsage(tokenUsage: TokenUsage, timestamp: string): void {
	console.log(`\n📊 Token Usage [${timestamp}]:`)
	console.log(`   Input tokens: ${tokenUsage.inputTokens}`)
	console.log(`   Output tokens: ${tokenUsage.outputTokens}`)
	console.log(`   Total tokens: ${tokenUsage.totalTokens}`)
	if (tokenUsage.cost) {
		console.log(`   Cost: $${tokenUsage.cost.toFixed(4)}`)
	}
}

function showHelpText(): void {
	console.log(`
🧪 Roo Code Agent API Test Client

Usage: api-client [options] "Your task here"

Options:
  --mode           Agent mode (default: code)
  --task <id>      Restart an existing task by ID (UUID format)
  --repl           Start interactive REPL mode for continuous conversation
  --stream         Test SSE streaming endpoint (default: false)
  --verbose        Show full JSON payload and debug information
  --show-timing    Show detailed execution timing for operations
  --show-thinking  Show thinking sections in LLM output
  --show-tools     Show tool call content
  --show-system    Show system content
  --show-response  Show final response content
  --show-completion Show attempt_completion tags
  --show-mcp-use   Show use_mcp_tool sections
  --show-token-usage Show token usage information (default: true)
  --hide-token-usage Hide token usage information
  --log-raw-chunks   Enable raw HTTP chunk logging
  --raw-chunk-log-dir <path>  Directory for raw chunk log files (default: ~/.agentz/logs)
  --host           API host (default: localhost)
  --port           API port (default: 3000)
  --help           Show this help

Examples:
  api-client --stream --mode code "Fix this bug"
  api-client --repl --stream
  api-client --stream --task abc123-def456-ghi789 "Add auth"
  api-client --stream --log-raw-chunks --verbose "debug streaming issue"
  api-client --stream --log-raw-chunks --raw-chunk-log-dir ./debug-logs "test task"
`)
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
	const { options, task, showHelp } = parseCommandLineArgs()

	if (showHelp) {
		showHelpText()
		process.exit(0)
	}

	const baseUrl = `http://${options.host}:${options.port}`

	if (options.verbose) {
		console.log(`🚀 Testing Roo Code Agent API at ${baseUrl}`)
		console.log(`📝 Task: "${task}"`)
		console.log(`🎭 Mode: ${options.mode}`)
		if (options.restartTask && options.task) {
			console.log(`🔄 Task Restart: ${options.task}`)
		}
		console.log(`🌊 Streaming: ${options.useStream ? "enabled" : "disabled"}`)
		console.log("")
	}

	try {
		if (options.replMode) {
			const replSession = new REPLSession({
				taskId: options.task,
				verbose: options.verbose,
				host: options.host,
				port: options.port,
				mode: options.mode,
				useStream: options.useStream,
				showResponse: options.showResponse,
				showThinking: options.showThinking,
				showTools: options.showTools,
				showSystem: options.showSystem,
				showCompletion: options.showCompletion,
				showMcpUse: options.showMcpUse,
				showTokenUsage: options.showTokenUsage,
				hideTokenUsage: options.hideTokenUsage,
				showTiming: options.showTiming,
				logRawChunks: options.logRawChunks,
				rawChunkLogDir: options.rawChunkLogDir,
			})

			await replSession.start()
		} else {
			// Execute single command
			if (options.useStream) {
				await executeStreamingRequest(options, task)
			} else {
				await executeBasicRequest(options, task)
			}
		}
	} catch (error) {
		console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`)
		process.exit(1)
	}
}

// Execute main function
if (require.main === module) {
	main().catch((error) => {
		console.error(`❌ Fatal error: ${error instanceof Error ? error.message : String(error)}`)
		process.exit(1)
	})
}

export { main, parseCommandLineArgs, validateTaskId, ApiClientOptions, REPLSessionOptions, StreamProcessorOptions }
