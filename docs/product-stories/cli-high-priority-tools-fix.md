# Product Story: Fix High-Priority Tools CLI Compatibility

## Epic

CLI Tool Compatibility - Phase 2: High-Priority Tool Fixes

## Story Title

As a CLI user, I want all high-priority tools to work in batch mode so that I can perform comprehensive automated workflows without interruption

## User Story

**As a** CLI user running automated workflows  
**I want** executeCommand, attemptCompletion, and askFollowupQuestion tools to work in non-interactive mode  
**So that** I can create complete end-to-end automation without manual intervention

## Background

After fixing the search_and_replace tool, several other high-priority tools have been identified that use similar problematic patterns with hardcoded `cline.ask()` calls. These tools are essential for comprehensive CLI automation workflows.

## Problem Statement

- Multiple critical tools hang in CLI batch mode
- Tools use hardcoded interactive approval requests
- Prevents end-to-end automation workflows
- Inconsistent behavior across tools

## Affected Tools Analysis

### 1. executeCommandTool.ts (Critical Impact)

**Issue Location**: Line 211

```typescript
const { response, text, images } = await cline.ask("command_output", "")
```

**Impact**: Commands that need user interaction hang in CLI mode
**Usage**: Core functionality for running system commands

### 2. attemptCompletionTool.ts (Critical Impact)

**Issue Location**: Line 119

```typescript
const { response, text, images } = await cline.ask("completion_result", "", false)
```

**Impact**: Task completion requires user confirmation, breaks automation
**Usage**: Final step in task execution workflows

### 3. askFollowupQuestionTool.ts (Medium Impact)

**Issue Location**: Line 59

```typescript
const { text, images } = await cline.ask("followup", JSON.stringify(follow_up_json), false)
```

**Impact**: Information gathering workflows hang waiting for user input
**Usage**: Interactive clarification and information gathering

## Technical Analysis

### Current CLI Auto-Approval Pattern (Working)

From Task.ts line 864:

```typescript
const askApproval = async () => true // Auto-approve in CLI
```

### Correct Implementation Pattern

From readFileTool.ts:

```typescript
const approved = await askApproval("tool", completeMessage)
if (!approved) {
	cline.didRejectTool = true
	return
}
```

## Acceptance Criteria

### Functional Requirements

- [ ] All high-priority tools work in CLI batch mode without hanging
- [ ] Tools auto-approve operations in CLI mode
- [ ] Tools maintain interactive behavior in VSCode mode
- [ ] Consistent approval patterns across all tools
- [ ] Proper error handling and fallback behavior

### Technical Requirements

- [ ] Replace hardcoded `cline.ask()` calls with appropriate CLI-compatible patterns
- [ ] Implement proper auto-approval for CLI mode
- [ ] Maintain backward compatibility with VSCode interactive mode
- [ ] Follow established patterns from successfully converted tools
- [ ] Consistent error handling and user feedback

### Quality Requirements

- [ ] All existing tests continue to pass
- [ ] No regression in VSCode functionality
- [ ] Comprehensive test coverage for CLI scenarios
- [ ] Consistent behavior and user experience

## Implementation Tasks

### Task 1: Fix executeCommandTool.ts

**Estimated Time**: 4 hours  
**Priority**: Critical

#### Analysis

The command output approval mechanism needs to handle:

- Background process management
- Interactive command scenarios
- Output capture and display
- User interruption handling

#### Implementation Strategy

```typescript
// Current problematic code:
const { response, text, images } = await cline.ask("command_output", "")
runInBackground = true

// Proposed fix:
// For CLI mode: Auto-approve background execution
// For VSCode mode: Show interactive prompt
const shouldRunInBackground = await askApproval("command_output", "")
if (shouldRunInBackground) {
	runInBackground = true
}
```

#### Specific Changes

- [ ] Replace interactive prompt with CLI-compatible approval
- [ ] Ensure background process handling works in CLI
- [ ] Maintain interrupt capability in VSCode mode
- [ ] Handle command output appropriately in both modes

### Task 2: Fix attemptCompletionTool.ts

**Estimated Time**: 3 hours  
**Priority**: Critical

#### Analysis

The completion result approval affects:

- Task completion workflows
- Final result confirmation
- Command execution for result demonstration
- User feedback collection

#### Implementation Strategy

```typescript
// Current problematic code:
const { response, text, images } = await cline.ask("completion_result", "", false)

// Proposed fix:
// For CLI mode: Auto-approve completion
// For VSCode mode: Show completion dialog
const completionApproved = await askApproval("completion_result", "")
if (completionApproved) {
	// Handle auto-approval logic
} else {
	// Handle rejection/modification requests
}
```

#### Specific Changes

- [ ] Replace completion prompt with CLI-compatible approval
- [ ] Ensure task completion works in automated scenarios
- [ ] Maintain user feedback capability in VSCode mode
- [ ] Handle command execution properly in both modes

### Task 3: Fix askFollowupQuestionTool.ts

**Estimated Time**: 3 hours  
**Priority**: High

#### Analysis

The followup question mechanism needs special handling:

- Information gathering workflows
- User clarification requests
- Multiple choice options
- Fallback behavior for automation

#### Implementation Strategy

```typescript
// Current problematic code:
const { text, images } = await cline.ask("followup", JSON.stringify(follow_up_json), false)

// Proposed fix:
// For CLI mode: Use first suggested option or skip
// For VSCode mode: Show interactive question dialog
const followupResponse = await handleFollowupQuestion(follow_up_json, askApproval)
```

#### Specific Changes

- [ ] Create smart fallback logic for CLI mode
- [ ] Use first suggested option as default in automation
- [ ] Maintain full interactive capability in VSCode mode
- [ ] Implement graceful degradation for automation scenarios

### Task 4: Pattern Standardization

**Estimated Time**: 2 hours  
**Priority**: High

#### Create Reusable Utilities

- [ ] Create `CliCompatibleApproval` utility function
- [ ] Create `AutomationFallback` helper for question handling
- [ ] Create consistent error handling patterns
- [ ] Document standard patterns for future tools

#### Implementation

```typescript
// Utility for CLI-compatible approvals
export async function createCliCompatibleApproval(
	askApproval: AskApproval,
	messageType: string,
	message: string,
	fallbackValue: boolean = true,
): Promise<boolean> {
	try {
		return await askApproval(messageType, message)
	} catch (error) {
		// Fallback for CLI mode or error scenarios
		return fallbackValue
	}
}
```

### Task 5: Testing and Validation

**Estimated Time**: 4 hours  
**Priority**: High

#### CLI Mode Testing

- [ ] Test command execution workflows
- [ ] Test task completion scenarios
- [ ] Test followup question fallback behavior
- [ ] Test error handling and edge cases
- [ ] Verify no hanging or timeout issues

#### VSCode Mode Testing

- [ ] Verify all interactive prompts still work
- [ ] Test user approval/rejection scenarios
- [ ] Test command interruption capabilities
- [ ] Verify no regression in existing behavior

#### Integration Testing

- [ ] Test complete workflows using multiple tools
- [ ] Test complex automation scenarios
- [ ] Verify proper state management across tools
- [ ] Test error propagation and handling

## Definition of Done

### Functional DoD

- ✅ All high-priority tools work without hanging in CLI batch mode
- ✅ Tools handle automation scenarios appropriately
- ✅ Interactive functionality preserved in VSCode mode
- ✅ Consistent behavior across all fixed tools

### Technical DoD

- ✅ Standardized CLI compatibility patterns implemented
- ✅ Proper error handling and fallback mechanisms
- ✅ Maintained backward compatibility
- ✅ Reusable utilities created for future tools

### Quality DoD

- ✅ Comprehensive test coverage for all scenarios
- ✅ All existing tests continue to pass
- ✅ Code review completed and approved
- ✅ Documentation updated with new patterns

## Test Scenarios

### Scenario 1: End-to-End CLI Workflow

```bash
npm run start:cli -- --batch "Create a new file, execute a command to process it, and complete the task"
```

**Expected**: Complete workflow runs without hanging

### Scenario 2: Command Execution in CLI

```bash
npm run start:cli -- --batch "Run 'ls -la' command and capture output"
```

**Expected**: Command executes and completes automatically

### Scenario 3: Task Completion in CLI

```bash
npm run start:cli -- --batch "Create a simple task and mark it as completed"
```

**Expected**: Task completes without requiring user confirmation

### Scenario 4: VSCode Interactive Preservation

1. Use executeCommand tool in VSCode
2. Run command that might need interruption
3. Verify interactive prompts appear
   **Expected**: Full interactive capability preserved

## Risk Assessment

### High Risk

- **Command Execution**: Background processes and interruption handling
- **Task Completion**: Workflow completion logic complexity
- **Backward Compatibility**: Preserving VSCode interactive features

### Medium Risk

- **Error Handling**: Consistent error handling across different tool types
- **State Management**: Proper cleanup and state management
- **Integration**: Interaction between multiple fixed tools

### Mitigation

- Incremental implementation and testing
- Thorough testing in both CLI and VSCode modes
- Code review focusing on compatibility and error handling
- Rollback plan for each tool individually

## Dependencies

- Completion of Phase 1 (search_and_replace tool fix)
- Understanding of CLI auto-approval mechanisms
- Access to comprehensive testing environment

## Related Stories

- Previous: Fix Search and Replace Tool CLI Compatibility
- Next: Comprehensive Tool Audit and Standardization
- Epic: CLI Tool Compatibility Comprehensive Plan

## Success Metrics

- Zero hanging issues in CLI batch mode for high-priority tools
- 100% backward compatibility with VSCode mode
- Consistent patterns established for future tool development
- Comprehensive automation workflows functional in CLI mode
