# MCP CLI Configuration Integration

## Problem Statement

The CLI has MCP functionality but cannot access MCP servers because there's a disconnect between two different configuration formats:

### Current Situation

1. **Roo Code Format** (VSCode Extension)

    - File: `mcp_settings.json`
    - Location: `~/.agentz/mcp_settings.json` or project `.agentz/mcp_settings.json`
    - Used by: VSCode extension McpHub
    - Format:

    ```json
    {
    	"mcpServers": {
    		"server-id": {
    			"command": "dotnet",
    			"args": ["path/to/server.dll"],
    			"env": { "KEY": "value" },
    			"alwaysAllow": ["tool1"]
    		}
    	}
    }
    ```

2. **CLI Format** (New CLI Implementation)
    - File: `mcp-config.json`
    - Location: `./mcp-config.json` or `~/.agentz/mcp-config.json`
    - Used by: CLIMcpService
    - Format:
    ```json
    {
    	"version": "1.0.0",
    	"defaults": {
    		"timeout": 30000,
    		"retryAttempts": 3,
    		"retryDelay": 1000,
    		"healthCheckInterval": 60000,
    		"autoConnect": true,
    		"enableLogging": true
    	},
    	"servers": [
    		{
    			"id": "server-id",
    			"name": "Server Name",
    			"type": "stdio",
    			"command": "dotnet",
    			"args": ["path/to/server.dll"]
    		}
    	]
    }
    ```

### The Issue

When users run CLI commands like `list your mcp resources`, the CLI reports "no MCP servers connected" even though they have servers configured in `mcp_settings.json` because:

1. CLI only looks for `mcp-config.json`
2. CLI expects `servers` array format
3. No integration between the two configuration systems

## Solution Architecture

### Unified MCP Configuration Resolution

The CLI MCP service should support both formats with the following priority:

1. **Explicit CLI config path** (if provided via `--mcp-config`)
2. **Local CLI config** (`./mcp-config.json`)
3. **Roo Code global config** (`~/.agentz/mcp_settings.json`)
4. **Roo Code project config** (`./.agentz/mcp_settings.json`)
5. **CLI global config** (`~/.agentz/mcp-config.json`)

### Configuration Mapping

Transform Roo Code format to CLI format:

```typescript
// Roo Code mcpServers object -> CLI servers array
{
  "mssql-dpsp": {
    "command": "dotnet",
    "args": ["path/to/server.dll"],
    "env": {"CONN": "..."},
    "alwaysAllow": ["get_table_schema"]
  }
}

// Becomes:
{
  "id": "mssql-dpsp",
  "name": "mssql-dpsp",
  "type": "stdio",
  "enabled": true,
  "command": "dotnet",
  "args": ["path/to/server.dll"],
  "env": {"CONN": "..."},
  "alwaysAllow": ["get_table_schema"]
}
```

## Implementation Stories

### Story 1: Update CLI Config Resolution

**File**: `src/cli/services/CLIMcpService.ts`

**Changes Needed**:

1. Update `resolveConfigPath()` to check multiple locations:

    - Current directory `mcp-config.json`
    - `.agentz/mcp_settings.json` (project Roo config)
    - `~/.agentz/mcp_settings.json` (global Roo config)
    - `~/.agentz/mcp-config.json` (CLI config)

2. Update `loadServerConfigs()` to handle both formats:

    - Detect format by checking for `mcpServers` vs `servers`
    - Transform Roo format to CLI format
    - Apply defaults appropriately

3. Add format detection and conversion logic

### Story 2: Pass CLI MCP Options to Task Creation

**File**: `src/core/task/Task.ts` (lines 1148-1160)

**Changes Needed**:

1. Pass `mcpConfig` path from CLI options to `CLIMcpService` constructor
2. Enable automatic server connection based on CLI options
3. Improve error handling and logging

### Story 3: Update CLI Entry Point

**File**: `src/cli/cli-entry.ts`

**Changes Needed**:

1. Pass MCP configuration options to batch processor
2. Ensure MCP config path is available in task creation
3. Add better MCP-related CLI option handling

### Story 4: Configuration Schema Update

**File**: `src/cli/config/CliConfigManager.ts`

**Changes Needed**:

1. Add MCP configuration to CLI config schema
2. Support loading MCP settings from agent configuration
3. Provide unified configuration interface

## Testing Strategy

### Test Cases

1. **Legacy Roo Config**: CLI should read `mcp_settings.json` and connect to servers
2. **New CLI Config**: CLI should read `mcp-config.json` format
3. **Mixed Config**: CLI should prioritize explicit config paths
4. **No Config**: CLI should gracefully handle missing configuration
5. **Invalid Config**: CLI should provide helpful error messages

### Validation

- Existing MCP servers (like `mssql-dpsp` and `github`) should be discoverable
- MCP tools should be listable via CLI
- MCP resources should be accessible via CLI
- No breaking changes to VSCode extension functionality

## Success Criteria

✅ **Primary Goal**: `npm run start:cli -- --config ~/.agentz/agent-config.json --batch "list your mcp resources"` returns actual MCP resources instead of "no MCP servers connected"

✅ **Secondary Goals**:

- CLI can use MCP tools from configured servers
- Backward compatibility with existing configurations
- No disruption to VSCode extension MCP functionality
- Clear error messages for configuration issues

## Implementation Priority

1. **High Priority**: Story 1 (Config Resolution) - Core functionality
2. **High Priority**: Story 2 (Task Integration) - CLI integration
3. **Medium Priority**: Story 3 (CLI Entry) - User experience
4. **Low Priority**: Story 4 (Schema Update) - Configuration consistency

## Risk Mitigation

- **Breaking Changes**: Maintain backward compatibility with both formats
- **Performance**: Cache configuration parsing to avoid repeated file reads
- **Error Handling**: Provide clear diagnostics when configuration fails
- **Testing**: Comprehensive test coverage for both configuration formats
