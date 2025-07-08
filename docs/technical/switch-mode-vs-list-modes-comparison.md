# switch_mode vs list_modes Comparison

Since `switch_mode` works but `list_modes` doesn't, let's compare them systematically to find the missing piece.

## Container Verification Commands

Run these commands in the container to compare the implementations:

### 1. Check Both Tools in ALWAYS_AVAILABLE_TOOLS

```bash
cat src/shared/tools.ts | grep -A 10 "ALWAYS_AVAILABLE_TOOLS"
```

**Status**: ✅ Both `switch_mode` and `list_modes` are present

### 2. Check Both Tools in toolNames Array

```bash
cat packages/types/src/tool.ts | grep -E "(switch_mode|list_modes)"
```

**Expected**: Both should appear in the toolNames array

### 3. Check Both Tools in MessageBuffer TOOL_NAMES

```bash
cat src/api/streaming/MessageBuffer.ts | grep -A 20 "TOOL_NAMES" | grep -E "(switch_mode|list_modes)"
```

**Expected**: Both should appear in the TOOL_NAMES set

### 4. Check Both Tool Description Functions

```bash
# Check switch_mode description
cat src/core/prompts/tools/index.ts | grep -A 2 -B 2 "switch_mode"

# Check list_modes description
cat src/core/prompts/tools/index.ts | grep -A 2 -B 2 "list_modes"
```

**Expected**: Both should have description function mappings

### 5. Check Both Tool Description Files Exist

```bash
# Check switch_mode description file
ls -la src/core/prompts/tools/switch-mode.ts

# Check list_modes description file
ls -la src/core/prompts/tools/list-modes.ts
```

**Expected**: Both files should exist

### 6. Check Both Tool Implementations Exist

```bash
# Check switch_mode tool implementation
ls -la src/core/tools/switchModeTool.ts

# Check list_modes tool implementation
ls -la src/core/tools/listModesTool.ts
```

**Expected**: Both files should exist

### 7. Check Both Tools in presentAssistantMessage

```bash
# Check switch_mode import and case
cat src/core/assistant-message/presentAssistantMessage.ts | grep -E "(switchModeTool|switch_mode)"

# Check list_modes import and case
cat src/core/assistant-message/presentAssistantMessage.ts | grep -E "(listModesTool|list_modes)"
```

**Expected**: Both should have imports and case statements

### 8. Check Both Tool Groups Configuration

```bash
cat src/shared/tools.ts | grep -A 5 "modes:"
```

**Expected**: Both should be in the modes group

### 9. Test Tool Description Generation

```bash
# Check if switch_mode description function works
node -e "
const { getSwitchModeDescription } = require('./src/core/prompts/tools/switch-mode.ts');
console.log('switch_mode description:', getSwitchModeDescription());
"

# Check if list_modes description function works
node -e "
const { getListModesDescription } = require('./src/core/prompts/tools/list-modes.ts');
console.log('list_modes description:', getListModesDescription({}));
"
```

## Critical Differences to Look For

1. **File naming**: Is there a difference in file naming conventions?
2. **Export format**: Are the functions exported differently?
3. **Function signatures**: Do the description functions have different signatures?
4. **Import statements**: Are there differences in how they're imported?
5. **TypeScript compilation**: Are there TypeScript errors preventing compilation?

## Most Likely Issues

Based on the pattern, the most likely issues are:

1. **Tool description function not working**: The `getListModesDescription` function might be returning undefined
2. **Import/export mismatch**: The function might not be properly exported or imported
3. **TypeScript compilation error**: There might be a TS error preventing the tool from being included
4. **File extension issue**: The description file might have wrong extension or not be found

Please run these verification commands and let me know which ones show differences between `switch_mode` and `list_modes`.
