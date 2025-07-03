# CLI vs API Output Processing Analysis

## Executive Summary

The CLI and API modes produce different output formats despite sharing core task execution components. The CLI displays tool usage indicators like `execute_command...` and `use_mcp_tool...`, while the API does not. This analysis documents where the two systems diverge and share code, and identifies the root cause of output differences.

## Architecture Overview

```mermaid
graph TD
    A[User Input] --> B{Mode Selection}
    B -->|CLI| C[BatchProcessor]
    B -->|API| D[FastifyServer]

    C --> E[Task.create]
    D --> F[Task.create]

    E --> G[CLI Adapters]
    F --> H[API Adapters]

    G --> I[CLIContentProcessor]
    H --> J[SSEOutputAdapter]

    I --> K[MessageBuffer]
    J --> K

    K --> L[ProcessedMessage[]]

    L --> M[CLIDisplayFormatter]
    L --> N[SSE Event Emission]

    M --> O[ContentHandlers]
    O --> P[Tool Indicators + Formatted Output]
    N --> Q[JSON Events via SSE]
```

## Shared Components

Both CLI and API modes share the following core components:

### 1. Task Execution Engine

- **File**: `src/core/task/Task.ts`
- **Shared By**: Both modes use `Task.create()` and the same execution orchestration
- **Responsibility**: Core task logic, tool execution, MCP integration

### 2. MessageBuffer

- **File**: `src/api/streaming/MessageBuffer.ts`
- **Shared By**: Both `CLIContentProcessor` and `SSEOutputAdapter`
- **Responsibility**:
    - Parse streaming XML content from LLM
    - Classify content types (`content`, `thinking`, `tool_call`, `system`, `tool_result`)
    - Handle partial XML tags across chunk boundaries
    - Extract tool names from XML tags

### 3. MCP Integration

- **Files**: MCP server management and connection handling
- **Shared By**: Both modes via same MCP service layer
- **Responsibility**: Tool execution, server connections, resource access

### 4. Core Adapters

- **Files**: `src/core/adapters/cli.ts`, `src/core/adapters/api.ts`
- **Shared By**: Provide filesystem, terminal, browser, telemetry interfaces
- **Responsibility**: Abstract platform-specific operations

## CLI-Specific Components

### 1. BatchProcessor

- **File**: `src/cli/commands/batch.ts`
- **Responsibility**:
    - CLI command execution orchestration
    - Timeout management for different query types
    - Task completion detection
    - MCP connection cleanup

### 2. CLIContentProcessor

- **File**: `src/cli/services/streaming/CLIContentProcessor.ts`
- **Responsibility**:
    - Delegates to MessageBuffer for content processing
    - Returns `ProcessedMessage[]` for display formatting

### 3. CLIDisplayFormatter

- **File**: `src/cli/services/streaming/CLIDisplayFormatter.ts`
- **Responsibility**:
    - Formats `ProcessedMessage[]` for CLI display
    - Applies color formatting via chalk
    - Delegates to ContentHandlers using Strategy pattern

### 4. ContentHandlers

- **File**: `src/cli/services/streaming/ContentHandlers.ts`
- **Key Component**: `ContentHandler_ToolCall`
- **Responsibility**: **THIS IS WHERE TOOL INDICATORS ARE GENERATED**

```typescript
// ContentHandler_ToolCall generates tool indicators
protected handleSpecific(message: ProcessedMessage, context: DisplayContext): DisplayResult | null {
    // Handle tool name display
    if (message.toolName && context.hasDisplayedTool && context.markToolDisplayed) {
        if (!context.hasDisplayedTool(message.toolName)) {
            const toolDisplay = this.applyColor(`${message.toolName}...`, chalk.yellow, context.useColor)

            context.markToolDisplayed(message.toolName)
            return {
                displayText: `\n${toolDisplay}\n`,
            }
        }
    }
    // ... rest of handler logic
}
```

## API-Specific Components

### 1. FastifyServer

- **File**: `src/api/server/FastifyServer.ts`
- **Responsibility**:
    - HTTP server management
    - SSE streaming endpoint (`/execute/stream`)
    - Task orchestration via `TaskExecutionOrchestrator`

### 2. SSEOutputAdapter

- **File**: `src/api/streaming/SSEOutputAdapter.ts`
- **Responsibility**:
    - Implements `IUserInterface` for Task integration
    - Uses MessageBuffer in verbose vs non-verbose modes
    - Emits SSE events directly **WITHOUT using ContentHandlers**

```typescript
// SSEOutputAdapter bypasses ContentHandlers entirely
async showProgress(message: string, progress?: number): Promise<void> {
    if (this.verbose) {
        // In verbose mode, pass through unchanged
        const event: SSEEvent = { /* ... */ }
        this.emitEvent(event)
    } else {
        // In non-verbose mode, use MessageBuffer to filter content
        const processedMessages = this.messageBuffer.processMessage(message)

        for (const processedMessage of processedMessages) {
            // Only emit events for content that should be shown to users
            if (this.shouldEmitContentType(processedMessage.contentType)) {
                const event: SSEEvent = { /* ... */ }
                this.emitEvent(event) // DIRECT EMISSION - NO CONTENT HANDLERS
            }
        }
    }
}
```

## Root Cause of Output Differences

### The Divergence Point

The critical divergence occurs after `MessageBuffer` processing:

1. **CLI Path**: `ProcessedMessage[]` → `CLIDisplayFormatter` → `ContentHandlers` → **Tool Indicators Generated**
2. **API Path**: `ProcessedMessage[]` → Direct SSE emission → **No Tool Indicators**

### Missing Component in API

The API's `SSEOutputAdapter` does **NOT** use the `ContentHandlers` system that generates tool indicators. Instead, it directly emits SSE events based on content type filtering.

## Content Type Flow Comparison

### CLI Content Processing Flow

```
LLM Output → MessageBuffer → ProcessedMessage[] → CLIDisplayFormatter → ContentHandlers
                ↓
        ContentType Classification:
        - content: Display as-is
        - thinking: Show if enabled
        - tool_call: GENERATE TOOL INDICATOR + process attempt_completion
        - system: Hide from user
        - tool_result: Hide from user
```

### API Content Processing Flow

```
LLM Output → MessageBuffer → ProcessedMessage[] → SSE Event Emission
                ↓
        ContentType Filtering:
        - content: Emit SSE event
        - thinking: Emit if verbose
        - tool_call: Emit if shouldEmitContentType() returns true
        - system: Skip
        - tool_result: Skip
```

## Tool Indicator Generation Logic

### CLI Implementation

Tool indicators like `execute_command...` are generated in `ContentHandler_ToolCall`:

1. MessageBuffer identifies `<execute_command>` XML tag
2. Creates `ProcessedMessage` with `contentType: "tool_call"` and `toolName: "execute_command"`
3. `ContentHandler_ToolCall.handleSpecific()` checks if tool hasn't been displayed yet
4. If not displayed, generates `"\nexecute_command...\n"` with yellow coloring
5. Marks tool as displayed to prevent duplicates

### API Implementation

The API's `SSEOutputAdapter` receives the same `ProcessedMessage` but:

1. Checks `shouldEmitContentType(processedMessage.contentType)`
2. If `tool_call` content type is allowed, emits raw SSE event
3. **Never calls ContentHandlers to generate tool indicators**

## Proposed Solution Architecture

To align CLI and API output, the API should use the same ContentHandlers system:

```mermaid
graph TD
    A[SSEOutputAdapter] --> B[MessageBuffer]
    B --> C[ProcessedMessage[]]
    C --> D[CLIDisplayFormatter]
    D --> E[ContentHandlers]
    E --> F[Formatted Content]
    F --> G[SSE Event with Formatted Content]
```

### Implementation Changes Required

1. **Modify SSEOutputAdapter** to use `CLIDisplayFormatter` and `ContentHandlers`
2. **Adapt ContentHandlers** to work in both CLI and API contexts
3. **Ensure tool indicators** are properly formatted for SSE transmission
4. **Maintain backwards compatibility** for existing API clients

## Current Code Paths Summary

### CLI Execution Path

```
BatchProcessor.run()
├── Task.create()
├── setupResponseCompletionDetection()
│   └── task.on("message") → CLIContentProcessor.processContent()
│       └── MessageBuffer.processMessage()
│           └── CLIDisplayFormatter.formatContent()
│               └── ContentHandlers → Tool indicators generated
└── Display formatted output with console.log()
```

### API Execution Path

```
FastifyServer./execute/stream
├── Task.create()
├── SSEOutputAdapter as userInterface
├── TaskExecutionOrchestrator.executeTask()
│   └── Task events → SSEOutputAdapter.showProgress()
│       └── MessageBuffer.processMessage()
│           └── Direct SSE emission (bypasses ContentHandlers)
└── Stream SSE events to client
```

## Interface Compatibility

Both systems implement different interfaces but could be unified:

- **CLI**: Uses console output with formatting
- **API**: Uses `IUserInterface` with SSE emission
- **Common Ground**: Both could use the same formatting pipeline with different output adapters

## Conclusion

The output differences between CLI and API stem from the API bypassing the `ContentHandlers` system that generates tool indicators. To achieve output parity, the API's `SSEOutputAdapter` should be modified to use the same content formatting pipeline as the CLI, while maintaining its SSE-specific output format.

The shared `MessageBuffer` component ensures both systems receive the same parsed content structure, making alignment feasible without major architectural changes.
