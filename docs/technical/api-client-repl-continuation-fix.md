# API Client REPL Continuation Fix

## Problem Description

When using the API client in `--repl` mode, after executing a task, the client exits instead of returning to the REPL prompt. This breaks the interactive experience and forces users to restart the client for each command.

## Root Cause

The issue is in the `handleInput` method of the `REPLSession` class in `src/tools/api-client.ts`. After executing a command via `await this.executeCommand(input)`, the method doesn't call `this.promptUser()` again to continue the REPL loop.

**Current flow:**

1. User enters command in REPL
2. `promptUser()` calls `handleInput()`
3. `handleInput()` executes the command via `executeCommand()`
4. Method returns without calling `promptUser()` again
5. REPL exits

## Solution

Add a call to `this.promptUser()` at the end of the `handleInput` method to continue the REPL loop after command execution.

**Fixed flow:**

1. User enters command in REPL
2. `promptUser()` calls `handleInput()`
3. `handleInput()` executes the command via `executeCommand()`
4. `handleInput()` calls `this.promptUser()` to continue the loop
5. REPL returns to prompt, ready for next command

## Implementation Details

### File: `src/tools/api-client.ts`

### Method: `REPLSession.handleInput()`

### Line: After line 736 (after `await this.executeCommand(input)`)

Add the following code:

```typescript
// Continue REPL loop after command execution
this.promptUser()
```

This ensures the REPL continues after each command execution, maintaining the interactive session.

## Testing

1. Start API client in REPL mode: `npm run api-client -- --repl`
2. Execute a task command
3. Verify that the REPL returns to the prompt instead of exiting
4. Execute multiple commands in sequence to ensure continuous operation

## Impact

- **Low Risk**: Single line addition with clear intent
- **High Value**: Fixes critical REPL functionality
- **No Breaking Changes**: Maintains existing API and behavior
- **Backward Compatible**: No impact on non-REPL usage
