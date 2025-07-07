# Missing Properties Implementation Plan for CLI and API Runtimes

## 1. `provider.context.globalStorageUri.fsPath` (Storage Path)

### Current Usage

```typescript
// Line 577 in Task.ts
this.globalStoragePath = provider.context.globalStorageUri.fsPath
```

### Implementation for Each Runtime

#### Extension (VSCode)

- **Current**: Uses `provider.context.globalStorageUri.fsPath`
- **Implementation**: No change, continues using VS Code's global storage API

#### CLI Runtime

- **Implementation**: Use file system-based storage in user's home directory
- **Path**: `~/.agentz/storage/` or `~/.config/agentz/storage/`
- **Code**:

```typescript
// In FileSystemProvider
getGlobalStoragePath(): string {
    return path.join(os.homedir(), '.agentz', 'storage')
}
```

#### API Runtime

- **Implementation**: Use temporary or configurable storage directory
- **Path**: `/tmp/agentz-api-storage/` or configurable via environment variable
- **Code**:

```typescript
// In MemoryProvider
getGlobalStoragePath(): string {
    return process.env.AGENTZ_STORAGE_PATH || '/tmp/agentz-api-storage'
}
```

## 2. `UrlContentFetcher(provider.context)` (URL Content Fetching)

### Current Usage

```typescript
// Line 671 in Task.ts
this.urlContentFetcher = new UrlContentFetcher(provider.context)
```

### Implementation for Each Runtime

#### Extension (VSCode)

- **Current**: Uses VS Code extension context for URL fetching
- **Implementation**: No change, continues using VS Code APIs

#### CLI Runtime

- **Implementation**: Use Node.js HTTP/HTTPS modules directly
- **Code**:

```typescript
// In FileSystemProvider or CLI context
// UrlContentFetcher should accept null context and use Node.js fetch
this.urlContentFetcher = new UrlContentFetcher(null) // Already handles null context
```

#### API Runtime

- **Implementation**: Use Node.js HTTP/HTTPS modules or fetch API
- **Code**:

```typescript
// In MemoryProvider or API context
// Same as CLI - UrlContentFetcher handles null context
this.urlContentFetcher = new UrlContentFetcher(null)
```

## 3. `BrowserSession(provider.context)` (Browser Session Management)

### Current Usage

```typescript
// Line 672 in Task.ts
this.browserSession = new BrowserSession(provider.context)
```

### Implementation for Each Runtime

#### Extension (VSCode)

- **Current**: Uses VS Code extension context for browser integration
- **Implementation**: No change, continues using VS Code APIs

#### CLI Runtime

- **Implementation**: Use headless browser (Puppeteer) or disable browser features
- **Code**:

```typescript
// In FileSystemProvider or CLI context
// BrowserSession should handle null context with Puppeteer
this.browserSession = new BrowserSession(null) // Use Puppeteer backend
```

#### API Runtime

- **Implementation**: Use headless browser (Puppeteer) or disable browser features
- **Code**:

```typescript
// In MemoryProvider or API context
// Same as CLI - use Puppeteer for headless browser automation
this.browserSession = new BrowserSession(null)
```

## 4. `FileContextTracker(provider, taskId)` (File Change Tracking)

### Current Usage

```typescript
// Line 643 in Task.ts
this.fileContextTracker = new FileContextTracker(provider, this.taskId)
```

### Implementation for Each Runtime

#### Extension (VSCode)

- **Current**: Uses full ClineProvider for VS Code file system events
- **Implementation**: No change, continues using VS Code file watcher APIs

#### CLI Runtime

- **Implementation**: Use Node.js file system watchers (fs.watch/chokidar)
- **Code**:

```typescript
// Create CLI-specific file tracker
this.fileContextTracker = new CLIFileContextTracker(this.taskId)

// CLIFileContextTracker implementation
class CLIFileContextTracker {
	constructor(taskId: string) {
		// Use fs.watch or chokidar for file watching
		this.watcher = fs.watch(process.cwd(), { recursive: true }, (eventType, filename) => {
			// Handle file changes
		})
	}
}
```

#### API Runtime

- **Implementation**: Use Node.js file system watchers or disable file tracking
- **Code**:

```typescript
// Create API-specific file tracker (similar to CLI)
this.fileContextTracker = new APIFileContextTracker(this.taskId)

// Or disable file tracking for stateless API
this.fileContextTracker = new NoOpFileContextTracker(this.taskId)
```

## Implementation Strategy

### Phase 1: Extend IProvider Interface

Add context-agnostic methods to IProvider:

```typescript
interface IProvider {
	// ... existing methods

	// Context-agnostic equivalents
	getGlobalStoragePath(): string
	createUrlContentFetcher(): IUrlContentFetcher
	createBrowserSession(): IBrowserSession
	createFileContextTracker(taskId: string): IFileContextTracker
}
```

### Phase 2: Update Task Class

Modify Task constructor to use provider methods instead of direct context access:

```typescript
// Instead of: provider.context.globalStorageUri.fsPath
this.globalStoragePath = provider.getGlobalStoragePath()

// Instead of: new UrlContentFetcher(provider.context)
this.urlContentFetcher = provider.createUrlContentFetcher()

// Instead of: new BrowserSession(provider.context)
this.browserSession = provider.createBrowserSession()

// Instead of: new FileContextTracker(provider, taskId)
this.fileContextTracker = provider.createFileContextTracker(this.taskId)
```

### Phase 3: Implement Provider-Specific Factories

Each provider implements the factory methods according to their runtime:

- **VSCodeProvider**: Delegates to existing VS Code implementations
- **FileSystemProvider**: Uses file system and Node.js implementations
- **MemoryProvider**: Uses in-memory or temporary implementations

## Benefits of This Approach

1. **Maintains Abstraction**: IProvider remains context-agnostic
2. **Runtime Appropriate**: Each implementation uses appropriate technologies
3. **Backward Compatible**: VS Code extension behavior unchanged
4. **Testable**: Easy to mock provider factory methods
5. **Flexible**: Can add new runtimes by implementing factory methods

## Migration Path

1. Add factory methods to IProvider interface
2. Implement factory methods in each provider
3. Update Task class to use factory methods
4. Test each runtime independently
5. Remove direct context dependencies
