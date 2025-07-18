# REPL History Persistence - Technical Implementation Guide

## Overview

This document provides detailed technical specifications for implementing persistent history functionality for both CLI REPL and API client REPL, with a shared history management service.

## Architecture Overview

### Current State Analysis

**CLI REPL (`src/cli/repl.ts`):**

- Uses Node.js `readline` with `historySize: 100`
- No persistence - history lost on exit
- Integrated with session management system

**API Client REPL (`api-client.js`):**

- Uses Node.js `readline` without explicit history configuration
- No persistence or history management
- Standalone implementation

**Problem:** No shared history management, no persistence, inconsistent behavior.

## Technical Design

### 1. Shared History Service Architecture

```typescript
// src/shared/services/ReplHistoryService.ts
export interface HistoryEntry {
	command: string
	timestamp: Date
	context: "cli" | "api-client"
	executionTime?: number
	success?: boolean
}

export interface ReplHistoryOptions {
	historyFile?: string
	maxHistorySize?: number
	storageDir?: string
	deduplication?: boolean
	autoSave?: boolean
	context?: "cli" | "api-client"
}

export interface HistoryStats {
	totalEntries: number
	uniqueCommands: number
	mostUsedCommands: Array<{ command: string; count: number }>
	averageCommandLength: number
	oldestEntry?: Date
	newestEntry?: Date
}

export class ReplHistoryService {
	private historyFile: string
	private maxHistorySize: number
	private history: HistoryEntry[]
	private isDirty: boolean
	private saveTimeout?: NodeJS.Timeout
	private context: string

	constructor(options: ReplHistoryOptions)
	async loadHistory(): Promise<HistoryEntry[]>
	async saveHistory(): Promise<void>
	async addEntry(command: string, metadata?: Partial<HistoryEntry>): Promise<void>
	getHistory(limit?: number): HistoryEntry[]
	async clearHistory(): Promise<void>
	searchHistory(pattern: string | RegExp): HistoryEntry[]
	pruneHistory(): void
	getStatistics(): HistoryStats
	private debouncedSave(): void
	private validateHistoryFile(): Promise<boolean>
	private createBackup(): Promise<void>
}
```

### 2. File Format Specification

**History File Format (`*.json`):**

```json
{
	"version": "1.0",
	"context": "cli",
	"maxSize": 100,
	"created": "2025-01-11T18:21:41.000Z",
	"lastModified": "2025-01-11T18:25:30.000Z",
	"entries": [
		{
			"command": "create a todo app with authentication",
			"timestamp": "2025-01-11T18:25:30.000Z",
			"context": "cli",
			"executionTime": 1250,
			"success": true
		},
		{
			"command": "list all tasks",
			"timestamp": "2025-01-11T18:24:15.000Z",
			"context": "cli",
			"executionTime": 450,
			"success": true
		}
	]
}
```

**Storage Locations:**

- CLI REPL: `~/.agentz/cli-repl-history.json`
- API Client: `~/.agentz/api-client-repl-history.json`
- Backup files: `~/.agentz/backups/repl-history-{timestamp}.json`

### 3. CLI REPL Integration

**File: `src/cli/repl.ts`**

```typescript
import { ReplHistoryService } from "../shared/services/ReplHistoryService"
import { getGlobalStoragePath } from "../shared/paths"

export class CliRepl {
	private historyService: ReplHistoryService

	constructor(options: ReplOptions, configManager?: CliConfigManager) {
		// ... existing code ...

		// Initialize history service
		this.historyService = new ReplHistoryService({
			storageDir: getGlobalStoragePath(),
			historyFile: "cli-repl-history.json",
			maxHistorySize: 100,
			context: "cli",
			deduplication: true,
			autoSave: true,
		})

		// Configure readline with loaded history
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			prompt: this.getPrompt(),
			historySize: 100,
			completer: this.completer.bind(this),
		})
	}

	async start(): Promise<void> {
		try {
			// Load existing configuration
			await this.loadConfiguration()

			// Load and apply history
			await this.loadHistory()

			// ... rest of existing start logic ...
		} catch (error) {
			// ... error handling ...
		}
	}

	private async loadHistory(): Promise<void> {
		try {
			const history = await this.historyService.loadHistory()

			// Apply history to readline interface
			// Note: readline history is in reverse order (newest first)
			const commands = history.map((entry) => entry.command).reverse()

			// Clear existing history and add loaded entries
			;(this.rl as any).history = commands.slice(0, 100)

			if (this.options.verbose) {
				console.log(chalk.gray(`Loaded ${history.length} history entries`))
			}
		} catch (error) {
			if (this.options.verbose) {
				console.log(chalk.yellow(`Could not load history: ${error.message}`))
			}
		}
	}

	private async handleInput(input: string): Promise<void> {
		const trimmedInput = input.trim()

		// ... existing input handling logic ...

		// Save to persistent history if it's a valid command
		if (trimmedInput && !this.isBuiltinCommand(trimmedInput)) {
			await this.historyService.addEntry(trimmedInput, {
				context: "cli",
				timestamp: new Date(),
			})
		}

		// ... rest of existing logic ...
	}

	private async handleBuiltinCommand(input: string): Promise<boolean> {
		const [command, ...args] = input.split(" ")

		switch (command.toLowerCase()) {
			// ... existing commands ...

			case "history":
				await this.handleHistoryCommand(args)
				return true

			// ... rest of existing commands ...
		}
	}

	private async handleHistoryCommand(args: string[]): Promise<void> {
		const [subcommand, ...subArgs] = args

		switch (subcommand) {
			case "show":
			case undefined:
				this.showHistory(parseInt(subArgs[0]) || 20)
				break

			case "clear":
				await this.clearHistory()
				break

			case "search":
				this.searchHistory(subArgs.join(" "))
				break

			case "stats":
				this.showHistoryStats()
				break

			default:
				console.log(chalk.yellow(`Unknown history command: ${subcommand}`))
				console.log(chalk.gray("Available commands: show [n], clear, search <pattern>, stats"))
		}
	}

	private showHistory(limit: number = 20): void {
		const history = this.historyService.getHistory(limit)

		if (history.length === 0) {
			console.log(chalk.gray("No history entries found"))
			return
		}

		console.log(chalk.cyan.bold(`Recent History (${history.length} entries):`))
		console.log(chalk.gray("=".repeat(50)))

		history.forEach((entry, index) => {
			const timeStr = entry.timestamp.toLocaleTimeString()
			const successIcon = entry.success !== false ? "✓" : "✗"
			console.log(
				`${chalk.gray(`${index + 1}.`)} ${chalk.green(successIcon)} ${chalk.white(entry.command)} ${chalk.gray(`(${timeStr})`)}`,
			)
		})
	}

	private async clearHistory(): Promise<void> {
		await this.historyService.clearHistory()
		;(this.rl as any).history = []
		console.log(chalk.green("✓ History cleared"))
	}

	private searchHistory(pattern: string): void {
		if (!pattern) {
			console.log(chalk.yellow("Please provide a search pattern"))
			return
		}

		const results = this.historyService.searchHistory(new RegExp(pattern, "i"))

		if (results.length === 0) {
			console.log(chalk.gray(`No history entries found matching: ${pattern}`))
			return
		}

		console.log(chalk.cyan.bold(`Search Results (${results.length} entries):`))
		results.forEach((entry, index) => {
			const timeStr = entry.timestamp.toLocaleString()
			console.log(`${chalk.gray(`${index + 1}.`)} ${chalk.white(entry.command)} ${chalk.gray(`(${timeStr})`)}`)
		})
	}

	private showHistoryStats(): void {
		const stats = this.historyService.getStatistics()

		console.log(chalk.cyan.bold("History Statistics:"))
		console.log(chalk.gray("=".repeat(30)))
		console.log(`Total entries: ${stats.totalEntries}`)
		console.log(`Unique commands: ${stats.uniqueCommands}`)
		console.log(`Average command length: ${stats.averageCommandLength.toFixed(1)} characters`)

		if (stats.oldestEntry) {
			console.log(`Oldest entry: ${stats.oldestEntry.toLocaleString()}`)
		}

		if (stats.newestEntry) {
			console.log(`Newest entry: ${stats.newestEntry.toLocaleString()}`)
		}

		if (stats.mostUsedCommands.length > 0) {
			console.log("\nMost used commands:")
			stats.mostUsedCommands.slice(0, 5).forEach((cmd, index) => {
				console.log(`  ${index + 1}. ${cmd.command} (${cmd.count} times)`)
			})
		}
	}

	private isBuiltinCommand(input: string): boolean {
		const command = input.split(" ")[0].toLowerCase()
		return ["exit", "quit", "clear", "help", "status", "abort", "config", "session", "history"].includes(command)
	}
}
```

### 4. API Client REPL Integration

**File: `api-client.js`**

```javascript
// Import the compiled JavaScript version of the history service
const { ReplHistoryService } = require("./src/shared/services/ReplHistoryService")
const path = require("path")
const os = require("os")

class REPLSession {
	constructor(options) {
		// ... existing constructor code ...

		// Initialize history service
		const storageDir = process.env.ROO_GLOBAL_STORAGE_PATH || path.join(os.homedir(), ".agentz")

		this.historyService = new ReplHistoryService({
			storageDir,
			historyFile: "api-client-repl-history.json",
			maxHistorySize: 100,
			context: "api-client",
			deduplication: true,
			autoSave: true,
		})

		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			prompt: this.getPrompt(),
			historySize: 100,
		})

		// Set up tab completion for special commands including history
		this.rl.completer = (line) => {
			const completions = ["exit", "quit", "newtask", "help", "history"]
			const hits = completions.filter((c) => c.startsWith(line))
			return [hits.length ? hits : completions, line]
		}
	}

	async start() {
		console.log("🚀 Roo API Client REPL Mode")
		console.log("Commands: exit (quit), newtask (clear task), help (show help), history (show history)")

		// Load and apply history
		await this.loadHistory()

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

	async loadHistory() {
		try {
			const history = await this.historyService.loadHistory()

			// Apply history to readline interface (reverse order for readline)
			const commands = history.map((entry) => entry.command).reverse()
			this.rl.history = commands.slice(0, 100)

			if (this.verbose) {
				console.log(`📚 Loaded ${history.length} history entries`)
			}
		} catch (error) {
			if (this.verbose) {
				console.log(`⚠️ Could not load history: ${error.message}`)
			}
		}
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
				// Check for history commands
				if (command.startsWith("history")) {
					await this.handleHistoryCommand(input.split(" ").slice(1))
					this.rl.prompt()
					return
				}

				// Regular command - send to API and save to history
				await this.executeCommand(input)

				// Save to persistent history
				await this.historyService.addEntry(input, {
					context: "api-client",
					timestamp: new Date(),
				})
		}

		this.rl.prompt()
	}

	async handleHistoryCommand(args) {
		const [subcommand, ...subArgs] = args

		switch (subcommand) {
			case "show":
			case undefined:
				this.showHistory(parseInt(subArgs[0]) || 20)
				break

			case "clear":
				await this.clearHistory()
				break

			case "search":
				this.searchHistory(subArgs.join(" "))
				break

			case "stats":
				this.showHistoryStats()
				break

			default:
				console.log(`❓ Unknown history command: ${subcommand}`)
				console.log("Available commands: show [n], clear, search <pattern>, stats")
		}
	}

	showHistory(limit = 20) {
		const history = this.historyService.getHistory(limit)

		if (history.length === 0) {
			console.log("📝 No history entries found")
			return
		}

		console.log(`📚 Recent History (${history.length} entries):`)
		console.log("=".repeat(50))

		history.forEach((entry, index) => {
			const timeStr = entry.timestamp.toLocaleTimeString()
			const successIcon = entry.success !== false ? "✅" : "❌"
			console.log(`${index + 1}. ${successIcon} ${entry.command} (${timeStr})`)
		})
	}

	async clearHistory() {
		await this.historyService.clearHistory()
		this.rl.history = []
		console.log("✅ History cleared")
	}

	searchHistory(pattern) {
		if (!pattern) {
			console.log("⚠️ Please provide a search pattern")
			return
		}

		const results = this.historyService.searchHistory(new RegExp(pattern, "i"))

		if (results.length === 0) {
			console.log(`🔍 No history entries found matching: ${pattern}`)
			return
		}

		console.log(`🔍 Search Results (${results.length} entries):`)
		results.forEach((entry, index) => {
			const timeStr = entry.timestamp.toLocaleString()
			console.log(`${index + 1}. ${entry.command} (${timeStr})`)
		})
	}

	showHistoryStats() {
		const stats = this.historyService.getStatistics()

		console.log("📊 History Statistics:")
		console.log("=".repeat(30))
		console.log(`Total entries: ${stats.totalEntries}`)
		console.log(`Unique commands: ${stats.uniqueCommands}`)
		console.log(`Average command length: ${stats.averageCommandLength.toFixed(1)} characters`)

		if (stats.oldestEntry) {
			console.log(`Oldest entry: ${stats.oldestEntry.toLocaleString()}`)
		}

		if (stats.newestEntry) {
			console.log(`Newest entry: ${stats.newestEntry.toLocaleString()}`)
		}

		if (stats.mostUsedCommands.length > 0) {
			console.log("\nMost used commands:")
			stats.mostUsedCommands.slice(0, 5).forEach((cmd, index) => {
				console.log(`  ${index + 1}. ${cmd.command} (${cmd.count} times)`)
			})
		}
	}

	showHelp() {
		console.log(`
REPL Commands:
  exit, quit    Exit the REPL
  newtask       Clear current task and start fresh
  help          Show this help message
  history       Show command history
    show [n]    Show last n entries (default: 20)
    clear       Clear all history
    search <p>  Search history for pattern
    stats       Show history statistics
  
Any other input will be sent as a task to the API server.
Current task: ${this.taskId || "none (will create new)"}
Current mode: ${this.mode}
Current server: ${this.host}:${this.port}
Streaming: ${this.useStream ? "enabled" : "disabled"}
`)
	}
}
```

### 5. Implementation Details

#### Error Handling Strategy

```typescript
class ReplHistoryService {
	private async safeFileOperation<T>(operation: () => Promise<T>, fallback: T, errorMessage: string): Promise<T> {
		try {
			return await operation()
		} catch (error) {
			console.warn(`${errorMessage}: ${error.message}`)
			return fallback
		}
	}

	async loadHistory(): Promise<HistoryEntry[]> {
		return this.safeFileOperation(
			async () => {
				const data = await fs.readFile(this.historyFile, "utf8")
				const parsed = JSON.parse(data)

				// Validate file format
				if (!this.validateHistoryFormat(parsed)) {
					throw new Error("Invalid history file format")
				}

				return parsed.entries || []
			},
			[],
			"Could not load history",
		)
	}

	private validateHistoryFormat(data: any): boolean {
		return data && typeof data === "object" && data.version && Array.isArray(data.entries)
	}
}
```

#### Performance Optimizations

1. **Lazy Loading**: Load history only when needed
2. **Debounced Saving**: Batch save operations to reduce I/O
3. **Memory Management**: Keep only essential data in memory
4. **Efficient Search**: Use optimized search algorithms for large histories

#### Cross-Platform Considerations

1. **Path Handling**: Use Node.js `path` module for all file operations
2. **Line Endings**: Normalize line endings across platforms
3. **File Permissions**: Set appropriate permissions on history files
4. **Storage Location**: Respect OS-specific conventions for user data

### 6. Testing Strategy

#### Unit Tests (`src/shared/services/__tests__/ReplHistoryService.test.ts`)

```typescript
describe("ReplHistoryService", () => {
	let historyService: ReplHistoryService
	let tempDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "repl-history-test-"))
		historyService = new ReplHistoryService({
			storageDir: tempDir,
			historyFile: "test-history.json",
			maxHistorySize: 5,
		})
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe("addEntry", () => {
		it("should add entries in reverse chronological order", async () => {
			await historyService.addEntry("command1")
			await historyService.addEntry("command2")

			const history = historyService.getHistory()
			expect(history[0].command).toBe("command2")
			expect(history[1].command).toBe("command1")
		})

		it("should prune history when exceeding max size", async () => {
			for (let i = 1; i <= 7; i++) {
				await historyService.addEntry(`command${i}`)
			}

			const history = historyService.getHistory()
			expect(history).toHaveLength(5)
			expect(history[0].command).toBe("command7")
			expect(history[4].command).toBe("command3")
		})

		it("should deduplicate consecutive identical commands", async () => {
			await historyService.addEntry("same command")
			await historyService.addEntry("same command")
			await historyService.addEntry("different command")

			const history = historyService.getHistory()
			expect(history).toHaveLength(2)
			expect(history[0].command).toBe("different command")
			expect(history[1].command).toBe("same command")
		})
	})

	describe("persistence", () => {
		it("should save and load history correctly", async () => {
			await historyService.addEntry("test command")
			await historyService.saveHistory()

			const newService = new ReplHistoryService({
				storageDir: tempDir,
				historyFile: "test-history.json",
			})

			const history = await newService.loadHistory()
			expect(history).toHaveLength(1)
			expect(history[0].command).toBe("test command")
		})

		it("should handle corrupted history files gracefully", async () => {
			const historyFile = path.join(tempDir, "test-history.json")
			await fs.writeFile(historyFile, "invalid json")

			const history = await historyService.loadHistory()
			expect(history).toEqual([])
		})
	})

	describe("search", () => {
		beforeEach(async () => {
			await historyService.addEntry("create todo app")
			await historyService.addEntry("list all tasks")
			await historyService.addEntry("delete completed tasks")
		})

		it("should search by string pattern", () => {
			const results = historyService.searchHistory(/task/)
			expect(results).toHaveLength(2)
		})

		it("should return empty array for no matches", () => {
			const results = historyService.searchHistory(/nonexistent/)
			expect(results).toHaveLength(0)
		})
	})
})
```

#### Integration Tests

1. **CLI REPL Integration**: Test history loading, saving, and commands
2. **API Client Integration**: Test Node.js compatibility and functionality
3. **Cross-Platform**: Test on Windows, macOS, and Linux
4. **Performance**: Test with large history files (1000+ entries)
5. **Concurrent Access**: Test multiple REPL instances

### 7. Migration Strategy

#### Backward Compatibility

1. **Graceful Degradation**: Continue working without history if service fails
2. **Format Migration**: Automatically upgrade old history formats
3. **Configuration Migration**: Preserve existing user settings

#### Deployment Plan

1. **Phase 1**: Deploy shared history service with basic functionality
2. **Phase 2**: Integrate with CLI REPL and test thoroughly
3. **Phase 3**: Integrate with API client REPL
4. **Phase 4**: Add advanced features and optimizations

### 8. Monitoring and Maintenance

#### Metrics to Track

- History file sizes and growth rates
- Load/save operation performance
- Error rates and types
- User adoption of history features

#### Maintenance Tasks

- Regular cleanup of old backup files
- Performance optimization based on usage patterns
- Bug fixes and feature enhancements
- Documentation updates

This implementation provides a robust, shared history management system that enhances both REPL implementations while maintaining backward compatibility and following established patterns in the codebase.
