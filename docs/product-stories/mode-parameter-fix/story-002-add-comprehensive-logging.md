# Story 002: Add Comprehensive Logging for Mode Parameter Debugging

## Overview

Add detailed logging throughout the task execution chain to identify exactly where the mode parameter issue is occurring when custom modes cause immediate task completion.

## Problem

The task completes immediately with "Standard task completion" when using custom modes, but we don't have visibility into where the execution is failing.

## Solution

Add comprehensive logging at all critical points in the execution chain to trace the flow and identify the failure point.

## Implementation

### 1. Task Constructor Logging

**File**: `src/core/task/Task.ts` (around line 543)

```typescript
// Store mode configuration
this.mode = mode
this.logDebug(`[Task] Constructor - mode set to: ${this.mode}`)
this.logDebug(`[Task] Constructor - customModesService available: ${!!this.customModesService}`)
```

### 2. System Prompt Generation Logging

**File**: `src/core/task/Task.ts` (around line 1694)

```typescript
// Get mode configuration
const mode = this.mode
this.logDebug(`[Task] getSystemPrompt() called with mode: ${mode}`)
this.logDebug(`[Task] customModesService available: ${!!this.customModesService}`)

let modeConfig: ModeConfig | undefined
let allCustomModes: ModeConfig[] = []

// First check custom modes if available
if (this.customModesService) {
	this.logDebug(`[Task] Attempting to load custom modes...`)
	try {
		allCustomModes = await this.customModesService.getAllModes()
		this.logDebug(
			`[Task] Loaded ${allCustomModes.length} custom modes:`,
			allCustomModes.map((m) => m.slug),
		)
		modeConfig = allCustomModes.find((m) => m.slug === mode)
		this.logDebug(`[Task] Found custom mode config for '${mode}':`, !!modeConfig)
		if (modeConfig) {
			this.logDebug(`[Task] Custom mode details:`, { slug: modeConfig.slug, name: modeConfig.name })
		}
	} catch (error) {
		this.logDebug(`[Task] Failed to load custom modes:`, error)
	}
} else {
	this.logDebug(`[Task] No customModesService available, using built-in modes only`)
}

// Fall back to built-in modes if not found in custom modes
if (!modeConfig) {
	this.logDebug(`[Task] Custom mode not found, checking built-in modes...`)
	modeConfig = modes.find((m) => m.slug === mode) || modes[0]
	this.logDebug(`[Task] Built-in mode found for '${mode}':`, !!modes.find((m) => m.slug === mode))
	this.logDebug(`[Task] Final mode config:`, { slug: modeConfig.slug, name: modeConfig.name })
}

this.logDebug(`[Task] Calling getModeSelection with mode: ${mode}, customModes count: ${allCustomModes.length}`)
const { roleDefinition } = getModeSelection(mode, undefined, allCustomModes)
this.logDebug(`[Task] getModeSelection completed, roleDefinition length: ${roleDefinition?.length || 0}`)
```

### 3. Task Loop Initialization Logging

**File**: `src/core/task/Task.ts` (around line 1336)

```typescript
private async initiateTaskLoop(userContent: Anthropic.Messages.ContentBlockParam[]): Promise<void> {
    this.logDebug(`[Task] initiateTaskLoop() called for task ${this.taskId}.${this.instanceId}`)
    this.logDebug(`[Task] Current mode: ${this.mode}`)
    this.logDebug(`[Task] User content length: ${userContent.length}`)
    this.logDebug(`[Task] User content:`, JSON.stringify(userContent, null, 2))
    this.logDebug(`[Task] About to call recursivelyMakeClineRequests`)

    // ... existing code ...
}
```

### 4. Recursive Requests Entry Logging

**File**: `src/core/task/Task.ts` (around line 1378)

```typescript
public async recursivelyMakeClineRequests(
    userContent: Anthropic.Messages.ContentBlockParam[],
    includeFileDetails: boolean = false,
): Promise<boolean> {
    this.logDebug(`[Task] recursivelyMakeClineRequests() called`)
    this.logDebug(`[Task] Current mode: ${this.mode}`)
    this.logDebug(`[Task] About to call getSystemPrompt()`)

    // ... existing code ...
}
```

### 5. Error Handling Enhancement

Add try-catch blocks around critical sections to catch and log any errors:

```typescript
// In getSystemPrompt() method
try {
	this.logDebug(`[Task] Starting system prompt generation...`)

	// ... mode configuration code ...

	this.logDebug(`[Task] System prompt generation completed successfully`)
	return systemPrompt
} catch (error) {
	this.logDebug(`[Task] Error in getSystemPrompt():`, error)
	throw error
}
```

## Testing Strategy

### Test Cases

1. **Built-in mode**: `./test-api.js --stream --mode debug "what is your current mode" --verbose`
2. **Custom mode**: `./test-api.js --stream --mode ticket-oracle "what is your current mode" --verbose`
3. **Invalid mode**: `./test-api.js --stream --mode invalid-mode "what is your current mode" --verbose`

### Expected Log Analysis

Compare the logs between working and failing scenarios to identify:

1. **Mode setting**: Is the mode correctly set in the constructor?
2. **Custom modes loading**: Are custom modes loaded successfully?
3. **Mode resolution**: Is the correct mode configuration found?
4. **System prompt generation**: Does it complete without errors?
5. **Task execution**: Where does the execution diverge?

## Acceptance Criteria

- [x] Comprehensive logging added to all critical execution points
- [x] Logs clearly show the execution flow for both built-in and custom modes
- [x] Error handling captures and logs any exceptions
- [x] Log analysis reveals the exact point where custom modes fail
- [x] Debugging information is sufficient to identify the root cause

## Files Modified

- `src/core/task/Task.ts` - Add logging throughout the execution chain

## Success Metrics

- Clear identification of where the execution fails with custom modes
- Sufficient debugging information to implement a targeted fix
- No performance impact from logging (use debug level)

## Next Steps

After implementing this logging:

1. Test with both built-in and custom modes
2. Analyze the log differences
3. Identify the exact failure point
4. Implement targeted fix based on findings
5. Remove or reduce logging once issue is resolved
