# API Client REPL Implementation Guide

## Overview

This document provides the technical implementation details for adding REPL (Read-Eval-Print Loop) functionality to the existing api-client.js while preserving all current functionality.

## Current Architecture Analysis

### Existing Command Flow

1. Parse command-line arguments
2. Validate parameters
3. Execute single API request (streaming or basic)
4. Display results
5. Exit

### Task Context Management

- Task ID is passed via `--task` parameter
- When `restartTask: true` is sent to API, server loads existing task context
- All conversation history and state is preserved in task storage
- Each API call with same task ID continues the conversation thread

## Implementation Plan

### Phase 1: REPL Infrastructure

#### 1.1 Add REPL Mode Detection

```javascript
// Add to command line parsing
let replMode = false

// In argument parsing loop
} else if (arg === "--repl") {
    replMode = true
```

#### 1.2 Create REPLSession Class

```javascript
class REPLSession {
	constructor(options) {
		this.taskId = options.initialTaskId || null
		this.mode = options.mode || "code"
		this.host = options.host
		this.port = options.port
		this.useStream = options.useStream || false
		this.verbose = options.verbose || false
		this.showThinking = options.showThinking || false
		this.showTools = options.showTools || false
		this.showSystem = options.showSystem || false
		this.showResponse = options.showResponse || false
		this.showCompletion = options.showCompletion || false
		this.showMcpUse = options.showMcpUse || false
		this.showTokenUsage = options.showTokenUsage !== undefined ? options.showTokenUsage : true
		this.hideTokenUsage = options.hideTokenUsage || false
		this.showTiming = options.showTiming || false
		this.logSystemPrompt = options.logSystemPrompt || false
		this.logLlm = options.logLlm || false

		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			prompt: this.getPrompt(),
		})
	}

	getPrompt() {
		const taskIndicator = this.taskId ? `[${this.taskId.substring(0, 8)}...]` : "[new]"
		return `roo-api ${taskIndicator} > `
	}

	setTaskId(taskId) {
		this.taskId = taskId
		this.rl.setPrompt(this.getPrompt())
	}

	clearTaskId() {
		this.taskId = null
		this.rl.setPrompt(this.getPrompt())
		console.log("🔄 Task cleared - next command will start a new task")
	}

	hasTask() {
		return this.taskId !== null
	}

	async start() {
		console.log("🚀 Roo API Client REPL Mode")
		console.log("Commands: exit (quit), newtask (clear task), help (show help)")
		if (this.taskId) {
			console.log(`📋 Continuing task: ${this.taskId}`)
		} else {
			console.log("💡 First command will create a new task")
		}
		console.log("")

		this.rl.prompt()

		this.rl.on("line", async (input) => {
			await this.handleInput(input.trim())
		})

		this.rl.on("close", () => {
			console.log("\n👋 Goodbye!")
			process.exit(0)
		})

		// Handle Ctrl+C gracefully
		this.rl.on("SIGINT", () => {
			console.log("\n👋 Goodbye!")
			process.exit(0)
		})
	}

	async handleInput(input) {
		if (!input) {
			this.rl.prompt()
			return
		}

		const command = input.toLowerCase()

		// Handle special commands
		switch (command) {
			case "exit":
			case "quit":
				console.log("👋 Goodbye!")
				process.exit(0)
				break

			case "newtask":
				this.clearTaskId()
				this.rl.prompt()
				return

			case "help":
				this.showHelp()
				this.rl.prompt()
				return

			default:
				// Regular command - send to API
				await this.executeCommand(input)
		}

		this.rl.prompt()
	}

	showHelp() {
		console.log(`
REPL Commands:
  exit, quit    Exit the REPL
  newtask       Clear current task and start fresh
  help          Show this help message
  
Any other input will be sent as a task to the API server.
Current task: ${this.taskId || "none (will create new)"}
Current mode: ${this.mode}
`)
	}

	async executeCommand(task) {
		try {
			// Prepare API request
			const isRestart = this.hasTask()

			if (this.useStream) {
				await this.executeStreamingCommand(task, isRestart)
			} else {
				await this.executeBasicCommand(task, isRestart)
			}
		} catch (error) {
			console.error("❌ Error executing command:", error.message)
		}
	}

	async executeStreamingCommand(task, isRestart) {
		// Reuse existing streaming logic with modifications
		// Extract task ID from response if new task
		// This will be implemented by adapting existing testStreamingEndpoint()
	}

	async executeBasicCommand(task, isRestart) {
		// Reuse existing basic execution logic with modifications
		// Extract task ID from response if new task
		// This will be implemented by adapting existing testExecuteEndpoint()
	}
}
```

### Phase 2: Integration with Existing Code

#### 2.1 Modify Main Execution Flow

```javascript
// At the end of argument parsing, after help check
if (replMode) {
	const replSession = new REPLSession({
		initialTaskId: taskId, // From --task parameter if provided
		mode,
		host,
		port,
		useStream,
		verbose,
		showThinking,
		showTools,
		showSystem,
		showResponse,
		showCompletion,
		showMcpUse,
		showTokenUsage,
		hideTokenUsage,
		showTiming,
		logSystemPrompt,
		logLlm,
	})

	await replSession.start()
	return // Don't execute normal flow
}

// Existing single-command execution continues unchanged
```

#### 2.2 Extract Reusable API Logic

Create helper functions that can be used by both single-command and REPL modes:

```javascript
async function executeApiRequest(options) {
	const {
		task,
		mode,
		taskId,
		restartTask,
		useStream,
		host,
		port,
		// ... other options
	} = options

	if (useStream) {
		return await executeStreamingRequest(options)
	} else {
		return await executeBasicRequest(options)
	}
}

async function executeStreamingRequest(options) {
	// Extracted from existing testStreamingEndpoint()
	// Returns { success, taskId, response }
}

async function executeBasicRequest(options) {
	// Extracted from existing testExecuteEndpoint()
	// Returns { success, taskId, response }
}
```

#### 2.3 Task ID Extraction

Modify response handling to extract task ID from API responses:

```javascript
// In streaming response handler
case "start":
    // Extract task ID from start event
    if (event.taskId && !currentTaskId) {
        currentTaskId = event.taskId
        if (replSession) {
            replSession.setTaskId(currentTaskId)
        }
    }
    break
```

### Phase 3: Enhanced Features

#### 3.1 Command History

```javascript
// Add to REPLSession constructor
this.history = []

// In handleInput method
if (input && !["exit", "quit", "newtask", "help"].includes(input.toLowerCase())) {
	this.history.push(input)
}

// Add history navigation with up/down arrows
this.rl.on("history", (history) => {
	// Handle history navigation
})
```

#### 3.2 Tab Completion

```javascript
// Add to REPLSession constructor
this.rl.completer = (line) => {
	const completions = ["exit", "quit", "newtask", "help"]
	const hits = completions.filter((c) => c.startsWith(line))
	return [hits.length ? hits : completions, line]
}
```

## Testing Strategy

### Unit Tests

- REPLSession class methods
- Command parsing logic
- Task ID management
- Special command handling

### Integration Tests

- REPL mode with streaming API
- REPL mode with basic API
- Task continuation across commands
- Error handling in REPL mode

### Manual Testing Scenarios

1. Start REPL without existing task
2. Start REPL with existing task via --task parameter
3. Execute multiple commands in sequence
4. Use newtask command to reset
5. Test exit command
6. Test error conditions

## Backward Compatibility

All existing functionality is preserved:

- Single command execution works unchanged
- All existing flags and options work as before
- REPL mode is opt-in via --repl flag
- No breaking changes to existing API

## File Structure Changes

```
api-client.js (modified)
├── Existing functionality (unchanged)
├── New REPL mode detection
├── REPLSession class
├── Extracted API helper functions
└── Modified main execution flow
```

## Implementation Checklist

- [ ] Add --repl flag parsing
- [ ] Implement REPLSession class
- [ ] Extract reusable API functions
- [ ] Modify main execution flow
- [ ] Add task ID extraction from responses
- [ ] Implement special commands (exit, newtask, help)
- [ ] Add error handling for REPL mode
- [ ] Test with streaming API
- [ ] Test with basic API
- [ ] Test task continuation
- [ ] Update help documentation
- [ ] Add command history support
- [ ] Add tab completion
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update README with REPL usage examples
