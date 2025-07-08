# MCP Debugging Configuration Strategy

## Current State

We successfully fixed the MCP system prompt issue and added comprehensive debugging logs throughout the process. However, these debugging logs are currently hardcoded `console.log` statements that will appear in production.

## Requirements

1. **Keep debugging logs available** - They were crucial for diagnosing the issue
2. **Make them configurable** - Turn off in production, on in development
3. **Consistent approach** - Use the same pattern across all MCP-related code
4. **Performance-friendly** - No overhead when debugging is disabled

## Debugging Locations

### Current Debug Logs Added:

1. **`src/core/task/Task.ts`** - MCP hub creation and population
2. **`src/core/prompts/sections/mcp-servers.ts`** - System prompt section generation
3. **`src/cli/services/GlobalCLIMcpService.ts`** - Server capability population

### Debug Log Types:

- MCP service initialization status
- Server connection and capability discovery
- Tool and resource population
- System prompt section generation
- Hub creation and server counts

## Proposed Solution

### 1. Create MCP Debug Configuration

Add an MCP-specific debug flag that can be controlled via:

- Environment variable: `MCP_DEBUG=true`
- Configuration file setting: `mcpDebug: true`
- CLI flag: `--mcp-debug`

### 2. Create MCP Debug Logger

Create a dedicated MCP debug logger that:

- Checks the debug flag before logging
- Uses consistent formatting
- Can be easily disabled in production
- Integrates with existing logging infrastructure

### 3. Implementation Pattern

```typescript
// In a shared MCP utilities file
export class McpDebugLogger {
	private static isEnabled(): boolean {
		return (
			process.env.MCP_DEBUG === "true" ||
			globalConfig?.mcpDebug === true ||
			process.env.NODE_ENV === "development"
		)
	}

	static log(message: string, ...args: any[]): void {
		if (this.isEnabled()) {
			console.log(`[MCP-DEBUG] ${message}`, ...args)
		}
	}
}

// Usage in code
McpDebugLogger.log("Global MCP service is initialized")
McpDebugLogger.log("MCP hub created:", mcpHub ? `${mcpHub.getServers().length} servers` : "null")
```

### 4. Configuration Integration

#### Environment Variables

```bash
# Development
MCP_DEBUG=true

# Production
MCP_DEBUG=false
```

#### Configuration Files

```json
{
	"mcpDebug": true,
	"verbose": true
}
```

#### CLI Integration

```bash
# Enable MCP debugging
npm run start:cli --mcp-debug

# Or via environment
MCP_DEBUG=true npm run start:cli
```

## Benefits

1. **Development-friendly**: Easy to enable detailed MCP debugging
2. **Production-safe**: No debug output in production by default
3. **Troubleshooting**: Can be enabled on-demand for production issues
4. **Performance**: Zero overhead when disabled
5. **Maintainable**: Centralized debug control

## Implementation Steps

1. Create `McpDebugLogger` utility class
2. Replace all `console.log('[MCP-DEBUG]')` calls with `McpDebugLogger.log()`
3. Replace all `console.log('[getMcpServersSection]')` calls with `McpDebugLogger.log()`
4. Replace all `console.log('[populateServerCapabilities]')` calls with `McpDebugLogger.log()`
5. Add configuration support for `mcpDebug` flag
6. Update documentation for debugging MCP issues

## Default Behavior

- **Development**: MCP debugging enabled by default
- **Production**: MCP debugging disabled by default
- **Troubleshooting**: Can be enabled via environment variable or config
