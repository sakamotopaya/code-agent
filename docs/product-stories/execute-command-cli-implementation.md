# Execute Command Tool CLI Implementation

## Problem Statement

The `execute_command` tool is not working in the CLI code path, even though other tools (list_files, search_files, read_file, write_file, and MCP tools) are working correctly. The issue is that the `executeCommandTool` implementation bypasses the CLI terminal adapter system and tries to use the VSCode-specific `TerminalRegistry` directly.

## Current Architecture Analysis

### Working Path (VSCode)

1. VSCode extension calls `TerminalRegistry.initialize()` on startup
2. `executeCommandTool` calls `TerminalRegistry.getOrCreateTerminal()`
3. Registry creates either VSCode Terminal or ExecaTerminal based on provider
4. Tool execution works

### Broken Path (CLI)

1. CLI never calls `TerminalRegistry.initialize()`
2. CLI creates terminal adapters via `createCliAdapters()`
3. `Task` receives CLI terminal adapter
4. `executeCommandTool` ignores Task's terminal adapter and calls `TerminalRegistry.getOrCreateTerminal()`
5. Registry is uninitialized → execution fails

### Key Files Involved

- `src/core/tools/executeCommandTool.ts` - The tool implementation
- `src/integrations/terminal/TerminalRegistry.ts` - VSCode-oriented registry
- `src/core/adapters/cli/CliTerminal.ts` - CLI terminal implementation
- `src/cli/repl.ts` - CLI entry point that creates adapters

## Implementation Plan

### Phase 1: Add CLI Terminal Support to executeCommandTool

**Objective**: Modify `executeCommandTool` to use the Task's terminal adapter when available, falling back to TerminalRegistry for VSCode compatibility.

**Changes Required**:

1. **Modify `executeCommandTool.ts`**:

    - Add detection of CLI context
    - Use `cline.terminal` adapter when available (CLI mode)
    - Fall back to `TerminalRegistry` for VSCode mode
    - Ensure interface compatibility between both paths

2. **Update `ExecuteCommandOptions` interface**:

    - Add optional `useTaskTerminal?: boolean` flag

3. **Create `CLITerminalAdapter`**:
    - Bridge between `ITerminal` interface and `TerminalRegistry` interface
    - Implement necessary methods to make CLI terminal work with existing tool code

### Phase 2: Initialize TerminalRegistry for CLI (Alternative Approach)

**Objective**: Make TerminalRegistry work in CLI context as a fallback approach.

**Changes Required**:

1. **Update `TerminalRegistry.initialize()`**:

    - Add CLI-safe initialization path
    - Skip VSCode-specific event handlers in CLI context
    - Detect environment context automatically

2. **Update CLI entry points**:
    - Call `TerminalRegistry.initialize()` in CLI startup
    - Ensure proper cleanup on exit

### Phase 3: Unify Terminal Architecture (Future Enhancement)

**Objective**: Create a unified terminal system that works seamlessly in both contexts.

**Changes Required**:

1. **Create `TerminalManager` interface**:

    - Abstract over both TerminalRegistry and CLI adapters
    - Provide consistent API for all terminal operations

2. **Update all terminal-related tools**:
    - Use unified TerminalManager instead of direct TerminalRegistry calls

## Recommended Implementation: Phase 1

We recommend implementing Phase 1 first as it:

- ✅ Provides immediate fix for the issue
- ✅ Maintains backward compatibility with VSCode
- ✅ Uses existing CLI terminal infrastructure
- ✅ Requires minimal changes to existing code
- ✅ Follows the established pattern used by other CLI adapters

## Technical Implementation Details

### executeCommandTool.ts Changes

```typescript
// Current approach (line 215):
const terminal = await TerminalRegistry.getOrCreateTerminal(workingDir, !!customCwd, cline.taskId, terminalProvider)

// New approach:
const terminal = await getTerminalForTask(cline, workingDir, !!customCwd, terminalProvider)

async function getTerminalForTask(cline: Task, workingDir: string, requiredCwd: boolean, provider: string) {
	// Check if task has CLI terminal adapter
	if (cline.terminal && typeof cline.terminal.executeCommand === "function") {
		return new CLITerminalAdapter(cline.terminal, workingDir)
	}

	// Fall back to TerminalRegistry for VSCode
	return await TerminalRegistry.getOrCreateTerminal(workingDir, requiredCwd, cline.taskId, provider)
}
```

### CLITerminalAdapter Implementation

```typescript
class CLITerminalAdapter {
	constructor(
		private cliTerminal: ITerminal,
		private workingDir: string,
	) {}

	runCommand(command: string, callbacks: RooTerminalCallbacks): RooTerminalProcessResultPromise {
		// Bridge CLI terminal execution to TerminalRegistry interface
		return this.cliTerminal.executeCommand(command, { cwd: this.workingDir }, callbacks)
	}

	getCurrentWorkingDirectory(): string {
		return this.workingDir
	}
}
```

## Success Criteria

- [ ] `execute_command` tool works in CLI context
- [ ] VSCode functionality remains unchanged
- [ ] All existing tests pass
- [ ] New CLI-specific tests added and passing
- [ ] No breaking changes to public APIs

## Testing Strategy

1. **Unit Tests**: Test CLI terminal adapter bridging
2. **Integration Tests**: Test execute_command in both CLI and VSCode contexts
3. **Manual Testing**: Verify actual command execution in CLI mode

## Migration Path

1. Implement CLITerminalAdapter
2. Update executeCommandTool to detect and use CLI context
3. Add comprehensive testing
4. Deploy and validate
5. Consider Phase 2/3 for future releases if needed

## Risks and Mitigation

**Risk**: Breaking VSCode functionality
**Mitigation**: Maintain existing TerminalRegistry path as fallback

**Risk**: Interface incompatibility between CLI and VSCode terminals
**Mitigation**: Create adapter layer to bridge interfaces

**Risk**: Performance overhead from adapter layer
**Mitigation**: Minimal adapter implementation with direct delegation
