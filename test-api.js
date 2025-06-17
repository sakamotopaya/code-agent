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
let showHelp = false
let verbose = false
let showThinking = false
let showTools = false
let showSystem = false

for (let i = 0; i < args.length; i++) {
	const arg = args[i]

	if (arg === "--stream") {
		useStream = true
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
  --stream         Test SSE streaming endpoint (default: false)
  --verbose        Show full JSON payload (default: false)
  --show-thinking  Show thinking sections in LLM output (default: false)
  --show-tools     Show tool call content (default: false)
  --show-system    Show system content (default: false)
  --host           API host (default: localhost)
  --port           API port (default: 3000)
  --help           Show this help

Content Display:
  Default mode shows only main content and tool results.
  Use --show-thinking to see LLM reasoning sections.
  Use --show-tools to see tool calls and their parameters.
  Use --show-system to see all system-level content.
  Use --verbose to see full JSON payloads with all metadata.

Examples:
  node test-api.js --stream "where does the vscode extension code store it's mode config files?"
  node test-api.js --verbose --stream "list your MCP servers"
  node test-api.js --stream --show-thinking "Write a React component"
  node test-api.js --stream --show-tools --show-thinking "Debug this code"
  node test-api.js --host api.example.com --port 8080 "Debug this code"
`)
	process.exit(0)
}

const baseUrl = `http://${host}:${port}`

if (verbose) {
	console.log(`🚀 Testing Roo Code Agent API at ${baseUrl}`)
	console.log(`📝 Task: "${task}"`)
	console.log(`🌊 Streaming: ${useStream ? "enabled" : "disabled"}`)
	console.log(`📊 Verbose: ${verbose ? "enabled" : "disabled"}`)
	console.log(`🧠 Show Thinking: ${showThinking ? "enabled" : "disabled"}`)
	console.log(`🔧 Show Tools: ${showTools ? "enabled" : "disabled"}`)
	console.log(`⚙️  Show System: ${showSystem ? "enabled" : "disabled"}`)
	console.log("")
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
		const payload = JSON.stringify({ task })

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
				console.log(result.message || result.result || "Task completed successfully")
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
 * Get display prefix for content types
 */
function getContentTypePrefix(contentType, toolName) {
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

		const payload = JSON.stringify({ task })

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

								// Helper function to determine if content should be displayed
								const shouldShowContent = (contentType) => {
									if (!contentType) return true // Default for messages without contentType

									switch (contentType) {
										case "content":
										case "tool_result":
											return true // Always show main content and results
										case "thinking":
											return showThinking
										case "tool_call":
											return showTools
										case "system":
											return showSystem
										default:
											return true // Show unknown content types by default
									}
								}

								if (verbose) {
									switch (data.type) {
										case "start":
											console.log(`     🚀 [${timestamp}] ${data.message}: ${data.task}`)
											break
										case "question_ask":
											console.log(`     ❓ [${timestamp}] Question: ${data.message}`)
											if (data.choices && data.choices.length > 0) {
												console.log(`     📝 Choices: ${data.choices.join(", ")}`)
											}
											// Handle interactive question asynchronously
											;(async () => {
												try {
													const answer = await promptUser(data.message, data.choices)
													console.log(`     💬 You answered: ${answer}`)
													await submitAnswer(data.questionId, answer)
												} catch (error) {
													console.log(`     ❌ Failed to handle question: ${error.message}`)
												}
											})()
											break
										case "progress":
											console.log(
												`     ⏳ [${timestamp}] Step ${data.step}/${data.total}: ${data.message}`,
											)
											break
										case "complete":
										case "completion":
											console.log(`     ✅ [${timestamp}] ${data.message}`)
											console.log(`     📋 Result: ${data.result}`)
											// Close the connection when task completes
											console.log("     🔚 Task completed, closing connection...")
											res.destroy()
											return
										case "error":
											console.log(`     ❌ [${timestamp}] Error: ${data.error}`)
											break
										default:
											console.log(`     📨 [${timestamp}] ${JSON.stringify(data)}`)
									}
								} else {
									// Simple output mode - stream content based on content type filtering
									const shouldDisplay = shouldShowContent(data.contentType)

									// Filter out system messages we don't want to show
									const isSystemMessage = (text) => {
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

									const messageIsSystem = isSystemMessage(data.message)
									const resultIsSystem = isSystemMessage(data.result)

									switch (data.type) {
										case "start":
											// Don't output anything for start
											break
										case "question_ask":
											// Handle interactive question - prompt user and submit answer
											;(async () => {
												try {
													const answer = await promptUser(data.message, data.choices)
													console.log(`💬 You answered: ${answer}`)
													await submitAnswer(data.questionId, answer)
												} catch (error) {
													console.log(`❌ Failed to handle question: ${error.message}`)
												}
											})()
											break
										case "progress":
											// Stream progress messages with content type filtering
											if (
												data.message &&
												data.message !== "Processing..." &&
												!messageIsSystem &&
												shouldDisplay
											) {
												// Only add prefix for non-content types and when content isn't just XML
												if (
													data.contentType &&
													data.contentType !== "content" &&
													!data.message.match(/^<[^>]*>.*<\/[^>]*>$/)
												) {
													const prefix = getContentTypePrefix(data.contentType, data.toolName)
													if (prefix) {
														process.stdout.write(prefix)
													}
												}
												process.stdout.write(data.message)
											}
											break
										case "complete":
										case "completion":
											// Show final result with content type filtering
											let outputSomething = false
											if (shouldDisplay && !resultIsSystem && data.result) {
												process.stdout.write(data.result)
												outputSomething = true
											} else if (shouldDisplay && !messageIsSystem && data.message) {
												process.stdout.write(data.message)
												outputSomething = true
											}
											// Add final newline only if we actually output something
											if (outputSomething) {
												process.stdout.write("\n")
											}
											res.destroy()
											return
										case "error":
											console.log(`❌ Error: ${data.error}`)
											break
										default:
											// Stream any other message content with filtering
											if (data.message && !messageIsSystem && shouldDisplay) {
												if (
													data.contentType &&
													data.contentType !== "content" &&
													!data.message.match(/^<[^>]*>.*<\/[^>]*>$/)
												) {
													const prefix = getContentTypePrefix(data.contentType, data.toolName)
													if (prefix) {
														process.stdout.write(prefix)
													}
												}
												process.stdout.write(data.message)
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

// Run the tests
runTests()
