# CLI MessageBuffer Integration Architecture

## Current Architecture Issues

```mermaid
graph TD
    subgraph "Current Streaming Architecture"
        A[TaskApiHandler.streaming] --> B{CLI Mode?}
        B -->|Yes| C[CLILogger.streamLLMOutput]
        B -->|No| D[SSEOutputAdapter.showProgress]

        C --> E[Manual XML Parsing]
        E --> F[Tool Name Detection]
        F --> G[System Tag Filtering]
        G --> H[CLI Terminal Output]

        D --> I[MessageBuffer.processMessage]
        I --> J[ProcessedMessage Array]
        J --> K[Content Type Classification]
        K --> L[SSE Event Emission]

        style E fill:#ffcccc
        style F fill:#ffcccc
        style G fill:#ffcccc
        style I fill:#ccffcc
        style J fill:#ccffcc
        style K fill:#ccffcc
    end
```

### Problems with Current Architecture

- **Red boxes**: Duplicate parsing logic in CLILogger
- **Green boxes**: Sophisticated parsing logic in MessageBuffer
- **Tool name sets are different** between CLILogger and MessageBuffer
- **System tag handling differs** between implementations
- **Content classification** only available in SSE path

## Proposed Unified Architecture

```mermaid
graph TD
    subgraph "Unified Streaming Architecture"
        A[TaskApiHandler.streaming] --> B{CLI Mode?}
        B -->|Yes| C[CLILogger.streamLLMOutput]
        B -->|No| D[SSEOutputAdapter.showProgress]

        C --> E[MessageBuffer.processMessage]
        D --> E

        E --> F[ProcessedMessage Array]
        F --> G{Content Type}

        G -->|content| H[Format for CLI/SSE]
        G -->|thinking| I[Show if enabled]
        G -->|tool_call| J[Tool Name Display]
        G -->|system| K[Skip Display]
        G -->|tool_result| L[Handle Results]

        H --> M[CLI Terminal Output]
        I --> M
        J --> M

        H --> N[SSE Event Emission]
        L --> N

        style E fill:#ccffcc
        style F fill:#ccffcc
        style G fill:#ccffcc
    end
```

### Benefits of Unified Architecture

- **Single parsing engine** handles all XML content
- **Consistent content classification** across CLI and SSE
- **Shared tool definitions** prevent drift
- **Extensible content types** automatically available to both paths
- **Reduced maintenance burden** - one place to update parsing logic

## Implementation Flow

```mermaid
sequenceDiagram
    participant T as TaskApiHandler
    participant C as CLILogger
    participant M as MessageBuffer
    participant S as SSEOutputAdapter

    Note over T: LLM chunk received

    alt CLI Mode
        T->>C: streamLLMOutput(chunk)
        C->>M: processMessage(chunk)
        M->>C: ProcessedMessage[]
        loop For each message
            C->>C: handleProcessedMessage()
            Note over C: Map ContentType to CLI display
        end
        C->>T: Display to terminal
    else SSE Mode
        T->>S: showProgress(chunk)
        S->>M: processMessage(chunk)
        M->>S: ProcessedMessage[]
        loop For each message
            S->>S: shouldEmitContentType()
            Note over S: Emit SSE events
        end
        S->>T: Stream to clients
    end
```

## Content Type Mapping

| ContentType   | CLI Behavior                           | SSE Behavior                 |
| ------------- | -------------------------------------- | ---------------------------- |
| `content`     | Display with markdown formatting       | Emit as progress event       |
| `thinking`    | Display only if `showThinking` enabled | Emit if verbose mode         |
| `tool_call`   | Show tool name indicator (yellow)      | Emit with tool metadata      |
| `system`      | Skip (internal XML tags)               | Skip or emit as system event |
| `tool_result` | Skip or show results                   | Emit as result event         |

## State Management

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> Processing : streamLLMOutput()
    Processing --> Buffering : Partial XML tag
    Buffering --> Processing : Complete tag received
    Processing --> Ready : Chunk processed
    Ready --> Reset: resetMessageBuffer()
    Reset --> [*]

    note right of Processing
        MessageBuffer handles
        tag boundary splitting
    end note

    note right of Reset
        Clear both MessageBuffer
        and CLI display state
    end note
```

## Migration Strategy

### Phase 1: Foundation

- Ensure MessageBuffer has complete tool/system tag coverage
- Create CLI content type mapping functions
- Add MessageBuffer instance to CLILogger

### Phase 2: Integration

- Replace manual XML parsing with MessageBuffer calls
- Implement content type to CLI display mapping
- Preserve existing display formatting and timing

### Phase 3: Cleanup

- Remove duplicate parsing code from CLILogger
- Remove hardcoded tool/system tag sets
- Update tests to use shared parsing logic

### Phase 4: Validation

- Comprehensive testing of CLI output behavior
- Performance benchmarking
- Integration testing with various LLM providers

## Risk Mitigation

### Backward Compatibility

- Feature flag for old vs new implementation during development
- Extensive output comparison testing
- Gradual rollout with fallback capability

### Performance Considerations

- MessageBuffer designed for streaming efficiency
- Object pooling if ProcessedMessage creation becomes bottleneck
- Benchmark against current manual parsing performance

### Testing Strategy

- Unit tests for CLILogger with MessageBuffer integration
- Integration tests comparing CLI and SSE output for identical input
- Edge case testing for XML tag boundary conditions
- Performance regression testing
