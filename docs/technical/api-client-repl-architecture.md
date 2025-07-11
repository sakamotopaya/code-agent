# API Client REPL Architecture

## System Overview

The REPL implementation extends the existing api-client.js with interactive capabilities while preserving all current functionality. The architecture follows a session-based approach where task context is maintained across multiple user interactions.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Command Line Interface"
        CLI[Command Line Args]
        CLI --> PARSE[Argument Parser]
        PARSE --> REPL_CHECK{--repl flag?}
        REPL_CHECK -->|No| SINGLE[Single Command Mode]
        REPL_CHECK -->|Yes| REPL_INIT[Initialize REPL Session]
    end

    subgraph "REPL Session Management"
        REPL_INIT --> SESSION[REPLSession Instance]
        SESSION --> PROMPT[Display Prompt]
        PROMPT --> INPUT[Wait for User Input]
        INPUT --> CMD_PARSE[Parse Command]

        CMD_PARSE --> SPECIAL{Special Command?}
        SPECIAL -->|exit| EXIT[Exit Program]
        SPECIAL -->|newtask| CLEAR[Clear Task ID]
        SPECIAL -->|help| HELP[Show Help]
        SPECIAL -->|No| API_CALL[Prepare API Call]

        CLEAR --> PROMPT
        HELP --> PROMPT
        API_CALL --> TASK_CHECK{Has Task ID?}
    end

    subgraph "Task Context Management"
        TASK_CHECK -->|Yes| CONTINUE[Continue Existing Task]
        TASK_CHECK -->|No| NEW[Create New Task]

        CONTINUE --> API_REQ[API Request with taskId]
        NEW --> API_REQ_NEW[API Request without taskId]

        API_REQ --> RESPONSE[Process Response]
        API_REQ_NEW --> EXTRACT[Extract New Task ID]
        EXTRACT --> STORE[Store Task ID in Session]
        STORE --> RESPONSE
    end

    subgraph "API Communication Layer"
        RESPONSE --> STREAM_CHECK{Streaming Mode?}
        STREAM_CHECK -->|Yes| STREAM_HANDLER[Streaming Response Handler]
        STREAM_CHECK -->|No| BASIC_HANDLER[Basic Response Handler]

        STREAM_HANDLER --> DISPLAY[Display Response]
        BASIC_HANDLER --> DISPLAY

        DISPLAY --> PROMPT
    end

    subgraph "Single Command Mode (Existing)"
        SINGLE --> EXISTING[Existing Logic]
        EXISTING --> API_SINGLE[Single API Call]
        API_SINGLE --> EXIT_SINGLE[Exit]
    end

    subgraph "API Server"
        API_REQ --> SERVER[Fastify Server]
        API_REQ_NEW --> SERVER
        API_SINGLE --> SERVER
        SERVER --> TASK_SERVICE[UnifiedTaskService]
        TASK_SERVICE --> STORAGE[(Task Storage)]
    end
```

## Component Responsibilities

### REPLSession Class

- **Purpose**: Manages interactive session state and user interactions
- **Responsibilities**:
    - Maintain task ID across commands
    - Handle user input and command parsing
    - Manage readline interface
    - Coordinate with API communication layer
    - Provide user feedback and prompts

### Command Parser

- **Purpose**: Distinguish between special REPL commands and API tasks
- **Responsibilities**:
    - Parse user input
    - Route special commands (exit, newtask, help)
    - Pass regular commands to API layer

### Task Context Manager

- **Purpose**: Maintain conversation continuity across REPL commands
- **Responsibilities**:
    - Store and retrieve task ID
    - Determine when to create new vs continue existing tasks
    - Extract task ID from API responses

### API Communication Layer

- **Purpose**: Handle communication with the API server
- **Responsibilities**:
    - Prepare API requests with appropriate task context
    - Handle both streaming and basic response modes
    - Extract task information from responses
    - Display formatted responses to user

## Data Flow

### New Task Creation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant R as REPL Session
    participant A as API Layer
    participant S as API Server

    U->>R: Enter command
    R->>R: Check task ID (none)
    R->>A: Prepare request without taskId
    A->>S: POST /execute or /stream
    S->>S: Create new task
    S->>A: Response with taskId
    A->>R: Extract and store taskId
    R->>U: Display response
    R->>R: Update prompt with task indicator
```

### Task Continuation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant R as REPL Session
    participant A as API Layer
    participant S as API Server

    U->>R: Enter command
    R->>R: Check task ID (exists)
    R->>A: Prepare request with taskId + restartTask
    A->>S: POST /execute or /stream
    S->>S: Load existing task context
    S->>A: Continue conversation
    A->>R: Process response
    R->>U: Display response
```

## State Management

### Session State

```javascript
{
    taskId: string | null,           // Current task identifier
    mode: string,                    // Agent mode (code, debug, etc.)
    host: string,                    // API server host
    port: number,                    // API server port
    useStream: boolean,              // Streaming vs basic mode
    // ... other configuration options
}
```

### Task Context State (Server-side)

```javascript
{
    historyItem: HistoryItem,        // Task metadata
    apiConversationHistory: ApiMessage[], // API conversation
    uiMessages: ClineMessage[],      // UI messages
    taskDir: string,                 // Storage directory
    originContext: "api",            // Context identifier
    mode: string,                    // Agent mode
    workspace?: string               // Workspace path if applicable
}
```

## Integration Points

### Backward Compatibility

- All existing command-line flags work in REPL mode
- Single command mode remains unchanged
- No breaking changes to existing API contracts

### Shared Components

- Reuse existing API request logic
- Leverage current streaming infrastructure
- Maintain existing error handling patterns
- Use established logging and debugging systems

### Extension Points

- Command history support
- Tab completion for commands
- Custom prompt formatting
- Plugin system for additional commands

## Error Handling Strategy

### REPL-Specific Errors

- Invalid commands: Show help and continue
- API connection errors: Display error and continue session
- Task loading errors: Clear task ID and continue
- Unexpected errors: Log and continue session

### Graceful Degradation

- If task context is lost, continue with new task creation
- If API is unavailable, provide clear feedback but keep REPL active
- Handle network interruptions gracefully

## Security Considerations

### Input Validation

- Sanitize user input before sending to API
- Validate task ID format
- Prevent command injection

### Session Security

- Task IDs are UUIDs (non-guessable)
- No sensitive data stored in REPL session
- Leverage existing API authentication mechanisms

## Performance Considerations

### Memory Management

- Limit command history size
- Clean up readline resources on exit
- Avoid memory leaks in long-running sessions

### Response Handling

- Stream large responses to avoid blocking
- Implement timeout handling for API calls
- Provide progress indicators for long operations

## Testing Strategy

### Unit Testing

- REPLSession class methods
- Command parsing logic
- Task ID management
- Error handling scenarios

### Integration Testing

- End-to-end REPL workflows
- API communication in REPL mode
- Task continuation across commands
- Error recovery scenarios

### User Acceptance Testing

- Interactive session usability
- Command discoverability
- Error message clarity
- Performance under normal usage
