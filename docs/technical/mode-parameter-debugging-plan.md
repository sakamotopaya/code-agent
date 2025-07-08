# Mode Parameter Issue - Root Cause Analysis and Solution Plan

## Issue Summary

When using the API with a mode parameter, tasks that start with question words (like "what is your current mode") are immediately terminated with "Standard task completion" instead of being executed by the LLM.

## Root Cause Analysis

### The Problem

The task "what is your current mode" is being classified as an "informational query" because it matches the pattern `/^(list|show|display|get|what|where|how|which|who|when)\b/` in the `isInformationalQuery()` method.

### What Changed During Refactoring

During the CLI/API refactoring, new logic was introduced that doesn't exist in the original VS Code extension:

1. **`isInformationalQuery()` method** (lines 786-804 in `src/api/server/FastifyServer.ts`)

    - Added to detect "informational queries" and handle them differently
    - Also exists in CLI (`src/cli/commands/batch.ts` lines 64-80)

2. **`TaskExecutionOrchestrator`** (new file: `src/core/task/execution/TaskExecutionOrchestrator.ts`)

    - Added to provide unified task execution across CLI/API contexts
    - Handles info queries differently via `executeInfoQuery()` method

3. **Info Query Special Handling**
    - When `isInfoQuery = true`, the orchestrator uses response completion detection
    - This causes immediate termination when certain patterns are detected
    - The task never actually gets to execute normally

### Original VS Code Extension Behavior

The original VS Code extension in `src/core/webview/ClineProvider.ts`:

- Uses `new Task()` directly (line 313)
- No informational query classification
- No special execution orchestrator
- Tasks execute normally regardless of their content

## Solution Options

### Option 1: Remove Informational Query Logic from API (Recommended)

- Remove the `isInformationalQuery()` call from the API endpoint
- Let all tasks execute as standard tasks
- This matches the original VS Code extension behavior

### Option 2: Fix the Informational Query Detection

- Improve the regex patterns to be more specific
- Add exceptions for mode-related questions
- Keep the special handling but make it more accurate

### Option 3: Make Informational Query Handling Optional

- Add a parameter to disable informational query detection
- Default to normal execution for API calls

## Recommended Solution: Option 1

The simplest and most reliable solution is to remove the informational query logic from the API entirely, since:

1. The original VS Code extension doesn't have this logic and works correctly
2. The API should behave consistently with the extension
3. The informational query detection is error-prone and causes false positives
4. Users expect their tasks to execute normally regardless of how they phrase them

## Implementation Plan

### Step 1: Remove Informational Query Logic from API

- In `src/api/server/FastifyServer.ts`, remove or comment out line 360: `const isInfoQuery = this.isInformationalQuery(task)`
- Set `isInfoQuery = false` for all API tasks
- This will force all tasks to use `executeStandardTask()` instead of `executeInfoQuery()`

### Step 2: Test the Fix

- Test with the original failing command: `./api-client.js --stream --mode ticket-oracle "what is your current mode"`
- Verify that the task now executes normally and provides a proper response
- Test with other question-style tasks to ensure they work correctly

### Step 3: Consider CLI Impact

- Evaluate whether the CLI should also remove this logic for consistency
- The CLI might benefit from keeping it for batch processing scenarios
- Document the difference if CLI keeps the logic but API removes it

## Files to Modify

1. **`src/api/server/FastifyServer.ts`**

    - Line 360: Remove or modify the `isInformationalQuery()` call
    - Lines 364-370: Set `isInfoQuery = false` for all API tasks

2. **Optional: `src/core/task/execution/TaskExecutionOrchestrator.ts`**
    - Could add logging to help debug future issues
    - No changes required for the fix

## Testing Strategy

1. **Regression Testing**

    - Test the original failing case
    - Test normal tasks to ensure they still work
    - Test with different modes to ensure mode parameter works correctly

2. **Edge Case Testing**
    - Test with various question formats
    - Test with long-running tasks
    - Test with tasks that require user interaction

## Expected Outcome

After implementing this fix:

- Tasks starting with question words will execute normally
- The API will behave consistently with the VS Code extension
- Mode parameter will work correctly for all task types
- No breaking changes to existing functionality
