# Logging Strategy for Multi-Platform Code Agent

## Problem Statement

The current codebase has hardcoded `console.log` statements throughout core modules that don't respect platform-specific logging configurations. This causes verbose debug messages to appear even when the `--verbose` flag is not used in CLI mode, and doesn't provide proper logging interfaces for API or VSCode extension contexts.

### Specific Issues Identified

When running CLI without `--verbose`, these messages still appear:

- `[CLIProvider] Initialized successfully`
- `[Task] CLI mode detected - using CLI output adapter`
- `[CoreProvider] parent task {id} created`
- `📊 State synchronized - Mode: {mode}, API: {provider}`
- `[MESSAGING-PERSISTENCE] lines...`

## Architecture Requirements

The solution must support three execution contexts:

1. **CLI utility** - Console logging with verbose/quiet controls
2. **VSCode extension** - UI-based logging and notifications
3. **API endpoint** - SSE streaming or structured responses

## Logging Strategy

### 1. Interface-Based Logging

Create a unified logging interface that can be adapted for each platform:

```typescript
interface ILogger {
	debug(message: string, ...args: any[]): void
	info(message: string, ...args: any[]): void
	warn(message: string, ...args: any[]): void
	error(message: string, ...args: any[]): void
	verbose(message: string, ...args: any[]): void
}
```

### 2. Platform-Specific Adapters

#### CLI Logger Adapter

- Respects `--verbose` and `--quiet` flags
- Uses colored output when appropriate
- Outputs to stderr for debug/verbose messages

#### VSCode Logger Adapter

- Integrates with VSCode output channels
- Uses VSCode notification system for important messages
- Respects user's VSCode settings

#### API Logger Adapter

- Integrates with SSE streaming for real-time feedback
- Provides structured log data for API consumers
- Supports different log levels for API responses

### 3. Logger Injection Strategy

Core modules should receive logger instances through:

1. **Constructor injection** - For long-lived services
2. **Context providers** - For platform-specific contexts
3. **Global registry** - For backwards compatibility during transition

### 4. Log Level Hierarchy

```
ERROR   - Always shown, critical issues
WARN    - Shown unless quiet mode, important notices
INFO    - Shown unless quiet mode, general information
DEBUG   - Only shown in verbose mode, detailed debugging
VERBOSE - Only shown in verbose mode, extra detail
```

## Implementation Plan

### Phase 1: Create Logging Infrastructure

1. **Define ILogger interface** in `src/core/interfaces/ILogger.ts`
2. **Create platform adapters**:
    - `src/core/adapters/cli/CLILoggerAdapter.ts`
    - `src/core/adapters/vscode/VSCodeLoggerAdapter.ts`
    - `src/core/adapters/api/APILoggerAdapter.ts`
3. **Create logger factory** in `src/core/services/LoggerFactory.ts`

### Phase 2: Update Core Modules

Priority files with hardcoded console.log statements:

1. `src/core/adapters/cli/CLIProvider.ts` - Line 72
2. `src/core/task/Task.ts` - Lines 515, 519, 523, 528, etc.
3. `src/core/provider/CoreProvider.ts` - Lines 42, 58, 222, etc.
4. `src/core/adapters/cli/CLIOutputAdapters.ts` - Line 128
5. `src/core/task/TaskApiHandler.ts` - Lines 624-659

### Phase 3: Integration Points

1. **CLI entry point** (`src/cli/index.ts`):

    - Initialize CLI logger adapter with verbose/quiet settings
    - Inject into PlatformServiceFactory

2. **VSCode extension** (`src/extension.ts`):

    - Initialize VSCode logger adapter
    - Hook into existing output channels

3. **API server** (`src/api/server/FastifyServer.ts`):
    - Initialize API logger adapter
    - Integrate with SSE streaming

### Phase 4: Backwards Compatibility

1. **Global logger registry** for gradual migration
2. **Wrapper functions** to maintain existing API contracts
3. **Feature flags** to enable new logging incrementally

## Expected Outcomes

### CLI Behavior

```bash
# Without --verbose (current issue)
npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "say hello"
# Should only show essential output, no debug messages

# With --verbose
npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "say hello" --verbose
# Should show all debug messages including [CLIProvider], [Task], etc.
```

### VSCode Extension

- Debug messages appear in dedicated output channel
- Important events trigger appropriate notifications
- Respects user's log level preferences

### API Endpoint

- Debug information available via SSE stream when requested
- Structured log data in API responses
- Configurable log levels per request

## Migration Strategy

1. **Start with CLI** - Most urgent issue affecting user experience
2. **Gradual core module updates** - Replace console.log statements systematically
3. **VSCode integration** - Leverage existing output infrastructure
4. **API integration** - Align with SSE streaming architecture
5. **Remove legacy patterns** - Clean up hardcoded logging

## Testing Strategy

1. **Unit tests** for each logger adapter
2. **Integration tests** for platform-specific behavior
3. **CLI behavioral tests** to verify verbose flag functionality
4. **Performance tests** to ensure logging doesn't impact execution

## File Structure

```
src/
├── core/
│   ├── interfaces/
│   │   └── ILogger.ts
│   ├── services/
│   │   └── LoggerFactory.ts
│   └── adapters/
│       ├── cli/
│       │   └── CLILoggerAdapter.ts
│       ├── vscode/
│       │   └── VSCodeLoggerAdapter.ts
│       └── api/
│           └── APILoggerAdapter.ts
└── ...
```

This strategy ensures consistent logging behavior across all platforms while maintaining the flexibility required for each execution context.
