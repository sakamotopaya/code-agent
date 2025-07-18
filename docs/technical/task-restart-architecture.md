# Task Restart Architecture

## System Architecture Overview

This document provides architectural diagrams and flow charts for the task restart functionality.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        CLI[API Client<br/>--task taskId]
        WEB[Web Interface]
        EXT[VSCode Extension]
    end

    subgraph "API Server"
        ROUTER[Request Router]
        RESTART[Task Restart Handler]
        NEW[New Task Handler]
        SSE[SSE Output Adapter]
    end

    subgraph "Core Services"
        UTS[UnifiedTaskService]
        TASK[Task Engine]
        LIFECYCLE[TaskLifecycle]
    end

    subgraph "Storage Layer"
        GLOBAL[Global Storage]
        TASKS[Task Directories]
        API_HIST[api_conversation_history.json]
        UI_MSG[ui_messages.json]
        META[Task Metadata]
    end

    CLI -->|POST /chat/stream<br/>taskId + restartTask| ROUTER
    WEB --> ROUTER
    EXT --> ROUTER

    ROUTER -->|restartTask=true| RESTART
    ROUTER -->|restartTask=false| NEW

    RESTART --> UTS
    UTS --> TASKS
    TASKS --> API_HIST
    TASKS --> UI_MSG
    TASKS --> META

    UTS -->|TaskData| RESTART
    RESTART -->|Create Task Instance| TASK
    TASK --> LIFECYCLE
    LIFECYCLE -->|Resume from History| TASK

    TASK -->|Stream Response| SSE
    SSE -->|SSE Events| CLI
```

## Task Restart Flow

```mermaid
sequenceDiagram
    participant Client as API Client
    participant Server as FastifyServer
    participant UTS as UnifiedTaskService
    participant Task as Task Instance
    participant Storage as File Storage

    Client->>Server: POST /chat/stream<br/>{taskId, restartTask: true, task: "new message"}

    Server->>Server: Validate request & taskId format

    Server->>UTS: findTask(taskId)
    UTS->>Storage: Load task directory
    Storage->>UTS: api_conversation_history.json
    Storage->>UTS: ui_messages.json
    UTS->>UTS: Reconstruct HistoryItem
    UTS->>Server: Return TaskData

    Server->>Server: Create Job for continuation
    Server->>Client: SSE: Task restart initiated

    Server->>Task: Create instance with historyItem
    Task->>Task: Load conversation history
    Server->>Task: resumePausedTask(newMessage)

    Task->>Task: Add new user message
    Task->>Task: Resume from history
    Task->>Task: Continue conversation

    loop Task Execution
        Task->>Server: Stream progress/responses
        Server->>Client: SSE: Progress updates
    end

    Task->>Server: Task completion
    Server->>Client: SSE: Completion with taskId
```

## Cross-Context Task Access

```mermaid
graph LR
    subgraph "VSCode Extension Context"
        EXT_TASK[Task Created<br/>in Extension]
        EXT_STORAGE[Extension Storage<br/>~/.vscode/extensions/.../globalStorage]
    end

    subgraph "CLI Context"
        CLI_TASK[Task Created<br/>in CLI]
        CLI_STORAGE[CLI Storage<br/>~/.config/roo-code]
    end

    subgraph "API Context"
        API_TASK[Task Created<br/>in API]
        API_STORAGE[API Storage<br/>Configured Path]
    end

    subgraph "Unified Access Layer"
        UTS[UnifiedTaskService]
        DISCOVERY[Task Discovery Logic]
    end

    EXT_TASK --> EXT_STORAGE
    CLI_TASK --> CLI_STORAGE
    API_TASK --> API_STORAGE

    EXT_STORAGE --> UTS
    CLI_STORAGE --> UTS
    API_STORAGE --> UTS

    UTS --> DISCOVERY
    DISCOVERY -->|Can restart any task<br/>from any context| API_CLIENT[API Client<br/>Task Restart]
```

## Task State Restoration

```mermaid
graph TD
    START[Task Restart Request] --> LOAD[Load Task Data]

    LOAD --> VALIDATE{Validate Task Data}
    VALIDATE -->|Invalid| ERROR[Return Error]
    VALIDATE -->|Valid| EXTRACT[Extract Components]

    EXTRACT --> HIST[HistoryItem]
    EXTRACT --> API[API Conversation History]
    EXTRACT --> UI[UI Messages]
    EXTRACT --> META[Metadata]

    HIST --> CREATE[Create Task Instance]
    API --> CREATE
    UI --> CREATE
    META --> CREATE

    CREATE --> RESTORE[Restore State]
    RESTORE --> MODE[Set Mode]
    RESTORE --> WORKSPACE[Set Workspace]
    RESTORE --> CONTEXT[Restore Context]

    MODE --> RESUME[Resume Task]
    WORKSPACE --> RESUME
    CONTEXT --> RESUME

    RESUME --> NEWMSG[Add New User Message]
    NEWMSG --> CONTINUE[Continue Execution]
```

## Storage Structure

```
globalStoragePath/
├── tasks/
│   ├── {taskId-1}/
│   │   ├── api_conversation_history.json    # API messages with timestamps
│   │   ├── ui_messages.json                 # UI display messages
│   │   ├── task_metadata.json              # Task metadata (optional)
│   │   └── checkpoints/                     # Checkpoint data (if enabled)
│   ├── {taskId-2}/
│   │   ├── api_conversation_history.json
│   │   ├── ui_messages.json
│   │   └── ...
│   └── ...
├── settings/
│   ├── custom_modes.yaml
│   └── mcp_settings.json
└── logs/
    └── system-prompt-*.txt
```

## Data Flow Architecture

```mermaid
graph TB
    subgraph "Request Processing"
        REQ[HTTP Request] --> PARSE[Parse Parameters]
        PARSE --> ROUTE{Route Request}
    end

    subgraph "Task Loading"
        ROUTE -->|Restart| FIND[Find Task]
        FIND --> LOAD[Load Files]
        LOAD --> RECONSTRUCT[Reconstruct State]
    end

    subgraph "Task Execution"
        ROUTE -->|New Task| CREATE[Create New Task]
        RECONSTRUCT --> RESUME[Resume Task]
        CREATE --> EXECUTE[Execute Task]
        RESUME --> EXECUTE
    end

    subgraph "Response Streaming"
        EXECUTE --> STREAM[Stream Responses]
        STREAM --> SSE[SSE Events]
        SSE --> CLIENT[Client Response]
    end

    subgraph "State Persistence"
        EXECUTE --> SAVE[Save State]
        SAVE --> FILES[Update Files]
        FILES --> STORAGE[(Storage)]
    end
```

## Error Handling Flow

```mermaid
graph TD
    START[Task Restart Request] --> VALIDATE{Validate Request}

    VALIDATE -->|Invalid TaskId| ERR1[400: Invalid Task ID Format]
    VALIDATE -->|Valid| FIND[Find Task]

    FIND -->|Not Found| ERR2[404: Task Not Found]
    FIND -->|Found| LOAD[Load Task Data]

    LOAD -->|File Error| ERR3[500: Storage Access Error]
    LOAD -->|Corrupt Data| ERR4[422: Corrupted Task Data]
    LOAD -->|Success| RESTORE[Restore Task]

    RESTORE -->|Context Error| ERR5[500: Context Restoration Failed]
    RESTORE -->|Success| CONTINUE[Continue Task]

    ERR1 --> SUGGEST1[Suggest: Check task ID format]
    ERR2 --> SUGGEST2[Suggest: List available tasks]
    ERR3 --> SUGGEST3[Suggest: Check permissions]
    ERR4 --> SUGGEST4[Suggest: Create new task]
    ERR5 --> SUGGEST5[Suggest: Retry or create new task]
```

## Security Architecture

```mermaid
graph TB
    subgraph "Input Validation"
        REQ[Request] --> VALIDATE[Validate TaskId Format]
        VALIDATE --> SANITIZE[Sanitize Paths]
    end

    subgraph "Access Control"
        SANITIZE --> CHECK[Check Task Access]
        CHECK --> PERMS[Verify Permissions]
    end

    subgraph "Safe Operations"
        PERMS --> SAFE[Safe File Operations]
        SAFE --> BOUNDED[Bounded Resource Usage]
    end

    subgraph "Audit Trail"
        BOUNDED --> LOG[Security Logging]
        LOG --> MONITOR[Monitor Access Patterns]
    end
```

## Performance Considerations

### Task Loading Optimization

```mermaid
graph LR
    subgraph "Optimization Strategies"
        CACHE[Task Metadata Cache]
        LAZY[Lazy Loading]
        STREAM[Streaming File Reads]
        PARALLEL[Parallel File Operations]
    end

    subgraph "Performance Metrics"
        LOAD_TIME[Load Time < 2s]
        MEMORY[Memory Usage < 100MB]
        CONCURRENT[Concurrent Requests]
    end

    CACHE --> LOAD_TIME
    LAZY --> MEMORY
    STREAM --> LOAD_TIME
    PARALLEL --> CONCURRENT
```

### Scalability Architecture

```mermaid
graph TB
    subgraph "Load Balancing"
        LB[Load Balancer] --> API1[API Server 1]
        LB --> API2[API Server 2]
        LB --> API3[API Server N]
    end

    subgraph "Shared Storage"
        API1 --> SHARED[Shared Task Storage]
        API2 --> SHARED
        API3 --> SHARED
    end

    subgraph "Caching Layer"
        SHARED --> CACHE[Task Metadata Cache]
        CACHE --> REDIS[(Redis/Memory Cache)]
    end
```

## Integration Points

### VSCode Extension Integration

```mermaid
graph LR
    EXT[VSCode Extension] -->|Creates Tasks| STORAGE[Global Storage]
    API[API Server] -->|Reads Tasks| STORAGE
    API -->|Continues Tasks| TASK[Task Engine]
    TASK -->|Updates Storage| STORAGE
    EXT -->|Can Resume| STORAGE
```

### CLI Integration

```mermaid
graph LR
    CLI[CLI Tool] -->|Creates Tasks| CLI_STORAGE[CLI Storage]
    API[API Server] -->|Cross-Context Access| CLI_STORAGE
    API -->|Unified Task Service| UTS[UnifiedTaskService]
    UTS -->|Discovers All Contexts| DISCOVERY[Task Discovery]
```

This architecture ensures that task restart functionality is robust, secure, and performant while maintaining compatibility across all execution contexts.
