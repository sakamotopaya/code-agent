# PRD: Mode Parameter Fix for API

## Overview

Fix the mode parameter handling in the API to ensure consistency with the VSCode extension's mode management system.

## Problem Statement

When using the API with a mode parameter (e.g., `--mode ticket-oracle`), the LLM incorrectly reports being in "Code mode" instead of the specified mode. This occurs because the API bypasses the provider's mode management system.

## Success Criteria

1. API tasks with mode parameters correctly report their actual mode
2. Environment details show the correct mode information
3. API and Extension use the same mode management patterns
4. No regression in existing functionality

## Technical Requirements

### Primary Fix (COMPLETED ✅)

- **Issue**: `getToolDescriptionsForMode()` called with empty custom modes array
- **Location**: `src/core/task/Task.ts` line 1786
- **Status**: Fixed by passing `allCustomModes` instead of `[]`

### Secondary Fix (REQUIRED)

- **Issue**: API doesn't set provider mode, causing metadata mismatch
- **Root Cause**: TaskApiHandler reads mode from provider state (defaults to "code")
- **Solution**: Set provider mode in API before task execution

## Implementation Plan

### Story 1: Provider Mode Setting in API

**Objective**: Ensure API sets provider mode before task execution

**Acceptance Criteria**:

- API calls provider mode setting when mode parameter is provided
- Provider state reflects the correct mode
- TaskApiHandler reads correct mode from provider state
- Environment details show correct mode

**Technical Tasks**:

1. Identify where Task creation happens in API server
2. Add provider mode setting call before task execution
3. Follow extension's `handleModeSwitch()` pattern
4. Ensure proper error handling for invalid modes

### Story 2: Validation and Testing

**Objective**: Ensure fix works correctly and doesn't break existing functionality

**Acceptance Criteria**:

- API with mode parameter shows correct mode in response
- API without mode parameter defaults to "code" mode
- Extension mode switching still works
- No performance regression

**Technical Tasks**:

1. Test API with various mode parameters
2. Test API without mode parameter
3. Test extension mode switching
4. Add automated tests for mode parameter handling

## Architecture Alignment

### Current Extension Flow (Correct)

```
User selects mode → handleModeSwitch() → setModeConfig() → provider.state.mode updated → TaskApiHandler reads correct mode
```

### Current API Flow (Broken)

```
Mode parameter → Task.mode set → provider.state.mode unchanged → TaskApiHandler reads "code" → Wrong metadata
```

### Target API Flow (Fixed)

```
Mode parameter → Task.mode set → handleModeSwitch() → provider.state.mode updated → TaskApiHandler reads correct mode
```

## Risk Assessment

### Low Risk

- Provider mode setting is existing, tested functionality
- Following established extension patterns
- Isolated to API code path

### Mitigation

- Thorough testing of both API and extension flows
- Gradual rollout with monitoring
- Fallback to current behavior if provider unavailable

## Dependencies

- Understanding of provider mode management system
- Access to API server code
- Test environment for validation

## Timeline

- **Story 1**: 1-2 hours implementation
- **Story 2**: 1-2 hours testing and validation
- **Total**: 2-4 hours

## Success Metrics

1. API responses show correct mode information
2. Zero regression in extension functionality
3. Consistent behavior between API and extension
4. User reports correct mode identification
