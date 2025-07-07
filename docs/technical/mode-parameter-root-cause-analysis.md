# Mode Parameter Root Cause Analysis

## Issue Summary

API tasks with mode parameters were immediately terminating, and when fixed, the LLM reported the wrong mode.

## Root Cause Analysis

### Primary Issue (FIXED)

**Location**: `src/core/task/Task.ts` line 1786
**Problem**: `getToolDescriptionsForMode()` was called with empty array `[]` for `customModeConfigs` instead of loaded custom modes
**Fix**: Pass `allCustomModes` instead of `[]`

### Secondary Issue (IDENTIFIED)

**Location**: Mode management architecture mismatch between Extension and API
**Problem**: API bypasses provider mode management system

## Extension vs API Mode Handling

### Extension Mode Management (Correct)

1. User selects mode in UI dropdown
2. `ClineProvider.handleModeSwitch(mode)` is called
3. `ProviderSettingsManager.setModeConfig(mode, configId)` updates provider state
4. Provider state includes correct mode
5. TaskApiHandler reads mode from provider state

### API Mode Management (Broken)

1. Mode parameter passed to API endpoint
2. Task created with correct mode
3. **Provider mode is never updated** ❌
4. TaskApiHandler reads default "code" mode from provider state
5. Wrong mode used in metadata and environment details

## Architectural Solution

The API should follow the same pattern as the extension:

```typescript
// In API server when creating Task:
1. Validate mode parameter
2. Create Task with mode
3. **Set provider mode**: await provider.handleModeSwitch(mode)
4. Start task execution
```

This ensures:

- Provider state matches Task mode
- TaskApiHandler reads correct mode
- Environment details show correct mode
- Metadata contains correct mode
- Consistency between Extension and API code paths

## Implementation Location

**File**: `src/api/server/FastifyServer.ts` or task creation logic
**Change**: Add provider mode setting before task execution
**Pattern**: Follow extension's `handleModeSwitch()` pattern

## Benefits

1. **Consistency**: API and Extension use same mode management
2. **Correctness**: LLM sees correct mode in environment details
3. **Maintainability**: Single source of truth for mode state
4. **Future-proof**: Any provider mode enhancements work in both contexts
