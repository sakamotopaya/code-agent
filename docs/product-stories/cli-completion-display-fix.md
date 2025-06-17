# CLI Completion Display Fix

## Problem Statement

The CLI shows `attempt_completion...` but never displays the actual completion result content, causing users to see incomplete output before system shutdown.

## Root Cause

CLILogger receives `completion_result` messages but doesn't properly handle/display them, unlike the VSCode extension which shows completion results correctly.

## Technical Analysis

### Current Flow

1. `attempt_completion` tool calls `cline.say("completion_result", result)`
2. TaskMessaging emits "message" event with completion result
3. CLILogger receives message but doesn't display `completion_result` content
4. System shuts down immediately

### Expected Flow

1. `attempt_completion` tool calls `cline.say("completion_result", result)`
2. TaskMessaging emits "message" event with completion result
3. CLILogger properly displays the completion result content
4. System completes gracefully

## Solution

Fix CLILogger to properly handle `completion_result` messages in the existing shared message handling flow.

### Files to Modify

1. **src/cli/services/streaming/CLILogger.ts**

    - Add proper `completion_result` message handling
    - Ensure completion content is displayed to user
    - Use existing message processing pipeline

2. **src/cli/services/streaming/CLIDisplayFormatter.ts** (if needed)
    - Ensure completion results are properly formatted
    - Handle completion message display formatting

### Implementation Details

- Use existing CLILogger message handling infrastructure
- Ensure `completion_result` messages are displayed prominently
- Maintain consistency with VSCode extension completion display
- Don't recreate logic - extend existing shared components

### Success Criteria

- CLI displays actual completion result content instead of just "attempt_completion..."
- Completion results are clearly visible to users
- Maintains shared code flow between VSCode ext, CLI, and API
- No custom message handling logic in batch.ts

### Test Cases

1. Run CLI with MCP task that uses `attempt_completion`
2. Verify completion result content is displayed
3. Verify system completes gracefully after showing results
4. Verify no regression in VSCode extension completion display

## Priority

High - Core functionality broken, affecting user experience
