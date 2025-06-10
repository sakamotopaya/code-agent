# Product Story: Comprehensive CLI Tool Audit and Standardization

## Epic

CLI Tool Compatibility - Phase 3: Comprehensive Audit and Standards

## Story Title

As a development team, we want to audit all tools for CLI compatibility and create standardized patterns so that future tool development is consistent and CLI-compatible by default

## User Story

**As a** development team maintaining the CLI functionality  
**I want** to audit all existing tools and establish standard patterns  
**So that** we prevent future CLI compatibility issues and ensure consistent behavior across all tools

## Background

After fixing critical and high-priority tools, we need to comprehensively audit all remaining tools to identify potential CLI compatibility issues and establish standardized patterns for consistent tool development.

## Problem Statement

- Unknown number of tools may have CLI compatibility issues
- No standardized patterns for tool development
- Risk of future regression without clear guidelines
- Inconsistent approval and error handling patterns across tools

## Scope Analysis

### Tools to Audit (Complete List)

Based on `src/core/tools/` directory analysis:

#### ✅ Already Fixed/Verified

- `searchAndReplaceTool.ts` - Fixed in Phase 1
- `executeCommandTool.ts` - Fixed in Phase 2
- `attemptCompletionTool.ts` - Fixed in Phase 2
- `askFollowupQuestionTool.ts` - Fixed in Phase 2
- `readFileTool.ts` - Already uses correct patterns

#### 🔍 Needs Audit (Medium/Low Risk)

1. `applyDiffTool.ts` - File modification tool
2. `browserActionTool.ts` - Browser automation
3. `insertContentTool.ts` - File content insertion
4. `writeToFileTool.ts` - File writing operations
5. `codebaseSearchTool.ts` - Code search functionality
6. `listCodeDefinitionNamesTool.ts` - Code analysis
7. `listFilesTool.ts` - File listing
8. `searchFilesTool.ts` - File search
9. `useMcpToolTool.ts` - MCP tool execution
10. `accessMcpResourceTool.ts` - MCP resource access
11. `fetchInstructionsTool.ts` - Instruction fetching
12. `newTaskTool.ts` - Task creation
13. `switchModeTool.ts` - Mode switching

#### 🚫 CLI Not Applicable

- Tools that are inherently interactive or VSCode-specific

## Acceptance Criteria

### Audit Requirements

- [ ] Complete analysis of all tools for CLI compatibility
- [ ] Categorization by risk level and impact
- [ ] Identification of all hardcoded `cline.ask()` usage
- [ ] Documentation of current patterns and inconsistencies
- [ ] Priority matrix for fixing remaining issues

### Standardization Requirements

- [ ] Create standard CLI-compatible patterns
- [ ] Develop reusable utility functions
- [ ] Establish error handling conventions
- [ ] Create development guidelines and checklist
- [ ] Implement type safety measures

### Documentation Requirements

- [ ] Comprehensive CLI compatibility guide
- [ ] Tool development best practices
- [ ] Code review checklist items
- [ ] Troubleshooting documentation
- [ ] Migration guide for existing tools

## Implementation Tasks

### Task 1: Comprehensive Tool Audit

**Estimated Time**: 8 hours  
**Priority**: High

#### Audit Process

For each tool, analyze:

- [ ] Approval mechanisms (`cline.ask()` vs `askApproval`)
- [ ] Error handling patterns
- [ ] CLI vs VSCode behavior differences
- [ ] Interactive elements and user inputs
- [ ] Background process handling
- [ ] State management and cleanup

#### Audit Checklist per Tool

- [ ] **Approval Pattern Analysis**

    - Uses `askApproval` parameter? ✅/❌
    - Has hardcoded `cline.ask()` calls? ✅/❌
    - Handles CLI auto-approval? ✅/❌
    - Maintains VSCode interactivity? ✅/❌

- [ ] **Error Handling Analysis**

    - Consistent error patterns? ✅/❌
    - Sets `cline.didRejectTool` appropriately? ✅/❌
    - Proper cleanup on errors? ✅/❌
    - CLI-friendly error messages? ✅/❌

- [ ] **CLI Compatibility Assessment**
    - Works in CLI batch mode? ✅/❌/❓
    - Hangs waiting for input? ✅/❌/❓
    - Auto-completes appropriately? ✅/❌/❓
    - Risk level: High/Medium/Low/None

#### Deliverables

- Detailed audit report per tool
- Risk matrix and priority ranking
- Pattern analysis and recommendations
- Fix effort estimation

### Task 2: Pattern Standardization

**Estimated Time**: 6 hours  
**Priority**: High

#### Standard Patterns to Establish

##### 1. Approval Pattern

```typescript
// Standard CLI-compatible approval
export async function getCliCompatibleApproval(
	askApproval: AskApproval,
	messageType: string,
	message: string,
): Promise<boolean> {
	return await askApproval(messageType, message)
}
```

##### 2. Error Handling Pattern

```typescript
// Standard error handling
export function handleToolError(cline: Task, error: Error, toolName: string, pushToolResult: PushToolResult): void {
	cline.consecutiveMistakeCount++
	cline.recordToolError(toolName)
	cline.didRejectTool = true

	const formattedError = formatResponse.toolError(`${toolName} failed: ${error.message}`)
	pushToolResult(formattedError)
}
```

##### 3. Progress Indication Pattern

```typescript
// Standard progress indication (safe for both modes)
export async function showToolProgress(cline: Task, message: any, isPartial: boolean = false): Promise<void> {
	await cline.ask("tool", JSON.stringify(message), isPartial).catch(() => {})
}
```

##### 4. Cleanup Pattern

```typescript
// Standard cleanup pattern
export async function performToolCleanup(cline: Task, diffViewProvider?: IDiffViewProvider): Promise<void> {
	if (diffViewProvider) {
		await diffViewProvider.reset()
	}
	// Other standard cleanup operations
}
```

#### Utility Functions to Create

- [ ] `createCliCompatibleTool()` - Tool wrapper factory
- [ ] `validateToolParameters()` - Parameter validation utility
- [ ] `handleToolApproval()` - Standardized approval handling
- [ ] `performToolCleanup()` - Standardized cleanup
- [ ] `formatToolError()` - Consistent error formatting

### Task 3: Create Development Guidelines

**Estimated Time**: 4 hours  
**Priority**: Medium

#### CLI Compatibility Checklist

- [ ] Use `askApproval` parameter instead of `cline.ask()` for approvals
- [ ] Handle partial tool execution with `.catch(() => {})`
- [ ] Set `cline.didRejectTool = true` on user rejection
- [ ] Use consistent error handling patterns
- [ ] Implement proper cleanup in all code paths
- [ ] Test in both CLI and VSCode modes

#### Tool Development Template

```typescript
export async function newTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	// 1. Parameter validation
	// 2. Partial tool handling
	// 3. Main tool logic
	// 4. CLI-compatible approval
	// 5. Error handling
	// 6. Cleanup
}
```

#### Code Review Guidelines

- CLI compatibility verification checklist
- Testing requirements for both modes
- Pattern compliance verification
- Error handling review points

### Task 4: Type Safety Implementation

**Estimated Time**: 6 hours  
**Priority**: Medium

#### TypeScript Interfaces

```typescript
// Tool function signature enforcement
export interface CliCompatibleTool {
	(
		cline: Task,
		block: ToolUse,
		askApproval: AskApproval,
		handleError: HandleError,
		pushToolResult: PushToolResult,
		removeClosingTag: RemoveClosingTag,
	): Promise<void>
}

// Approval mechanism interface
export interface ApprovalMechanism {
	(messageType: string, message: string): Promise<boolean>
}
```

#### Compile-time Checks

- [ ] Enforce tool function signatures
- [ ] Prevent direct `cline.ask()` usage in tools
- [ ] Require proper error handling patterns
- [ ] Validate approval mechanism usage

### Task 5: Create Testing Framework

**Estimated Time**: 8 hours  
**Priority**: High

#### CLI Compatibility Test Suite

```typescript
describe("CLI Tool Compatibility", () => {
	describe.each(ALL_TOOLS)("Tool: %s", (toolName) => {
		it("should work in CLI batch mode", async () => {
			// Test CLI mode execution
		})

		it("should maintain VSCode functionality", async () => {
			// Test VSCode mode execution
		})

		it("should handle errors gracefully", async () => {
			// Test error scenarios
		})
	})
})
```

#### Test Utilities

- [ ] Mock CLI environment setup
- [ ] Mock VSCode environment setup
- [ ] Approval mechanism mocking
- [ ] Error injection utilities
- [ ] State verification helpers

## Definition of Done

### Audit DoD

- ✅ All tools audited and categorized
- ✅ Complete risk assessment and priority matrix
- ✅ Detailed recommendations for each tool
- ✅ Fix effort estimations provided

### Standardization DoD

- ✅ Standard patterns documented and implemented
- ✅ Reusable utility functions created
- ✅ Development guidelines established
- ✅ Type safety measures implemented

### Testing DoD

- ✅ Comprehensive test suite for CLI compatibility
- ✅ Automated testing in CI/CD pipeline
- ✅ Testing utilities and frameworks created
- ✅ Documentation for testing procedures

### Documentation DoD

- ✅ CLI compatibility guide completed
- ✅ Tool development best practices documented
- ✅ Code review checklists created
- ✅ Troubleshooting guides available

## Deliverables

### 1. Audit Report

- Tool-by-tool analysis
- Risk matrix and priority ranking
- Pattern analysis and findings
- Recommendations and fix estimations

### 2. Standards Package

- Standard pattern implementations
- Utility function library
- TypeScript interfaces and types
- Development guidelines

### 3. Testing Framework

- CLI compatibility test suite
- Testing utilities and mocks
- CI/CD integration
- Testing documentation

### 4. Documentation Suite

- CLI compatibility guide
- Tool development handbook
- Code review checklists
- Troubleshooting documentation

## Risk Assessment

### High Risk

- **Scope Creep**: Audit might reveal more issues than anticipated
- **Complex Tool Logic**: Some tools may have intricate approval flows
- **Backward Compatibility**: Changes might affect existing VSCode functionality

### Medium Risk

- **Testing Coverage**: Ensuring comprehensive test coverage for all scenarios
- **Pattern Adoption**: Ensuring team adopts new standards
- **Maintenance Overhead**: Keeping standards up to date

### Mitigation

- Limit scope to essential compatibility issues
- Incremental implementation and testing
- Thorough code review process
- Automated testing to prevent regression

## Success Metrics

- 100% of tools audited and categorized
- Zero CLI compatibility issues in remaining tools
- Standard patterns adopted across all new tool development
- Comprehensive test coverage for CLI compatibility
- Zero regression in VSCode functionality

## Timeline

- Week 1: Complete tool audit and analysis
- Week 2: Implement standard patterns and utilities
- Week 3: Create testing framework and documentation
- Week 4: Final testing and validation

## Dependencies

- Completion of Phase 1 and Phase 2 fixes
- Access to all tools and testing environments
- Team availability for standards review and adoption

## Related Stories

- Previous: Fix High-Priority Tools CLI Compatibility
- Next: Long-term Type Safety and Monitoring
- Epic: CLI Tool Compatibility Comprehensive Plan
