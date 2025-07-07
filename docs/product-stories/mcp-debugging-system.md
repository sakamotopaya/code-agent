# MCP Debugging System - Product Story

## Problem Statement

We successfully fixed the MCP system prompt issue and added comprehensive debugging logs that were crucial for diagnosis. However, these debugging logs are currently hardcoded `console.log` statements that will appear in production and cannot be controlled.

## User Stories

### Story 1: Configurable MCP Debugging

**As a** developer debugging MCP issues
**I want** to enable detailed MCP debugging logs
**So that** I can troubleshoot MCP server integration problems

**Acceptance Criteria**:

- [ ] MCP debugging can be enabled via environment variable `MCP_DEBUG=true`
- [ ] MCP debugging can be enabled via configuration file `mcpDebug: true`
- [ ] MCP debugging is enabled by default in development mode
- [ ] MCP debugging is disabled by default in production mode
- [ ] All MCP debug logs use consistent formatting with `[MCP-DEBUG]` prefix

### Story 2: Production-Safe Logging

**As a** system administrator running in production
**I want** MCP debugging logs to be disabled by default
**So that** production logs are clean and performant

**Acceptance Criteria**:

- [ ] No MCP debug output in production unless explicitly enabled
- [ ] Zero performance overhead when debugging is disabled
- [ ] Can be enabled on-demand for production troubleshooting
- [ ] Integrates with existing logging infrastructure

### Story 3: Centralized Debug Control

**As a** developer maintaining the codebase
**I want** all MCP debugging to use a centralized logger
**So that** debug behavior is consistent and maintainable

**Acceptance Criteria**:

- [ ] Single `McpDebugLogger` class controls all MCP debugging
- [ ] Replace all hardcoded `console.log('[MCP-DEBUG]')` calls
- [ ] Replace all hardcoded `console.log('[getMcpServersSection]')` calls
- [ ] Replace all hardcoded `console.log('[populateServerCapabilities]')` calls
- [ ] Consistent log formatting across all MCP components

## Technical Implementation

### Phase 1: Create MCP Debug Logger

Create `src/shared/mcp/McpDebugLogger.ts`:

```typescript
export class McpDebugLogger {
	private static isEnabled(): boolean {
		// Check multiple sources for debug flag
		return (
			process.env.MCP_DEBUG === "true" ||
			process.env.NODE_ENV === "development" ||
			globalThis.mcpDebugEnabled === true
		)
	}

	static log(message: string, ...args: any[]): void {
		if (this.isEnabled()) {
			console.log(`[MCP-DEBUG] ${message}`, ...args)
		}
	}

	static section(sectionName: string, message: string, ...args: any[]): void {
		if (this.isEnabled()) {
			console.log(`[${sectionName}] ${message}`, ...args)
		}
	}
}
```

### Phase 2: Update Configuration Support

Add MCP debug configuration to:

- API configuration manager
- CLI configuration loading
- Environment variable handling

### Phase 3: Replace Debug Calls

Update all files with MCP debugging:

#### `src/core/task/Task.ts`

```typescript
// BEFORE
console.log(`[MCP-DEBUG] Global MCP service is initialized`)

// AFTER
McpDebugLogger.log("Global MCP service is initialized")
```

#### `src/core/prompts/sections/mcp-servers.ts`

```typescript
// BEFORE
console.log(`[getMcpServersSection] Called with mcpHub: present`)

// AFTER
McpDebugLogger.section("getMcpServersSection", "Called with mcpHub: present")
```

#### `src/cli/services/GlobalCLIMcpService.ts`

```typescript
// BEFORE
console.log(`[populateServerCapabilities] Starting capability population`)

// AFTER
McpDebugLogger.section("populateServerCapabilities", "Starting capability population")
```

## Configuration Examples

### Development Mode

```bash
# Automatically enabled
NODE_ENV=development npm run start:api
```

### Production with Debugging

```bash
# Explicitly enable for troubleshooting
MCP_DEBUG=true npm run start:api
```

### Configuration File

```json
{
	"mcpDebug": true,
	"verbose": true
}
```

## Success Criteria

1. **Clean Production Logs**: No MCP debug output in production by default
2. **Easy Development**: MCP debugging enabled automatically in development
3. **Troubleshooting Ready**: Can be enabled on-demand for production issues
4. **Maintainable**: All MCP debug calls use centralized logger
5. **Performance**: Zero overhead when debugging is disabled

## Testing

### Manual Testing

1. **Development Mode**: Verify MCP debug logs appear automatically
2. **Production Mode**: Verify no MCP debug logs by default
3. **Environment Override**: Verify `MCP_DEBUG=true` enables logs in production
4. **Configuration File**: Verify `mcpDebug: true` enables logs
5. **Performance**: Verify no performance impact when debugging disabled

### Integration Testing

1. Test MCP debugging during server startup
2. Test MCP debugging during capability population
3. Test MCP debugging during system prompt generation
4. Test configuration loading in all execution contexts (extension, CLI, API)

## Documentation Updates

1. **Developer Documentation**: How to enable MCP debugging
2. **Troubleshooting Guide**: Using MCP debugging for issue diagnosis
3. **Configuration Reference**: MCP debug configuration options
4. **Production Guide**: Enabling debugging in production environments
