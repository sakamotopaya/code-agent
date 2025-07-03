# CLI Hanging Issue Analysis

## Problem Summary

The CLI hangs after task completion despite extensive cleanup efforts. The process won't exit naturally even after aggressive cleanup of child processes, sockets, and other handles.

## Root Cause Analysis

### VSCode Extension (Works Fine)

```typescript
// Simple, clean cleanup in McpHub.deleteConnection()
await connection.transport.close()
await connection.client.close()
```

### CLI (Hangs)

```typescript
// Complex, aggressive cleanup in StdioMcpConnection
await super.disconnect() // Normal cleanup
await this.forceTerminateProcess() // SIGKILL + aggressive cleanup
```

## Key Findings

1. **Both use same MCP SDK**: Both VSCode extension and CLI use `StdioClientTransport` which spawns child processes
2. **Different cleanup approaches**: VSCode trusts MCP SDK cleanup, CLI over-engineers with aggressive force-killing
3. **Interference**: CLI's aggressive cleanup interferes with MCP SDK's proper cleanup process
4. **Orphaned handles**: Force-killing and stream destruction prevents proper resource cleanup

## Evidence from Logs

- Child processes (PIDs 91337, 91379) are being force-killed but handles remain
- Multiple sockets and streams persist after aggressive cleanup
- CleanupManager tries to be "polite" but aggressive cleanup has already broken normal resource cleanup

## Solution Strategy

### Phase 1: Simplify MCP Cleanup

- Remove `forceTerminateProcess()` method from `StdioMcpConnection`
- Remove complex timeout and force-killing logic
- Use simple `transport.close()` + `client.close()` like VSCode extension
- Trust MCP SDK to handle child process cleanup properly

### Phase 2: Simplify CleanupManager

- Remove aggressive handle inspection and force-killing
- Remove complex timeout mechanisms
- Use simple cleanup task registration and execution
- Allow natural process exit after cleanup

### Phase 3: Test and Validate

- Test CLI with simple "say hello" command
- Verify no hanging after task completion
- Test with MCP server operations
- Compare performance with VSCode extension

## Implementation Plan

1. **Revert StdioMcpConnection**: Remove aggressive cleanup, use simple transport/client close
2. **Simplify CLIMcpService**: Remove force-killing logic, use standard dispose pattern
3. **Streamline CleanupManager**: Remove handle inspection, use simple task execution
4. **Update GlobalCLIMcpService**: Use simple dispose pattern matching VSCode extension
5. **Test**: Verify CLI exits cleanly after tasks

## Expected Outcome

CLI should exit cleanly after task completion, matching VSCode extension behavior, without requiring force-exit mechanisms or aggressive cleanup procedures.
