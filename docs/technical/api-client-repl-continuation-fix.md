# API Client REPL Continuation Fix - CORRECTED

## Issue Description

The API client's REPL mode (`--repl`) exits after completing a request instead of prompting for the next input. This breaks the continuous conversation flow that users expect from a REPL interface.

## Root Cause - CORRECTED ANALYSIS

The issue is NOT duplicate `promptUser()` calls. The real problem is that the `start()` method returns immediately after calling `promptUser()`, which causes the `main()` function to complete, which causes the Node.js process to exit.

## Code Analysis

### Current Problematic Flow

```typescript
// In main() function
if (options.replMode) {
    const replSession = new REPLSession({...})
    await replSession.start()  // Returns immediately!
}
// main() completes, process exits!

// In REPLSession.start()
async start(): Promise<void> {
    console.log("🚀 Roo API Client REPL Mode")
    // ... setup code ...
    this.promptUser()  // Async callback-based, but start() returns immediately
}
```

### The Real Problem

1. `start()` calls `promptUser()` but doesn't wait for it
2. `promptUser()` uses `readline.question()` which is callback-based
3. `start()` returns immediately, completing the `main()` function
4. The Node.js process exits before the REPL can continue

### Solution

The `start()` method needs to return a Promise that only resolves when the user explicitly exits the REPL:

```typescript
class REPLSession {
	private exitResolver: (() => void) | null = null

	async start(): Promise<void> {
		console.log("🚀 Roo API Client REPL Mode")
		// ... setup code ...

		// Create a promise that keeps the process alive
		return new Promise<void>((resolve) => {
			this.exitResolver = resolve
			this.promptUser()
		})
	}

	private async handleInput(input: string): Promise<void> {
		// ... existing code ...

		// Handle exit commands
		if (input === "exit" || input === "quit") {
			console.log("👋 Goodbye!")
			if (this.historyService) {
				await this.historyService.flush()
			}
			// Resolve the promise to allow process to exit
			if (this.exitResolver) {
				this.exitResolver()
			}
			return
		}

		// ... rest of existing code ...
	}
}
```

## Files Affected

- `src/tools/api-client.ts` - REPLSession class

## Implementation Details

### Changes Required

1. **Add exitResolver property** to REPLSession class
2. **Modify start() method** to return a Promise that waits for exit
3. **Modify handleInput() method** to resolve the Promise on exit
4. **Remove process.exit(0)** calls and use Promise resolution instead

### Key Changes

1. **Line ~475**: Add `private exitResolver: (() => void) | null = null`
2. **Line ~503**: Modify `start()` to return a waiting Promise
3. **Line ~570**: Modify exit handling to resolve the Promise instead of calling `process.exit(0)`

## Testing

1. Run API client in REPL mode: `api-client --repl --stream`
2. Execute a command and verify it completes
3. Verify the REPL prompts for the next input instead of exiting
4. Test multiple consecutive commands to ensure continuous operation
5. Test that 'exit' command properly terminates the process

## Root Cause Summary

- **NOT** a duplicate `promptUser()` call issue
- **IS** a process lifecycle issue where `start()` returns immediately
- **FIX** is to make `start()` wait until user explicitly exits

This maintains the process alive while the REPL is running and only exits when the user chooses to exit.
