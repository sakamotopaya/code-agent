# Logging Architecture Diagram

## Current State vs Proposed Architecture

### Current Problem

```mermaid
graph TD
    A[CLI Entry Point] --> B[Core Modules]
    B --> C[console.log everywhere]
    C --> D[Terminal Output]

    E[VSCode Extension] --> B
    F[API Server] --> B

    style C fill:#ff6b6b
    style D fill:#ff6b6b

    G[Issues:]
    G1[❌ No verbose control]
    G2[❌ Platform-specific needs ignored]
    G3[❌ Hardcoded console.log statements]
    G4[❌ Debug spam in production]
```

### Proposed Solution

```mermaid
graph TD
    subgraph "Platform Entry Points"
        CLI[CLI Entry Point<br/>--verbose flag]
        VSC[VSCode Extension<br/>Output channels]
        API[API Server<br/>SSE streaming]
    end

    subgraph "Logger Factory"
        LF[LoggerFactory<br/>Platform Detection]
    end

    subgraph "Logger Adapters"
        CLA[CLILoggerAdapter<br/>Respects --verbose]
        VLA[VSCodeLoggerAdapter<br/>Output channels]
        ALA[APILoggerAdapter<br/>SSE integration]
    end

    subgraph "Core Interface"
        IL[ILogger Interface<br/>debug(), info(), warn(), error()]
    end

    subgraph "Core Modules"
        CP[CLIProvider]
        T[Task]
        CPR[CoreProvider]
        COA[CLIOutputAdapters]
        TAH[TaskApiHandler]
    end

    subgraph "Output Destinations"
        TERM[Terminal<br/>Clean/Verbose]
        OUT[VSCode Output<br/>Channels]
        SSE[SSE Stream<br/>Structured logs]
    end

    CLI --> LF
    VSC --> LF
    API --> LF

    LF --> CLA
    LF --> VLA
    LF --> ALA

    CLA --> IL
    VLA --> IL
    ALA --> IL

    IL --> CP
    IL --> T
    IL --> CPR
    IL --> COA
    IL --> TAH

    CLA --> TERM
    VLA --> OUT
    ALA --> SSE

    style IL fill:#4ecdc4
    style LF fill:#45b7d1
    style CLA fill:#96ceb4
    style VLA fill:#96ceb4
    style ALA fill:#96ceb4
```

## Implementation Flow

```mermaid
sequenceDiagram
    participant User
    participant CLI as CLI Entry
    participant Factory as LoggerFactory
    participant Adapter as CLILoggerAdapter
    participant Core as Core Module
    participant Terminal

    User->>CLI: npm run start:cli --batch "hello"
    Note over User,CLI: No --verbose flag

    CLI->>Factory: createLogger(platform: 'cli', verbose: false)
    Factory->>Adapter: new CLILoggerAdapter(verbose: false)
    CLI->>Core: new CoreModule(logger: adapter)

    Core->>Adapter: logger.debug("[CoreProvider] debug message")
    Note over Adapter: Check verbose: false, suppress output
    Adapter-->>Core: (no output)

    Core->>Adapter: logger.error("Critical error")
    Adapter->>Terminal: ERROR: Critical error

    Note over User,Terminal: Clean output - only errors shown
```

```mermaid
sequenceDiagram
    participant User
    participant CLI as CLI Entry
    participant Factory as LoggerFactory
    participant Adapter as CLILoggerAdapter
    participant Core as Core Module
    participant Terminal

    User->>CLI: npm run start:cli --batch "hello" --verbose
    Note over User,CLI: With --verbose flag

    CLI->>Factory: createLogger(platform: 'cli', verbose: true)
    Factory->>Adapter: new CLILoggerAdapter(verbose: true)
    CLI->>Core: new CoreModule(logger: adapter)

    Core->>Adapter: logger.debug("[CoreProvider] debug message")
    Note over Adapter: Check verbose: true, show output
    Adapter->>Terminal: [DEBUG] [CoreProvider] debug message

    Core->>Adapter: logger.error("Critical error")
    Adapter->>Terminal: ERROR: Critical error

    Note over User,Terminal: Verbose output - all messages shown
```

## Migration Strategy Visual

```mermaid
flowchart TD
    subgraph "Phase 1: Foundation"
        P1A[Create ILogger Interface]
        P1B[Create LoggerFactory]
        P1C[Create CLI Adapter]
    end

    subgraph "Phase 2: Core Fixes"
        P2A[Fix CLIProvider.ts]
        P2B[Fix Task.ts]
        P2C[Fix CoreProvider.ts]
        P2D[Fix OutputAdapters.ts]
        P2E[Fix TaskApiHandler.ts]
    end

    subgraph "Phase 3: Integration"
        P3A[Update CLI Entry Point]
        P3B[End-to-End Testing]
    end

    subgraph "Phase 4: Future Platforms"
        P4A[VSCode Adapter]
        P4B[API Adapter]
    end

    P1A --> P1B
    P1B --> P1C
    P1C --> P2A
    P2A --> P2B
    P2B --> P2C
    P2C --> P2D
    P2D --> P2E
    P2E --> P3A
    P3A --> P3B
    P3B --> P4A
    P4A --> P4B

    style P1A fill:#e1f5fe
    style P1B fill:#e1f5fe
    style P1C fill:#e1f5fe
    style P2A fill:#f3e5f5
    style P2B fill:#f3e5f5
    style P2C fill:#f3e5f5
    style P2D fill:#f3e5f5
    style P2E fill:#f3e5f5
    style P3A fill:#e8f5e8
    style P3B fill:#e8f5e8
    style P4A fill:#fff3e0
    style P4B fill:#fff3e0
```

## Expected Behavior Changes

### Before Fix

```bash
$ npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "say hello"
[CLIProvider] Initialized successfully
[Task] CLI mode detected - using CLI output adapter
📊 State synchronized - Mode: code, API: anthropic
[CoreProvider] parent task dc75d4f6-2afb-4bdd-853f-a6ed189a0d12.9e140e92 created
[MESSAGING-PERSISTENCE] 📦 About to send chunk to messaging system for persistence
Hello! How can I help you today?
```

### After Fix

```bash
$ npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "say hello"
Hello! How can I help you today?
```

### With Verbose Flag

```bash
$ npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "say hello" --verbose
[DEBUG] [+0ms] CLIProvider initialized successfully
[DEBUG] [+15ms] Task CLI mode detected - using CLI output adapter
[DEBUG] [+23ms] State synchronized - Mode: code, API: anthropic
[DEBUG] [+31ms] CoreProvider parent task dc75d4f6-2afb-4bdd-853f-a6ed189a0d12.9e140e92 created
[DEBUG] [+45ms] MESSAGING-PERSISTENCE About to send chunk to messaging system for persistence
Hello! How can I help you today?
```
