# cliUIService Runtime Analysis

## Problem Statement

The `ask_followup_question` tool fails in API mode with the error:

```
Error: this.cliUIService.getPromptManager is not a function
```

## Root Cause Analysis

### Type Definition Issue

In `src/core/task/Task.ts`, `cliUIService` is typed as `any` due to a circular dependency:

```typescript
// Line 152: TaskOptions
cliUIService?: any // CLIUIService type import would create circular dependency

// Line 227: Task class property
private cliUIService?: any // CLIUIService instance for CLI mode
```

### Runtime Object Creation Analysis

| Runtime            | Object Type        | Location                              | Has `getPromptManager()` | Interface        |
| ------------------ | ------------------ | ------------------------------------- | ------------------------ | ---------------- |
| **CLI Mode** ✅    | `CLIUIService`     | `src/cli/commands/batch.ts:146`       | ✅ Yes                   | `ICLIUIService`  |
| **API Mode** ❌    | `SSEOutputAdapter` | `src/api/server/FastifyServer.ts:389` | ❌ **NO**                | `IUserInterface` |
| **Extension Mode** | `undefined`        | N/A                                   | ❌ N/A                   | N/A              |

### CLI Mode (Working)

```typescript
// src/cli/commands/batch.ts line 146
const cliUIService = new CLIUIService(this.options.color)

// CLIUIService implements ICLIUIService with:
getPromptManager(): PromptManager {
    return this.promptManager
}
```

### API Mode (Broken)

```typescript
// src/api/server/FastifyServer.ts lines 388-389
// Use SSE adapter as CLI UI service equivalent for question handling
cliUIService: sseAdapter,
```

The `sseAdapter` is an `SSEOutputAdapter` which:

- Implements `IUserInterface` only
- Does NOT have a `getPromptManager()` method
- Is designed for streaming output, not CLI-style prompt management

### The Failing Code

```typescript
// src/core/task/Task.ts line 1175
promptManager = this.cliUIService.getPromptManager()
```

When `this.cliUIService` is an `SSEOutputAdapter`, this method doesn't exist.

## Architectural Problems

1. **Interface Mismatch**: `SSEOutputAdapter` is incorrectly used as a CLI UI service replacement
2. **Mixed Paradigms**: API mode should use unified question manager, not CLI patterns
3. **Type Safety**: `any` typing hides interface incompatibilities
4. **Circular Dependencies**: Prevents proper typing

## Solution Options

### Option A: Fix API Mode Assignment (Recommended)

- Don't pass `sseAdapter` as `cliUIService` in API mode
- Pass `undefined` and rely on unified question manager
- Update `ask_followup_question` tool to use unified system

### Option B: Make SSEOutputAdapter Compatible

- Add `getPromptManager()` method to `SSEOutputAdapter`
- Return the existing `questionManager` property
- Maintains backward compatibility

### Option C: Runtime-Aware Tool Logic

- Make `ask_followup_question` tool detect runtime mode
- Use appropriate question system for each environment
- Most robust but requires more changes

## Recommended Fix

Implement Option A:

1. Remove `cliUIService: sseAdapter` from API mode
2. Ensure unified question manager initializes properly
3. Update `ask_followup_question` tool to prefer unified system

This aligns with the intended architecture where:

- CLI mode uses `CLIUIService`
- API mode uses `UnifiedQuestionManager`
- Extension mode uses VSCode-specific question handling
