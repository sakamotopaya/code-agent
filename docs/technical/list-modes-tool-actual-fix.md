# Actual Fix for list_modes Tool

## Root Cause Identified

The `list_modes` tool is not appearing because it's missing from the `ALWAYS_AVAILABLE_TOOLS` array in `src/shared/tools.ts`.

## Analysis

1. **Tool Group Configuration**: `list_modes` is correctly in the `modes` group with `alwaysAvailable: true`
2. **Always Available Tools**: However, the `ALWAYS_AVAILABLE_TOOLS` array only includes:

    - `ask_followup_question`
    - `attempt_completion`
    - `switch_mode` ✅ (this is why it shows up)
    - `new_task` ✅ (this is why it shows up)

3. **Missing**: `list_modes` is **not** in the `ALWAYS_AVAILABLE_TOOLS` array

## The Fix

Add `"list_modes"` to the `ALWAYS_AVAILABLE_TOOLS` array in `src/shared/tools.ts`:

```typescript
// Tools that are always available to all modes.
export const ALWAYS_AVAILABLE_TOOLS: ToolName[] = [
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"new_task",
	"list_modes", // ADD THIS LINE
] as const
```

## Why This Matters

The `getToolDescriptionsForMode` function in `src/core/prompts/tools/index.ts` adds tools to the available set in two ways:

1. **From mode groups** (lines 78-98): Only includes tools from groups that the current mode has
2. **Always available tools** (line 101): `ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))`

Since the default "code" mode doesn't include the `modes` group, `list_modes` only gets added if it's in the `ALWAYS_AVAILABLE_TOOLS` array.

## Implementation Status

✅ **All Previous Work Completed**:

- Added to type definitions
- Added to tool configurations
- Created tool implementation
- Added to prompt descriptions
- Added to message handling
- Added to streaming buffer

❌ **Final Missing Piece**:

- Add `"list_modes"` to `ALWAYS_AVAILABLE_TOOLS` array

This single addition will make the tool available across all modes, just like `switch_mode` and `new_task`.
