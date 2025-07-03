# CLI Cleanup Simplification - Product Stories

## Epic: Fix CLI Hanging Issue by Simplifying Cleanup Process

### Background

The CLI currently hangs after task completion due to overly aggressive cleanup that interferes with the MCP SDK's normal resource cleanup. The VSCode extension works fine because it uses simple, trusted cleanup methods.

### Stories

## Story 1: Simplify StdioMcpConnection Cleanup

**As a** CLI user  
**I want** the CLI to exit cleanly after completing tasks  
**So that** I don't have to manually kill the process

### Acceptance Criteria

- Remove `forceTerminateProcess()` method from `StdioMcpConnection`
- Remove aggressive timeout and force-killing logic in `disconnect()` method
- Use simple `transport.close()` + `client.close()` approach matching VSCode extension
- Trust MCP SDK to handle child process cleanup properly
- Test with MCP servers to ensure they disconnect cleanly

### Technical Details

- File: `src/cli/connections/StdioMcpConnection.ts`
- Remove lines 72-144 (forceTerminateProcess method)
- Replace complex disconnect() override with simple parent cleanup
- Remove verbose logging for force termination

---

## Story 2: Streamline CLIMcpService Disposal

**As a** CLI developer  
**I want** the MCP service disposal to be simple and reliable  
**So that** it matches the proven VSCode extension approach

### Acceptance Criteria

- Remove force-killing logic from `dispose()` method
- Remove complex timeout mechanisms during disconnection
- Use standard dispose pattern with simple connection cleanup
- Ensure all connections are properly closed using MCP SDK methods

### Technical Details

- File: `src/cli/services/CLIMcpService.ts`
- Simplify `dispose()` method (lines 524-574)
- Remove force process killing and complex timeout logic
- Use simple `await this.disconnectFromServer(serverId)` for each connection

---

## Story 3: Simplify CleanupManager Process Exit

**As a** CLI user  
**I want** the cleanup process to be straightforward and effective  
**So that** the CLI exits promptly without hanging

### Acceptance Criteria

- Remove aggressive handle inspection and force-killing of child processes
- Remove complex timeout mechanisms for natural exit
- Simplify cleanup task execution
- Allow natural process exit after cleanup tasks complete
- Remove handle type logging and diagnostic complexity

### Technical Details

- File: `src/cli/services/CleanupManager.ts`
- Remove lines 106-221 (aggressive handle inspection and force-killing)
- Simplify `performShutdown()` method
- Remove `logActiveHandles()` complexity
- Use simple cleanup task execution with basic timeout

---

## Story 4: Align GlobalCLIMcpService with VSCode Pattern

**As a** CLI developer  
**I want** the global MCP service to follow the same disposal pattern as VSCode  
**So that** it's consistent and reliable

### Acceptance Criteria

- Use simple `mcpService.dispose()` call without additional complexity
- Remove redundant cleanup logging and error handling
- Match the simplicity of VSCode extension's `McpServerManager.cleanup()`
- Ensure proper singleton cleanup

### Technical Details

- File: `src/cli/services/GlobalCLIMcpService.ts`
- Simplify `dispose()` method (lines 239-252)
- Remove complex error handling and logging
- Use simple await pattern

---

## Story 5: Update CLI Entry Point Cleanup

**As a** CLI user  
**I want** the main CLI cleanup process to be simple and effective  
**So that** the application exits cleanly every time

### Acceptance Criteria

- Remove complex CleanupManager configuration
- Use simple cleanup task registration
- Remove redundant performance monitoring cleanup
- Trust that simplified services will clean up properly

### Technical Details

- File: `src/cli/cli-entry.ts`
- Simplify cleanup task registration (lines 370-415)
- Remove complex cleanup error handling
- Use straightforward dispose pattern

---

## Definition of Done

- [ ] All stories implemented and tested
- [ ] CLI exits cleanly after simple tasks (e.g., "say hello")
- [ ] CLI exits cleanly after MCP server operations
- [ ] No hanging processes or orphaned handles
- [ ] Performance matches or exceeds VSCode extension cleanup
- [ ] All tests pass
- [ ] Code follows simplified, maintainable patterns

---

## Testing Strategy

1. **Unit Tests**: Test individual cleanup methods work correctly
2. **Integration Tests**: Test full CLI execution with various tasks
3. **Manual Testing**: Run CLI with verbose logging to verify clean exit
4. **Performance Testing**: Compare cleanup time vs current implementation
5. **Regression Testing**: Ensure MCP functionality still works correctly

---

## Risk Mitigation

- **Risk**: Simplified cleanup might miss edge cases
    - **Mitigation**: Thorough testing with various MCP server configurations
- **Risk**: Some child processes might not clean up properly
    - **Mitigation**: Monitor process trees during testing, fallback mechanisms if needed
- **Risk**: Breaking existing MCP functionality
    - **Mitigation**: Comprehensive integration testing with both MCP servers
