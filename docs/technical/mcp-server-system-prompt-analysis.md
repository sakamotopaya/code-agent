# MCP Server System Prompt Analysis

## Issue Summary

The LLM in API mode is not aware of available MCP servers and their tools. From the test logs, we can see:

1. **LLM attempted to use `agentx-dpsp` server**: The LLM tried to call `use_mcp_tool` with server `agentx-dpsp` and tool `get_ticket`
2. **Got error "MCP service not available in CLI mode"**: This suggests the MCP integration isn't working properly in API mode
3. **System prompt may not include MCP server information**: The LLM should know about available servers from the system prompt

## Root Cause Analysis

### System Prompt Generation Flow

From `src/core/task/Task.ts:1656-1900`, the system prompt generation:

1. **Line 1702-1721**: In CLI mode, attempts to use `GlobalCLIMcpService`
2. **Line 1710**: Creates `mcpHub = globalMcpService.createMcpHub()`
3. **Line 1714**: Calls `globalMcpService.populateServerCapabilities(mcpHub)`
4. **Line 1857**: Calls `getMcpServersSection(mcpHub, undefined, enableMcpServerCreation)`
5. **Line 1876**: Includes `mcpServersSection` in final system prompt

### Potential Issues

#### 1. GlobalCLIMcpService Not Initialized

```typescript
if (globalMcpService.isInitialized()) {
	// MCP logic
} else {
	this.logDebug("[Task] Global MCP service not initialized - MCP features will be unavailable")
}
```

If the global MCP service isn't initialized, `mcpHub` will be `undefined`.

#### 2. Server Capabilities Not Populated

```typescript
await globalMcpService.populateServerCapabilities(mcpHub)
```

If this fails, the `mcpHub` won't have tool information.

#### 3. MCP Hub Creation Fails

```typescript
mcpHub = globalMcpService.createMcpHub()
```

If this returns `undefined` or fails, no MCP information will be included.

## Investigation Steps

### Step 1: Check MCP Service Initialization

The API server should initialize the global MCP service. Check:

- Is `GlobalCLIMcpService.getInstance().initialize()` called during API startup?
- Are MCP servers configured in the config file being loaded?
- Is the initialization completing successfully?

### Step 2: Verify MCP Hub Population

Check if server capabilities are being populated:

- Does `populateServerCapabilities()` successfully load tool schemas?
- Are the servers actually connected and responding?
- Is the `agentx-dpsp` server listed in the connected servers?

### Step 3: Examine System Prompt Content

Add logging to see what's actually in the MCP servers section:

- Log the `mcpServersSection` content before including in system prompt
- Verify that `agentx-dpsp` server and its tools are listed
- Check if the tool schemas are properly formatted

## Expected System Prompt Content

The system prompt should include a section like:

```
MCP SERVERS

## agentx-dpsp (`dotnet /path/to/server.dll`)

### Available Tools
- ticketRetriever: Returns the given ticket number (ex:10234/45) as a json string
    Input Schema:
    {
      "type": "object",
      "properties": {
        "ticket": {
          "description": "The ticket number to retrieve data for",
          "type": "string"
        }
      },
      "required": [
        "ticket"
      ]
    }

- Echo: Echoes the input back to the client.
    Input Schema:
    {
      "type": "object",
      "properties": {
        "message": {
          "type": "string"
        }
      },
      "required": [
        "message"
      ]
    }
```

## Debugging Strategy

### 1. Add MCP Service Logging

Add debug logging to track MCP service initialization and server loading.

### 2. Log System Prompt Content

Add logging to see the actual MCP servers section content being included in the system prompt.

### 3. Verify MCP Configuration

Check that the MCP configuration file has the correct server definitions and they're being loaded.

### 4. Test MCP Service Directly

Create a test to verify the global MCP service can connect to and query the `agentx-dpsp` server.

## Implementation Plan

### Phase 1: Add Debugging

1. Add logging to `GlobalCLIMcpService` initialization
2. Add logging to `populateServerCapabilities()`
3. Add logging to system prompt MCP section generation
4. Log the final system prompt content (or at least the MCP section)

### Phase 2: Fix Initialization Issues

1. Ensure global MCP service is properly initialized in API mode
2. Verify MCP configuration is loaded correctly
3. Fix any server connection issues

### Phase 3: Verify System Prompt

1. Confirm MCP servers section is properly included
2. Verify tool schemas are correctly formatted
3. Test that LLM can see and use MCP tools

## Testing

### Manual Test

1. Start API server with MCP servers configured
2. Make a request that should use MCP tools
3. Check logs for MCP service initialization
4. Verify system prompt includes MCP server information
5. Confirm LLM can successfully use MCP tools

### Expected Outcome

- LLM should be aware of `agentx-dpsp` server and its tools
- LLM should successfully call `use_mcp_tool` with correct parameters
- No "MCP service not available" errors

## Files to Investigate

1. **`src/cli/services/GlobalCLIMcpService.ts`** - Global MCP service implementation
2. **`src/core/task/Task.ts:1700-1722`** - MCP hub creation in CLI mode
3. **`src/core/prompts/sections/mcp-servers.ts`** - MCP servers section generation
4. **API server startup code** - Where global MCP service should be initialized
5. **MCP configuration file** - Verify server definitions are correct

This analysis provides a roadmap for diagnosing and fixing the MCP server integration issue in API mode.
