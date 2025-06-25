# MCP Service Unification Analysis

## Current State

### VSCode Extension MCP Architecture

- Uses `McpServerManager` → `McpHub`
- Clean, simple disposal: `transport.close()` + `client.close()`
- No hanging issues

### CLI MCP Architecture

- Uses `GlobalCLIMcpService` → `CLIMcpService` → `StdioMcpConnection`
- Complex, aggressive cleanup with force-killing
- Hanging issues due to interference with MCP SDK cleanup

## VSCode Dependencies in McpHub

### Core VSCode API Dependencies

1. **Extension Context**

    - `vscode.ExtensionContext` - for state storage
    - Global state management

2. **Workspace Management**

    - `vscode.workspace.workspaceFolders` - getting workspace paths
    - `vscode.workspace.onDidChangeWorkspaceFolders` - workspace events
    - `vscode.workspace.onDidSaveTextDocument` - document save events

3. **File System Watching**

    - `vscode.FileSystemWatcher` - watching config file changes
    - `vscode.Disposable` - managing watchers lifecycle

4. **User Interface**

    - `vscode.window.showErrorMessage` - error notifications
    - `vscode.window.showInformationMessage` - info notifications
    - `vscode.window.showWarningMessage` - warning notifications

5. **Provider Integration**
    - `WeakRef<ClineProvider>` - webview provider reference
    - Webview update notifications

## Abstraction Interfaces Needed

### 1. IFileSystemService

```typescript
interface IFileSystemService {
	readFile(path: string): Promise<string>
	writeFile(path: string, content: string): Promise<void>
	exists(path: string): Promise<boolean>
	getWorkspacePath(): string | null
	getGlobalStoragePath(): string
}
```

### 2. IFileWatcherService

```typescript
interface IFileWatcherService {
	watchFile(path: string, callback: () => void): IDisposable
	watchWorkspace(callback: () => void): IDisposable
}
```

### 3. IUserInterfaceService

```typescript
interface IUserInterfaceService {
	showError(message: string): void
	showInfo(message: string): void
	showWarning(message: string): void
}
```

### 4. IStateService

```typescript
interface IStateService {
	get<T>(key: string): Promise<T | undefined>
	update(key: string, value: any): Promise<void>
}
```

### 5. IMcpNotificationService

```typescript
interface IMcpNotificationService {
	notifyServerChanges(): Promise<void>
	notifyToolUpdate(toolName: string): Promise<void>
}
```

## Unification Strategy

### Phase 1: Extract Core MCP Logic

1. Create `BaseMcpService` with core MCP functionality
2. Move connection management, tool execution, resource access to base
3. Keep VSCode-specific logic in `McpHub`

### Phase 2: Create Platform Adapters

1. `VsCodeMcpAdapter` - implements VSCode-specific services
2. `CliMcpAdapter` - implements CLI-specific services
3. Both extend `BaseMcpService`

### Phase 3: Unified Implementation

1. CLI uses same core logic as VSCode extension
2. Different adapters handle platform differences
3. Identical cleanup behavior (simple transport/client close)

## Benefits

### Immediate

- Fixes CLI hanging issue by using proven cleanup approach
- Eliminates code duplication between CLI and VSCode
- Consistent behavior across platforms

### Long-term

- Single codebase for MCP functionality
- Easier maintenance and testing
- Platform-specific optimizations through adapters
- Foundation for API/other platforms

## Implementation Complexity

### Low Complexity Changes

- Extract core connection logic (transport creation, cleanup)
- Create simple CLI adapters for file system, logging
- Replace CLI MCP service with adapted McpHub

### Medium Complexity Changes

- Abstract file watching for CLI (polling vs VSCode watchers)
- Handle workspace concepts in CLI context
- State management without VSCode extension context

### High Complexity Changes

- Full notification system abstraction
- Complex configuration management unification
- Testing across all platforms

## Recommendation

**Start with Phase 1**: Extract core MCP logic into `BaseMcpService` and create simple CLI adapter. This gives us:

1. Immediate fix for CLI hanging issue
2. Code reuse without major architectural changes
3. Foundation for future unification
4. Minimal risk to existing VSCode functionality

The CLI can use the same proven `transport.close()` + `client.close()` cleanup approach that works in VSCode, eliminating the hanging issue while moving toward unified architecture.
