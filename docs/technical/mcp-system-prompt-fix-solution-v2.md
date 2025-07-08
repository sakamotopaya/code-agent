# MCP System Prompt Fix - Correct Solution

## Key Insight

The VS Code extension works perfectly with MCP servers. The issue is that the CLI/API mode is using a different MCP integration pattern that doesn't properly interface with the existing extension code.

## Root Cause Analysis

### VS Code Extension (Working)

- Uses the original MCP integration from `src/services/mcp/McpHub`
- System prompt generation works correctly
- Tools are properly discovered and included

### CLI/API Mode (Broken)

- Uses `GlobalCLIMcpService` which creates a "compatible interface" via `createMcpHub()`
- This interface doesn't properly mirror the real McpHub behavior
- Tools are discovered but not properly exposed through the interface

## Problem Location

In `src/cli/services/GlobalCLIMcpService.ts`, the `createMcpHub()` method creates a fake interface:

```typescript
createMcpHub(): any {
    return {
        getServers: () => {
            return this.mcpService!.getConnectedServers().map((conn: any) => ({
                name: conn.config.name,
                status: conn.status,
                config: JSON.stringify(conn.config),
                tools: [], // ❌ Always empty!
                resources: [],
                resourceTemplates: [],
            }))
        },
        isConnecting: false,
    }
}
```

## Correct Solution

Instead of trying to modify the core MCP logic, we need to make the CLI/API `createMcpHub()` method properly interface with the existing extension patterns.

### Option 1: Use Real McpHub

Import and use the actual `McpHub` class from the extension instead of creating a fake interface.

### Option 2: Fix the Interface

Make the `createMcpHub()` interface properly expose the tools that were discovered by `populateServerCapabilities()`.

## Recommended Approach: Fix the Interface

The `populateServerCapabilities()` method successfully discovers tools and stores them on the server objects. The issue is that `createMcpHub()` doesn't expose these tools.

### Changes Required

1. **Store tools persistently**: When `populateServerCapabilities()` discovers tools, store them in a way that `createMcpHub()` can access them.

2. **Fix the interface**: Make `createMcpHub()` return the actual discovered tools instead of empty arrays.

### Implementation Strategy

```typescript
// In GlobalCLIMcpService class, add a property to store server capabilities
private serverCapabilities: Map<string, any> = new Map()

// In populateServerCapabilities(), store the results
async populateServerCapabilities(mcpHub: any): Promise<void> {
    // ... existing discovery logic ...

    // Store capabilities for later retrieval
    this.serverCapabilities.set(server.name, {
        tools: server.tools,
        resources: server.resources,
        resourceTemplates: server.resourceTemplates
    })
}

// In createMcpHub(), use the stored capabilities
createMcpHub(): any {
    return {
        getServers: () => {
            return this.mcpService!.getConnectedServers().map((conn: any) => {
                const capabilities = this.serverCapabilities.get(conn.config.name) || {
                    tools: [],
                    resources: [],
                    resourceTemplates: []
                }

                return {
                    name: conn.config.name,
                    status: conn.status,
                    config: JSON.stringify(conn.config),
                    tools: capabilities.tools,
                    resources: capabilities.resources,
                    resourceTemplates: capabilities.resourceTemplates,
                }
            })
        },
        isConnecting: false,
    }
}
```

## Expected Result

After this fix:

1. Tools discovered by `populateServerCapabilities()` will be stored persistently
2. `createMcpHub()` will expose the actual discovered tools
3. System prompt generation will work the same as in VS Code extension
4. LLM will receive proper MCP server information

## Verification

The logs should show:

```
[getMcpServersSection] Processing server: agentx-dpsp tools: 2
```

And the system prompt should include the `ticketRetriever` and `Echo` tools with their schemas.
