# Add Sample MCP Server to Configuration

## Objective

Add sample MCP servers to `/Users/eo/.agentz/mcp-config.json` to demonstrate MCP functionality and provide ready-to-use configurations.

## Current State Analysis

### Existing MCP Configuration File

**Location**: `/Users/eo/.agentz/mcp-config.json`
**Current Content**:

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
	"servers": []
}
```

### Available Example Servers

**Source**: [`src/cli/types/mcp-config-types.ts`](src/cli/types/mcp-config-types.ts:40-86)

The codebase already defines example servers in `EXAMPLE_SERVERS`:

1. **GitHub Server** - Access GitHub repositories and operations
2. **Filesystem Server** - Access local filesystem operations
3. **Custom API Server** - SSE-based MCP server example

## Implementation Plan

### Step 1: Update Configuration File Structure

**File to Modify**: `/Users/eo/.agentz/mcp-config.json`

**Target Content**:

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
			"id": "github-server",
			"name": "GitHub MCP Server",
			"description": "Access GitHub repositories and operations",
			"type": "stdio",
			"enabled": false,
			"command": "npx",
			"args": ["-y", "@modelcontextprotocol/server-github"],
			"env": {
				"GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
			},
			"timeout": 30000,
			"retryAttempts": 3,
			"retryDelay": 1000,
			"healthCheckInterval": 60000
		},
		{
			"id": "filesystem-server",
			"name": "Filesystem MCP Server",
			"description": "Access local filesystem operations",
			"type": "stdio",
			"enabled": false,
			"command": "npx",
			"args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
			"timeout": 15000,
			"retryAttempts": 2,
			"retryDelay": 500,
			"healthCheckInterval": 30000
		},
		{
			"id": "custom-api-server",
			"name": "Custom API Server",
			"description": "Custom SSE-based MCP server",
			"type": "sse",
			"enabled": false,
			"url": "https://api.example.com/mcp",
			"headers": {
				"Authorization": "Bearer ${API_TOKEN}",
				"Content-Type": "application/json"
			},
			"timeout": 15000,
			"retryAttempts": 2,
			"retryDelay": 2000,
			"healthCheckInterval": 30000
		}
	]
}
```

### Step 2: Code Implementation

#### Option A: Direct File Modification

Simply update the JSON file with the sample servers from `EXAMPLE_SERVERS`.

#### Option B: CLI Command Enhancement

**File to Modify**: [`src/cli/commands/mcp-commands.ts`](src/cli/commands/mcp-commands.ts)

Add functionality to the `initConfig()` method to include sample servers:

```typescript
// In CLIMcpCommands.initConfig()
const configWithSamples: McpConfigFile = {
	version: "1.0.0",
	defaults: DEFAULT_MCP_CONFIG,
	servers: EXAMPLE_SERVERS.map((server) => ({
		...server,
		enabled: false, // Disable by default to prevent connection errors
	})),
}
```

### Step 3: Dependency Installation Instructions

The sample servers require these npm packages:

```bash
# GitHub MCP Server
npm install -g @modelcontextprotocol/server-github

# Filesystem MCP Server
npm install -g @modelcontextprotocol/server-filesystem

# For creating custom servers
npm install -g @modelcontextprotocol/create-server
```

### Step 4: Environment Variable Setup

Add documentation for required environment variables:

#### GitHub Server

```bash
export GITHUB_TOKEN="your_github_personal_access_token"
```

#### Custom API Server

```bash
export API_TOKEN="your_api_token"
```

### Step 5: Testing and Validation

**Files to Test**:

- [`src/cli/services/CLIMcpService.ts`](src/cli/services/CLIMcpService.ts) - Config loading
- [`src/cli/commands/mcp-commands.ts`](src/cli/commands/mcp-commands.ts) - CLI commands

**Test Commands**:

```bash
# Validate configuration
roo mcp config validate

# Show configuration
roo mcp config show

# List available servers
roo mcp list

# Test connection (after enabling and setting env vars)
roo mcp connect github-server
```

## Implementation Notes

### Why Servers are Disabled by Default

- Prevents connection errors when dependencies aren't installed
- Requires explicit activation after setup
- Allows users to configure environment variables first

### Security Considerations

- Environment variables use placeholder syntax `${VAR_NAME}`
- No hardcoded credentials in configuration
- Filesystem server uses safe default path (`/tmp`)

### Backward Compatibility

- Maintains existing configuration structure
- Doesn't break existing CLI functionality
- Compatible with current validation logic

## Dependencies Detected

From analysis of existing code, adding MCP servers requires:

### Core MCP SDK

```bash
npm install @modelcontextprotocol/sdk
```

### Server Packages (CLI Installation)

```bash
npm install -g @modelcontextprotocol/server-github
npm install -g @modelcontextprotocol/server-filesystem
```

### Development Dependencies (for custom servers)

```bash
npm install axios zod
npm install @types/node typescript
```

## Files That Need Updates

1. **`/Users/eo/.agentz/mcp-config.json`** - Add sample server configurations
2. **`src/cli/commands/mcp-commands.ts`** (Optional) - Enhance init command to include samples
3. **Documentation** - Update setup instructions for environment variables

## Validation

The existing validation logic in [`CLIMcpService.validateServerConfig()`](src/cli/services/CLIMcpService.ts) should handle the new sample configurations correctly.

## Success Criteria

- [ ] Sample servers added to configuration file
- [ ] All servers disabled by default
- [ ] Environment variable placeholders properly formatted
- [ ] Configuration validates successfully with existing CLI commands
- [ ] Clear documentation for enabling and configuring servers
- [ ] Dependencies clearly documented for installation
