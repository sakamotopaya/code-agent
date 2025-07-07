# MCP System Prompt Fix - Final Solution

## Root Cause Identified

The issue is in the data flow between `populateServerCapabilities()` and `createMcpHub()`:

1. **`populateServerCapabilities()`** stores tools on the `server` object: `server.tools = ...`
2. **`createMcpHub()`** tries to read tools from the `conn` object: `conn.tools`
3. **The `server` objects are created fresh each time** `getServers()` is called, so the populated tools are lost

## Solution

Store the tools directly on the connection object so they persist between calls.

### Changes Required

#### 1. Modify `populateServerCapabilities()` in `src/cli/services/GlobalCLIMcpService.ts`

Change from storing tools on the temporary `server` object to storing them on the persistent `connection` object:

```typescript
// BEFORE (line 205):
server.tools = toolsResult.tools.map((tool: any) => ({
	name: tool.name,
	description: tool.description,
	inputSchema: tool.inputSchema,
}))

// AFTER:
connection.tools = toolsResult.tools.map((tool: any) => ({
	name: tool.name,
	description: tool.description,
	inputSchema: tool.inputSchema,
}))
server.tools = connection.tools // Also set on server for immediate use
```

#### 2. Apply same pattern for resources

```typescript
// BEFORE (line ~220):
server.resources = resourcesResult.resources.map((resource: any) => ({
	uri: resource.uri,
	name: resource.name,
	description: resource.description,
}))

// AFTER:
connection.resources = resourcesResult.resources.map((resource: any) => ({
	uri: resource.uri,
	name: resource.name,
	description: resource.description,
}))
server.resources = connection.resources
```

## Expected Result

After this fix:

1. Tools will be discovered and stored on the connection object
2. `createMcpHub()` will read tools from `conn.tools` (which now exists)
3. System prompt will include MCP server tools
4. LLM will know about `ticketRetriever` and `Echo` tools from `agentx-dpsp` server

## Test Verification

The logs should show:

```
[getMcpServersSection] Processing server: agentx-dpsp tools: 2
```

Instead of:

```
[getMcpServersSection] Processing server: agentx-dpsp tools: 0
```

And the system prompt should include:

```
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
