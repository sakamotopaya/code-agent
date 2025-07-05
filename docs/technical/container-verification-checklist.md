# Container Verification Checklist for list_modes Tool

## Files to Check in Container

### 1. Check ALWAYS_AVAILABLE_TOOLS Array

**File**: `src/shared/tools.ts`
**Line**: ~232
**Expected**: Should contain `"list_modes"` in the array

```bash
# In container, check this file:
cat src/shared/tools.ts | grep -A 10 "ALWAYS_AVAILABLE_TOOLS"
```

**Expected Output**:

```typescript
export const ALWAYS_AVAILABLE_TOOLS: ToolName[] = [
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"new_task",
	"list_modes", // <-- THIS SHOULD BE HERE
] as const
```

### 2. Check Tool Names in Types

**File**: `packages/types/src/tool.ts`
**Line**: ~36
**Expected**: Should contain `"list_modes"` in toolNames array

```bash
# In container, check this file:
cat packages/types/src/tool.ts | grep -A 5 -B 5 "list_modes"
```

### 3. Check MessageBuffer TOOL_NAMES

**File**: `src/api/streaming/MessageBuffer.ts`
**Line**: ~59
**Expected**: Should contain `"list_modes"` in the TOOL_NAMES set

```bash
# In container, check this file:
cat src/api/streaming/MessageBuffer.ts | grep -A 20 "TOOL_NAMES"
```

### 4. Check Tool Description Map

**File**: `src/core/prompts/tools/index.ts`
**Line**: ~47
**Expected**: Should have `list_modes: (args) => getListModesDescription(args),`

```bash
# In container, check this file:
cat src/core/prompts/tools/index.ts | grep -A 5 -B 5 "list_modes"
```

### 5. Check presentAssistantMessage Integration

**File**: `src/core/assistant-message/presentAssistantMessage.ts`
**Expected**: Should have import and case for list_modes

```bash
# Check import:
cat src/core/assistant-message/presentAssistantMessage.ts | grep "listModesTool"

# Check case statement:
cat src/core/assistant-message/presentAssistantMessage.ts | grep -A 3 "case \"list_modes\""
```

## Quick Verification Commands

Run these in the container to verify all changes:

```bash
# 1. Check if list_modes is in ALWAYS_AVAILABLE_TOOLS
grep -n "list_modes" src/shared/tools.ts

# 2. Check if list_modes is in toolNames
grep -n "list_modes" packages/types/src/tool.ts

# 3. Check if list_modes is in MessageBuffer
grep -n "list_modes" src/api/streaming/MessageBuffer.ts

# 4. Check if list_modes has description function
grep -n "list_modes" src/core/prompts/tools/index.ts

# 5. Check if list_modes is in presentAssistantMessage
grep -n "list_modes" src/core/assistant-message/presentAssistantMessage.ts
```

## Expected Results

All 5 commands should return results. If any command returns no results, that file is missing the `list_modes` implementation.

## Most Critical Check

The most critical file to check is:

```bash
cat src/shared/tools.ts | grep -A 10 "ALWAYS_AVAILABLE_TOOLS"
```

If `"list_modes"` is not in this array, that's the primary reason it won't appear in the tools list.
