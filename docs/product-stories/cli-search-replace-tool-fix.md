# Product Story: Fix Search and Replace Tool CLI Compatibility

## Epic

CLI Tool Compatibility - Phase 1: Critical Fix

## Story Title

As a CLI user, I want the search_and_replace tool to work in batch mode so that I can perform automated text replacements without hanging

## User Story

**As a** CLI user running batch operations  
**I want** the search_and_replace tool to complete successfully in non-interactive mode  
**So that** I can automate text replacement tasks without manual intervention

## Background

The search_and_replace tool currently hangs in CLI batch mode because it uses hardcoded `cline.ask()` calls that expect interactive user input. This prevents automated workflows and CLI batch operations from completing.

## Problem Statement

- CLI batch mode hangs when using search_and_replace tool
- Tool uses hardcoded interactive approval requests
- No auto-approval mechanism for CLI mode
- Breaks automated text replacement workflows

## Technical Analysis

### Current Implementation Issues

1. **Line 200**: `await cline.ask("tool", JSON.stringify(sharedMessageProps), true).catch(() => {})`

    - Shows diff view but expects user interaction
    - Should use `askApproval` parameter instead

2. **Lines 211-213**:
    ```typescript
    const didApprove = await cline
    	.ask("tool", completeMessage, false)
    	.then((response) => response.response === "yesButtonClicked")
    ```
    - Hardcoded approval request for applying changes
    - Should use `askApproval` parameter for CLI compatibility

### Correct Pattern (from readFileTool.ts)

```typescript
// ✅ Correct - Works in both CLI and VSCode
const approved = await askApproval("tool", completeMessage)

if (!approved) {
	cline.didRejectTool = true
	// Handle rejection consistently
	return
}
```

## Acceptance Criteria

### Functional Requirements

- [ ] Search and replace tool completes successfully in CLI batch mode
- [ ] Tool auto-approves changes in CLI mode without user interaction
- [ ] Tool maintains interactive approval in VSCode mode
- [ ] Diff generation and application work correctly in both modes
- [ ] Error handling is consistent with other tools

### Technical Requirements

- [ ] Replace hardcoded `cline.ask()` calls with `askApproval` parameter
- [ ] Update approval logic for diff view display
- [ ] Update approval logic for change application
- [ ] Maintain backward compatibility with VSCode mode
- [ ] Follow established patterns from other CLI-compatible tools

### Quality Requirements

- [ ] All existing tests continue to pass
- [ ] No regression in VSCode functionality
- [ ] Proper error handling and user feedback
- [ ] Consistent behavior with other tools

## Implementation Tasks

### Task 1: Fix Diff View Approval (Line 200)

**Estimated Time**: 2 hours  
**Priority**: Critical

```typescript
// Current (problematic):
if (!cline.diffViewProvider.isEditing) {
	await cline.ask("tool", JSON.stringify(sharedMessageProps), true).catch(() => {})
	// ... rest of diff view setup
}

// Fixed:
if (!cline.diffViewProvider.isEditing) {
	// In CLI mode, askApproval auto-approves; in VSCode mode, shows UI
	const approved = await askApproval("tool", JSON.stringify(sharedMessageProps))
	if (!approved) {
		cline.didRejectTool = true
		pushToolResult("Operation cancelled by user.")
		return
	}
	// ... rest of diff view setup
}
```

### Task 2: Fix Change Application Approval (Lines 211-213)

**Estimated Time**: 2 hours  
**Priority**: Critical

```typescript
// Current (problematic):
const completeMessage = JSON.stringify({ ...sharedMessageProps, diff } satisfies ClineSayTool)
const didApprove = await cline
	.ask("tool", completeMessage, false)
	.then((response) => response.response === "yesButtonClicked")

// Fixed:
const completeMessage = JSON.stringify({ ...sharedMessageProps, diff } satisfies ClineSayTool)
const didApprove = await askApproval("tool", completeMessage)
```

### Task 3: Update Error Handling

**Estimated Time**: 1 hour  
**Priority**: High

- Ensure consistent error handling pattern
- Set `cline.didRejectTool = true` when operations are denied
- Provide appropriate user feedback messages
- Clean up diff view state on errors

### Task 4: Testing and Validation

**Estimated Time**: 3 hours  
**Priority**: High

#### CLI Mode Testing

- [ ] Test basic search and replace functionality
- [ ] Test with various regex patterns
- [ ] Test with case-sensitive/insensitive options
- [ ] Test with line range restrictions
- [ ] Verify no hanging or timeout issues
- [ ] Test error scenarios (file not found, permission errors)

#### VSCode Mode Testing

- [ ] Verify interactive approval dialogs still work
- [ ] Test diff view display and functionality
- [ ] Test user approval/rejection scenarios
- [ ] Verify no regression in existing behavior

#### Integration Testing

- [ ] Test as part of larger batch operations
- [ ] Test with other tools in sequence
- [ ] Verify proper cleanup and state management

## Definition of Done

### Functional DoD

- ✅ Search and replace tool works without hanging in CLI batch mode
- ✅ Tool auto-approves in CLI mode, shows prompts in VSCode mode
- ✅ All search/replace operations complete successfully
- ✅ Proper error handling and user feedback

### Technical DoD

- ✅ Code follows established CLI compatibility patterns
- ✅ Uses `askApproval` parameter instead of hardcoded `cline.ask()`
- ✅ Maintains backward compatibility with VSCode mode
- ✅ Proper error handling and cleanup

### Quality DoD

- ✅ All existing tests pass
- ✅ New test coverage for CLI mode scenarios
- ✅ Code review completed and approved
- ✅ Documentation updated if necessary

## Test Scenarios

### Scenario 1: Basic CLI Search and Replace

```bash
npm run start:cli -- --batch "Create a test file with console.log statements, then replace all 'console.log' with 'logger.debug'"
```

**Expected**: Tool completes without hanging, replacements are applied

### Scenario 2: VSCode Interactive Mode

1. Open search and replace tool in VSCode
2. Specify search/replace parameters
3. Review diff view
4. Approve or reject changes
   **Expected**: Interactive prompts work as before

### Scenario 3: Error Handling

```bash
npm run start:cli -- --batch "Try to replace text in a non-existent file"
```

**Expected**: Proper error message, graceful failure

## Risk Assessment

### High Risk

- **Backward Compatibility**: Changes might affect VSCode mode behavior
- **Complex Approval Logic**: Diff view and change application have intricate flows

### Medium Risk

- **Error Handling**: Need to ensure consistent error handling across modes
- **State Management**: Diff view provider state needs proper cleanup

### Mitigation

- Thorough testing in both modes before release
- Code review with focus on compatibility
- Rollback plan if issues are discovered

## Dependencies

- Understanding of existing `askApproval` pattern from other tools
- Access to CLI batch mode testing environment
- VSCode extension testing capabilities

## Related Stories

- Epic: CLI Tool Compatibility Comprehensive Plan
- Future: Audit other tools for similar issues
- Future: Create automated testing for CLI compatibility

## Notes

- This fix follows the pattern successfully used in `readFileTool.ts`
- The `askApproval` function automatically handles CLI vs VSCode mode differences
- Changes should be minimal and focused to reduce risk of regression
