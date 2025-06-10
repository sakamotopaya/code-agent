# MCP Architecture Fix - Critical CLI Compatibility

## Epic Overview

Fix the MCP server implementation to ensure proper initialization handshake timing, resolving the "Method not found" errors in CLI and ensuring compatibility between extension and CLI versions.

## Root Cause

CLI connections are attempting MCP capability discovery (tools/list, resources/list) before the MCP initialization handshake completes, even though transport connections are established.

## Success Criteria

- [ ] CLI can successfully connect to MCP servers without -32601 errors
- [ ] Extension MCP functionality remains fully functional
- [ ] Both stdio and SSE connections work properly
- [ ] Proper error handling and recovery mechanisms
- [ ] Unified connection architecture between CLI and extension

---

## Story 1: Create Base MCP Connection Interface

**Priority**: P0 - Critical
**Estimate**: 2 story points

### Description

Create a unified base interface and abstract class for MCP connections that handles proper initialization handshake timing.

### Acceptance Criteria

- [ ] Create `BaseMcpConnection` abstract class with proper handshake flow
- [ ] Implement `initializeHandshake()` method that waits for MCP ready state
- [ ] Add `waitForReady()` method with configurable timeout
- [ ] Include proper error handling for handshake failures
- [ ] Add connection state management (connecting -> handshaking -> ready -> connected)

### Technical Details

```typescript
abstract class BaseMcpConnection implements McpConnection {
	protected abstract setupTransport(): Promise<void>
	protected abstract createClient(): Client

	public async connect(): Promise<void> {
		await this.setupTransport()
		await this.initializeHandshake()
		await this.waitForReady()
		this.status = "connected"
	}

	private async initializeHandshake(): Promise<void> {
		// Perform MCP initialization protocol
	}

	private async waitForReady(timeout: number = 30000): Promise<void> {
		// Wait for server to be ready for capability requests
	}
}
```

### Files to Modify

- `src/core/mcp/BaseMcpConnection.ts` (new)
- `src/core/mcp/types.ts` (update interfaces)

---

## Story 2: Fix CLI Stdio Connection Implementation

**Priority**: P0 - Critical
**Estimate**: 3 story points

### Description

Update the CLI Stdio connection to use the new base class and implement proper handshake timing.

### Acceptance Criteria

- [ ] Extend `BaseMcpConnection` instead of implementing interface directly
- [ ] Override `setupTransport()` to create stdio transport properly
- [ ] Add stderr monitoring with proper error classification
- [ ] Implement retry logic for failed handshakes
- [ ] Add timeout handling for slow server starts

### Technical Details

- Follow the extension's pattern for stderr handling and transport setup
- Add delay after transport connection before attempting handshake
- Implement exponential backoff for retries

### Files to Modify

- `src/cli/connections/StdioMcpConnection.ts`
- `src/cli/connections/__tests__/StdioMcpConnection.test.ts`

---

## Story 3: Fix CLI SSE Connection Implementation

**Priority**: P0 - Critical
**Estimate**: 2 story points

### Description

Update the CLI SSE connection to use the new base class and implement proper handshake timing.

### Acceptance Criteria

- [ ] Extend `BaseMcpConnection` instead of implementing interface directly
- [ ] Override `setupTransport()` to create SSE transport properly
- [ ] Add proper event handling for SSE-specific errors
- [ ] Implement connection health monitoring
- [ ] Add reconnection logic for dropped SSE connections

### Files to Modify

- `src/cli/connections/SseMcpConnection.ts`
- `src/cli/connections/__tests__/SseMcpConnection.test.ts`

---

## Story 4: Update CLI MCP Service for Proper Timing

**Priority**: P0 - Critical
**Estimate**: 2 story points

### Description

Update the CLI MCP service to properly handle the new connection timing and avoid premature capability discovery.

### Acceptance Criteria

- [ ] Add connection readiness checks before capability discovery
- [ ] Implement proper error handling for handshake failures
- [ ] Add retry logic for failed connections
- [ ] Update server discovery to wait for full connection readiness
- [ ] Add proper logging for connection states

### Technical Details

```typescript
async discoverServers(): Promise<McpServerInfo[]> {
  for (const config of configs) {
    const connection = this.connections.get(config.id)
    if (connection?.status === "connected" && connection.isReady) {
      // Only attempt capability discovery if fully ready
      try {
        await this.discoverCapabilities(connection)
      } catch (error) {
        // Handle with proper retry logic
      }
    }
  }
}
```

### Files to Modify

- `src/cli/services/CLIMcpService.ts`
- `src/cli/services/__tests__/CLIMcpService.test.ts`

---

## Story 5: Ensure Extension Compatibility

**Priority**: P0 - Critical
**Estimate**: 3 story points

### Description

Verify that the extension MCP implementation remains fully functional and optionally migrate to use the new base classes.

### Acceptance Criteria

- [ ] Extension MCP servers continue to work without regression
- [ ] All existing extension tests pass
- [ ] Consider migrating extension to use new base classes (optional)
- [ ] Ensure no breaking changes to extension API
- [ ] Add integration tests for both CLI and extension

### Technical Details

- The extension's `McpHub.ts` has sophisticated initialization that works correctly
- We need to ensure our changes don't break the extension
- Consider whether to migrate the extension to use the new base classes or keep it separate

### Files to Verify

- `src/services/mcp/McpHub.ts`
- `src/services/mcp/__tests__/McpHub.test.ts`
- All extension MCP integration tests

---

## Story 6: Add Integration Tests and Error Recovery

**Priority**: P1 - High
**Estimate**: 3 story points

### Description

Add comprehensive integration tests and improve error recovery mechanisms for both CLI and extension.

### Acceptance Criteria

- [ ] Add end-to-end tests for CLI MCP server connections
- [ ] Test both stdio and SSE connection types
- [ ] Add tests for connection failure scenarios
- [ ] Test handshake timeout scenarios
- [ ] Add tests for server restart and reconnection
- [ ] Verify error messages are helpful for debugging

### Files to Create/Modify

- `src/cli/integration-tests/mcp-connections.test.ts` (new)
- `src/core/mcp/__tests__/integration.test.ts` (new)

---

## Implementation Order

1. **Story 1**: Create base connection architecture
2. **Story 2**: Fix CLI Stdio connection
3. **Story 3**: Fix CLI SSE connection
4. **Story 4**: Update CLI service timing
5. **Story 5**: Verify extension compatibility
6. **Story 6**: Add comprehensive testing

## Risk Mitigation

- **Risk**: Breaking extension functionality
    - **Mitigation**: Keep extension code separate initially, thorough testing
- **Risk**: CLI still has timing issues

    - **Mitigation**: Add configurable delays and extensive logging for debugging

- **Risk**: Different MCP server implementations behave differently
    - **Mitigation**: Test with multiple server types, add server-specific handling

## Testing Strategy

1. **Unit Tests**: Each connection class and service method
2. **Integration Tests**: Full CLI workflows with real MCP servers
3. **Regression Tests**: Ensure extension functionality unchanged
4. **Manual Testing**: Test with the problematic mssql-dpsp and github servers
