# REPL History Persistence - Product Stories

## Overview

Implement persistent history for both CLI REPL and API client REPL with shared history management service. History should be saved in reverse chronological order and pruned to keep only the last 100 entries.

## Epic: Unified REPL History Management

### Story 1: Create Shared REPL History Service

**As a** developer using either CLI or API client REPL  
**I want** my command history to be persisted across sessions  
**So that** I can easily reuse previous commands and maintain productivity

**Acceptance Criteria:**

- [ ] Create `ReplHistoryService` class in `src/shared/services/`
- [ ] Implement persistent JSON storage with configurable file paths
- [ ] Store history in reverse chronological order (most recent first)
- [ ] Automatically prune history to keep only last 100 entries (configurable)
- [ ] Include deduplication to avoid consecutive duplicate entries
- [ ] Provide comprehensive error handling with graceful fallbacks
- [ ] Write unit tests with 90%+ coverage
- [ ] Support cross-platform file operations

**Technical Requirements:**

- File format: JSON with metadata (version, maxSize, entries with timestamps)
- Storage location: `~/.agentz/` directory
- Thread-safe operations for concurrent access
- Lazy loading for performance optimization

### Story 2: Integrate CLI REPL History Persistence

**As a** CLI user  
**I want** my REPL commands to be saved and restored between sessions  
**So that** I can quickly access my previous work and commands

**Acceptance Criteria:**

- [ ] Update `src/cli/repl.ts` to use shared `ReplHistoryService`
- [ ] Load history on REPL startup and apply to readline interface
- [ ] Save valid commands to persistent history after execution
- [ ] Maintain compatibility with existing session management
- [ ] Handle history file corruption gracefully
- [ ] Provide history-related CLI commands (clear, show, etc.)
- [ ] Test with various CLI scenarios and edge cases

**Integration Points:**

- Constructor: Initialize history service with CLI storage path
- `setupEventHandlers()`: Add history saving on line input
- `handleInput()`: Filter and save commands to history
- Exit handling: Ensure history is saved on graceful shutdown

### Story 3: Integrate API Client REPL History Persistence

**As an** API client user  
**I want** my REPL commands to persist across sessions  
**So that** I can maintain continuity in my API testing workflow

**Acceptance Criteria:**

- [ ] Update `api-client.js` REPLSession to use shared history service
- [ ] Ensure Node.js compatibility (no TypeScript runtime dependencies)
- [ ] Load and apply history to readline interface on startup
- [ ] Save commands after successful execution
- [ ] Handle both streaming and non-streaming command modes
- [ ] Test with various API client scenarios

**Technical Considerations:**

- Import as CommonJS module in Node.js environment
- Separate history file from CLI REPL (`api-client-repl-history.json`)
- Maintain existing REPLSession functionality

### Story 4: Add Configuration Support for History Management

**As a** user of either REPL  
**I want** to configure history behavior according to my preferences  
**So that** I can customize the history experience for my workflow

**Acceptance Criteria:**

- [ ] Add history settings to existing CLI configuration system
- [ ] Support custom history file paths and storage directories
- [ ] Allow configuration of maximum history size (default: 100)
- [ ] Provide option to disable history persistence entirely
- [ ] Include history cleanup and maintenance commands
- [ ] Document all configuration options

**Configuration Options:**

```json
{
	"repl": {
		"historyEnabled": true,
		"historyMaxSize": 100,
		"historyFile": "~/.agentz/cli-repl-history.json",
		"historyDeduplication": true
	}
}
```

### Story 5: Enhanced History Features and Commands

**As a** REPL user  
**I want** advanced history management capabilities  
**So that** I can efficiently work with my command history

**Acceptance Criteria:**

- [ ] Add `history` command to show recent entries
- [ ] Add `history clear` command to reset history
- [ ] Add `history search <pattern>` for finding specific commands
- [ ] Support history expansion with `!n` syntax (optional)
- [ ] Provide history statistics (total commands, most used, etc.)
- [ ] Include export/import functionality for history backup

**Advanced Features:**

- Smart deduplication (ignore minor variations)
- Command categorization and filtering
- History analytics and insights
- Integration with existing help system

## Technical Architecture

### Class Diagram

```mermaid
classDiagram
    class ReplHistoryService {
        -historyFile: string
        -maxHistorySize: number
        -history: HistoryEntry[]
        -isDirty: boolean
        +constructor(options: ReplHistoryOptions)
        +loadHistory(): Promise<HistoryEntry[]>
        +saveHistory(): Promise<void>
        +addEntry(command: string, context?: string): Promise<void>
        +getHistory(limit?: number): HistoryEntry[]
        +clearHistory(): Promise<void>
        +searchHistory(pattern: string): HistoryEntry[]
        +pruneHistory(): void
        +getStatistics(): HistoryStats
    }

    class HistoryEntry {
        +command: string
        +timestamp: Date
        +context: string
        +executionTime?: number
    }

    class ReplHistoryOptions {
        +historyFile?: string
        +maxHistorySize?: number
        +storageDir?: string
        +deduplication?: boolean
        +autoSave?: boolean
    }

    class HistoryStats {
        +totalEntries: number
        +uniqueCommands: number
        +mostUsedCommands: Array<{command: string, count: number}>
        +averageCommandLength: number
    }

    ReplHistoryService --> HistoryEntry
    ReplHistoryService --> ReplHistoryOptions
    ReplHistoryService --> HistoryStats
```

### File Structure

```
src/shared/services/
├── ReplHistoryService.ts          # Main history service
├── __tests__/
│   └── ReplHistoryService.test.ts # Comprehensive tests
└── types/
    └── repl-history-types.ts      # Type definitions

~/.agentz/
├── cli-repl-history.json          # CLI REPL history
├── api-client-repl-history.json   # API client history
└── repl-config.json               # REPL configuration
```

## Implementation Priority

1. **High Priority**: Core history service and CLI integration
2. **Medium Priority**: API client integration and basic configuration
3. **Low Priority**: Advanced features and analytics

## Success Metrics

- [ ] History persists correctly across REPL sessions
- [ ] No performance degradation in REPL startup time
- [ ] History files remain under reasonable size limits
- [ ] Zero data loss during normal operation
- [ ] Graceful handling of all error conditions
- [ ] User satisfaction with history functionality

## Risk Mitigation

- **File corruption**: Implement backup and recovery mechanisms
- **Performance impact**: Use lazy loading and efficient data structures
- **Cross-platform issues**: Thorough testing on Windows, macOS, and Linux
- **Concurrent access**: Implement proper file locking mechanisms
- **Storage space**: Automatic cleanup and size management
