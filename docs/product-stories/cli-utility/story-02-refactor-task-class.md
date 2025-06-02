# Story 2: Refactor Task Class for Abstraction

**Phase**: 1 - Core Abstraction  
**Labels**: `cli-utility`, `phase-1`, `refactoring`, `task-class`  
**Story Points**: 13  
**Priority**: High  

## User Story
As a developer working on the CLI utility implementation, I need to refactor the Task class to use abstraction interfaces instead of direct VS Code dependencies, so that the same Task class can work in both VS Code and CLI environments.

## Acceptance Criteria

### Task Class Refactoring
- [ ] Remove all direct `vscode` imports from `Task.ts`
- [ ] Add `IUserInterface` parameter to Task constructor
- [ ] Replace VS Code-specific UI calls with interface method calls
- [ ] Update all file operations to use `IFileSystem` interface
- [ ] Update terminal operations to use `ITerminal` interface
- [ ] Update browser operations to use `IBrowser` interface

### Interface Integration
- [ ] Modify Task constructor to accept interface implementations:
  ```typescript
  constructor(
    options: TaskOptions,
    userInterface: IUserInterface,
    fileSystem: IFileSystem,
    terminal: ITerminal,
    browser: IBrowser
  )
  ```

### Method Updates
- [ ] Update `say()` method to use `userInterface.showMessage()`
- [ ] Update `ask()` method to use `userInterface.askQuestion()`
- [ ] Update file reading/writing to use `fileSystem` methods
- [ ] Update command execution to use `terminal.executeCommand()`
- [ ] Update browser actions to use `browser` interface methods

### Error Handling
- [ ] Ensure all interface method calls have proper error handling
- [ ] Maintain existing error message formats and behavior
- [ ] Add fallback mechanisms for interface method failures

### Backward Compatibility
- [ ] Ensure existing VS Code functionality is not broken
- [ ] Maintain all existing public method signatures
- [ ] Preserve all existing event emissions
- [ ] Keep all existing configuration handling

## Technical Details

### Current Task Class Analysis
The current `Task.ts` file has these VS Code dependencies that need abstraction:
- Direct `vscode` imports for UI operations
- File system operations through VS Code APIs
- Terminal operations through VS Code terminal API
- Browser session management through VS Code webview

### Refactoring Approach
1. **Constructor Changes**:
   ```typescript
   // Before
   constructor(options: TaskOptions, provider: ClineProvider)
   
   // After  
   constructor(
     options: TaskOptions,
     userInterface: IUserInterface,
     fileSystem: IFileSystem,
     terminal: ITerminal,
     browser: IBrowser,
     provider?: ClineProvider // Optional for VS Code compatibility
   )
   ```

2. **Method Refactoring Examples**:
   ```typescript
   // Before
   private async say(type: "text" | "error", text?: string) {
     // Direct VS Code UI calls
   }
   
   // After
   private async say(type: "text" | "error", text?: string) {
     await this.userInterface.showMessage(text, type === "error" ? "error" : "info")
   }
   ```

3. **File Operations**:
   ```typescript
   // Before
   const content = await vscode.workspace.fs.readFile(uri)
   
   // After
   const content = await this.fileSystem.readFile(path)
   ```

### Interface Usage Patterns
- All UI interactions must go through `userInterface`
- All file operations must go through `fileSystem`
- All terminal operations must go through `terminal`
- All browser operations must go through `browser`

## Dependencies
- **Depends on**: Story 1 (Create Interface Definitions)
- **Blocks**: Story 3 (Create VS Code Adapter Implementations)

## Definition of Done
- [ ] Task class compiles without VS Code dependencies
- [ ] All interface methods are properly integrated
- [ ] Existing functionality is preserved (verified by tests)
- [ ] Error handling is maintained
- [ ] Code review completed
- [ ] Unit tests updated to reflect new constructor signature
- [ ] Integration tests pass with mock interface implementations

## Testing Strategy
- Create mock implementations of all interfaces for testing
- Verify that Task class works with mocked interfaces
- Ensure all existing Task functionality still works
- Test error scenarios with interface method failures

## Notes
- This is a critical refactoring that affects the core of the application
- Take extra care to preserve existing behavior
- Consider creating a compatibility layer if needed
- Document any breaking changes clearly

## GitHub Issue Template
```markdown
## Summary
Refactor the Task class to use abstraction interfaces instead of direct VS Code dependencies.

## Tasks
- [ ] Remove direct vscode imports from Task.ts
- [ ] Add interface parameters to constructor
- [ ] Replace VS Code UI calls with interface methods
- [ ] Update file operations to use IFileSystem
- [ ] Update terminal operations to use ITerminal
- [ ] Update browser operations to use IBrowser
- [ ] Maintain backward compatibility
- [ ] Update error handling
- [ ] Update tests

## Acceptance Criteria
[Copy from story document]

Labels: cli-utility, phase-1, refactoring, task-class