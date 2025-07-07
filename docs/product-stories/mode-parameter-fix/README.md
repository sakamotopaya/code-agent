# Mode Parameter Fix

## Overview

This project fixes the mode parameter handling in the API to ensure consistency with the VSCode extension's mode management system.

## Problem

When using the API with a mode parameter (e.g., `--mode ticket-oracle`), the LLM incorrectly reported being in "Code mode" instead of the specified mode. This occurred because the API bypassed the provider's mode management system.

## Solution

Implement proper provider mode setting in the API to align with the extension's mode management patterns.

## Project Structure

### Documentation

- **[PRD](./PRD-mode-parameter-fix.md)**: Complete product requirements and technical specifications
- **[Root Cause Analysis](../technical/mode-parameter-root-cause-analysis.md)**: Detailed analysis of the underlying issues

### Implementation Stories

- **[Story 001](./story-001-provider-mode-setting.md)**: Provider Mode Setting in API
- **[Story 002](./story-002-validation-testing.md)**: Validation and Testing

## Current Status

### ✅ Completed

- **Primary Fix**: Fixed `getToolDescriptionsForMode()` empty array issue in `Task.ts`
- **Root Cause Analysis**: Identified provider mode management mismatch
- **Documentation**: Complete PRD and implementation stories

### 🔄 In Progress

- **Secondary Fix**: Provider mode setting in API (Story 001)

### ⏳ Pending

- **Validation**: Comprehensive testing (Story 002)

## Quick Start

### Testing the Current Fix

```bash
# Test API with mode parameter (should work but show wrong mode)
./test-api.js --stream --mode ticket-oracle "what is your current mode"

# Expected: Task executes successfully but reports "code" mode
# After full fix: Should report "ticket-oracle" mode
```

### Implementation Next Steps

1. **Implement Story 001**: Add provider mode setting in API
2. **Execute Story 002**: Comprehensive testing and validation
3. **Deploy**: Roll out with monitoring

## Technical Details

### Architecture

- **Extension Flow**: Mode selection → `handleModeSwitch()` → provider state updated → correct metadata
- **API Flow (Current)**: Mode parameter → Task mode set → provider state unchanged → wrong metadata
- **API Flow (Target)**: Mode parameter → Task mode set → `handleModeSwitch()` → provider state updated → correct metadata

### Key Files

- `src/core/task/Task.ts`: System prompt generation (fixed)
- `src/api/server/FastifyServer.ts`: API task creation (needs fix)
- `src/core/task/TaskApiHandler.ts`: Metadata generation (reads from provider)
- `src/core/webview/ClineProvider.ts`: Mode management patterns (reference)

## Success Criteria

- [x] API tasks execute without immediate termination
- [ ] API tasks report correct mode in LLM responses
- [ ] Environment details show correct mode information
- [ ] No regression in extension functionality
- [ ] Consistent behavior between API and extension

## Timeline

- **Story 001**: 1-2 hours implementation
- **Story 002**: 1-2 hours testing and validation
- **Total**: 2-4 hours

## Related Issues

- Original issue: API tasks with mode parameters immediately terminating
- Secondary issue: LLM reporting wrong mode information
- Architecture issue: API bypassing provider mode management

## Contact

For questions or clarification on this fix, refer to the detailed documentation in the PRD and technical analysis files.
