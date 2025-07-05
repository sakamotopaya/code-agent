# Additional Verification Steps

Great! The `ALWAYS_AVAILABLE_TOOLS` array correctly includes `"list_modes"`. Now let's check the other critical files:

## 1. Check Tool Description Function

```bash
cat src/core/prompts/tools/index.ts | grep -A 2 -B 2 "list_modes"
```

**Expected**: Should show the tool description mapping

## 2. Check MessageBuffer TOOL_NAMES

```bash
cat src/api/streaming/MessageBuffer.ts | grep -A 20 "TOOL_NAMES" | grep "list_modes"
```

**Expected**: Should show `"list_modes",` in the TOOL_NAMES set

## 3. Check presentAssistantMessage Integration

```bash
# Check import
cat src/core/assistant-message/presentAssistantMessage.ts | grep "listModesTool"

# Check case statement
cat src/core/assistant-message/presentAssistantMessage.ts | grep -A 3 "case \"list_modes\""
```

**Expected**: Should show both import and case statement

## 4. Test the Tool Directly

Try using the tool directly:

```bash
./test-api.js --stream "use the list_modes tool to show me all available modes"
```

## 5. Check if Tool Description is Generated

The issue might be that the tool description function is not being called properly. Let's verify the tool description exists:

```bash
cat src/core/prompts/tools/list-modes.ts | head -10
```

**Expected**: Should show the tool description function

## Debugging Strategy

If the tool still doesn't appear, the issue is likely in the system prompt generation. The tool might be:

1. **Filtered out by `isToolAllowedForMode`**
2. **Tool description function returning undefined**
3. **Missing from the final system prompt for some other reason**

Let me know the results of these checks and we can narrow down the exact issue.
