#!/usr/bin/env node

/**
 * Test script for Roo Code Agent API Server
 * Usage: node api-client.js [options] "Your task here"
 *
 * Options:
 *   --stream    Test SSE streaming endpoint (default: false)
 *   --host      API host (default: localhost)
 *   --port      API port (default: 3000)
 *   --help      Show help
 */

const http = require("http")
const https = require("https")
const readline = require("readline")

// Parse command line arguments
const args = process.argv.slice(2)
let useStream = false
let host = "localhost"
let port = 3000
let task = "Test task from API client"
let mode = "code" // Default mode
let showHelp = false
let verbose = false
let showThinking = false
let showTools = false
let showSystem = false
let logSystemPrompt = false
let logLlm = false
let showResponse = false
let showCompletion = false
let showMcpUse = false
let showTokenUsage = true // Default to show (user requested)
let hideTokenUsage = false
let showTiming = false
let taskId = null // New: Task ID for restart functionality
let restartTask = false // New: Flag to indicate task restart

/**
 * Validate task ID format (UUID)
 */
function validateTaskId(taskId) {
	// Basic UUID format validation
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
	return uuidRegex.test(taskId)
}

for (let i = 0; i < args.length; i++) {
	const arg = args[i]

	if (arg === "--stream") {
		useStream = true
	} else if (arg === "--mode") {
		mode = args[++i] || "code"
	} else if (arg === "--host") {
		host = args[++i] || host
	} else if (arg === "--port") {
		port = parseInt(args[++i]) || port
	} else if (arg === "--verbose" || arg === "-v") {
		verbose = true
	} else if (arg === "--show-thinking") {
		showThinking = true
	} else if (arg === "--show-tools") {
		showTools = true
	} else if (arg === "--show-system") {
		showSystem = true
	} else if (arg === "--log-system-prompt") {
		logSystemPrompt = true
	} else if (arg === "--log-llm") {
		logLlm = true
	} else if (arg === "--show-response") {
		showResponse = true
	} else if (arg === "--show-completion") {
		showCompletion = true
	} else if (arg === "--show-mcp-use") {
		showMcpUse = true
	} else if (arg === "--show-token-usage") {
		showTokenUsage = true
		hideTokenUsage = false
	} else if (arg === "--hide-token-usage") {
		showTokenUsage = false
		hideTokenUsage = true
	} else if (arg === "--show-timing") {
		showTiming = true
	} else if (arg === "--task") {
		taskId = args[++i]
		if (!taskId) {
			console.error("Error: --task requires a task ID")
			process.exit(1)
		}
		if (!validateTaskId(taskId)) {
			console.error("Error: Invalid task ID format. Expected UUID format.")
			process.exit(1)
		}
		restartTask = true
		if (verbose) {
			console.log(`🔄 Task restart mode: ${taskId}`)
		}
	} else if (arg === "--help" || arg === "-h") {
		showHelp = true
	} else if (!arg.startsWith("--")) {
		task = arg
	}
}

if (showHelp) {
	console.log(`
🧪 Roo Code Agent API Test Client

Usage: node api-client.js [options] "Your task here"

Options:
  --mode           Agent mode (default: code)
                   Built-in: code, debug, architect, ask, test, design-engineer,
                            release-engineer, translate, product-owner, orchestrator
                   Custom modes loaded from server storage
  --task <id>      Restart an existing task by ID (UUID format)
  --stream         Test SSE streaming endpoint (default: false)
  --verbose        Show full JSON payload and debug information (default: false)
  --show-timing    Show detailed execution timing for operations (default: false)
  --show-thinking  Show thinking sections in LLM output (default: false)
  --show-tools     Show tool call content (default: false)
  --show-system    Show system content (default: false)
  --show-response  Show final response content (default: false)
  --show-completion Show attempt_completion tags (default: false)
  --show-mcp-use   Show use_mcp_tool sections (default: false)
  --show-token-usage Show token usage information (default: true)
  --hide-token-usage Hide token usage information
  --log-system-prompt  Log system prompt to file (default: false)
  --log-llm        Log raw LLM interactions to file (default: false)
  --host           API host (default: localhost)
  --port           API port (default: 3000)
  --help           Show this help

Content Display:
  Default mode shows only main content and tool results (no final response).
  Use --show-thinking to see LLM reasoning sections.
  Use --show-tools to see tool calls and their parameters.
  Use --show-system to see all system-level content.
  Use --show-response to show the final response/completion message.
  Use --show-completion to show attempt_completion sections.
  Use --show-mcp-use to show use_mcp_tool sections.
  Use --verbose to see full JSON payloads with all metadata.

Timing Display:
  Default mode shows only final execution time in format: "task completed in min:sec:millis"
  Use --show-timing to see detailed operation timing during execution.
  Use --verbose to see debug timing information even without --show-timing.

Token Usage Display:
  Token usage is shown by default when available from the server.
  Use --hide-token-usage to suppress token usage display.
  Use --verbose to see detailed debug information about token usage events.

Examples:
  # Built-in modes
  node api-client.js --stream --mode code "Fix this bug"
  node api-client.js --stream --mode architect "Plan this feature"
  
  # Task restart functionality
  node api-client.js --stream "Create a todo app"                    # Start new task (returns task ID)
  node api-client.js --stream --task abc123-def456-ghi789 "Add auth" # Restart existing task
  
  # Custom modes (if configured on server)
  node api-client.js --stream --mode product-owner "Create a PRD for user auth"
  node api-client.js --stream --mode ticket-oracle "Check ticket status"
  
  # Default mode
  node api-client.js --stream "Test task" # Uses code mode
  
  # Show final response
  node api-client.js --stream --show-response "Complete this task"
  
  # Other examples
  node api-client.js --verbose --stream --mode debug "Debug this issue"
  node api-client.js --host api.example.com --port 8080 --mode ask "Explain this"

  # Timing and token usage examples
  node api-client.js --stream "test task"                    # Shows token usage, final timing
  node api-client.js --stream --show-timing "test task"      # Shows detailed timing
  node api-client.js --stream --hide-token-usage "test task" # Hides token usage
  node api-client.js --stream --verbose "test task"          # Debug token usage issues
  node api-client.js --stream --verbose --show-timing "test task" # Full debug mode
`)
	process.exit(0)
}

const baseUrl = `http://${host}:${port}`

if (verbose) {
	console.log(`🚀 Testing Roo Code Agent API at ${baseUrl}`)
	console.log(`📝 Task: "${task}"`)
	console.log(`🎭 Mode: ${mode}`)
	if (restartTask) {
		console.log(`🔄 Task Restart: ${taskId}`)
	}
	console.log(`🌊 Streaming: ${useStream ? "enabled" : "disabled"}`)
	console.log(`📊 Verbose: ${verbose ? "enabled" : "disabled"}`)
	console.log(`🧠 Show Thinking: ${showThinking ? "enabled" : "disabled"}`)
	console.log(`🔧 Show Tools: ${showTools ? "enabled" : "disabled"}`)
	console.log(`⚙️  Show System: ${showSystem ? "enabled" : "disabled"}`)
	console.log(`📤 Show Response: ${showResponse ? "enabled" : "disabled"}`)
	console.log(`📝 Log System Prompt: ${logSystemPrompt ? "enabled" : "disabled"}`)
	console.log(`🤖 Log LLM: ${logLlm ? "enabled" : "disabled"}`)
	console.log("")
}

/**
 * Enhanced question logger for debugging and monitoring
 */
class QuestionLogger {
	constructor(verbose = false) {
		this.verbose = verbose
	}

	logEvent(event, data) {
		if (!this.verbose) return

		const logEntry = {
			timestamp: new Date().toISOString(),
			event,
			...data,
		}
		console.log(`[QUESTION-LOG] ${JSON.stringify(logEntry)}`)
	}

	logQuestionReceived(questionId, question) {
		this.logEvent("question_received", {
			questionId,
			question: question.substring(0, 100),
		})
	}

	logStreamPaused() {
		this.logEvent("stream_paused", {})
	}

	logStreamResumed(queuedEventsCount) {
		this.logEvent("stream_resumed", { queuedEventsCount })
	}

	logAnswerSubmission(questionId, answer, attempt) {
		this.logEvent("answer_submission", {
			questionId,
			answer: answer.substring(0, 50),
			attempt,
		})
	}

	logAnswerResult(questionId, success, error = null) {
		this.logEvent("answer_result", {
			questionId,
			success,
			error,
		})
	}

	logQuestionCompleted(questionId, answer) {
		this.logEvent("question_completed", {
			questionId,
			answer: answer.substring(0, 50),
		})
	}

	logQuestionError(questionId, error) {
		this.logEvent("question_error", {
			questionId,
			error: error.message || error,
		})
	}

	logEventQueued(eventType) {
		this.logEvent("event_queued", { eventType })
	}
}

/**
 * Stream processor that handles pausing/resuming during questions
 */
class StreamProcessor {
	constructor(options = {}) {
		this.isPaused = false
		this.eventQueue = []
		this.currentQuestion = null
		this.questionLogger = new QuestionLogger(options.verbose)
		this.verbose = options.verbose || false
		this.maxRetries = options.maxRetries || 3
		this.baseDelay = options.baseDelay || 1000

		// Store display options for event processing
		this.showResponse = options.showResponse || false
		this.showThinking = options.showThinking || false
		this.showTools = options.showTools || false
		this.showSystem = options.showSystem || false
		this.showCompletion = options.showCompletion || false
		this.showMcpUse = options.showMcpUse || false
		this.showTokenUsage = options.showTokenUsage !== undefined ? options.showTokenUsage : true
		this.hideTokenUsage = options.hideTokenUsage || false

		// Token usage accumulator
		this.finalTokenUsage = null
		this.finalTokenTimestamp = null
	}

	async processEvent(event, timestamp, contentFilter) {
		// If paused and not a question event, queue it
		if (this.isPaused && event.type !== "question_ask") {
			this.eventQueue.push({ event, timestamp, contentFilter })
			this.questionLogger.logEventQueued(event.type)
			return
		}

		switch (event.type) {
			case "question_ask":
				await this.handleQuestion(event, timestamp)
				break
			default:
				await this.handleRegularEvent(event, timestamp, contentFilter)
		}
	}

	async handleQuestion(event, timestamp) {
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
			this.questionLogger.logQuestionError(event.questionId, error)
			console.error(`❌ Question handling failed: ${error.message}`)
		} finally {
			this.resumeProcessing()
		}
	}

	async handleRegularEvent(event, timestamp, contentFilter) {
		// Process regular events (existing logic will be moved here)
		// For now, just log that we're processing it
		if (this.verbose) {
			console.log(`     📨 [${timestamp}] Processing ${event.type}`)
		}
	}

	pauseProcessing() {
		this.isPaused = true
		this.questionLogger.logStreamPaused()
		console.log("\n⏸️  Stream paused - waiting for your response...")
	}

	resumeProcessing() {
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
				// Process the queued event with the original logic
				this.handleRegularEvent(event, timestamp, contentFilter)
			} catch (error) {
				console.error(`❌ Error processing queued event ${event.type}: ${error.message}`)
			}
		}
	}

	async handleRegularEvent(event, timestamp, contentFilter) {
		// This method will handle all non-question events
		// We need to implement the original event processing logic here

		const shouldShowContent = (contentType) => contentFilter.shouldShowContent(contentType)
		const messageIsSystem = contentFilter.isSystemMessage(event.message)
		const resultIsSystem = contentFilter.isSystemMessage(event.result)

		if (this.verbose) {
			switch (event.type) {
				case "start":
					console.log(`     🚀 [${timestamp}] ${event.message}: ${event.task}`)
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
					// Always log reception for debugging when verbose
					if (this.verbose) {
						console.log(`[DEBUG-TOKEN-USAGE] 📊 Received token usage event at ${timestamp}`)
						console.log(`[DEBUG-TOKEN-USAGE] Raw event data:`, JSON.stringify(event, null, 2))
						console.log(
							`[DEBUG-TOKEN-USAGE] Display flags: showTokenUsage=${this.showTokenUsage}, hideTokenUsage=${this.hideTokenUsage}`,
						)
					}

					// Accumulate token usage instead of displaying immediately
					if (this.showTokenUsage && !this.hideTokenUsage) {
						this.finalTokenUsage = event.tokenUsage
						this.finalTokenTimestamp = timestamp
						if (this.verbose) {
							console.log(`[DEBUG-TOKEN-USAGE] ✅ Token usage accumulated for final display`)
						}
					} else {
						if (this.verbose) {
							const reason = this.hideTokenUsage ? "hideTokenUsage=true" : "showTokenUsage=false"
							console.log(`[DEBUG-TOKEN-USAGE] ⏭️ Token usage accumulation skipped (${reason})`)
						}
					}
					break
				case "stream_end":
					console.log("     🔚 Stream ended by server, closing connection...")
					// Display final token usage if we have it
					if (this.finalTokenUsage && this.showTokenUsage && !this.hideTokenUsage) {
						displayTokenUsage(this.finalTokenUsage, this.finalTokenTimestamp)
					}
					break
				case "error":
					console.log(`     ❌ [${timestamp}] Error: ${event.error}`)
					break
				default:
					console.log(`     📨 [${timestamp}] ${JSON.stringify(event)}`)
			}
		} else {
			// Simple output mode - stream content based on content type filtering
			const shouldDisplay = shouldShowContent(event.contentType)

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
					// Handle other errors normally
					console.log(`❌ Error: ${event.error || event.message}`)
					break
				case "progress":
				case "log":
					// Stream progress/log messages with content type filtering
					if (event.message && event.message !== "Processing..." && !messageIsSystem && shouldDisplay) {
						// Only add prefix for non-content types and when content isn't just XML
						if (
							event.contentType &&
							event.contentType !== "content" &&
							!event.message.match(/^<[^>]*>.*<\/[^>]*>$/)
						) {
							const prefix = contentFilter.getContentTypePrefix(event.contentType, event.toolName)
							if (prefix) {
								process.stdout.write(prefix)
							}
						}
						process.stdout.write(event.message)
					}
					break
				case "complete":
				case "completion":
					// Only show final result if --show-response is explicitly enabled
					if (this.showResponse && shouldDisplay) {
						let outputSomething = false
						if (!resultIsSystem && event.result) {
							process.stdout.write(event.result)
							outputSomething = true
						} else if (!messageIsSystem && event.message) {
							process.stdout.write(event.message)
							outputSomething = true
						}
						// Add final newline only if we actually output something
						if (outputSomething) {
							process.stdout.write("\n")
						}
					} else {
						// Default behavior: just ensure we end with a newline for clean terminal output
						process.stdout.write("\n")
					}
					break
				case "token_usage":
					// Always log reception for debugging when verbose
					if (this.verbose) {
						console.log(`[DEBUG-TOKEN-USAGE] 📊 Received token usage event at ${event.timestamp}`)
						console.log(`[DEBUG-TOKEN-USAGE] Raw event data:`, JSON.stringify(event, null, 2))
						console.log(
							`[DEBUG-TOKEN-USAGE] Display flags: showTokenUsage=${this.showTokenUsage}, hideTokenUsage=${this.hideTokenUsage}`,
						)
					}

					// Accumulate token usage instead of displaying immediately
					if (this.showTokenUsage && !this.hideTokenUsage) {
						this.finalTokenUsage = event.tokenUsage
						this.finalTokenTimestamp = event.timestamp
						if (this.verbose) {
							console.log(`[DEBUG-TOKEN-USAGE] ✅ Token usage accumulated for final display`)
						}
					} else {
						if (this.verbose) {
							const reason = this.hideTokenUsage ? "hideTokenUsage=true" : "showTokenUsage=false"
							console.log(`[DEBUG-TOKEN-USAGE] ⏭️ Token usage accumulation skipped (${reason})`)
						}
					}
					break
				case "stream_end":
					// Display final token usage if we have it
					if (this.finalTokenUsage && this.showTokenUsage && !this.hideTokenUsage) {
						displayTokenUsage(this.finalTokenUsage, this.finalTokenTimestamp)
					}
					// Stream ended - this will be handled by the main stream handler
					break
				case "error":
					console.log(`❌ Error: ${event.error}`)
					break
				default:
					// Special handling for log events that might contain final results
					if (event.type === "log" && event.message && event.message.length > 500) {
						// This looks like a complete final result dump - suppress it in non-verbose mode
						if (!this.verbose && !this.showResponse) {
							break
						}
					}

					// Stream any other message content with filtering
					if (event.message && !messageIsSystem && shouldDisplay) {
						if (
							event.contentType &&
							event.contentType !== "content" &&
							!event.message.match(/^<[^>]*>.*<\/[^>]*>$/)
						) {
							const prefix = contentFilter.getContentTypePrefix(event.contentType, event.toolName)
							if (prefix) {
								process.stdout.write(prefix)
							}
						}
						process.stdout.write(event.message)
					}
			}
		}
	}

	displayQuestion(event, timestamp) {
		console.log("\n" + "=".repeat(60))
		console.log("❓ QUESTION")
		console.log("=".repeat(60))
		console.log(`\n${event.message}\n`)

		if (event.choices && event.choices.length > 0) {
			console.log("Choices:")
			event.choices.forEach((choice, index) => {
				console.log(`  ${index + 1}. ${choice}`)
			})
			console.log("")
		}

		if (this.verbose) {
			console.log(`[${timestamp}] Question ID: ${event.questionId}`)
		}
	}

	async promptUserWithRetry(event) {
		const maxPromptAttempts = 3

		for (let attempt = 1; attempt <= maxPromptAttempts; attempt++) {
			try {
				const answer = await promptUser(event.message, event.choices)

				if (!answer || answer.trim() === "") {
					if (attempt < maxPromptAttempts) {
						console.log("⚠️ Empty answer provided, please try again...")
						continue
					} else {
						throw new Error("No valid answer provided")
					}
				}

				return answer.trim()
			} catch (error) {
				if (attempt < maxPromptAttempts) {
					console.log(`⚠️ Input error: ${error.message}, please try again...`)
				} else {
					throw error
				}
			}
		}

		throw new Error("Failed to get valid user input")
	}

	async submitAnswerWithRetry(questionId, answer) {
		for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
			try {
				this.questionLogger.logAnswerSubmission(questionId, answer, attempt)

				const success = await submitAnswer(questionId, answer)

				if (success) {
					console.log(`✅ Answer submitted successfully`)
					this.questionLogger.logAnswerResult(questionId, true)
					return
				}

				throw new Error("Answer submission returned false")
			} catch (error) {
				const isLastAttempt = attempt === this.maxRetries

				this.questionLogger.logAnswerResult(questionId, false, error.message)

				if (isLastAttempt) {
					console.error(`❌ Failed to submit answer after ${this.maxRetries} attempts`)
					throw new Error(`Answer submission failed: ${error.message}`)
				} else {
					const delay = this.baseDelay * Math.pow(2, attempt - 1)
					console.warn(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`)
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}
	}
}

/**
 * Execution timing tracker with configurable display options
 */
class ExecutionTimer {
	constructor(showTiming = false, verbose = false) {
		this.showTiming = showTiming
		this.verbose = verbose
		this.startTime = Date.now()
		this.operations = []
		this.lastOperationTime = this.startTime
	}

	/**
	 * Log an operation with timing information
	 * @param {string} operation - Operation name
	 * @param {string} details - Optional operation details
	 * @param {boolean} forceShow - Force show even if showTiming is false
	 */
	logOperation(operation, details = "", forceShow = false) {
		const now = Date.now()
		const operationDuration = now - this.lastOperationTime
		const totalDuration = now - this.startTime

		const operationRecord = {
			operation,
			details,
			duration: operationDuration,
			totalTime: totalDuration,
			timestamp: new Date(now).toISOString(),
		}

		this.operations.push(operationRecord)

		// Show timing if enabled or forced
		if (this.showTiming || forceShow) {
			const totalFormatted = this.formatDuration(totalDuration)
			const opFormatted =
				operationDuration < 1000 ? `${operationDuration}ms` : this.formatDuration(operationDuration)
			console.log(`⏱️  [${totalFormatted}] ${operation}${details ? ": " + details : ""} (+${opFormatted})`)
		}

		// Verbose logging always captures timing data for debugging
		if (this.verbose && !this.showTiming) {
			console.log(`[DEBUG-TIMING] ${operation}: ${operationDuration}ms (total: ${totalDuration}ms)`)
		}

		this.lastOperationTime = now
	}

	/**
	 * Format duration in min:sec:millis format
	 * @param {number} ms - Duration in milliseconds
	 * @returns {string} Formatted duration
	 */
	formatDuration(ms) {
		const minutes = Math.floor(ms / 60000)
		const seconds = Math.floor((ms % 60000) / 1000)
		const millis = ms % 1000
		return `${minutes}:${seconds.toString().padStart(2, "0")}:${millis.toString().padStart(3, "0")}`
	}

	/**
	 * Get final execution summary (always shown)
	 * @returns {string} Final timing summary
	 */
	getFinalSummary() {
		const totalDuration = Date.now() - this.startTime
		return `task completed in ${this.formatDuration(totalDuration)}`
	}

	/**
	 * Get timing statistics for analysis
	 * @returns {object} Timing statistics
	 */
	getStatistics() {
		const totalDuration = Date.now() - this.startTime
		return {
			totalDuration,
			operationCount: this.operations.length,
			operations: this.operations,
			averageOperationTime:
				this.operations.length > 0
					? this.operations.reduce((sum, op) => sum + op.duration, 0) / this.operations.length
					: 0,
			longestOperation:
				this.operations.length > 0
					? this.operations.reduce((max, op) => (op.duration > max.duration ? op : max))
					: null,
		}
	}

	/**
	 * Reset timer for new operation
	 */
	reset() {
		this.startTime = Date.now()
		this.operations = []
		this.lastOperationTime = this.startTime
	}
}

/**
 * Content filter for client output
 */
class ClientContentFilter {
	constructor(options = {}) {
		this.verbose = options.verbose || false
		this.showThinking = options.showThinking || false
		this.showTools = options.showTools || false
		this.showSystem = options.showSystem || false
		this.showResponse = options.showResponse || false
		this.showCompletion = options.showCompletion || false
		this.showMcpUse = options.showMcpUse || false

		// XML parser state
		this.parserState = "NORMAL" // NORMAL, TAG_OPENING, INSIDE_TAG, TAG_CLOSING
		this.currentTag = null // Current tag name we're inside
		this.tagBuffer = "" // Buffer for collecting tag name
		this.contentBuffer = "" // Buffer for collecting content
		this.outputBuffer = "" // Buffer for output content
		this.checkingForClosingTag = false // Flag to check for closing tag after '<'
		this.tempTagBuffer = "" // Temporary buffer for nested tag parsing
		this.nestedTagStart = 0 // Start position for nested tag parsing
		this.filteringNestedTag = null // Name of nested tag being filtered
		this.nestedTagDepth = 0 // Depth of nested tag filtering

		// Parsed sections storage
		this.parsedSections = [] // Array of parsed XML sections
		this.currentSection = null // Current section being parsed
	}

	/**
	 * Process SSE data and determine what should be output
	 * @param {Object} data - The parsed SSE data
	 * @returns {Object|null} - Output information or null if nothing should be output
	 */
	processData(data) {
		let hasFiltering = false
		const filteredData = { ...data }

		// Process the message content through XML parser if it exists
		if (data.message && typeof data.message === "string") {
			filteredData.message = this.processText(data.message)
			hasFiltering = true
		}

		// Process the result content through XML parser if it exists
		if (data.result && typeof data.result === "string") {
			filteredData.result = this.processText(data.result)
			hasFiltering = true
		}

		return {
			shouldOutput: true,
			content: filteredData,
			outputType: hasFiltering ? "filtered" : "raw",
		}
	}

	/**
	 * Process text content through XML parser
	 * @param {string} text - The text content to process
	 * @returns {string} - Filtered text content
	 */
	processText(text) {
		if (!text) return text

		// Reset state for new text processing
		this.outputBuffer = ""
		this.parsedSections = []
		this.currentSection = null
		this.filteringNestedTag = null
		this.nestedTagDepth = 0

		for (let i = 0; i < text.length; i++) {
			const char = text[i]
			this.processChar(char)
		}

		return this.outputBuffer
	}

	/**
	 * Process a single character through the state machine
	 * @param {string} char - The character to process
	 */
	processChar(char) {
		switch (this.parserState) {
			case "NORMAL":
				this.handleNormalState(char)
				break
			case "TAG_OPENING":
				this.handleTagOpeningState(char)
				break
			case "INSIDE_TAG":
				this.handleInsideTagState(char)
				break
			case "TAG_CLOSING":
				this.handleTagClosingState(char)
				break
		}
	}

	/**
	 * Handle character in NORMAL state
	 * @param {string} char - The character to handle
	 */
	handleNormalState(char) {
		if (char === "<") {
			this.parserState = "TAG_OPENING"
			this.tagBuffer = ""
			this.contentBuffer = ""
		} else {
			this.outputBuffer += char
		}
	}

	/**
	 * Handle character in TAG_OPENING state
	 * @param {string} char - The character to handle
	 */
	handleTagOpeningState(char) {
		if (char === ">") {
			// Complete tag found
			const tagName = this.tagBuffer.trim()

			if (this.isRecognizedTag(tagName)) {
				this.currentTag = tagName
				this.parserState = "INSIDE_TAG"
				this.contentBuffer = ""

				// Start tracking this section
				this.currentSection = {
					tagName: this.getCleanTagName(tagName),
					fullTag: tagName,
					content: "",
					startPos: this.outputBuffer.length,
				}

				// If we should show this tag, add the opening tag to output
				if (this.shouldShowTag(tagName)) {
					this.outputBuffer += "<" + this.tagBuffer + ">"
				}
			} else {
				// Not a recognized tag, output the buffered content
				this.outputBuffer += "<" + this.tagBuffer + ">"
				this.parserState = "NORMAL"
				this.tagBuffer = ""
			}
		} else if (char === " " || char === "\t" || char === "\n") {
			// Handle tags with attributes by treating space as end of tag name
			if (this.tagBuffer && !this.tagBuffer.includes(" ")) {
				this.tagBuffer += char
			} else {
				this.tagBuffer += char
			}
		} else {
			this.tagBuffer += char
		}
	}

	/**
	 * Handle character in INSIDE_TAG state
	 * @param {string} char - The character to handle
	 */
	handleInsideTagState(char) {
		if (char === "<") {
			// Store the '<' temporarily, we'll decide what to do with it
			this.contentBuffer += char

			// Store content in current section if we're tracking one
			if (this.currentSection) {
				this.currentSection.content = this.contentBuffer
			}

			if (this.shouldShowTag(this.currentTag)) {
				this.outputBuffer += char
			}
			// Set a flag to check for '/' on next character
			this.checkingForClosingTag = true
		} else if (this.checkingForClosingTag && char === "/") {
			// This is a closing tag, remove the last '<' from buffers
			this.contentBuffer = this.contentBuffer.slice(0, -1)
			if (this.shouldShowTag(this.currentTag)) {
				this.outputBuffer = this.outputBuffer.slice(0, -1)
			}
			this.parserState = "TAG_CLOSING"
			this.tagBuffer = ""
			this.checkingForClosingTag = false
		} else {
			// Normal content character
			this.contentBuffer += char

			// Store content in current section if we're tracking one
			if (this.currentSection) {
				this.currentSection.content = this.contentBuffer
			}

			if (this.shouldShowTag(this.currentTag)) {
				this.outputBuffer += char
			}
			this.checkingForClosingTag = false
		}
	}

	/**
	 * Parse a nested filtered tag and remove it from the content
	 * @param {string} tagName - The tag name to filter
	 */
	parseNestedFilteredTag(tagName) {
		// We need to continue parsing until we find the closing tag
		// For now, we'll remove the opening tag and mark that we're filtering
		const tagStartPos = this.nestedTagStart

		// Remove the opening tag from content buffer
		this.contentBuffer = this.contentBuffer.slice(0, tagStartPos)

		// Remove from output buffer if we're showing the parent tag
		if (this.shouldShowTag(this.currentTag)) {
			this.outputBuffer = this.outputBuffer.slice(0, tagStartPos)
		}

		// Store content in current section if we're tracking one
		if (this.currentSection) {
			this.currentSection.content = this.contentBuffer
		}

		// Set flag to indicate we're filtering a nested tag
		this.filteringNestedTag = tagName
		this.nestedTagDepth = 1
	}

	/**
	 * Check if a tag should be filtered out
	 * @param {string} tagName - The tag name to check
	 * @returns {boolean} - Whether the tag should be filtered
	 */
	shouldFilterTag(tagName) {
		const cleanTag = this.getCleanTagName(tagName)

		// Check if this tag should be filtered based on showThinking setting
		if (cleanTag === "thinking" && !this.showThinking) {
			return true
		}

		// Add other filtering logic here as needed
		return false
	}

	/**
	 * Handle character in TAG_CLOSING state
	 * @param {string} char - The character to handle
	 */
	handleTagClosingState(char) {
		if (char === ">") {
			// Complete closing tag
			const closingTagName = this.tagBuffer.trim()

			if (closingTagName === this.currentTag) {
				// Matching closing tag - save the completed section
				if (this.currentSection) {
					this.currentSection.content = this.contentBuffer
					this.currentSection.endPos = this.outputBuffer.length
					this.parsedSections.push(this.currentSection)
					this.currentSection = null
				}

				if (this.shouldShowTag(this.currentTag)) {
					// Apply nested tag filtering before adding to output
					const filteredContent = this.filterNestedTags(this.contentBuffer)

					// Remove the old content and add the filtered content
					const contentLength = this.contentBuffer.length
					const filteredLength = filteredContent.length

					// Adjust the output buffer
					this.outputBuffer = this.outputBuffer.slice(0, -contentLength) + filteredContent
					this.outputBuffer += "</" + closingTagName + ">"
				}

				// Reset state
				this.parserState = "NORMAL"
				this.currentTag = null
				this.tagBuffer = ""
				this.contentBuffer = ""
			} else {
				// Non-matching closing tag, treat as content
				this.contentBuffer += "</" + this.tagBuffer + ">"
				if (this.shouldShowTag(this.currentTag)) {
					this.outputBuffer += "</" + this.tagBuffer + ">"
				}
				this.parserState = "INSIDE_TAG"
				this.tagBuffer = ""
			}
		} else if (char === "/") {
			// Skip the '/' in closing tag
			if (this.tagBuffer === "") {
				// First character after '<'
				return
			}
			this.tagBuffer += char
		} else {
			this.tagBuffer += char
		}
	}

	/**
	 * Post-process content to filter out nested tags
	 * @param {string} content - The content to process
	 * @returns {string} - The filtered content
	 */
	filterNestedTags(content) {
		if (!content) return content

		// Filter out thinking tags if showThinking is false
		if (!this.showThinking) {
			// Remove thinking tags and their content
			content = content.replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, "")
		}

		// Filter out attempt_completion tags if showCompletion is false
		if (!this.showCompletion) {
			// Remove attempt_completion tags and their content
			content = content.replace(/<attempt_completion\b[^>]*>[\s\S]*?<\/attempt_completion>/gi, "")
		}

		// Filter out use_mcp_tool tags if showMcpUse is false
		if (!this.showMcpUse) {
			// Remove use_mcp_tool tags and their content
			content = content.replace(/<use_mcp_tool\b[^>]*>[\s\S]*?<\/use_mcp_tool>/gi, "")
		}

		return content
	}

	/**
	 * Get clean tag name without attributes
	 * @param {string} tagName - The full tag name with potential attributes
	 * @returns {string} - Clean tag name
	 */
	getCleanTagName(tagName) {
		return tagName.split(" ")[0].toLowerCase()
	}

	/**
	 * Check if a tag name is recognized for processing
	 * @param {string} tagName - The tag name to check
	 * @returns {boolean} - Whether the tag is recognized (true for any valid XML tag)
	 */
	isRecognizedTag(tagName) {
		const cleanTagName = this.getCleanTagName(tagName)
		// Accept any XML tag name that looks valid (letters, numbers, underscores, hyphens)
		return /^[a-z][a-z0-9_-]*$/i.test(cleanTagName)
	}

	/**
	 * Determine if content for a tag should be shown
	 * @param {string} tagName - The tag name
	 * @returns {boolean} - Whether to show the tag content
	 */
	shouldShowTag(tagName) {
		if (!tagName) return true

		const cleanTagName = this.getCleanTagName(tagName)

		// Only filter specific tags based on configuration
		switch (cleanTagName) {
			case "thinking":
				return this.showThinking // Default false - hide thinking unless explicitly shown
			case "attempt_completion":
				return this.showCompletion // Default false - hide attempt_completion unless explicitly shown
			case "use_mcp_tool":
				return this.showMcpUse // Default false - hide use_mcp_tool unless explicitly shown
			case "tool_call":
				// Show tool_call content by default (only hide if showTools is explicitly false)
				return true
			case "system":
				// Show system content by default (only hide if showSystem is explicitly false)
				return true
			default:
				return true // Show all other XML tags by default
		}
	}

	/**
	 * Get current parser state (for testing)
	 * @returns {string} - Current parser state
	 */
	getParserState() {
		return this.parserState
	}

	/**
	 * Get current tag (for testing)
	 * @returns {string|null} - Current tag name
	 */
	getCurrentTag() {
		return this.currentTag
	}

	/**
	 * Get tag buffer (for testing)
	 * @returns {string} - Current tag buffer
	 */
	getTagBuffer() {
		return this.tagBuffer
	}

	/**
	 * Get parsed XML sections from the last processText call
	 * @returns {Array} - Array of parsed section objects
	 */
	getParsedSections() {
		return this.parsedSections
	}

	/**
	 * Get sections by tag name
	 * @param {string} tagName - The tag name to filter by
	 * @returns {Array} - Array of sections with the specified tag name
	 */
	getSectionsByTag(tagName) {
		return this.parsedSections.filter((section) => section.tagName === tagName.toLowerCase())
	}

	/**
	 * Helper function to determine if content should be displayed based on content type
	 * @param {string} contentType - The content type to check
	 * @returns {boolean} - Whether content should be displayed
	 */
	shouldShowContent(contentType) {
		if (!contentType) return true // Default for messages without contentType

		switch (contentType) {
			case "content":
			case "tool_result":
				return true // Always show main content and results
			case "thinking":
				return this.showThinking
			case "tool_call":
				return this.showTools
			case "system":
				return this.showSystem
			default:
				return true // Show unknown content types by default
		}
	}

	/**
	 * Helper function to check if a message is a system message we want to filter out
	 * @param {string} text - The text to check
	 * @returns {boolean} - Whether the text is a system message
	 */
	isSystemMessage(text) {
		if (!text) return false
		return (
			text === "Task execution started" ||
			text === "Task started" ||
			text === "Task has been completed successfully" ||
			text === "Task completed" ||
			text === "Task execution completed" ||
			/^<[^>]+>$/.test(text.trim())
		) // Pure XML tags
	}

	/**
	 * Get display prefix for content types
	 * @param {string} contentType - The content type
	 * @param {string} toolName - The tool name (optional)
	 * @returns {string} - The display prefix
	 */
	getContentTypePrefix(contentType, toolName) {
		switch (contentType) {
			case "thinking":
				return "\n[Thinking] "
			case "tool_call":
				return toolName ? `\n[Tool: ${toolName}] ` : "\n[Tool] "
			case "system":
				return "\n[System] "
			case "tool_result":
				return "\n[Result] "
			default:
				return ""
		}
	}
}

/**
 * Make HTTP request helper
 */
function makeRequest(options, data = null) {
	return new Promise((resolve, reject) => {
		const protocol = options.protocol === "https:" ? https : http

		const req = protocol.request(options, (res) => {
			let body = ""

			res.on("data", (chunk) => {
				body += chunk
			})

			res.on("end", () => {
				resolve({
					statusCode: res.statusCode,
					headers: res.headers,
					body: body,
				})
			})
		})

		req.on("error", reject)

		if (data) {
			req.write(data)
		}

		req.end()
	})
}

/**
 * Test basic endpoints
 */
async function testBasicEndpoints() {
	if (verbose) {
		console.log("🔍 Testing basic endpoints...\n")
	}

	// Test health endpoint
	try {
		if (verbose) {
			console.log("📊 GET /health")
		}
		const healthResponse = await makeRequest({
			hostname: host,
			port: port,
			path: "/health",
			method: "GET",
			headers: { "Content-Type": "application/json" },
		})

		if (verbose) {
			console.log(`   Status: ${healthResponse.statusCode}`)
			if (healthResponse.statusCode === 200) {
				const health = JSON.parse(healthResponse.body)
				console.log(`   Health: ${health.status}`)
				console.log(`   Timestamp: ${health.timestamp}`)
			} else {
				console.log(`   Error: ${healthResponse.body}`)
			}
			console.log("")
		} else {
			if (healthResponse.statusCode !== 200) {
				console.log(`❌ Health check failed: ${healthResponse.body}`)
			}
		}
	} catch (error) {
		if (verbose) {
			console.log(`   ❌ Failed: ${error.message}\n`)
		} else {
			console.log(`❌ Health check failed: ${error.message}`)
		}
	}

	// Test status endpoint
	try {
		if (verbose) {
			console.log("📈 GET /status")
		}
		const statusResponse = await makeRequest({
			hostname: host,
			port: port,
			path: "/status",
			method: "GET",
			headers: { "Content-Type": "application/json" },
		})

		if (verbose) {
			console.log(`   Status: ${statusResponse.statusCode}`)
			if (statusResponse.statusCode === 200) {
				const status = JSON.parse(statusResponse.body)
				console.log(`   Running: ${status.running}`)
				console.log(`   Requests: ${status.stats?.totalRequests || 0}`)
				console.log(`   Memory: ${Math.round((status.stats?.memoryUsage?.heapUsed || 0) / 1024 / 1024)}MB`)
			} else {
				console.log(`   Error: ${statusResponse.body}`)
			}
			console.log("")
		} else {
			if (statusResponse.statusCode !== 200) {
				console.log(`❌ Status check failed: ${statusResponse.body}`)
			}
		}
	} catch (error) {
		if (verbose) {
			console.log(`   ❌ Failed: ${error.message}\n`)
		} else {
			console.log(`❌ Status check failed: ${error.message}`)
		}
	}
}

/**
 * Test regular execute endpoint
 */
async function testExecuteEndpoint() {
	if (verbose) {
		console.log("⚡ Testing POST /execute...\n")
	}

	// Initialize execution timer
	const executionTimer = new ExecutionTimer(showTiming, verbose)
	executionTimer.logOperation("API request initiated", "/execute")

	try {
		const payload = JSON.stringify({
			task,
			mode, // Add mode to payload
			logSystemPrompt,
			logLlm,
			...(restartTask && {
				taskId: taskId,
				restartTask: true,
			}),
		})

		executionTimer.logOperation("Request payload prepared", `${payload.length} bytes`)

		const response = await makeRequest(
			{
				hostname: host,
				port: port,
				path: "/execute",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(payload),
				},
			},
			payload,
		)

		executionTimer.logOperation("Response received", `Status: ${response.statusCode}`)

		if (verbose) {
			console.log(`   Status: ${response.statusCode}`)
			if (response.statusCode === 200) {
				const result = JSON.parse(response.body)
				console.log(`   Success: ${result.success}`)
				console.log(`   Message: ${result.message}`)
				console.log(`   Task: ${result.task}`)
				console.log(`   Timestamp: ${result.timestamp}`)
			} else {
				console.log(`   Error: ${response.body}`)
			}
			console.log("")
		} else {
			if (response.statusCode === 200) {
				const result = JSON.parse(response.body)
				if (showResponse) {
					console.log(result.message || result.result || "Task completed successfully")
				}
			} else {
				console.log(`❌ Error: ${response.body}`)
			}
		}

		// Always show final timing
		console.log(`✅ ${executionTimer.getFinalSummary()}`)

		// Show timing statistics in verbose mode
		if (verbose) {
			const stats = executionTimer.getStatistics()
			console.log(`[DEBUG-TIMING] Statistics:`, {
				totalOperations: stats.operationCount,
				averageOperationTime: `${stats.averageOperationTime.toFixed(2)}ms`,
				totalDuration: `${stats.totalDuration}ms`,
			})
		}
	} catch (error) {
		executionTimer.logOperation("Request failed", error.message)

		// Always show final timing even on error
		console.log(`❌ ${executionTimer.getFinalSummary()}`)

		if (verbose) {
			console.log(`   ❌ Failed: ${error.message}\n`)
		} else {
			console.log(`❌ Failed: ${error.message}`)
		}
	}
}

/**
 * Submit answer to a question
 */
async function submitAnswer(questionId, answer) {
	const payload = JSON.stringify({ answer })

	try {
		const response = await makeRequest(
			{
				hostname: host,
				port: port,
				path: `/api/questions/${questionId}/answer`,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(payload),
				},
			},
			payload,
		)

		if (response.statusCode === 200) {
			const result = JSON.parse(response.body)
			if (verbose) {
				console.log(`✅ Answer submitted successfully: ${result.message}`)
			}
			return true
		} else {
			console.log(`❌ Failed to submit answer: ${response.body}`)
			return false
		}
	} catch (error) {
		console.log(`❌ Error submitting answer: ${error.message}`)
		return false
	}
}

/**
 * Prompt user for input via command line
 */
function promptUser(question, choices = []) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})

		let prompt = `\n❓ Question: ${question}\n`

		if (choices.length > 0) {
			prompt += `\nChoices:\n`
			choices.forEach((choice, index) => {
				prompt += `  ${index + 1}. ${choice}\n`
			})
			prompt += `\nEnter your choice (1-${choices.length}) or type your answer: `
		} else {
			prompt += `\nYour answer: `
		}

		rl.question(prompt, (answer) => {
			rl.close()

			// If choices are provided and user entered a number, return the choice
			if (choices.length > 0 && !isNaN(answer)) {
				const choiceIndex = parseInt(answer) - 1
				if (choiceIndex >= 0 && choiceIndex < choices.length) {
					resolve(choices[choiceIndex])
					return
				}
			}

			resolve(answer.trim())
		})
	})
}

/**
 * Display token usage information in a formatted way
 */
function displayTokenUsage(tokenUsage, timestamp) {
	if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] 🔍 displayTokenUsage called with:`, {
			tokenUsage: tokenUsage ? "present" : "null/undefined",
			timestamp: timestamp || "no timestamp",
		})
	}

	if (!tokenUsage) {
		if (verbose) {
			console.log(`[DEBUG-TOKEN-USAGE] ⚠️ No token usage data provided, skipping display`)
		}
		return
	}

	// Build two-line output
	const time = verbose && timestamp ? `[${timestamp}] ` : ""
	const mainParts = []
	const contextParts = []

	// Always show input/output tokens
	if (tokenUsage.totalTokensIn !== undefined) {
		mainParts.push(`Input: ${tokenUsage.totalTokensIn.toLocaleString()} tokens`)
		if (verbose) {
			console.log(`[DEBUG-TOKEN-USAGE] Input tokens: ${tokenUsage.totalTokensIn} (raw value)`)
		}
	} else if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] ⚠️ totalTokensIn is undefined`)
	}

	if (tokenUsage.totalTokensOut !== undefined) {
		mainParts.push(`Output: ${tokenUsage.totalTokensOut.toLocaleString()} tokens`)
		if (verbose) {
			console.log(`[DEBUG-TOKEN-USAGE] Output tokens: ${tokenUsage.totalTokensOut} (raw value)`)
		}
	} else if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] ⚠️ totalTokensOut is undefined`)
	}

	// Show cost if available
	if (tokenUsage.totalCost !== undefined && tokenUsage.totalCost > 0) {
		mainParts.push(`Cost: $${tokenUsage.totalCost.toFixed(4)}`)
		if (verbose) {
			console.log(`[DEBUG-TOKEN-USAGE] Cost: $${tokenUsage.totalCost} (raw value)`)
		}
	} else if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] Cost not available (totalCost: ${tokenUsage.totalCost})`)
	}

	// Show context tokens if available
	if (tokenUsage.contextTokens !== undefined && tokenUsage.contextTokens > 0) {
		contextParts.push(`Context: ${tokenUsage.contextTokens.toLocaleString()} tokens`)
		if (verbose) {
			console.log(`[DEBUG-TOKEN-USAGE] Context tokens: ${tokenUsage.contextTokens} (raw value)`)
		}
	} else if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] Context tokens not available (contextTokens: ${tokenUsage.contextTokens})`)
	}

	// Show cache statistics if available
	if (tokenUsage.totalCacheReads !== undefined || tokenUsage.totalCacheWrites !== undefined) {
		const reads = tokenUsage.totalCacheReads || 0
		const writes = tokenUsage.totalCacheWrites || 0
		contextParts.push(`Cache: ${reads.toLocaleString()} reads, ${writes.toLocaleString()} writes`)
		if (verbose) {
			console.log(
				`[DEBUG-TOKEN-USAGE] Cache reads: ${tokenUsage.totalCacheReads}, writes: ${tokenUsage.totalCacheWrites} (raw values)`,
			)
		}
	} else if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] Cache statistics not available`)
	}

	// Output on two lines
	console.log(`💰 ${time}Token Usage: ${mainParts.join(", ")}`)
	if (contextParts.length > 0) {
		console.log(`   ${contextParts.join(", ")}`)
	}

	if (verbose) {
		console.log(`[DEBUG-TOKEN-USAGE] ✅ Token usage display completed successfully`)
	}
}

/**
 * Test SSE streaming endpoint
 */
function testStreamingEndpoint() {
	return new Promise((resolve, reject) => {
		if (verbose) {
			console.log("🌊 Testing POST /execute/stream (SSE)...\n")
		}

		// Initialize execution timer
		const executionTimer = new ExecutionTimer(showTiming, verbose)
		executionTimer.logOperation("API connection initiated", `${baseUrl}/execute/stream`)

		// Create content filter instance
		const contentFilter = new ClientContentFilter({
			verbose,
			showThinking,
			showTools,
			showSystem,
			showResponse,
			showCompletion,
			showMcpUse,
		})

		// Create stream processor for handling question pausing
		const streamProcessor = new StreamProcessor({
			verbose,
			maxRetries: 3,
			baseDelay: 1000,
			showResponse,
			showThinking,
			showTools,
			showSystem,
			showCompletion,
			showMcpUse,
			showTokenUsage,
			hideTokenUsage,
		})

		const payload = JSON.stringify({
			task,
			mode, // Add mode to payload
			verbose,
			logSystemPrompt,
			logLlm,
			...(restartTask && {
				taskId: taskId,
				restartTask: true,
			}),
		})

		const req = http.request(
			{
				hostname: host,
				port: port,
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
				executionTimer.logOperation("Connection established", `Status: ${res.statusCode}`)

				if (verbose) {
					console.log(`   Status: ${res.statusCode}`)
					console.log(`   Content-Type: ${res.headers["content-type"]}`)
					console.log("   Events:")
				}

				let buffer = ""
				let firstDataReceived = false
				let firstEventProcessed = false

				// ✅ NEW: Add sliding timeout protection to prevent hanging connections
				const STREAM_TIMEOUT = 30000 // 30 seconds
				let streamTimeout = null
				let lastActivityTime = null

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
						const inactiveTime = ((Date.now() - lastActivityTime) / 1000).toFixed(1)
						if (verbose) {
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
					// Reset sliding timeout on any data activity
					resetSlidingTimeout()

					if (!firstDataReceived) {
						executionTimer.logOperation("First data received")
						firstDataReceived = true
					}

					buffer += chunk.toString()

					// Process complete SSE messages
					const lines = buffer.split("\n")
					buffer = lines.pop() || "" // Keep incomplete line in buffer

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							try {
								const data = JSON.parse(line.slice(6))
								const timestamp = new Date(data.timestamp).toLocaleTimeString()

								if (!firstEventProcessed) {
									executionTimer.logOperation("First event processed", data.type)
									firstEventProcessed = true
								}

								// Log specific event types with timing
								switch (data.type) {
									case "start":
										executionTimer.logOperation("Task started", data.message || "")
										break
									case "tool_use":
										executionTimer.logOperation("Tool execution", data.toolName || "unknown")
										break
									case "token_usage":
										executionTimer.logOperation("Token usage received")
										break
									case "complete":
									case "completion":
										executionTimer.logOperation("Task completed")
										break
									case "stream_end":
										executionTimer.logOperation("Stream ended")
										break
									case "error":
										executionTimer.logOperation("Error received", data.error || "")
										break
								}

								// Process data through content filter
								const filterResult = contentFilter.processData(data)

								if (!filterResult.shouldOutput) {
									continue // Skip this data if filter says not to output
								}

								// Use filtered data for all output
								const filteredData = filterResult.content

								// ✅ NEW: Use StreamProcessor for ALL event handling
								// This allows proper pausing/queueing during questions
								;(async () => {
									try {
										await streamProcessor.processEvent(filteredData, timestamp, contentFilter)
									} catch (error) {
										console.error(`❌ Stream processor error: ${error.message}`)
									}
								})()

								// Skip all the old event handling logic since StreamProcessor handles everything
								// Handle special events that need immediate processing (like stream_end)
								if (filteredData.type === "stream_end") {
									console.log("🔚 Stream ended by server, closing connection...")
									clearTimeout(streamTimeout)
									res.destroy()
									return
								}
							} catch (e) {
								if (verbose) {
									console.log(`     📄 Raw: ${line}`)
								}
							}
						}
					}
				})

				res.on("end", () => {
					// Clear sliding timeout when stream ends normally
					if (streamTimeout) {
						clearTimeout(streamTimeout)
						streamTimeout = null
					}

					// Always show final timing
					console.log(`✅ ${executionTimer.getFinalSummary()}`)

					// Show timing statistics in verbose mode
					if (verbose) {
						const stats = executionTimer.getStatistics()
						console.log(`[DEBUG-TIMING] Statistics:`, {
							totalOperations: stats.operationCount,
							averageOperationTime: `${stats.averageOperationTime.toFixed(2)}ms`,
							longestOperation: stats.longestOperation
								? `${stats.longestOperation.operation} (${stats.longestOperation.duration}ms)`
								: "none",
							totalDuration: `${stats.totalDuration}ms`,
						})
						console.log("     🔚 Stream ended\n")
					}
					resolve()
				})

				res.on("error", (error) => {
					// Clear sliding timeout on error
					if (streamTimeout) {
						clearTimeout(streamTimeout)
						streamTimeout = null
					}
					if (verbose) {
						console.log(`     ❌ Stream error: ${error.message}\n`)
					} else {
						console.log(`❌ Stream error: ${error.message}`)
					}
					reject(error)
				})
			},
		)

		req.on("error", (error) => {
			clearTimeout(streamTimeout)
			if (verbose) {
				console.log(`   ❌ Request failed: ${error.message}\n`)
			} else {
				console.log(`❌ Request failed: ${error.message}`)
			}
			reject(error)
		})

		req.write(payload)
		req.end()
	})
}

/**
 * Main test function
 */
async function runTests() {
	try {
		// Test basic endpoints first
		await testBasicEndpoints()

		if (useStream) {
			// Test streaming endpoint
			await testStreamingEndpoint()
		} else {
			// Test regular execute endpoint
			await testExecuteEndpoint()
		}

		if (verbose) {
			console.log("✅ All tasks completed successfully!")
		}
	} catch (error) {
		console.error("❌ task failed:", error.message)
		process.exit(1)
	}
}

// Export for testing
if (typeof module !== "undefined" && module.exports) {
	module.exports = { ClientContentFilter }
}

// Run the tests
runTests()
