# MCP System Prompt Debugging - Product Story

## Problem Statement

The LLM in API mode is not aware of the `ticketRetriever` tool from the `agentx-dpsp` MCP server, despite the server being successfully connected. The system prompt is not properly including MCP server tool information.

## Evidence

### ✅ MCP Service Working

- GlobalCLIMcpService initializes successfully
- `agentx-dpsp` server connects successfully
- Server has `ticketRetriever` tool available

### ❌ System Prompt Missing MCP Info

- LLM attempts to use `agentx-dpsp` server but gets "MCP service not available in CLI mode"
- LLM has no knowledge of `ticketRetriever` tool
- System prompt generation is not including MCP server information

## Root Cause Investigation Plan

### Phase 1: Add System Prompt Logging

**Goal**: See exactly what MCP information is being included in the system prompt

**Implementation**:

1. Add logging to `Task.getSystemPrompt()` to log the MCP servers section
2. Add logging to `getMcpServersSection()` to see what servers/tools are found
3. Add logging to `GlobalCLIMcpService.populateServerCapabilities()` to verify tool discovery

**Expected Output**:

```
[SYSTEM-PROMPT-DEBUG] MCP servers section content:
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
```

### Phase 2: Debug MCP Hub Creation

**Goal**: Verify the mcpHub is being created and populated correctly

**Key Areas**:

1. `Task.getSystemPrompt()` lines 1702-1721 - MCP hub creation in CLI mode
2. `GlobalCLIMcpService.createMcpHub()` - Hub creation
3. `GlobalCLIMcpService.populateServerCapabilities()` - Tool population

**Potential Issues**:

- `mcpHub` is null/undefined
- `populateServerCapabilities()` not finding tools
- Server capabilities not being queried correctly

### Phase 3: Verify Tool Schema Discovery

**Goal**: Ensure the `ticketRetriever` tool schema is being discovered

**Implementation**:

1. Add logging to MCP client tool discovery
2. Verify the tool list request to `agentx-dpsp` server
3. Check if tool schemas are properly formatted

## Implementation Stories

### Story 1: Add System Prompt MCP Section Logging

**As a** developer debugging MCP integration
**I want** to see exactly what MCP server information is included in the system prompt
**So that** I can verify the LLM is receiving the correct tool information

**Acceptance Criteria**:

- [ ] Log the complete MCP servers section before including in system prompt
- [ ] Log the number of servers found and their names
- [ ] Log the number of tools found per server
- [ ] Log any errors during MCP section generation

### Story 2: Add MCP Hub Population Debugging

**As a** developer debugging MCP integration
**I want** to see the MCP hub creation and population process
**So that** I can identify where tool discovery is failing

**Acceptance Criteria**:

- [ ] Log mcpHub creation success/failure
- [ ] Log server capability population for each server
- [ ] Log tool discovery results for `agentx-dpsp` server
- [ ] Log any errors during capability population

### Story 3: Verify Tool Schema Format

**As a** developer debugging MCP integration
**I want** to verify the tool schemas are properly formatted in the system prompt
**So that** the LLM can understand and use the tools

**Acceptance Criteria**:

- [ ] Verify `ticketRetriever` tool appears in system prompt
- [ ] Verify tool description is included
- [ ] Verify input schema is properly formatted
- [ ] Verify tool usage instructions are clear

## Technical Implementation

### Files to Modify

1. **`src/core/task/Task.ts`** (lines 1857, 1876)

    - Add logging before calling `getMcpServersSection()`
    - Add logging of the final `mcpServersSection` content

2. **`src/core/prompts/sections/mcp-servers.ts`** (lines 8-11, 13-48)

    - Add logging at start of function with mcpHub status
    - Add logging of connected servers and their tools
    - Add logging of final section content

3. **`src/cli/services/GlobalCLIMcpService.ts`** (lines 168-230)
    - Add logging in `populateServerCapabilities()` for each server
    - Add logging of tool discovery results
    - Add logging of final server capabilities

### Expected Debug Output

```
[TASK-DEBUG] Getting system prompt - checking MCP hub...
[TASK-DEBUG] MCP hub created: true, servers: 2
[MCP-SECTION-DEBUG] getMcpServersSection called with mcpHub containing 2 servers
[MCP-SECTION-DEBUG] Connected servers: agentx-dpsp, my-github-server
[MCP-SECTION-DEBUG] agentx-dpsp tools: ticketRetriever, Echo
[MCP-SECTION-DEBUG] Final MCP section length: 1234 characters
[TASK-DEBUG] System prompt MCP section included: 1234 characters
```

## Success Criteria

1. **System Prompt Contains MCP Info**: The system prompt includes a complete MCP servers section with `agentx-dpsp` server and `ticketRetriever` tool
2. **Tool Schema Properly Formatted**: The `ticketRetriever` tool appears with correct description and input schema
3. **LLM Can Use Tool**: The LLM successfully calls `use_mcp_tool` with `agentx-dpsp` server and `ticketRetriever` tool
4. **No More "MCP service not available" Errors**: The error disappears once system prompt is fixed

## Next Steps

1. Switch to code mode to implement debugging
2. Add comprehensive logging to system prompt generation
3. Test with API request to see debug output
4. Fix any issues found in MCP section generation
5. Verify LLM can successfully use MCP tools
