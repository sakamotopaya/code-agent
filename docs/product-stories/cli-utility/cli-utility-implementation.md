# PRD: Command Line Utility Implementation for Roo Code Agent

## Overview

This PRD outlines the requirements for extending the Roo Code VS Code extension to function as a standalone command line utility. This will allow users to interact with the coding agent through a REPL (Read-Eval-Print Loop) interface instead of the VS Code UI, while maintaining all existing functionality.

## Problem Statement

Currently, the Roo Code agent is tightly coupled to the VS Code environment and can only be used within the VS Code editor. Users who prefer command line interfaces or want to integrate the agent into automated workflows cannot access the powerful coding capabilities outside of VS Code.

## Goals

### Primary Goals
- Enable the Roo Code agent to run as a standalone command line utility
- Provide a REPL interface for user interaction
- Maintain feature parity with the VS Code extension
- Support all existing tools and capabilities
- Preserve configuration and settings management

### Secondary Goals
- Support both interactive and non-interactive modes
- Enable integration with CI/CD pipelines
- Provide output formatting options (JSON, plain text, etc.)
- Support session persistence and history

## User Stories

### Core Functionality
1. **As a developer**, I want to run `roo-cli` in my terminal to start an interactive coding session
2. **As a developer**, I want to input tasks and receive responses just like in the VS Code extension
3. **As a developer**, I want all file operations (read, write, diff, etc.) to work in CLI mode
4. **As a developer**, I want to execute commands and see their output in the CLI
5. **As a developer**, I want to browse websites and interact with web content from the CLI

### Configuration & Settings
6. **As a developer**, I want to configure API keys and model settings for CLI usage
7. **As a developer**, I want to use the same configuration as my VS Code extension
8. **As a developer**, I want to specify different working directories for CLI sessions

### Advanced Features
9. **As a developer**, I want to save and restore CLI sessions
10. **As a developer**, I want to run the CLI in non-interactive mode for automation
11. **As a developer**, I want to integrate MCP servers in CLI mode
12. **As a developer**, I want to use custom modes and prompts in CLI

## Technical Requirements

### Architecture Changes

#### 1. Core Abstraction Layer
- **Requirement**: Create an abstraction layer that separates VS Code-specific functionality from core agent logic
- **Implementation**: 
  - Extract `Task` class to be environment-agnostic
  - Create interface for UI interactions (`IUserInterface`)
  - Implement VS Code and CLI implementations of the interface

#### 2. CLI Entry Point
- **Requirement**: Create a new CLI entry point separate from the VS Code extension
- **Implementation**:
  - New `src/cli/index.ts` main entry point
  - Command line argument parsing
  - REPL implementation using Node.js `readline` or similar

#### 3. Configuration Management
- **Requirement**: Support configuration loading outside VS Code context
- **Implementation**:
  - Extend `ContextProxy` to work with file-based configuration
  - Support environment variables and config files
  - Maintain compatibility with VS Code settings

#### 4. Tool System Adaptation
- **Requirement**: Ensure all tools work in CLI environment
- **Implementation**:
  - Modify tools to use abstracted file system operations
  - Replace VS Code-specific UI elements with CLI equivalents
  - Adapt browser tools for headless operation

### New Components Required

#### 1. CLI Interface (`src/cli/`)
```
src/cli/
├── index.ts              # Main CLI entry point
├── repl.ts              # REPL implementation
├── config.ts            # CLI configuration management
├── ui/
│   ├── CliUserInterface.ts    # CLI implementation of IUserInterface
│   ├── formatters.ts          # Output formatting utilities
│   └── progress.ts            # Progress indicators for CLI
└── commands/
    ├── interactive.ts         # Interactive mode handler
    ├── batch.ts              # Non-interactive mode handler
    └── session.ts            # Session management
```

#### 2. Abstraction Layer (`src/core/interfaces/`)
```
src/core/interfaces/
├── IUserInterface.ts          # UI abstraction interface
├── IFileSystem.ts            # File system abstraction
├── ITerminal.ts              # Terminal abstraction
└── IBrowser.ts               # Browser abstraction
```

#### 3. Environment Adapters (`src/adapters/`)
```
src/adapters/
├── vscode/
│   ├── VsCodeUserInterface.ts
│   ├── VsCodeFileSystem.ts
│   └── VsCodeTerminal.ts
└── cli/
    ├── CliFileSystem.ts
    ├── CliTerminal.ts
    └── CliBrowser.ts
```

### Modified Components

#### 1. Task Class (`src/core/task/Task.ts`)
- Remove direct VS Code dependencies
- Accept `IUserInterface` in constructor
- Use abstracted interfaces for all operations

#### 2. Tool Implementations (`src/core/tools/`)
- Modify all tools to use abstracted interfaces
- Replace VS Code UI calls with interface methods
- Ensure browser tools work in headless mode

#### 3. Configuration System (`src/core/config/`)
- Extend `ContextProxy` to support file-based configuration
- Add CLI-specific configuration options
- Maintain backward compatibility

#### 4. Extension Entry Point (`src/extension.ts`)
- Refactor to use new abstraction layer
- Create VS Code-specific adapters
- Maintain existing functionality

### Package.json Changes

#### 1. New CLI Binary
```json
{
  "bin": {
    "roo-cli": "./dist/cli/index.js"
  },
  "scripts": {
    "build:cli": "tsc && chmod +x ./dist/cli/index.js",
    "start:cli": "node ./dist/cli/index.js"
  }
}
```

#### 2. Dependencies
- Add CLI-specific dependencies (commander, inquirer, etc.)
- Ensure all existing dependencies work in Node.js environment

## Implementation Plan

### Phase 1: Core Abstraction (2-3 weeks)
1. Create interface definitions (`IUserInterface`, `IFileSystem`, etc.)
2. Refactor `Task` class to use abstractions
3. Create VS Code adapter implementations
4. Ensure existing VS Code functionality still works

### Phase 2: CLI Infrastructure (2-3 weeks)
1. Implement CLI adapters for all interfaces
2. Create CLI entry point and REPL
3. Implement basic configuration management
4. Add command line argument parsing

### Phase 3: Tool Adaptation (2-3 weeks)
1. Modify all tools to work with CLI adapters
2. Implement CLI-specific UI elements (progress bars, prompts)
3. Ensure browser tools work in headless mode
4. Add output formatting options

### Phase 4: Advanced Features (2-3 weeks)
1. Implement session persistence
2. Add non-interactive mode support
3. Integrate MCP server support
4. Add comprehensive error handling

### Phase 5: Testing & Documentation (1-2 weeks)
1. Comprehensive testing of CLI functionality
2. Update documentation
3. Create CLI usage examples
4. Performance optimization

## Success Criteria

### Functional Requirements
- [ ] CLI can execute all tasks that work in VS Code extension
- [ ] All tools function correctly in CLI environment
- [ ] Configuration can be managed independently or shared with VS Code
- [ ] REPL provides intuitive user experience
- [ ] Non-interactive mode supports automation scenarios

### Performance Requirements
- [ ] CLI startup time < 3 seconds
- [ ] Task execution performance matches VS Code extension
- [ ] Memory usage remains reasonable for long-running sessions

### Quality Requirements
- [ ] 95% test coverage for new CLI components
- [ ] All existing VS Code tests continue to pass
- [ ] CLI handles errors gracefully
- [ ] Comprehensive documentation available

## Risks & Mitigation

### Technical Risks
1. **Risk**: VS Code dependencies deeply embedded in core logic
   - **Mitigation**: Gradual refactoring with comprehensive testing

2. **Risk**: Browser tools may not work in headless environment
   - **Mitigation**: Use puppeteer in headless mode, provide fallbacks

3. **Risk**: Configuration complexity between VS Code and CLI
   - **Mitigation**: Design unified configuration system from start

### User Experience Risks
1. **Risk**: CLI interface may be less intuitive than VS Code UI
   - **Mitigation**: Extensive user testing and iterative improvements

2. **Risk**: Feature parity difficult to maintain
   - **Mitigation**: Automated testing to ensure both interfaces work identically

## Future Considerations

### Potential Enhancements
- Web-based UI for remote access
- Docker container support
- Integration with popular IDEs beyond VS Code
- API server mode for programmatic access

### Maintenance Considerations
- Ensure changes don't break VS Code extension
- Maintain unified codebase to avoid duplication
- Consider CI/CD pipeline updates for dual-mode testing

## Appendix

### Key Files to Modify
1. `src/core/task/Task.ts` - Core task execution logic
2. `src/core/tools/*.ts` - All tool implementations
3. `src/core/config/ContextProxy.ts` - Configuration management
4. `src/extension.ts` - VS Code extension entry point
5. `src/core/webview/ClineProvider.ts` - Provider abstraction

### New Dependencies
- `commander` - Command line argument parsing
- `inquirer` - Interactive CLI prompts
- `chalk` - Terminal colors and formatting
- `ora` - Progress spinners
- `boxen` - Terminal boxes for formatting

### Configuration Schema
```json
{
  "cli": {
    "workingDirectory": "./",
    "outputFormat": "text|json",
    "sessionPersistence": true,
    "headlessBrowser": true
  }
}