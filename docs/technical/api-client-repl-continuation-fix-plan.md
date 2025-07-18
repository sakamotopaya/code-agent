# API Client REPL Continuation Fix - Implementation Plan

## Project Overview

This document outlines the complete plan to fix the API client REPL mode issue where the REPL exits after completing a request instead of continuing to prompt for the next input.

## Problem Summary

**Issue**: `api-client --repl --stream` exits after the first command completes instead of continuing the REPL loop.

**Root Cause**: Duplicate calls to `this.promptUser()` in the `REPLSession` class create a race condition that breaks the REPL loop.

## Solution Architecture

### High-Level Approach

1. **Identify Duplicate Calls**: Located in `REPLSession.handleInput()` method
2. **Remove Duplicate**: Remove the problematic `this.promptUser()` call
3. **Maintain Single Loop**: Ensure REPL loop is controlled by the callback mechanism
4. **Validate Operation**: Test continuous operation across multiple commands

### Technical Implementation

#### Current Problematic Code Flow

```typescript
// In promptUser() - CORRECT
this.rl.question(prompt, async (input) => {
    await this.handleInput(input.trim())
    this.promptUser()  // ✅ Correct - maintains the loop
})

// In handleInput() - PROBLEMATIC
private async handleInput(input: string): Promise<void> {
    // ... process input ...
    await this.executeCommand(input)
    this.promptUser()  // ❌ Duplicate - causes race condition
}
```

#### Fixed Code Flow

```typescript
// In promptUser() - CORRECT
this.rl.question(prompt, async (input) => {
    await this.handleInput(input.trim())
    this.promptUser()  // ✅ Correct - maintains the loop
})

// In handleInput() - FIXED
private async handleInput(input: string): Promise<void> {
    // ... process input ...
    await this.executeCommand(input)
    // ✅ No duplicate call - loop maintained by callback
}
```

## Implementation Details

### Files to Modify

1. **`src/tools/api-client.ts`**
    - **Change**: Remove line 626: `this.promptUser()`
    - **Location**: End of `handleInput()` method in `REPLSession` class
    - **Risk**: Low - removing problematic code

### Code Changes

**File**: `src/tools/api-client.ts`
**Method**: `REPLSession.handleInput()`
**Line**: 626

**Before**:

```typescript
// Execute the command
await this.executeCommand(input)

this.promptUser() // REMOVE THIS LINE
```

**After**:

```typescript
// Execute the command
await this.executeCommand(input)

// REPL loop maintained by promptUser() callback
```

## Testing Strategy

### Manual Testing Procedure

1. **Start API Server**: `./run-api.sh` (from project root)
2. **Start REPL**: `cd src && npm run start:cli --silent -- --repl --stream`
3. **Execute Test Commands**:
    ```
    what is your favorite food?
    tell me about pizza
    help
    history
    exit
    ```
4. **Verify Continuous Operation**: Each command should complete and return to prompt

### Test Scenarios

#### Primary Scenarios

- [x] Multiple consecutive commands
- [x] Error handling doesn't break loop
- [x] Special commands work (exit, newtask, help, history)
- [x] History service continues to function
- [x] Task ID tracking across commands

#### Edge Cases

- [x] Long-running commands
- [x] Commands that fail
- [x] Network interruptions
- [x] Mixed streaming/non-streaming modes

### Validation Criteria

- ✅ REPL continues after each command completion
- ✅ No duplicate prompts or race conditions
- ✅ All existing REPL features work correctly
- ✅ Exit commands work as expected
- ✅ No regressions in history service
- ✅ Task ID tracking works correctly

## Risk Assessment

**Risk Level**: **Low**

**Rationale**:

- Single line removal
- No new code added
- Well-understood problem
- Targeted surgical fix

**Mitigation**:

- Comprehensive manual testing
- Validation of all REPL features
- Backwards compatibility verification

## Timeline

**Total Estimated Time**: 2 hours

1. **Implementation** (15 minutes)

    - Remove duplicate promptUser() call
    - Basic testing

2. **Testing** (90 minutes)

    - Manual testing scenarios
    - Edge case validation
    - Regression testing

3. **Documentation** (15 minutes)
    - Update implementation notes
    - Record test results

## Success Metrics

### Functional Metrics

- REPL continues after command completion: ✅
- No duplicate prompts: ✅
- All commands work correctly: ✅
- History service functions: ✅

### User Experience Metrics

- Developers can have continuous conversations
- No need to restart client between commands
- Improved testing workflow efficiency

## Next Steps

1. **Get Approval**: Confirm this plan meets requirements
2. **Switch to Code Mode**: Implement the fix
3. **Execute Testing**: Run comprehensive test scenarios
4. **Validate Results**: Confirm all success criteria met

## Dependencies

- No external dependencies required
- Must maintain compatibility with existing REPL features
- Requires running API server for testing

## Deliverables

1. **Code Fix**: Remove duplicate promptUser() call
2. **Test Results**: Comprehensive testing validation
3. **Documentation**: Updated technical documentation
4. **Validation**: Confirmed continuous REPL operation

---

**Ready for Implementation**: This plan provides a clear, low-risk approach to fixing the REPL continuation issue with comprehensive testing strategy.
