#!/usr/bin/env node

/**
 * Test script for Roo Code Agent API Server
 * Usage: node test-api.js [options] "Your task here"
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
	} else if (arg === "--help" || arg === "-h") {
		showHelp = true
	} else if (!arg.startsWith("--")) {
		task = arg
	}
}

if (showHelp) {
	console.log(`
🧪 Roo Code Agent API Test Client

Usage: node test-api.js [options] "Your task here"

Options:
  --mode           Agent mode (default: code)
                   Built-in: code, debug, architect, ask, test, design-engineer,
                            release-engineer, translate, product-owner, orchestrator
                   Custom modes loaded from server storage
  --stream         Test SSE streaming endpoint (default: false)
  --verbose        Show full JSON payload (default: false)
  --show-thinking  Show thinking sections in LLM output (default: false)
  --show-tools     Show tool call content (default: false)
  --show-system    Show system content (default: false)
  --show-response  Show final response content (default: false)
  --show-completion Show attempt_completion tags (default: false)
  --show-mcp-use   Show use_mcp_tool sections (default: false)
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

Examples:
  # Built-in modes
  node test-api.js --stream --mode code "Fix this bug"
  node test-api.js --stream --mode architect "Plan this feature"
  
  # Custom modes (if configured on server)
  node test-api.js --stream --mode product-owner "Create a PRD for user auth"
  node test-api.js --stream --mode ticket-oracle "Check ticket status"
  
  # Default mode
  node test-api.js --stream "Test task" # Uses code mode
  
  # Show final response
  node test-api.js --stream --show-response "Complete this task"
  
  # Other examples
  node test-api.js --verbose --stream --mode debug "Debug this issue"
  node test-api.js --host api.example.com --port 8080 --mode ask "Explain this"
`)
	process.exit(0)
}

const baseUrl = `http://${host}:${port}`

if (verbose) {
	console.log(`🚀 Testing Roo Code Agent API at ${baseUrl}`)
	console.log(`📝 Task: "${task}"`)
	console.log(`🎭 Mode: ${mode}`)
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

	try {
		const payload = JSON.stringify({
			task,
			mode, // Add mode to payload
			logSystemPrompt,
			logLlm,
		})

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
	} catch (error) {
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
 * Test SSE streaming endpoint
 */
function testStreamingEndpoint() {
	return new Promise((resolve, reject) => {
		if (verbose) {
			console.log("🌊 Testing POST /execute/stream (SSE)...\n")
		}

		// DEBUG: Log initial variable state
		console.error(
			`DEBUG: Initial state - showResponse=${showResponse}, showCompletion=${showCompletion}, showThinking=${showThinking}, showTools=${showTools}, showSystem=${showSystem}, showMcpUse=${showMcpUse}`,
		)

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

		const payload = JSON.stringify({
			task,
			mode, // Add mode to payload
			verbose,
			logSystemPrompt,
			logLlm,
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
				if (verbose) {
					console.log(`   Status: ${res.statusCode}`)
					console.log(`   Content-Type: ${res.headers["content-type"]}`)
					console.log("   Events:")
				}

				let buffer = ""

				res.on("data", (chunk) => {
					buffer += chunk.toString()

					// Process complete SSE messages
					const lines = buffer.split("\n")
					buffer = lines.pop() || "" // Keep incomplete line in buffer

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							try {
								const data = JSON.parse(line.slice(6))
								const timestamp = new Date(data.timestamp).toLocaleTimeString()

								// DEBUG: Log received event type
								console.error(`DEBUG: Received event type: ${data.type}`)

								// Process data through content filter
								const filterResult = contentFilter.processData(data)

								if (!filterResult.shouldOutput) {
									console.error(`DEBUG: Filter says NOT to output this data`)
									continue // Skip this data if filter says not to output
								}

								// Use filtered data for all output
								const filteredData = filterResult.content

								// Use the filter's helper methods
								const shouldShowContent = (contentType) => contentFilter.shouldShowContent(contentType)

								if (verbose) {
									switch (filteredData.type) {
										case "start":
											console.log(
												`     🚀 [${timestamp}] ${filteredData.message}: ${filteredData.task}`,
											)
											break
										case "question_ask":
											console.log(`     ❓ [${timestamp}] Question: ${filteredData.message}`)
											if (filteredData.choices && filteredData.choices.length > 0) {
												console.log(`     📝 Choices: ${filteredData.choices.join(", ")}`)
											}
											// Handle interactive question asynchronously
											;(async () => {
												try {
													const answer = await promptUser(
														filteredData.message,
														filteredData.choices,
													)
													console.log(`     💬 You answered: ${answer}`)
													await submitAnswer(filteredData.questionId, answer)
												} catch (error) {
													console.log(`     ❌ Failed to handle question: ${error.message}`)
												}
											})()
											break
										case "progress":
											console.log(
												`     ⏳ [${timestamp}] Step ${filteredData.step}/${filteredData.total}: ${filteredData.message}`,
											)
											break
										case "complete":
										case "completion":
											console.log(`     ✅ [${timestamp}] ${filteredData.message}`)
											console.log(`     📋 Result: ${filteredData.result}`)
											// Close the connection when task completes
											console.log("     🔚 Task completed, closing connection...")
											res.destroy()
											return
										case "error":
											console.log(`     ❌ [${timestamp}] Error: ${filteredData.error}`)
											break
										default:
											console.log(`     📨 [${timestamp}] ${JSON.stringify(filteredData)}`)
									}
								} else {
									// Simple output mode - stream content based on content type filtering
									const shouldDisplay = shouldShowContent(filteredData.contentType)

									// Filter out system messages we don't want to show using content filter
									const messageIsSystem = contentFilter.isSystemMessage(filteredData.message)
									const resultIsSystem = contentFilter.isSystemMessage(filteredData.result)

									switch (filteredData.type) {
										case "start":
											// Don't output anything for start
											break
										case "error":
											if (filteredData.error === "Invalid mode") {
												console.log(`❌ Invalid mode '${mode}': ${filteredData.message}`)
												console.log(
													`💡 Tip: Check available modes on the server or use a built-in mode`,
												)
												res.destroy()
												return
											}
											// Handle other errors normally
											console.log(`❌ Error: ${filteredData.error || filteredData.message}`)
											break
										case "question_ask":
											// Handle interactive question - prompt user and submit answer
											;(async () => {
												try {
													const answer = await promptUser(
														filteredData.message,
														filteredData.choices,
													)
													console.log(`💬 You answered: ${answer}`)
													await submitAnswer(filteredData.questionId, answer)
												} catch (error) {
													console.log(`❌ Failed to handle question: ${error.message}`)
												}
											})()
											break
										case "progress":
											// DEBUG: Log progress event details
											console.error(
												`DEBUG: Progress event - contentType=${filteredData.contentType}, messageLength=${filteredData.message?.length || 0}`,
											)

											// Stream progress messages with content type filtering
											if (
												filteredData.message &&
												filteredData.message !== "Processing..." &&
												!messageIsSystem &&
												shouldDisplay
											) {
												console.error(
													`DEBUG: About to output progress content: ${filteredData.message.substring(0, 100)}...`,
												)
												// Only add prefix for non-content types and when content isn't just XML
												if (
													filteredData.contentType &&
													filteredData.contentType !== "content" &&
													!filteredData.message.match(/^<[^>]*>.*<\/[^>]*>$/)
												) {
													const prefix = contentFilter.getContentTypePrefix(
														filteredData.contentType,
														filteredData.toolName,
													)
													if (prefix) {
														process.stdout.write(prefix)
													}
												}
												process.stdout.write(filteredData.message)
											} else {
												console.error(
													`DEBUG: NOT outputting progress - message empty/processing: ${!filteredData.message || filteredData.message === "Processing..."}, messageIsSystem: ${messageIsSystem}, shouldDisplay: ${shouldDisplay}`,
												)
											}
											break
										case "complete":
										case "completion":
											// DEBUG: Log completion event details
											console.error(
												`DEBUG: Completion event - showResponse=${showResponse}, shouldDisplay=${shouldDisplay}`,
											)
											console.error(
												`DEBUG: filteredData.result exists: ${!!filteredData.result}, length: ${filteredData.result?.length || 0}`,
											)
											console.error(
												`DEBUG: filteredData.message exists: ${!!filteredData.message}, length: ${filteredData.message?.length || 0}`,
											)
											console.error(
												`DEBUG: resultIsSystem=${resultIsSystem}, messageIsSystem=${messageIsSystem}`,
											)

											// Only show final result if --show-response is explicitly enabled
											if (showResponse && shouldDisplay) {
												console.error(
													`DEBUG: About to output completion content (showResponse=true)`,
												)
												let outputSomething = false
												if (!resultIsSystem && filteredData.result) {
													console.error(
														`DEBUG: Outputting result: ${filteredData.result.substring(0, 100)}...`,
													)
													process.stdout.write(filteredData.result)
													outputSomething = true
												} else if (!messageIsSystem && filteredData.message) {
													console.error(
														`DEBUG: Outputting message: ${filteredData.message.substring(0, 100)}...`,
													)
													process.stdout.write(filteredData.message)
													outputSomething = true
												}
												// Add final newline only if we actually output something
												if (outputSomething) {
													process.stdout.write("\n")
												}
											} else {
												console.error(
													`DEBUG: NOT outputting completion content (showResponse=${showResponse}, shouldDisplay=${shouldDisplay})`,
												)
												// Default behavior: just ensure we end with a newline for clean terminal output
												process.stdout.write("\n")
											}
											res.destroy()
											return
										case "error":
											console.log(`❌ Error: ${filteredData.error}`)
											break
										default:
											// DEBUG: Log default case details
											console.error(
												`DEBUG: Default case - eventType=${filteredData.type}, messageLength=${filteredData.message?.length || 0}`,
											)

											// Special handling for log events that might contain final results
											if (
												filteredData.type === "log" &&
												filteredData.message &&
												filteredData.message.length > 500
											) {
												// This looks like a complete final result dump - suppress it in non-verbose mode
												console.error(
													`DEBUG: Detected large log event (${filteredData.message.length} chars) - likely final result dump`,
												)
												if (!verbose && !showResponse) {
													console.error(
														`DEBUG: Suppressing large log event in non-verbose mode`,
													)
													break
												}
											}

											// Stream any other message content with filtering
											if (filteredData.message && !messageIsSystem && shouldDisplay) {
												console.error(
													`DEBUG: About to output default content: ${filteredData.message.substring(0, 100)}...`,
												)
												if (
													filteredData.contentType &&
													filteredData.contentType !== "content" &&
													!filteredData.message.match(/^<[^>]*>.*<\/[^>]*>$/)
												) {
													const prefix = contentFilter.getContentTypePrefix(
														filteredData.contentType,
														filteredData.toolName,
													)
													if (prefix) {
														process.stdout.write(prefix)
													}
												}
												process.stdout.write(filteredData.message)
											} else {
												console.error(
													`DEBUG: NOT outputting default - message empty: ${!filteredData.message}, messageIsSystem: ${messageIsSystem}, shouldDisplay: ${shouldDisplay}`,
												)
											}
									}
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
					if (verbose) {
						console.log("     🔚 Stream ended\n")
					}
					resolve()
				})

				res.on("error", (error) => {
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
			console.log("✅ All tests completed successfully!")
		}
	} catch (error) {
		console.error("❌ Test failed:", error.message)
		process.exit(1)
	}
}

// Export for testing
if (typeof module !== "undefined" && module.exports) {
	module.exports = { ClientContentFilter }
}

// Run the tests
runTests()
