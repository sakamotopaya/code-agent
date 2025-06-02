# Story 3: Create VS Code Adapter Implementations

**Phase**: 1 - Core Abstraction  
**Labels**: `cli-utility`, `phase-1`, `adapters`, `vscode`  
**Story Points**: 10  
**Priority**: High  

## User Story
As a developer working on the CLI utility implementation, I need to create VS Code adapter implementations for all abstraction interfaces, so that the existing VS Code extension continues to work with the new abstracted Task class.

## Acceptance Criteria

### Adapter Implementation
- [ ] Create `VsCodeUserInterface.ts` implementing `IUserInterface`
- [ ] Create `VsCodeFileSystem.ts` implementing `IFileSystem`
- [ ] Create `VsCodeTerminal.ts` implementing `ITerminal`
- [ ] Create `VsCodeBrowser.ts` implementing `IBrowser`

### VS Code Integration
- [ ] All adapters must use existing VS Code APIs
- [ ] Maintain current user experience and behavior
- [ ] Preserve all existing error handling patterns
- [ ] Support all current VS Code-specific features

### File Structure
```
src/adapters/vscode/
├── VsCodeUserInterface.ts
├── VsCodeFileSystem.ts
├── VsCodeTerminal.ts
├── VsCodeBrowser.ts
└── index.ts (barrel export)
```

### Adapter Factory
- [ ] Create factory function to instantiate all VS Code adapters
- [ ] Ensure proper dependency injection for VS Code context
- [ ] Handle VS Code extension context properly

## Technical Details

### VsCodeUserInterface Implementation
```typescript
export class VsCodeUserInterface implements IUserInterface {
  constructor(private provider: ClineProvider) {}

  async showMessage(message: string, type: 'info' | 'warning' | 'error'): Promise<void> {
    // Use existing VS Code message display logic
    switch (type) {
      case 'info':
        vscode.window.showInformationMessage(message)
        break
      case 'warning':
        vscode.window.showWarningMessage(message)
        break
      case 'error':
        vscode.window.showErrorMessage(message)
        break
    }
  }

  async askQuestion(question: string, options?: string[]): Promise<string> {
    // Use existing VS Code input/selection logic
    if (options) {
      return await vscode.window.showQuickPick(options, { placeHolder: question })
    } else {
      return await vscode.window.showInputBox({ prompt: question })
    }
  }

  // ... other interface methods
}
```

### VsCodeFileSystem Implementation
```typescript
export class VsCodeFileSystem implements IFileSystem {
  async readFile(path: string, encoding: string = 'utf8'): Promise<string> {
    const uri = vscode.Uri.file(path)
    const content = await vscode.workspace.fs.readFile(uri)
    return Buffer.from(content).toString(encoding)
  }

  async writeFile(path: string, content: string): Promise<void> {
    const uri = vscode.Uri.file(path)
    const buffer = Buffer.from(content, 'utf8')
    await vscode.workspace.fs.writeFile(uri, buffer)
  }

  // ... other interface methods
}
```

### VsCodeTerminal Implementation
```typescript
export class VsCodeTerminal implements ITerminal {
  constructor(private terminalRegistry: TerminalRegistry) {}

  async executeCommand(command: string, options: ExecuteOptions): Promise<ExecuteResult> {
    // Use existing terminal execution logic
    return await this.terminalRegistry.executeCommand(command, options)
  }

  // ... other interface methods
}
```

### VsCodeBrowser Implementation
```typescript
export class VsCodeBrowser implements IBrowser {
  async launch(options: BrowserLaunchOptions): Promise<IBrowserSession> {
    // Use existing browser session logic
    return new VsCodeBrowserSession(options)
  }

  // ... other interface methods
}
```

### Adapter Factory
```typescript
export function createVsCodeAdapters(
  provider: ClineProvider,
  terminalRegistry: TerminalRegistry
): {
  userInterface: IUserInterface
  fileSystem: IFileSystem
  terminal: ITerminal
  browser: IBrowser
} {
  return {
    userInterface: new VsCodeUserInterface(provider),
    fileSystem: new VsCodeFileSystem(),
    terminal: new VsCodeTerminal(terminalRegistry),
    browser: new VsCodeBrowser()
  }
}
```

## Integration Points

### ClineProvider Updates
- [ ] Update `ClineProvider` to use adapter factory
- [ ] Pass adapters to Task constructor
- [ ] Maintain existing provider functionality

### Extension.ts Updates
- [ ] Update extension activation to create adapters
- [ ] Ensure proper dependency injection
- [ ] Maintain existing extension behavior

## Dependencies
- **Depends on**: Story 1 (Create Interface Definitions)
- **Depends on**: Story 2 (Refactor Task Class)
- **Blocks**: Story 4 (Ensure VS Code Functionality Preservation)

## Definition of Done
- [ ] All adapter classes implement their respective interfaces
- [ ] VS Code extension compiles without errors
- [ ] All existing VS Code functionality works unchanged
- [ ] Adapter factory creates properly configured instances
- [ ] Code review completed
- [ ] Unit tests written for each adapter
- [ ] Integration tests pass with VS Code adapters

## Testing Strategy
- Test each adapter individually with VS Code APIs
- Verify that adapters maintain existing behavior
- Test adapter factory creates correct instances
- Ensure no regression in VS Code extension functionality

## Notes
- These adapters are essentially wrappers around existing VS Code functionality
- Focus on maintaining exact same behavior as current implementation
- Consider performance implications of additional abstraction layer
- Document any VS Code-specific behaviors that are preserved

## GitHub Issue Template
```markdown
## Summary
Create VS Code adapter implementations for all abstraction interfaces to maintain existing VS Code extension functionality.

## Tasks
- [ ] Create VsCodeUserInterface adapter
- [ ] Create VsCodeFileSystem adapter
- [ ] Create VsCodeTerminal adapter
- [ ] Create VsCodeBrowser adapter
- [ ] Create adapter factory
- [ ] Update ClineProvider integration
- [ ] Update extension.ts
- [ ] Write tests

## Acceptance Criteria
[Copy from story document]

Labels: cli-utility, phase-1, adapters, vscode