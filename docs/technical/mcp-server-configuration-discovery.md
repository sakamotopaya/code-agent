# MCP Server Configuration Discovery

This document details how the code agent discovers and loads MCP (Model Context Protocol) server configurations across all three operational modes: VS Code Extension, CLI Utility, and API Server.

## Overview

The system supports both **global** and **project-specific** MCP server configurations, with a consistent directory structure and file naming convention across all modes.

## Global Storage Directory

All modes use a common global storage directory:

- **Default**: `$HOME/.agentz/` (user's home directory)
- **Environment Overrides**:
    - `ROO_GLOBAL_STORAGE_PATH` - Direct path override
    - `API_STORAGE_ROOT` - API-specific override
- **Fallback**: `/tmp/.agentz/` (when home directory is unavailable)

## Configuration Discovery by Mode

### 1. VS Code Extension Mode

The VS Code extension uses `McpHub.ts` to discover MCP servers in two locations:

#### Global Configuration

- **File Path**: `[global storage]/.agentz/mcp_settings.json`
- **Access Method**: `getMcpSettingsFilePath()`
- **Auto-creation**: Creates empty config if file doesn't exist
- **File Format**:

```json
{
	"mcpServers": {
		"server-name": {
			"type": "stdio",
			"command": "node",
			"args": ["server.js"],
			"disabled": false,
			"timeout": 60,
			"alwaysAllow": []
		}
	}
}
```

#### Project Configuration

- **File Path**: `[workspace folder]/.agentz/mcp.json`
- **Access Method**: `getProjectMcpPath()`
- **Availability**: Only when VS Code workspace folders exist
- **Same format** as global configuration

### 2. CLI Utility Mode

The CLI uses `CLIMcpService.ts` with a **priority-based discovery system**:

#### Priority Order (highest to lowest):

1. **Explicit Config Path** (via `--mcp-config` option)
2. **Project Roo Config**: `[current working directory]/.agentz/mcp_settings.json`
3. **Global Roo Config**: `$HOME/.agentz/mcp_settings.json`
4. **Global CLI Config**: `$HOME/.agentz/mcp-config.json`

#### Configuration Resolution

- Method: `resolveConfigPath()`
- Tries each path in order until one is found
- Falls back to global CLI config path (creates if needed)

### 3. API Server Mode

The API server uses the same `GlobalCLIMcpService` as the CLI, inheriting **identical discovery behavior**:

- Follows the same priority order as CLI mode
- Configured via API server startup options
- Uses same file paths and formats

## Configuration File Formats

### Shared Structure

All configuration files use the same base structure:

```json
{
  "mcpServers": {
    "server-id": {
      "type": "stdio" | "sse",
      "disabled": false,
      "timeout": 60,
      "alwaysAllow": ["tool1", "tool2"],
      "watchPaths": ["/path/to/watch"],

      // For stdio servers:
      "command": "node",
      "args": ["server.js"],
      "cwd": "/working/directory",
      "env": { "VAR": "value" },

      // For SSE servers:
      "url": "https://server.example.com/sse",
      "headers": { "Authorization": "Bearer token" }
    }
  }
}
```

### Server Configuration Types

#### STDIO Servers

```json
{
	"type": "stdio",
	"command": "node",
	"args": ["mcp-server.js"],
	"cwd": "/path/to/server",
	"env": { "API_KEY": "value" }
}
```

#### SSE Servers

```json
{
	"type": "sse",
	"url": "https://mcp-server.example.com/sse",
	"headers": { "Authorization": "Bearer token" }
}
```

## File Watching and Hot Reload

### VS Code Extension

- **Global Config**: Watches for file saves via `vscode.workspace.onDidSaveTextDocument`
- **Project Config**: Watches for file saves in workspace
- **Hot Reload**: Automatically reconnects servers when configs change

### CLI/API

- **Static Loading**: Configs loaded at startup or command execution
- **No Hot Reload**: Requires restart to pick up configuration changes

## Environment Variables

### Global Path Override

```bash
# Override global storage directory
export ROO_GLOBAL_STORAGE_PATH="/custom/path"

# API-specific override
export API_STORAGE_ROOT="/api/storage"
```

### Command Line Options (CLI)

```bash
# Explicit config file
roo-cli --mcp-config /path/to/config.json

# Server-specific options
roo-cli --mcp-server server-id --mcp-timeout 120
```

## Discovery Flow Diagram

```
┌─────────────────┐
│   Mode Check    │
└─────────┬───────┘
          │
    ┌─────▼─────┐
    │ VS Code?  │
    └─────┬─────┘
          │ No
    ┌─────▼─────┐      ┌─────────────────────┐
    │ CLI/API   │ ────▶│ Priority Discovery  │
    └───────────┘      │ 1. Explicit path    │
          │            │ 2. Project config   │
          │            │ 3. Global config    │
          │            │ 4. CLI config       │
          │            └─────────────────────┘
          │ Yes
    ┌─────▼─────┐      ┌─────────────────────┐
    │ VS Code   │ ────▶│ Dual Discovery      │
    └───────────┘      │ 1. Global config    │
                       │ 2. Project config   │
                       └─────────────────────┘
```

## Configuration Validation

All modes use the same validation schema (`ServerConfigSchema`) with:

- **Type Validation**: Must be 'stdio' or 'sse'
- **Field Requirements**: Appropriate fields for each type
- **Timeout Limits**: 1-3600 seconds
- **Format Checking**: JSON syntax validation
- **Error Reporting**: Detailed validation messages

## Best Practices

### For Development

1. Use project-specific configs (`.agentz/mcp.json` or `.agentz/mcp_settings.json`)
2. Keep global configs for commonly used servers
3. Use environment variables for sensitive data

### For Production

1. Use explicit config paths in automated environments
2. Set appropriate timeouts for your use case
3. Monitor server status and error logs
4. Use `disabled: true` to temporarily disable servers

### For Multi-Mode Usage

1. Use consistent server names across configs
2. Prefer `mcp_settings.json` naming for CLI/API compatibility
3. Test configurations across all modes you plan to use
