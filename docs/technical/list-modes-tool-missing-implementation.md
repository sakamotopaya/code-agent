# Missing Implementation for list_modes Tool

## Issue Analysis

The `list_modes` tool was implemented but is not showing up in the available tools list. After comparing with the `switch_mode` tool implementation, I found the missing pieces.

## Root Cause

The `list_modes` tool was added to `Task.ts` but should be added to `presentAssistantMessage.ts` instead. The `switch_mode` tool is handled in `presentAssistantMessage.ts`, not in `Task.ts`.

## Missing Implementation Steps

### 1. Add Import to presentAssistantMessage.ts

**File**: `src/core/assistant-message/presentAssistantMessage.ts`

Add this import after line 26:

```typescript
import { listModesTool } from "../tools/listModesTool"
```

### 2. Add Case to Switch Statement

**File**: `src/core/assistant-message/presentAssistantMessage.ts`

Add this case after the `new_task` case (around line 456):

```typescript
case "list_modes":
    await listModesTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
    break
```

### 3. Add Tool Description Case

**File**: `src/core/assistant-message/presentAssistantMessage.ts`

Add this case in the tool description switch statement (around line 185):

```typescript
case "list_modes":
    return `[${block.name}${block.params.filter ? ` filter: ${block.params.filter}` : ""}]`
```

### 4. Remove Incorrect Implementation

**File**: `src/core/task/Task.ts`

Remove the `list_modes` case that was incorrectly added around line 872:

```typescript
// REMOVE THIS ENTIRE CASE BLOCK:
case "list_modes": {
    const { listModesTool } = await import("../tools/listModesTool")
    const result = await this.executeToolWithCLIInterface(listModesTool, {
        name: toolName,
        params,
        type: "tool_use",
        partial: false,
    })
    return result
}
```

## Implementation Status

✅ **Completed**:

- Added to `packages/types/src/tool.ts` toolNames array
- Added to `src/shared/tools.ts` (toolParamNames, ListModesToolUse interface, TOOL_DISPLAY_NAMES, TOOL_GROUPS)
- Added to `src/shared/ExtensionMessage.ts` ClineSayTool interface
- Created `src/core/tools/listModesTool.ts` implementation
- Created `src/core/prompts/tools/list-modes.ts` description
- Added to `src/core/prompts/tools/index.ts` toolDescriptionMap

❌ **Missing**:

- Import in `presentAssistantMessage.ts`
- Case in `presentAssistantMessage.ts` switch statement
- Tool description case in `presentAssistantMessage.ts`
- Remove incorrect case from `Task.ts`

## Why This Matters

Tools in the `modes` group (like `switch_mode`, `new_task`, and `list_modes`) are handled differently than other tools. They are processed in `presentAssistantMessage.ts` rather than `Task.ts` because they are always available and don't follow the standard tool execution pattern.

## Next Steps

1. Switch to code mode
2. Make the 4 changes listed above
3. Test the implementation
4. Verify the tool appears in the tools list
