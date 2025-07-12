# API Client TypeScript Conversion - Implementation Guide

## Overview

This guide provides step-by-step instructions for converting the `api-client.js` to TypeScript and integrating it into the build system to fix the ReplHistoryService issue.

## Prerequisites

- Node.js 20.19.2
- TypeScript knowledge
- Familiarity with esbuild
- Understanding of the existing codebase structure

## Implementation Steps

### Step 1: Create TypeScript Type Definitions

First, create the type definitions that will be used throughout the implementation.

**File: `src/tools/types/api-client-types.ts`**

```typescript
import { ReplHistoryService } from "../../shared/services/ReplHistoryService"

// Command line options interface
export interface ApiClientOptions {
	useStream: boolean
	host: string
	port: number
	mode: string
	task?: string
	restartTask: boolean
	replMode: boolean
	verbose: boolean
	showThinking: boolean
	showTools: boolean
	showSystem: boolean
	showResponse: boolean
	showCompletion: boolean
	showMcpUse: boolean
	showTokenUsage: boolean
	hideTokenUsage: boolean
	showTiming: boolean
	logSystemPrompt: boolean
	logLlm: boolean
}

// REPL session configuration
export interface REPLSessionOptions {
	historyService?: ReplHistoryService
	taskId?: string
	verbose: boolean
	host: string
	port: number
	mode: string
	useStream: boolean
	showResponse: boolean
	showThinking: boolean
	showTools: boolean
	showSystem: boolean
	showCompletion: boolean
	showMcpUse: boolean
	showTokenUsage: boolean
	hideTokenUsage: boolean
	showTiming: boolean
}

// Stream processor options
export interface StreamProcessorOptions {
	verbose?: boolean
	maxRetries?: number
	baseDelay?: number
	showResponse?: boolean
	showThinking?: boolean
	showTools?: boolean
	showSystem?: boolean
	showCompletion?: boolean
	showMcpUse?: boolean
	showTokenUsage?: boolean
	hideTokenUsage?: boolean
}

// Content filter options
export interface ContentFilterOptions {
	showResponse: boolean
	showThinking: boolean
	showTools: boolean
	showSystem: boolean
	showCompletion: boolean
	showMcpUse: boolean
}

// API request/response types
export interface ApiRequest {
	task: string
	mode: string
	taskId?: string
	restartTask?: boolean
}

export interface ApiResponse {
	success: boolean
	data?: any
	error?: string
}

// Event types for streaming
export interface StreamEvent {
	type: string
	message?: string
	error?: string
	questionId?: string
	tokenUsage?: TokenUsage
	contentType?: string
	toolName?: string
	[key: string]: any
}

export interface TokenUsage {
	inputTokens: number
	outputTokens: number
	totalTokens: number
	cost?: number
}

// Supported modes
export type SupportedMode =
	| "code"
	| "debug"
	| "architect"
	| "ask"
	| "test"
	| "design-engineer"
	| "release-engineer"
	| "translate"
	| "product-owner"
	| "orchestrator"

// Command line argument parsing result
export interface ParsedArgs {
	options: ApiClientOptions
	task: string
	showHelp: boolean
}

// HTTP request options
export interface HttpRequestOptions {
	hostname: string
	port: number
	path: string
	method: string
	headers: Record<string, string>
}

// Question handling types
export interface QuestionEvent {
	type: "question_ask"
	questionId: string
	message: string
	choices?: string[]
}

export interface AnswerSubmission {
	questionId: string
	answer: string
}
```

### Step 2: Convert Main API Client to TypeScript

**File: `src/tools/api-client.ts`**

```typescript
#!/usr/bin/env node

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
import { ReplHistoryService } from "../shared/services/ReplHistoryService"
import { getGlobalStoragePath } from "../shared/paths"
import {
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
	SupportedMode,
} from "./types/api-client-types"

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
	private isPaused = false
	private eventQueue: Array<{ event: StreamEvent; timestamp: string; contentFilter: ClientContentFilter }> = []
	private currentQuestion: QuestionEvent | null = null
	private questionLogger: QuestionLogger
	private verbose: boolean
	private maxRetries: number
	private baseDelay: number
	private showResponse: boolean
	private showThinking: boolean
	private showTools: boolean
	private showSystem: boolean
	private showCompletion: boolean
	private showMcpUse: boolean
	private showTokenUsage: boolean
	private hideTokenUsage: boolean
	private finalTokenUsage: TokenUsage | null = null
	private finalTokenTimestamp: string | null = null

	constructor(options: StreamProcessorOptions = {}) {
		this.questionLogger = new QuestionLogger(options.verbose)
		this.verbose = options.verbose || false
		this.maxRetries = options.maxRetries || 3
		this.baseDelay = options.baseDelay || 1000
		this.showResponse = options.showResponse || false
		this.showThinking = options.showThinking || false
		this.showTools = options.showTools || false
		this.showSystem = options.showSystem || false
		this.showCompletion = options.showCompletion || false
		this.showMcpUse = options.showMcpUse || false
		this.showTokenUsage = options.showTokenUsage !== undefined ? options.showTokenUsage : true
		this.hideTokenUsage = options.hideTokenUsage || false
	}

	async processEvent(event: StreamEvent, timestamp: string, contentFilter: ClientContentFilter): Promise<void> {
		// If paused and not a question event, queue it
		if (this.isPaused && event.type !== "question_ask") {
			this.eventQueue.push({ event, timestamp, contentFilter })
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
		// Implementation of regular event handling
		// This would include the existing logic from the original file
		// ... (implementation details)
	}

	private pauseProcessing(): void {
		this.isPaused = true
		this.questionLogger.logStreamPaused()
		console.log("\n⏸️  Stream paused - waiting for your response...")
	}

	private resumeProcessing(): void {
		this.isPaused = false
		this.questionLogger.logStreamResumed(this.eventQueue.length)

		if (this.eventQueue.length > 0) {
			console.log(`\n▶️  Stream resumed - processing ${this.eventQueue.length} queued events...`)
		}

		// Process all queued events
		const queuedEvents = [...this.eventQueue]
		this.eventQueue = []

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
		// Implementation of user prompting with retry logic
		// ... (implementation details)
		return "" // Placeholder
	}

	private async submitAnswerWithRetry(questionId: string, answer: string): Promise<void> {
		// Implementation of answer submission with retry logic
		// ... (implementation details)
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

		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			history: [], // We'll manage history through our service
		})
	}

	async start(): Promise<void> {
		console.log("🚀 Roo API Client REPL Mode")
		console.log("Commands: exit (quit), newtask (clear task), help (show help), history (show history)")

		if (this.historyService) {
			await this.loadHistory()
			console.log('💡 History service enabled - use "history" command for options')
		} else {
			console.log("⚠️  History service not available - history features disabled")
		}

		console.log("💡 First command will create a new task\n")

		this.promptUser()
	}

	private async loadHistory(): Promise<void> {
		if (!this.historyService) return

		try {
			await this.historyService.initialize()
			const history = this.historyService.getHistory(10) // Get last 10 commands
			if (history.length > 0) {
				console.log(`📚 Loaded ${history.length} previous commands`)
			}
		} catch (error) {
			console.warn(`Failed to load history: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	private promptUser(): void {
		const prompt = this.getPrompt()
		this.rl.question(prompt, async (input) => {
			await this.handleInput(input.trim())
			this.promptUser()
		})
	}

	private getPrompt(): string {
		const taskStatus = this.taskId ? `task:${this.taskId.substring(0, 8)}` : "new"
		return `roo-api [${taskStatus}] > `
	}

	private async handleInput(input: string): Promise<void> {
		if (!input) {
			return
		}

		// Handle special commands
		if (input === "exit" || input === "quit") {
			console.log("👋 Goodbye!")
			if (this.historyService) {
				await this.historyService.flush()
			}
			process.exit(0)
		}

		if (input === "newtask") {
			this.taskId = null
			console.log("🆕 Cleared task ID - next command will create a new task")
			return
		}

		if (input === "help") {
			this.showHelp()
			return
		}

		if (input.startsWith("history")) {
			await this.handleHistoryCommand(input.split(" ").slice(1))
			return
		}

		// Add to history before executing
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

		// Execute the command
		await this.executeCommand(input)
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
		// Implementation of command execution
		// This would call the API with the task
		// ... (implementation details)
	}
}

/**
 * Client content filter for processing streaming content
 */
class ClientContentFilter {
	private options: ContentFilterOptions

	constructor(options: ContentFilterOptions) {
		this.options = options
	}

	shouldShowContent(contentType: string): boolean {
		// Implementation of content filtering logic
		// ... (implementation details)
		return true // Placeholder
	}

	processText(text: string): string {
		// Implementation of text processing
		// ... (implementation details)
		return text // Placeholder
	}

	isSystemMessage(text: string): boolean {
		// Implementation of system message detection
		// ... (implementation details)
		return false // Placeholder
	}

	getContentTypePrefix(contentType: string, toolName?: string): string {
		// Implementation of content type prefix generation
		// ... (implementation details)
		return "" // Placeholder
	}
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
				historyService: undefined, // Will be initialized in constructor
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

/**
 * Execute streaming API request
 */
async function executeStreamingRequest(options: ApiClientOptions, task: string): Promise<void> {
	// Implementation of streaming request execution
	// ... (implementation details)
}

/**
 * Execute basic API request
 */
async function executeBasicRequest(options: ApiClientOptions, task: string): Promise<void> {
	// Implementation of basic request execution
	// ... (implementation details)
}

/**
 * Show help text
 */
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
  --host           API host (default: localhost)
  --port           API port (default: 3000)
  --help           Show this help

Examples:
  api-client --stream --mode code "Fix this bug"
  api-client --repl --stream
  api-client --stream --task abc123-def456-ghi789 "Add auth"
`)
}

// Execute main function
if (require.main === module) {
	main().catch((error) => {
		console.error(`❌ Fatal error: ${error instanceof Error ? error.message : String(error)}`)
		process.exit(1)
	})
}

export { main, ApiClientOptions, REPLSessionOptions, StreamProcessorOptions }
```

### Step 3: Update esbuild Configuration

**File: `src/esbuild.mjs` (add to existing configuration)**

````javascript
// Add after the existing configurations (around line 183)

/**
 * @type {import('esbuild').BuildOptions}
 */
const apiClientConfig = {
  ...buildOptions,
  entryPoints: ["tools/api-client.ts"],
  outfile: "dist/tools/api-client.js",
  banner: {
    js: '#!/usr/bin/env node'
  },
  alias: {
    "vscode": path.resolve(__dirname, "cli/__mocks__/vscode.js"),
    "@roo-code/telemetry": path.resolve(__dirname, "cli/__mocks__/@roo-code/telemetry.js"),
    "tiktoken/lite": path.resolve(__dirname, "cli/__mocks__/tiktoken.js"),
    "tiktoken/encoders/o200k_base": path.resolve(__dirname, "cli/__mocks__/tiktoken.js")
  },
  external: [
    // Keep Node.js built-ins external
    "http",
    "https",
    "readline",
    "path",
    "os",
    "fs"
  ],
  define: {
    'process.env.VSCODE_CONTEXT': 'false',
  },
  treeShaking: true,
  keepNames: true,
}

// Update the context creation (around line 185)
const [extensionCtx, workerCtx, cliCtx, apiCtx, apiClientCtx] = await Promise.all([
  esbuild.context(extensionConfig),
  esbuild.context(workerConfig),
  esbuild.context(cliConfig),
  esbuild.context(apiConfig),
  esbuild.context(apiClientConfig), // Add this line
])

// Update the watch/build logic (around line 192)
if (watch) {
  await Promise.all([
    extensionCtx.watch(),
    workerCtx.watch(),
    cliCtx.watch(),
    apiCtx.watch(),
    apiClientCtx.watch() // Add this line
  ])
  copyLocales(srcDir, distDir)
  setupLocaleWatcher(srcDir, distDir)
} else {
  await Promise.all([
    extensionCtx.rebuild(),
    workerCtx.rebuild(),
    cliCtx.rebuild(),
    apiCtx.rebuild(),
    apiClientCtx.rebuild() // Add this line
  ])

  // Make CLI executable
  const cliPath = path.join(distDir, "cli", "index.js")
  if (fs.existsSync(cliPath)) {
    fs.chmodSync(cliPath, 0o755)
  }

  // Make API client executable (ad

### Step 4: Complete esbuild Configuration

Add the remaining parts to the esbuild configuration:

```javascript
  // Make API client executable (complete the previous section)
  const apiClientPath = path.join(distDir, "tools", "api-client.js")
  if (fs.existsSync(apiClientPath)) {
    fs.chmodSync(apiClientPath, 0o755)
  }
}

// Dispose contexts
await Promise.all([
  extensionCtx.dispose(),
  workerCtx.dispose(),
  cliCtx.dispose(),
  apiCtx.dispose(),
  apiClientCtx.dispose() // Add this line
])
````

### Step 5: Update Package.json Scripts

**File: `src/package.json` (add to scripts section)**

```json
{
	"scripts": {
		// ... existing scripts ...
		"build:api-client": "node esbuild.mjs --api-client-only",
		"watch:api-client": "node esbuild.mjs --api-client-only --watch"
		// ... other scripts ...
	}
}
```

### Step 6: Create Wrapper Script for Backward Compatibility

**File: `api-client.js` (root directory - replace existing)**

```javascript
#!/usr/bin/env node

/**
 * Backward compatibility wrapper for the TypeScript API client
 * This script automatically uses the built TypeScript version when available
 */

const path = require("path")
const { spawn } = require("child_process")
const fs = require("fs")

// Check if built version exists
const builtClient = path.join(__dirname, "src", "dist", "tools", "api-client.js")

function checkBuiltVersion() {
	try {
		return fs.existsSync(builtClient) && fs.statSync(builtClient).isFile()
	} catch (error) {
		return false
	}
}

function showBuildInstructions() {
	console.error("❌ Built api-client not found.")
	console.error("")
	console.error("💡 To build the TypeScript version:")
	console.error("   cd src && npm run build")
	console.error("   # or for just the api-client:")
	console.error("   cd src && npm run build:api-client")
	console.error("")
	console.error("🔧 For development with auto-rebuild:")
	console.error("   cd src && npm run watch:api-client")
	console.error("")
}

function executeBuiltVersion() {
	// Execute built version with all arguments
	const child = spawn("node", [builtClient, ...process.argv.slice(2)], {
		stdio: "inherit",
		env: process.env,
	})

	// Handle process signals properly
	const signals = ["SIGINT", "SIGTERM", "SIGQUIT"]
	signals.forEach((signal) => {
		process.on(signal, () => {
			if (!child.killed) {
				child.kill(signal)
			}
		})
	})

	// Handle child process exit
	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal)
		} else {
			process.exit(code || 0)
		}
	})

	child.on("error", (error) => {
		console.error(`❌ Failed to execute api-client: ${error.message}`)
		process.exit(1)
	})
}

// Main execution
if (checkBuiltVersion()) {
	executeBuiltVersion()
} else {
	showBuildInstructions()
	process.exit(1)
}
```

### Step 7: Testing and Validation

#### Unit Tests

**File: `src/tools/__tests__/api-client.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals"
import { ApiClientOptions, REPLSessionOptions } from "../types/api-client-types"

// Mock dependencies
jest.mock("../../shared/services/ReplHistoryService")
jest.mock("../../shared/paths")

describe("API Client TypeScript Implementation", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	describe("Command Line Parsing", () => {
		it("should parse basic options correctly", () => {
			// Test command line argument parsing
			// ... test implementation
		})

		it("should handle REPL mode flag", () => {
			// Test REPL mode detection
			// ... test implementation
		})

		it("should validate task ID format", () => {
			// Test UUID validation
			// ... test implementation
		})
	})

	describe("REPL Session", () => {
		it("should initialize history service correctly", async () => {
			// Test history service initialization
			// ... test implementation
		})

		it("should handle history commands", async () => {
			// Test history command handling
			// ... test implementation
		})

		it("should gracefully handle missing history service", async () => {
			// Test fallback behavior
			// ... test implementation
		})
	})

	describe("Stream Processing", () => {
		it("should handle question events correctly", async () => {
			// Test question handling
			// ... test implementation
		})

		it("should queue events during question processing", async () => {
			// Test event queuing
			// ... test implementation
		})
	})
})
```

#### Integration Tests

**File: `src/tools/__tests__/api-client.integration.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals"
import { spawn, ChildProcess } from "child_process"
import * as path from "path"

describe("API Client Integration Tests", () => {
	const apiClientPath = path.join(__dirname, "../../dist/tools/api-client.js")

	beforeAll(async () => {
		// Ensure the API client is built
		// ... setup code
	})

	afterAll(async () => {
		// Cleanup
		// ... cleanup code
	})

	it("should show help when --help flag is used", (done) => {
		const child = spawn("node", [apiClientPath, "--help"])
		let output = ""

		child.stdout.on("data", (data) => {
			output += data.toString()
		})

		child.on("exit", (code) => {
			expect(code).toBe(0)
			expect(output).toContain("Roo Code Agent API Test Client")
			expect(output).toContain("Usage:")
			done()
		})
	})

	it("should handle REPL mode startup", (done) => {
		const child = spawn("node", [apiClientPath, "--repl"], {
			stdio: ["pipe", "pipe", "pipe"],
		})

		let output = ""
		child.stdout.on("data", (data) => {
			output += data.toString()
			if (output.includes("REPL Mode")) {
				child.stdin.write("exit\n")
			}
		})

		child.on("exit", (code) => {
			expect(output).toContain("REPL Mode")
			done()
		})
	})

	it("should validate task ID format", (done) => {
		const child = spawn("node", [apiClientPath, "--task", "invalid-id"])
		let errorOutput = ""

		child.stderr.on("data", (data) => {
			errorOutput += data.toString()
		})

		child.on("exit", (code) => {
			expect(code).toBe(1)
			expect(errorOutput).toContain("Invalid task ID format")
			done()
		})
	})
})
```

### Step 8: Build Script Modifications

**File: `src/esbuild.mjs` (additional modifications)**

```javascript
// Add command line argument handling for api-client-only builds
const apiClientOnly = process.argv.includes("--api-client-only")

// Modify the main function to handle api-client-only builds
if (apiClientOnly) {
	// Build only the API client
	const apiClientCtx = await esbuild.context(apiClientConfig)

	if (watch) {
		console.log("👀 Watching API client for changes...")
		await apiClientCtx.watch()
	} else {
		console.log("🔨 Building API client...")
		await apiClientCtx.rebuild()

		// Make executable
		const apiClientPath = path.join(distDir, "tools", "api-client.js")
		if (fs.existsSync(apiClientPath)) {
			fs.chmodSync(apiClientPath, 0o755)
			console.log("✅ API client built successfully")
		}
	}

	await apiClientCtx.dispose()
	return
}

// ... rest of existing build logic
```

### Step 9: Documentation Updates

**File: `README.md` (add section about API client)**

````markdown
## API Client

The API client is now implemented in TypeScript for better type safety and integration with the codebase.

### Building

```bash
# Build all components including API client
cd src && npm run build

# Build only the API client
cd src && npm run build:api-client

# Watch mode for development
cd src && npm run watch:api-client
```
````

### Usage

The API client maintains backward compatibility:

```bash
# Basic usage (same as before)
./api-client.js --stream "test task"

# REPL mode with history support
./api-client.js --repl --stream

# Task restart functionality
./api-client.js --stream --task <task-id> "continue task"
```

### History Features

The TypeScript version includes full history support in REPL mode:

- `history` - Show recent commands
- `history search <term>` - Search command history
- `history clear` - Clear all history
- `history stats` - Show usage statistics

````

### Step 10: Troubleshooting Guide

**File: `docs/troubleshooting/api-client-typescript.md`**

```markdown
# API Client TypeScript Troubleshooting

## Common Issues

### "Built api-client not found" Error

**Problem**: The wrapper script can't find the built TypeScript version.

**Solution**:
```bash
cd src
npm run build:api-client
````

### History Service Not Working

**Problem**: "ReplHistoryService not available" message appears.

**Solution**: This should be fixed with the TypeScript version. If you still see this:

1. Ensure you're using the built version: `ls -la src/dist/tools/api-client.js`
2. Check build logs for errors: `cd src && npm run build:api-client`
3. Verify TypeScript compilation: `cd src && npm run check-types`

### Build Failures

**Problem**: esbuild fails to compile the TypeScript code.

**Common causes**:

- Missing dependencies: `cd src && npm install`
- TypeScript errors: `cd src && npm run check-types`
- Path resolution issues: Check import paths in the TypeScript files

### Performance Issues

**Problem**: The TypeScript version is slower than the JavaScript version.

**Solutions**:

- Ensure you're using the built version, not ts-node
- Check bundle size: `ls -lh src/dist/tools/api-client.js`
- Profile with: `node --prof src/dist/tools/api-client.js --help`

### REPL Mode Issues

**Problem**: REPL commands don't work correctly.

**Debugging steps**:

1. Enable verbose mode: `./api-client.js --repl --verbose`
2. Check history file: `ls -la ~/.roo-code/api-client-repl-history.json`
3. Test history service directly in Node.js REPL

## Development Tips

### Debugging TypeScript Issues

```bash
# Check TypeScript compilation
cd src && npm run check-types

# Build with source maps
cd src && npm run build:api-client

# Use Node.js debugger
node --inspect-brk src/dist/tools/api-client.js --help
```

### Testing Changes

```bash
# Run unit tests
cd src && npm test -- tools/__tests__

# Run integration tests
cd src && npm run test:integration

# Manual testing
./api-client.js --repl --verbose
```

### Performance Profiling

```bash
# Profile startup time
time ./api-client.js --help

# Profile memory usage
node --max-old-space-size=100 src/dist/tools/api-client.js --repl

# Bundle analysis
cd src && npm run build:api-client -- --analyze
```

```

## Implementation Checklist

### Phase 1: TypeScript Conversion
- [ ] Create type definitions in `src/tools/types/api-client-types.ts`
- [ ] Convert main logic to `src/tools/api-client.ts`
- [ ] Implement proper ReplHistoryService integration
- [ ] Add comprehensive error handling
- [ ] Include JSDoc documentation

### Phase 2: Build Integration
- [ ] Update `src/esbuild.mjs` with api-client configuration
- [ ] Add build scripts to `src/package.json`
- [ ] Test build process in development and production modes
- [ ] Verify executable permissions are set correctly
- [ ] Ensure all dependencies are properly bundled

### Phase 3: Backward Compatibility
- [ ] Create wrapper script in root `api-client.js`
- [ ] Test all command-line options pass through correctly
- [ ] Verify exit codes and signal handling work
- [ ] Add helpful error messages for missing build

### Phase 4: Testing
- [ ] Write unit tests for core functionality
- [ ] Create integration tests for CLI interface
- [ ] Test REPL mode with history features
- [ ] Validate cross-platform compatibility
- [ ] Performance testing and optimization

### Phase 5: Documentation
- [ ] Update README with build instructions
- [ ] Create troubleshooting guide
- [ ] Document new TypeScript architecture
- [ ] Update usage examples
- [ ] Add developer migration guide

## Success Criteria

1. **Functional**: ReplHistoryService works correctly in REPL mode
2. **Compatible**: All existing functionality preserved
3. **Performant**: No regression in startup time or memory usage
4. **Maintainable**: TypeScript provides better type safety and IDE support
5. **Reliable**: Comprehensive error handling and graceful degradation

This implementation guide provides a complete roadmap for converting the API client to TypeScript while maintaining backward compatibility and fixing the history service issue.
```
