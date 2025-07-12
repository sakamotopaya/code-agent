# REPL Options Issue Analysis

## Problem

The CLI options like `--show-thinking`, `--show-mcp-use`, etc. are not being honored when using `--repl` mode, even though they're being passed correctly to the REPLSession.

## Root Cause

The issue is a type mismatch between `REPLSessionOptions` and `ApiClientOptions`:

1. **REPLSessionOptions** (lines 27-44) includes most CLI options but is missing:

    - `logSystemPrompt`
    - `logLlm`

2. **ApiClientOptions** (lines 4-24) includes all options including the missing ones

3. In `executeCommand` method (lines 774-792), when creating the options object:
    ```typescript
    const options: ApiClientOptions = {
    	...this.options, // REPLSessionOptions spread
    	task: this.taskId || undefined,
    	restartTask: !!this.taskId,
    	replMode: false,
    	logSystemPrompt: false, // Force to false
    	logLlm: false, // Force to false
    }
    ```

## The Fix

Update the `REPLSessionOptions` type to include the missing properties and ensure proper option passing.

## Files to Update

1. `src/tools/types/api-client-types.ts` - Add missing properties to REPLSessionOptions
2. `src/tools/api-client.ts` - Update REPLSession constructor calls to pass all options

## Expected Behavior

When user runs: `api-client --repl --show-thinking --show-mcp-use --verbose`

- All options should be honored in REPL mode
- Streaming responses should show thinking sections and MCP tool usage
- Verbose output should be displayed
