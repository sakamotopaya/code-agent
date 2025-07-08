# Mode Parameter Fix for API Server

## Issue Description

The `--mode` parameter in the API test script is not being honored correctly. When a custom mode like "ticket-oracle" is specified, the task either hangs or defaults to "code" mode instead of using the requested mode.

## Root Cause

In `src/core/task/Task.ts` at line 1695, the system prompt generation only searches for modes in the built-in `modes` array:

```typescript
const modeConfig = modes.find((m) => m.slug === mode) || modes[0]
```

This fails for custom modes because:

1. Custom modes are not in the built-in `modes` array
2. When the mode is not found, it falls back to `modes[0]` (code mode)
3. The Task class has access to `this.customModesService` but doesn't use it here

## Solution

Update the mode configuration logic in `src/core/task/Task.ts` around line 1693-1696 to check both built-in and custom modes:

```typescript
// Get mode configuration
const mode = this.mode
let modeConfig: ModeConfig | undefined

// First check custom modes if available
if (this.customModesService) {
	const allModes = await this.customModesService.getAllModes()
	modeConfig = allModes.find((m) => m.slug === mode)
}

// Fall back to built-in modes if not found in custom modes
if (!modeConfig) {
	modeConfig = modes.find((m) => m.slug === mode) || modes[0]
}

const { roleDefinition } = getModeSelection(mode, undefined, [])
```

## Files to Modify

1. **`src/core/task/Task.ts`** (lines 1693-1696)
    - Update mode configuration logic to check custom modes first
    - Ensure proper fallback to built-in modes

## Testing Plan

1. Test with built-in modes (should continue working):

    ```bash
    ./api-client.js --stream --mode debug "what is your current mode"
    ```

2. Test with custom modes (should now work):

    ```bash
    ./api-client.js --stream --mode ticket-oracle "what is your current mode"
    ```

3. Test with invalid modes (should fall back to code mode):
    ```bash
    ./api-client.js --stream --mode invalid-mode "what is your current mode"
    ```

## Expected Outcome

After the fix:

- Built-in modes (code, debug, architect, ask, orchestrator) continue to work
- Custom modes (ticket-oracle, product-owner) work correctly
- The AI responds with the correct mode information
- Invalid modes gracefully fall back to code mode

## Implementation Notes

- The fix requires making the mode lookup async since `customModesService.getAllModes()` is async
- The system prompt generation method may need to be updated to handle the async mode lookup
- Ensure proper error handling for cases where custom modes service is unavailable
