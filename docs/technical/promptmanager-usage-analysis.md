# PromptManager: Purpose, Usage, and API Mode Failure Analysis

## What is PromptManager?

`PromptManager` is a wrapper around `inquirer.js` that provides **interactive CLI prompts** for terminal-based user interaction.

### Core Methods:

```typescript
class PromptManager {
	async promptText(options: TextPromptOptions): Promise<string>
	async promptPassword(options: PasswordPromptOptions): Promise<string>
	async promptConfirm(options: ConfirmPromptOptions): Promise<boolean>
	async promptSelect(options: SelectPromptOptions): Promise<string>
	async promptMultiSelect(options: MultiSelectPromptOptions): Promise<string[]>
	async promptNumber(options: NumberPromptOptions): Promise<number>
}
```

### Purpose:

- **Interactive CLI questioning** using inquirer.js
- **Terminal-based user input** with colored prompts
- **Synchronous blocking** - waits for user input in terminal
- **CLI-specific UI elements** like selection lists, confirmations

## How getPromptManager() is Used

### Usage Flow in Task.ts (lines 1170-1190):

```typescript
// 1. Get PromptManager from cliUIService
let promptManager: any
if (this.cliUIService) {
	promptManager = this.cliUIService.getPromptManager() // ← FAILS HERE in API mode
} else {
	// Fallback: create new CLIUIService
	const fallbackUIService = new CLIUIService(true)
	promptManager = fallbackUIService.getPromptManager()
}

// 2. Create CLI question handler
const handler = createCLIQuestionHandler({
	promptManager, // ← Used here
	logger: this,
})

// 3. Create question service
const questionService = new TaskQuestionService(handler, this)
```

### The Problem in API Mode:

1. **API mode sets**: `this.cliUIService = sseAdapter` (SSEOutputAdapter)
2. **Code tries**: `sseAdapter.getPromptManager()`
3. **SSEOutputAdapter doesn't have**: `getPromptManager()` method
4. **Error**: "this.cliUIService.getPromptManager is not a function"

## Why This is Architecturally Wrong

### CLI Mode (Correct):

- **Environment**: Interactive terminal
- **User Interaction**: Direct keyboard input
- **Blocking**: Can wait synchronously for user response
- **UI**: Terminal prompts, colors, selection lists

### API Mode (Wrong Approach):

- **Environment**: HTTP API server
- **User Interaction**: HTTP requests/responses
- **Non-blocking**: Must handle async HTTP communication
- **UI**: SSE streams, JSON responses

### The Mismatch:

Using `PromptManager` in API mode is like trying to use CLI terminal prompts over HTTP - they're fundamentally incompatible paradigms.

## Current Fallback Logic Issue

```typescript
if (this.cliUIService) {
	promptManager = this.cliUIService.getPromptManager() // Tries SSEOutputAdapter
} else {
	// This fallback never executes in API mode because cliUIService IS set
	const fallbackUIService = new CLIUIService(true)
	promptManager = fallbackUIService.getPromptManager()
}
```

**Problem**: In API mode, `this.cliUIService` is truthy (SSEOutputAdapter), so the fallback never executes. The code assumes ANY cliUIService has `getPromptManager()`.

## Solution Architecture

### Option 1: Remove cliUIService Assignment in API Mode

```typescript
// In FastifyServer.ts - DON'T pass sseAdapter as cliUIService
// cliUIService: sseAdapter,  // ← Remove this line
```

This makes `this.cliUIService` undefined in API mode, triggering the fallback.

### Option 2: Add getPromptManager() to SSEOutputAdapter

```typescript
// In SSEOutputAdapter.ts
getPromptManager(): PromptManager {
    // Return a mock or throw error since CLI prompts don't work in API mode
    throw new Error("CLI prompts not supported in API mode")
}
```

### Option 3: Use Unified Question Manager (Recommended)

The unified question manager I implemented should handle this properly by:

- Detecting the runtime environment
- Using appropriate question handling for each mode
- Avoiding CLI-specific code in API mode

## Root Cause Summary

**The fundamental issue**: API mode is trying to use CLI-interactive prompting mechanisms that are completely inappropriate for HTTP-based communication. The `ask_followup_question` tool should use the unified question manager, not CLI prompts, in API mode.
