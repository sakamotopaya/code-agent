# CLI Output Coordinator Architecture Diagram

## Current Problem Architecture (Before Fix)

```mermaid
graph TD
    A[LLM Response] --> B[Task Events]
    A --> C[Direct Calls]

    B --> D[CLIOutputAdapter]
    B --> E[CLIStreamingAdapter]
    B --> F[CLIContentOutputAdapter]
    C --> G[ConsoleOutputWriter]
    C --> H[BatchProcessor]

    D --> I[process.stdout.write]
    E --> I
    F --> I
    G --> I
    H --> I

    I --> J[CLI Output]

    style I fill:#ff9999
    style J fill:#ff9999

    K[Problem: Multiple adapters<br/>writing same content<br/>to stdout simultaneously]
    K -.-> I
```

## Solution Architecture (After Fix)

```mermaid
graph TD
    A[LLM Response] --> B[Task Events]
    A --> C[Direct Calls]

    B --> D[CLIOutputAdapter]
    B --> E[CLIStreamingAdapter]
    B --> F[CLIContentOutputAdapter]
    C --> G[ConsoleOutputWriter]
    C --> H[BatchProcessor]

    D --> I[CLIOutputCoordinator]
    E --> I
    F --> I
    G --> I
    H --> I

    I --> J[OutputContentTracker]
    J --> K{Content<br/>Duplicate?}

    K -->|Yes| L[Discard]
    K -->|No| M[Hash & Track]
    M --> N[Format Content]
    N --> O[process.stdout.write]
    O --> P[CLI Output]

    style I fill:#99ff99
    style J fill:#99ff99
    style P fill:#99ff99

    Q[Solution: Single coordinated<br/>output path with<br/>deduplication]
    Q -.-> I
```

## Content Flow Detail

```mermaid
sequenceDiagram
    participant T as Task
    participant A as CLIOutputAdapter
    participant C as CLIOutputCoordinator
    participant CT as ContentTracker
    participant S as stdout

    T->>A: emit('message', content)
    A->>C: outputContent(content, 'adapter')
    C->>CT: isContentDuplicate(content)

    alt Content is duplicate
        CT-->>C: true
        C-->>A: return (discard)
    else Content is new
        CT-->>C: false
        C->>CT: trackContent(content)
        C->>C: formatContent(content)
        C->>S: process.stdout.write(formatted)
        S-->>C: success
        C-->>A: return
    end
```

## Deduplication Strategy

```mermaid
graph LR
    A[Raw Content] --> B[Generate SHA-256 Hash]
    B --> C{Hash in<br/>Recent Window?}

    C -->|Yes| D[Check Timestamp]
    D --> E{Within 5s<br/>Window?}
    E -->|Yes| F[DUPLICATE - Discard]
    E -->|No| G[Expired - Allow]

    C -->|No| H[NEW - Allow]

    G --> I[Update Hash Window]
    H --> I
    I --> J[Track Content]
    J --> K[Output to stdout]

    style F fill:#ff9999
    style K fill:#99ff99
```

## Class Relationship Diagram

```mermaid
classDiagram
    class CLIOutputCoordinator {
        -config: CoordinatorConfig
        -contentTracker: OutputContentTracker
        -logger: ILogger
        +outputContent(content, source) Promise~void~
        +streamContent(chunk, source) Promise~void~
        +writeToolIndicator(toolName) Promise~void~
        +reset() void
        +dispose() Promise~void~
    }

    class OutputContentTracker {
        -contentHashes: Map~string, ContentInfo~
        -config: TrackerConfig
        +trackContent(content, source) boolean
        +isContentDuplicate(content) boolean
        +getSimilarContent(content) string[]
        +clearExpiredContent() void
        +getContentHistory() ContentHistoryItem[]
    }

    class CLIOutputAdapter {
        -coordinator: CLIOutputCoordinator
        +outputContent(message) Promise~void~
        +outputPartialContent(message) Promise~void~
        +streamChunk(chunk) Promise~void~
    }

    class BatchProcessor {
        -outputCoordinator: CLIOutputCoordinator
        +run(taskDescription) Promise~void~
    }

    class Task {
        -outputCoordinator: CLIOutputCoordinator
        +emit(event, data) void
    }

    CLIOutputCoordinator --> OutputContentTracker : uses
    CLIOutputAdapter --> CLIOutputCoordinator : delegates to
    BatchProcessor --> CLIOutputCoordinator : uses
    Task --> CLIOutputCoordinator : outputs through

    OutputContentTracker --> ContentInfo : manages

    class ContentInfo {
        +hash: string
        +timestamp: number
        +source: string
        +content: string
    }
```

## Configuration Structure

```mermaid
graph TD
    A[CLIOutputCoordinatorConfig] --> B[Deduplication Settings]
    A --> C[Performance Settings]
    A --> D[Debug Settings]
    A --> E[Fallback Settings]

    B --> B1[enableDeduplication: boolean]
    B --> B2[contentHashWindow: number]
    B --> B3[similarityThreshold: number]

    C --> C1[bufferSize: number]
    C --> C2[flushInterval: number]
    C --> C3[maxConcurrentOps: number]

    D --> D1[enableDebugLogging: boolean]
    D --> D2[showDuplicationWarnings: boolean]
    D --> D3[logContentFlow: boolean]

    E --> E1[enableFallbackMode: boolean]
    E --> E2[maxRetries: number]
    E --> E3[fallbackTimeout: number]
```

## Error Handling Flow

```mermaid
graph TD
    A[Content Input] --> B[CLIOutputCoordinator.outputContent]
    B --> C{Coordinator<br/>Available?}

    C -->|No| D[Fallback: Direct stdout.write]
    C -->|Yes| E[ContentTracker.isContentDuplicate]

    E --> F{Tracker<br/>Error?}
    F -->|Yes| G[Log Error + Continue without deduplication]
    F -->|No| H{Is Duplicate?}

    H -->|Yes| I[Discard Content]
    H -->|No| J[Format Content]

    J --> K{stdout.write<br/>Success?}
    K -->|No| L[Retry with backoff]
    K -->|Yes| M[Success]

    L --> N{Max Retries<br/>Reached?}
    N -->|Yes| O[Log Error + Fallback]
    N -->|No| K

    D --> P[Output Complete]
    G --> J
    I --> P
    M --> P
    O --> P

    style D fill:#ffff99
    style G fill:#ffff99
    style O fill:#ffff99
```

## Integration Points

```mermaid
graph LR
    subgraph "CLI Entry Points"
        A[src/cli/index.ts]
        B[src/cli/repl.ts]
        C[src/cli/commands/batch.ts]
    end

    subgraph "Core Adapters"
        D[CLIOutputAdapter]
        E[CLIStreamingAdapter]
        F[ConsoleOutputWriter]
    end

    subgraph "Task System"
        G[Task.ts]
        H[TaskApiHandler.ts]
    end

    subgraph "CLI Services"
        I[CLIUIService]
        J[CLILogger]
        K[ProgressIndicator]
    end

    subgraph "Output Coordinator System"
        L[CLIOutputCoordinator]
        M[OutputContentTracker]
    end

    A --> L
    B --> L
    C --> L

    D --> L
    E --> L
    F --> L

    G --> L
    H --> L

    I --> L
    J --> L
    K --> L

    L --> M
    L --> N[process.stdout]

    style L fill:#99ff99
    style M fill:#99ff99
```

## Performance Monitoring

```mermaid
graph TD
    A[CLIOutputCoordinator] --> B[Performance Metrics]

    B --> C[Output Latency]
    B --> D[Deduplication Rate]
    B --> E[Memory Usage]
    B --> F[Error Rate]

    C --> C1[P50: <5ms]
    C --> C2[P95: <10ms]
    C --> C3[P99: <25ms]

    D --> D1[Duplicate Ratio]
    D --> D2[Hash Collisions]
    D --> D3[False Positives]

    E --> E1[Hash Window Size]
    E --> E2[Content Cache Size]
    E --> E3[Memory Growth Rate]

    F --> F1[Coordinator Errors]
    F --> F2[Fallback Usage]
    F --> F3[Retry Count]

    style C1 fill:#99ff99
    style C2 fill:#99ff99
    style C3 fill:#ffff99
```
