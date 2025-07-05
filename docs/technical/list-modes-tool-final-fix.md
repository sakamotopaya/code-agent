# Final Fix for list_modes Tool

## Root Cause Found

The `list_modes` tool is not appearing because it's missing from the `TOOL_NAMES` set in `src/api/streaming/MessageBuffer.ts`. This hardcoded list is used for tool recognition in the API streaming layer.

## Evidence

In `src/api/streaming/MessageBuffer.ts` lines 41-59, there's a hardcoded set of tool names:

```typescript
private static readonly TOOL_NAMES = new Set([
    "read_file",
    "write_to_file",
    "apply_diff",
    "search_files",
    "list_files",
    "list_code_definition_names",
    "execute_command",
    "browser_action",
    "insert_content",
    "search_and_replace",
    "ask_followup_question",
    "attempt_completion",
    "use_mcp_tool",
    "access_mcp_resource",
    "switch_mode",
    "new_task",
    "fetch_instructions",
])
```

Notice that `list_modes` is **missing** from this list, even though `switch_mode` and `new_task` are present.

## Required Fix

Add `"list_modes"` to the `TOOL_NAMES` set in `MessageBuffer.ts`:

```typescript
private static readonly TOOL_NAMES = new Set([
    "read_file",
    "write_to_file",
    "apply_diff",
    "search_files",
    "list_files",
    "list_code_definition_names",
    "execute_command",
    "browser_action",
    "insert_content",
    "search_and_replace",
    "ask_followup_question",
    "attempt_completion",
    "use_mcp_tool",
    "access_mcp_resource",
    "switch_mode",
    "new_task",
    "fetch_instructions",
    "list_modes",  // ADD THIS LINE
])
```

## Why This Matters

The `MessageBuffer` class is responsible for processing streaming messages in the API layer. If a tool name is not in the `TOOL_NAMES` set, it won't be properly recognized as a tool call, which means:

1. The tool won't appear in tool listings
2. The tool won't be available for execution
3. The streaming parser won't classify it correctly

## Implementation Status

✅ **Already Completed**:

- Added to `packages/types/src/tool.ts`
- Added to `src/shared/tools.ts`
- Added to `src/shared/ExtensionMessage.ts`
- Created `src/core/tools/listModesTool.ts`
- Created `src/core/prompts/tools/list-modes.ts`
- Added to `src/core/prompts/tools/index.ts`
- Added to `src/core/assistant-message/presentAssistantMessage.ts`
- Removed incorrect case from `src/core/task/Task.ts`

❌ **Missing (Critical)**:

- Add `"list_modes"` to `TOOL_NAMES` set in `src/api/streaming/MessageBuffer.ts`

This single missing line is why the tool doesn't appear in the tools list despite all other implementation being correct.
