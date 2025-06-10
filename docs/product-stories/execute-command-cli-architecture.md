# Execute Command CLI Architecture

## Current Flow (Broken)

```mermaid
graph TD
    A[CLI User Input] --> B[CliRepl.executeTask]
    B --> C[Task Creation with CLI Adapters]
    C --> D[createCliAdapters creates ITerminal]
    D --> E[Task receives terminal adapter]
    E --> F[presentAssistantMessage]
    F --> G[executeCommandTool]
    G --> H{Uses TerminalRegistry}
    H --> I[TerminalRegistry.getOrCreateTerminal]
    I --> J[❌ FAILS - Registry not initialized]

    style H fill:#ff9999
    style I fill:#ff9999
    style J fill:#ff0000
```

## Proposed Solution Flow

```mermaid
graph TD
    A[CLI User Input] --> B[CliRepl.executeTask]
    B --> C[Task Creation with CLI Adapters]
    C --> D[createCliAdapters creates ITerminal]
    D --> E[Task receives terminal adapter]
    E --> F[presentAssistantMessage]
    F --> G[executeCommandTool]
    G --> H{Context Detection}
    H -->|CLI Context| I[Use Task.terminal adapter]
    H -->|VSCode Context| J[Use TerminalRegistry]
    I --> K[CLITerminalAdapter Bridge]
    K --> L[ITerminal.executeCommand]
    L --> M[✅ Command Executes Successfully]
    J --> N[TerminalRegistry.getOrCreateTerminal]
    N --> O[✅ VSCode Terminal Works]

    style H fill:#99ff99
    style I fill:#99ff99
    style K fill:#99ff99
    style M fill:#00ff00
    style O fill:#00ff00
```

## Interface Bridge Architecture

```mermaid
classDiagram
    class ITerminal {
        +executeCommand(command, options, callbacks)
        +createSession(options)
        +getDefaultShell()
    }

    class RooTerminal {
        +runCommand(command, callbacks)
        +getCurrentWorkingDirectory()
        +provider: string
        +busy: boolean
    }

    class CLITerminalAdapter {
        -cliTerminal: ITerminal
        -workingDir: string
        +runCommand(command, callbacks)
        +getCurrentWorkingDirectory()
        +provider: "cli"
        +busy: boolean
    }

    class TerminalRegistry {
        +getOrCreateTerminal(cwd, requiredCwd, taskId, provider)
        +initialize()
    }

    class executeCommandTool {
        +getTerminalForTask(task, workingDir, requiredCwd, provider)
    }

    ITerminal <|-- CLITerminalAdapter : implements
    RooTerminal <|-- CLITerminalAdapter : emulates
    executeCommandTool --> CLITerminalAdapter : creates when CLI
    executeCommandTool --> TerminalRegistry : uses when VSCode
    CLITerminalAdapter --> ITerminal : delegates to
```

## Component Integration Points

```mermaid
graph LR
    subgraph "CLI Context"
        A1[CliRepl] --> B1[Task]
        B1 --> C1[CLI Adapters]
        C1 --> D1[ITerminal Impl]
    end

    subgraph "VSCode Context"
        A2[Extension] --> B2[Task]
        B2 --> C2[VSCode Adapters]
        C2 --> D2[TerminalRegistry]
    end

    subgraph "Shared Tool Layer"
        E[executeCommandTool]
        F[Context Detection]
        G[CLITerminalAdapter]
    end

    D1 --> F
    D2 --> F
    F --> E
    F --> G
    G --> D1
```

## Implementation Strategy

### Phase 1: Core Implementation

1. **Create CLITerminalAdapter class**

    - Bridge ITerminal interface to RooTerminal interface
    - Handle command execution delegation
    - Manage working directory state

2. **Modify executeCommandTool**

    - Add context detection logic
    - Route to appropriate terminal system
    - Maintain backward compatibility

3. **Add proper error handling**
    - Graceful fallbacks between systems
    - Clear error messages for debugging

### Phase 2: Testing & Validation

1. **Unit tests for CLITerminalAdapter**
2. **Integration tests for executeCommandTool in both contexts**
3. **Manual testing of CLI command execution**

### Phase 3: Documentation & Cleanup

1. **Update tool documentation**
2. **Add CLI-specific usage examples**
3. **Performance optimization if needed**

## Success Metrics

- ✅ `execute_command` tool works in CLI context
- ✅ No regression in VSCode functionality
- ✅ All existing tests continue to pass
- ✅ New CLI tests added and passing
- ✅ Error handling provides clear feedback
- ✅ Performance within acceptable bounds

## Risk Mitigation

| Risk                          | Impact | Mitigation                                         |
| ----------------------------- | ------ | -------------------------------------------------- |
| Breaking VSCode functionality | High   | Maintain existing TerminalRegistry path as default |
| Interface incompatibility     | Medium | Create comprehensive adapter layer                 |
| Performance overhead          | Low    | Minimize adapter with direct delegation            |
| Complex debugging             | Medium | Add comprehensive logging and error messages       |
