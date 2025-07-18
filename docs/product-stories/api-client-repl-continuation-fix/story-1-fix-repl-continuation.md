# Story 1: Fix REPL Continuation Issue

## Story Description

**As a developer using the API client in REPL mode**  
**I want the REPL to continue prompting for input after each command completes**  
**So that I can have a continuous interactive session without restarting the client**

## Current Behavior

```bash
$ api-client --repl --stream
🚀 Roo API Client REPL Mode
Commands: exit (quit), newtask (clear task), help (show help), history (show history)
💡 History service enabled - use "history" command for options
💡 Use up/down arrows to navigate through command history
💡 First command will create a new task

roo-api [new] > what is your favorite food?
[API processes request and shows response]
I've asked about your favorite food and you've indicated that it's tacos.
📊 Token Usage [4:29:12 PM]:
   Input tokens: undefined
   Output tokens: undefined
   Total tokens: undefined
✅ Stream completed
[REPL EXITS - PROBLEM!]
```

## Expected Behavior

```bash
$ api-client --repl --stream
🚀 Roo API Client REPL Mode
Commands: exit (quit), newtask (clear task), help (show help), history (show history)
💡 History service enabled - use "history" command for options
💡 Use up/down arrows to navigate through command history
💡 First command will create a new task

roo-api [new] > what is your favorite food?
[API processes request and shows response]
I've asked about your favorite food and you've indicated that it's tacos.
📊 Token Usage [4:29:12 PM]:
   Input tokens: undefined
   Output tokens: undefined
   Total tokens: undefined
✅ Stream completed
roo-api [task:abc12345] > what about pizza?
[Continues working...]
```

## Root Cause

The issue is in `src/tools/api-client.ts` in the `REPLSession` class. There are two calls to `this.promptUser()`:

1. **Line 547** in `promptUser()` callback: `this.promptUser()` ← Correct
2. **Line 626** in `handleInput()`: `this.promptUser()` ← Duplicate causing race condition

## Implementation Details

### Files to Modify

- `src/tools/api-client.ts` - Remove duplicate `this.promptUser()` call

### Code Changes

**Before (Lines 545-548):**

```typescript
this.rl.question(prompt, async (input) => {
	await this.handleInput(input.trim())
	this.promptUser() // Correct call
})
```

**Before (Lines 624-627):**

```typescript
// Execute the command
await this.executeCommand(input)

this.promptUser() // REMOVE THIS LINE - it's a duplicate
```

**After (Lines 624-626):**

```typescript
// Execute the command
await this.executeCommand(input)

// No duplicate call here - loop maintained by promptUser() callback
```

### Testing Strategy

1. **Manual Testing**:

    ```bash
    cd /Users/eo/code/code-agent/src && npm run start:cli --silent -- --repl --stream
    ```

2. **Test Scenarios**:

    - Execute multiple commands in sequence
    - Test error handling doesn't break the loop
    - Test special commands (exit, newtask, help, history)
    - Test with both streaming and non-streaming modes

3. **Verification Points**:
    - REPL continues after each command completion
    - No duplicate prompts appear
    - History service works correctly
    - Exit commands work as expected
    - Task ID tracking works across commands

## Acceptance Criteria

- [ ] REPL continues prompting after command completion
- [ ] No duplicate prompts or race conditions
- [ ] Special commands (exit, newtask, help, history) work correctly
- [ ] History service continues to function
- [ ] Task ID tracking works across multiple commands
- [ ] Error handling doesn't break the REPL loop
- [ ] Both streaming and non-streaming modes work correctly

## Definition of Done

- [ ] Code changes implemented and tested
- [ ] Manual testing confirms continuous operation
- [ ] No regressions in existing REPL functionality
- [ ] Documentation updated with the fix
- [ ] Code review completed

## Risk Assessment

**Low Risk** - This is a surgical fix that removes problematic code without adding complexity.

**Mitigation**: Thorough testing across all REPL scenarios to ensure no regression.

## Dependencies

- No external dependencies
- Must maintain compatibility with existing REPL features
- Requires testing with both streaming and non-streaming API endpoints

## Estimated Effort

**1-2 hours** - Simple one-line fix with comprehensive testing

## Success Metrics

- REPL sessions can execute multiple commands without exiting
- No user reports of premature REPL termination
- Improved developer experience when testing the API client
