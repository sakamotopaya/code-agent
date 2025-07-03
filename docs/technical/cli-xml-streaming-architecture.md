# CLI XML Streaming Architecture

## Problem Statement

The CLI is currently outputting raw XML tags from the LLM response instead of processing them and extracting only the relevant user content. XML tags can span multiple chunks in the streaming response, requiring stateful processing.

**Current Issue:**

```
Hello! I'm R<attempt_completion>
<result>
Hello! I'm here and ready to help you with any software development tasks.
</result>
</attempt_completion>
```

**Desired Output:**

```
Hello! I'm R
Hello! I'm here and ready to help you with any software development tasks.
```

## Architecture Overview

### Composition vs Direct Integration

#### Direct Integration (❌ Not Recommended)

```typescript
export class CLIOutputAdapter implements IOutputAdapter {
	private messageBuffer: MessageBuffer // Direct dependency

	async outputPartialContent(partialMessage: ClineMessage): Promise<void> {
		// MessageBuffer logic embedded directly in CLIOutputAdapter
		const processedMessages = this.messageBuffer.processMessage(partialMessage.text)
		// ... processing logic mixed with CLI output logic
	}
}
```

**Problems:**

- Tight coupling between XML processing and CLI output
- Hard to test XML processing independently
- Cannot reuse XML processing logic elsewhere
- CLI-specific features (--thinking, --tools) mixed with core logic

#### Composition Approach (✅ Recommended)

```typescript
export class CLIStreamProcessor {
	private messageBuffer: MessageBuffer
	private options: CLIStreamOptions

	processChunk(chunk: string): CLIOutputResult {
		// Pure XML processing logic with CLI-specific formatting
	}
}

export class CLIOutputAdapter implements IOutputAdapter {
	private streamProcessor: CLIStreamProcessor // Composition

	async outputPartialContent(partialMessage: ClineMessage): Promise<void> {
		// Use composed service for processing
		const result = this.streamProcessor.processChunk(partialMessage.text)
		if (result.content) {
			process.stdout.write(result.content)
		}
	}
}
```

**Benefits:**

- Separation of concerns
- Testable components
- Reusable XML processing
- CLI-specific features cleanly separated

## Component Architecture

```mermaid
graph TD
    A[LLM Stream Chunks] --> B[CLIOutputAdapter.outputPartialContent]
    B --> C[CLIStreamProcessor.processChunk]
    C --> D[MessageBuffer.processMessage]
    D --> E[ProcessedMessage[]]
    E --> F[CLI Content Filter]
    F --> G{Content Type}
    G -->|content| H[Direct Output]
    G -->|thinking| I{--thinking flag?}
    G -->|tool_call| J{--tools flag?}
    G -->|system/tool_result| K[No Output]
    I -->|yes| L[🤔 Thinking: content]
    I -->|no| K
    J -->|yes| M[🔧 Using tool: name]
    J -->|no| K
    H --> N[process.stdout.write]
    L --> N
    M --> N
```

## Implementation Components

### 1. CLIStreamProcessor Service

**File:** `src/core/adapters/cli/CLIStreamProcessor.ts`

```typescript
export interface CLIStreamOptions {
	showThinking: boolean
	showTools: boolean
	useColor: boolean
}

export interface CLIOutputResult {
	content: string
	hasOutput: boolean
}

export class CLIStreamProcessor {
	private messageBuffer: MessageBuffer
	private options: CLIStreamOptions

	constructor(options: CLIStreamOptions) {
		this.messageBuffer = new MessageBuffer()
		this.options = options
	}

	processChunk(chunk: string): CLIOutputResult {
		const processedMessages = this.messageBuffer.processMessage(chunk)
		let outputContent = ""

		for (const msg of processedMessages) {
			const formatted = this.formatMessage(msg)
			if (formatted) {
				outputContent += formatted
			}
		}

		return {
			content: outputContent,
			hasOutput: outputContent.length > 0,
		}
	}

	private formatMessage(msg: ProcessedMessage): string {
		switch (msg.contentType) {
			case "content":
				return msg.content

			case "thinking":
				if (this.options.showThinking) {
					return this.options.useColor ? chalk.gray(`🤔 ${msg.content}`) : `🤔 ${msg.content}`
				}
				return ""

			case "tool_call":
				if (this.options.showTools && msg.toolName) {
					return this.options.useColor
						? chalk.yellow(`🔧 Using tool: ${msg.toolName}\n`)
						: `🔧 Using tool: ${msg.toolName}\n`
				}
				return ""

			case "tool_result":
			case "system":
				return "" // Never show these to user

			default:
				return msg.content
		}
	}

	reset(): void {
		this.messageBuffer.reset()
	}
}
```

### 2. Enhanced CLIOutputAdapter

**File:** `src/core/adapters/cli/CLIOutputAdapters.ts`

```typescript
export class CLIOutputAdapter implements IOutputAdapter {
	private streamProcessor: CLIStreamProcessor
	// ... existing properties

	constructor(
		globalStoragePath: string,
		useColor: boolean = true,
		logger?: ILogger,
		cliOptions?: { showThinking?: boolean; showTools?: boolean },
	) {
		// ... existing initialization

		this.streamProcessor = new CLIStreamProcessor({
			showThinking: cliOptions?.showThinking || false,
			showTools: cliOptions?.showTools || false,
			useColor,
		})
	}

	async outputPartialContent(partialMessage: ClineMessage): Promise<void> {
		await this.outputLogger.logMethodCall("outputPartialContent", partialMessage.text, {
			type: partialMessage.type,
		})

		if (!partialMessage.text) return

		// Process through XML-aware stream processor
		const result = this.streamProcessor.processChunk(partialMessage.text)

		if (result.hasOutput) {
			process.stdout.write(result.content)
		}
	}

	// Reset method for new tasks
	reset(): void {
		super.reset() // existing reset logic
		this.streamProcessor.reset()
	}
}
```

### 3. CLI Options Integration

**File:** `src/cli/index.ts` (modifications needed)

Add CLI flags for controlling output:

- `--thinking`: Show thinking content with 🤔 prefix
- `--tools`: Show tool usage notifications
- `--no-color`: Disable color output

## Content Filtering Rules

| Content Type  | Default Behavior | With --thinking | With --tools      |
| ------------- | ---------------- | --------------- | ----------------- |
| `content`     | ✅ Show          | ✅ Show         | ✅ Show           |
| `thinking`    | ❌ Hide          | ✅ Show with 🤔 | ❌ Hide           |
| `tool_call`   | ❌ Hide          | ❌ Hide         | ✅ Show tool name |
| `tool_result` | ❌ Hide          | ❌ Hide         | ❌ Hide           |
| `system`      | ❌ Hide          | ❌ Hide         | ❌ Hide           |

## Special Cases

### attempt_completion Processing

The MessageBuffer already handles the special case where `<result>` content inside `<attempt_completion>` is treated as user content rather than tool_result.

### Partial XML Tags

The MessageBuffer maintains state across chunks to handle XML tags that span multiple streaming chunks.

### Error Handling

- If XML processing fails, fall back to raw output
- Log XML processing errors for debugging
- Never crash the CLI due to malformed XML

## Testing Strategy

### Unit Tests

1. **CLIStreamProcessor Tests**

    - Test each content type filtering
    - Test CLI option combinations
    - Test partial XML handling
    - Test color formatting

2. **Integration Tests**
    - Test full streaming flow
    - Test with real LLM responses
    - Test CLI flag combinations

### Test Files

- `src/core/adapters/cli/__tests__/CLIStreamProcessor.test.ts`
- `src/core/adapters/cli/__tests__/CLIOutputAdapter.integration.test.ts`

## Migration Path

1. ✅ **Phase 1**: Create CLIStreamProcessor service
2. ✅ **Phase 2**: Integrate into CLIOutputAdapter via composition
3. ✅ **Phase 3**: Add CLI flags (--thinking, --tools)
4. ✅ **Phase 4**: Add comprehensive tests
5. ✅ **Phase 5**: Update CLI documentation

## Interface Compatibility

This architecture maintains all existing interfaces:

- **VS Code Extension**: No changes, uses existing webview processing
- **API Endpoints**: No changes, uses existing SSE MessageBuffer
- **CLI**: Enhanced with XML processing while maintaining IOutputAdapter interface

## Performance Considerations

- MessageBuffer is lightweight and stateful
- Minimal overhead for XML parsing
- No impact on non-CLI usage (VS Code, API)
- Streaming performance maintained

## Future Enhancements

1. **Custom Formatting**: User-configurable output formats
2. **Progress Indicators**: Real-time tool progress
3. **Logging Integration**: Structured logging for CLI operations
4. **Plugin System**: Extensible content processors
