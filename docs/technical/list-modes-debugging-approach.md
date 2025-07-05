# Debugging the list_modes Tool Issue

## Current Status

Despite implementing all the necessary components, the `list_modes` tool is still not appearing in the system prompt that the LLM receives.

## Debugging Strategy

We need to trace through the exact path that generates the system prompt to find where `list_modes` is being filtered out.

### Key Functions to Debug

1. **`getToolDescriptionsForMode`** in `src/core/prompts/tools/index.ts`

    - This generates the tool descriptions for the system prompt
    - Need to verify it includes `list_modes`

2. **`isToolAllowedForMode`** in `src/shared/modes.ts`

    - This filters tools based on mode permissions
    - Need to verify it allows `list_modes` for the default mode

3. **System Prompt Generation** in `src/core/prompts/system.ts`
    - This calls `getToolDescriptionsForMode` to build the final prompt
    - Need to verify the output includes `list_modes`

### Debug Steps

1. **Create a debug script** to test `getToolDescriptionsForMode` directly
2. **Add console.log statements** to trace tool filtering
3. **Check the actual system prompt** being sent to the LLM
4. **Verify tool description function** returns valid content

### Potential Issues

1. **Tool description function returning undefined**
2. **`isToolAllowedForMode` filtering out `list_modes`**
3. **Missing import or export**
4. **Type mismatch in tool name**

### Next Steps

1. Switch to code mode
2. Create debug script to test tool generation
3. Add logging to trace the issue
4. Fix the root cause
