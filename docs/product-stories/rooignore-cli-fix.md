# .rooignore CLI Mode Issues - Product Requirements Document

## Overview

The .rooignore logic has critical bugs that prevent proper file access validation in CLI mode, causing the system to block access to all files including the .rooignore file itself.

## Problem Statement

From user testing logs, we discovered that the .rooignore logic is blocking access to all files in CLI mode with the error:

```
Access to [file] is blocked by the .rooignore file settings
```

### Root Cause Analysis

1. **Critical Runtime Error**: `.toPosix()` method doesn't exist on strings in JavaScript
2. **Self-Blocking Logic**: .rooignore file blocks access to itself
3. **CLI Mode Gaps**: RooIgnoreController creation inconsistencies between CLI and VSCode modes
4. **Path Resolution Issues**: Workspace path handling differs between modes

## Technical Issues Identified

### Issue 1: `.toPosix()` Method Error

- **Location**: `src/core/ignore/RooIgnoreController.ts:95`
- **Problem**: `path.relative().toPosix()` throws runtime error
- **Impact**: All file access validation fails, defaulting to "blocked"

### Issue 2: Self-Blocking .rooignore File

- **Location**: `src/core/ignore/RooIgnoreController.ts:72`
- **Problem**: Controller adds `.rooignore` to its own ignore patterns
- **Impact**: Cannot debug or read .rooignore configuration

### Issue 3: CLI Mode Controller Creation

- **Problem**: Task constructor only creates RooIgnoreController in VSCode mode
- **Impact**: CLI mode may lack proper validation or create inconsistent instances

### Issue 4: Path Resolution Inconsistencies

- **Problem**: Workspace path handling differs between CLI and VSCode modes
- **Impact**: Path validation may fail due to incorrect relative path calculations

## User Stories

### Story 1: Fix Runtime Error in Path Normalization

**As a** developer using the CLI
**I want** file access validation to work correctly
**So that** I can access allowed files without runtime errors

**Acceptance Criteria:**

- Replace `.toPosix()` with proper cross-platform path normalization
- All path operations handle Windows and POSIX paths correctly
- No runtime errors during path validation

**Technical Implementation:**

- Replace `relativePath.toPosix()` with `relativePath.replace(/\\/g, '/')`
- Add path normalization utility if needed
- Test on Windows, macOS, and Linux

### Story 2: Allow Access to .rooignore File

**As a** developer debugging .rooignore issues
**I want** to be able to read the .rooignore file
**So that** I can understand what patterns are being applied

**Acceptance Criteria:**

- .rooignore file itself is not blocked by the controller
- Can read .rooignore file contents for debugging
- Other patterns in .rooignore still work correctly

**Technical Implementation:**

- Remove automatic addition of `.rooignore` to ignore patterns
- Update tests to verify .rooignore accessibility
- Maintain security for patterns defined within the file

### Story 3: Consistent RooIgnoreController in CLI Mode

**As a** CLI user
**I want** .rooignore functionality to work the same as in VSCode
**So that** my ignore patterns are respected consistently

**Acceptance Criteria:**

- RooIgnoreController is created and initialized in CLI mode
- Same validation logic applies in both CLI and VSCode modes
- Workspace path is correctly resolved in CLI mode

**Technical Implementation:**

- Update Task constructor to create RooIgnoreController in CLI mode
- Ensure proper workspace path handling in CLI adapters
- Add CLI-specific initialization if needed

### Story 4: Robust Path Resolution

**As a** user running the CLI from different directories
**I want** .rooignore patterns to work regardless of my current directory
**So that** the workspace-relative patterns are applied correctly

**Acceptance Criteria:**

- Workspace path is correctly identified in CLI mode
- Relative path calculations work from any working directory
- Error handling for invalid workspace paths

**Technical Implementation:**

- Verify workspace path setting in CLI initialization
- Add error handling for path resolution failures
- Implement fallback behavior for edge cases

### Story 5: Comprehensive Error Handling and Logging

**As a** developer troubleshooting .rooignore issues
**I want** clear error messages and debug information
**So that** I can quickly identify and fix configuration problems

**Acceptance Criteria:**

- Clear error messages for .rooignore validation failures
- Debug logging for path resolution and pattern matching
- Helpful suggestions in error messages

**Technical Implementation:**

- Add structured logging throughout RooIgnoreController
- Improve error messages in tool validation
- Add debug mode for detailed .rooignore operation logging

### Story 6: Platform-Specific Testing

**As a** QA engineer
**I want** comprehensive tests for .rooignore functionality
**So that** we can ensure cross-platform compatibility

**Acceptance Criteria:**

- Tests for CLI mode RooIgnoreController behavior
- Cross-platform path normalization tests
- Integration tests for CLI and VSCode mode parity

**Technical Implementation:**

- Add CLI mode test scenarios
- Test path normalization on different platforms
- Mock VSCode APIs for consistent testing

## Implementation Priority

1. **Critical (P0)**: Fix `.toPosix()` runtime error - Story 1
2. **High (P1)**: Enable CLI mode RooIgnoreController - Story 3
3. **High (P1)**: Allow .rooignore file access - Story 2
4. **Medium (P2)**: Improve path resolution - Story 4
5. **Medium (P2)**: Add comprehensive logging - Story 5
6. **Low (P3)**: Platform testing - Story 6

## Success Criteria

- CLI mode respects .rooignore patterns correctly
- No runtime errors during file access validation
- .rooignore file itself is accessible for debugging
- Consistent behavior between CLI and VSCode modes
- Clear error messages for troubleshooting

## Technical Architecture

### Current Flow

```mermaid
graph TD
    A[File Access Request] --> B[RooIgnoreController.validateAccess]
    B --> C[path.relative().toPosix()]
    C --> D[Runtime Error]
    D --> E[Default to Blocked]
```

### Fixed Flow

```mermaid
graph TD
    A[File Access Request] --> B[RooIgnoreController.validateAccess]
    B --> C[Normalize Path with replace()]
    C --> D[Check Ignore Patterns]
    D --> E{Is Ignored?}
    E -->|No| F[Allow Access]
    E -->|Yes| G[Block Access]
```

## Dependencies

- Core ignore library functionality
- Path manipulation utilities
- CLI adapter framework
- Testing infrastructure

## Risks and Mitigation

- **Risk**: Breaking existing VSCode mode functionality
  **Mitigation**: Comprehensive regression testing
- **Risk**: Platform-specific path issues
  **Mitigation**: Cross-platform testing and path utilities
- **Risk**: Security implications of allowing .rooignore access
  **Mitigation**: Careful review of access patterns and implications
