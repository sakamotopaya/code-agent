# Final Architecture Decision: Should All Modes Use ClineProvider?

## The Core Question

Currently:

- **VSCode**: `new Task({ provider: clineProviderInstance })` - Gets ALL the logic
- **CLI**: `Task.create({ provider: undefined })` - Gets minimal logic
- **API**: `Task.create({ provider: undefined, userInterface: sseAdapter })` - Gets minimal logic

**Should all modes use ClineProvider with injected IOutputAdapter?**

## The Answer: Yes, but with Refactoring

All modes should benefit from ClineProvider's comprehensive logic, but ClineProvider is currently too VSCode-specific. We need to refactor it.

## Proposed Solution: Core Provider + Mode-Specific Extensions

### 1. Extract Core Business Logic

Create a base `CoreProvider` class that contains all the valuable business logic:

```typescript
// src/core/provider/CoreProvider.ts
export class CoreProvider {
	constructor(
		protected context: IProviderContext, // Abstracted context
		protected outputAdapter: IOutputAdapter,
		protected telemetry: ITelemetryService,
		// ... other dependencies
	) {}

	// All the valuable logic from ClineProvider:
	async getState() {
		/* ... */
	}
	async updateGlobalState(key: string, value: any) {
		/* ... */
	}
	async updateTaskHistory(item: HistoryItem) {
		/* ... */
	}
	async createTaskInstance(config: TaskConfig) {
		/* ... */
	}

	// Task lifecycle management
	async addTaskToStack(task: Task) {
		/* ... */
	}
	async removeTaskFromStack() {
		/* ... */
	}
	getCurrentTask(): Task | undefined {
		/* ... */
	}

	// MCP integration
	async initializeMcpHub() {
		/* ... */
	}

	// Settings management
	async loadConfiguration() {
		/* ... */
	}
	async saveConfiguration() {
		/* ... */
	}
}
```

### 2. Mode-Specific Providers

Each mode extends CoreProvider or uses it directly:

```typescript
// VSCode Provider (extends with VSCode-specific functionality)
export class ClineProvider extends CoreProvider implements vscode.WebviewViewProvider {
	constructor(
		context: vscode.ExtensionContext,
		outputChannel: vscode.OutputChannel,
		// ...
	) {
		const outputAdapter = new VSCodeOutputAdapter(/* VSCode-specific setup */)
		const providerContext = new VSCodeProviderContext(context)
		super(providerContext, outputAdapter, telemetry)
	}

	// VSCode-specific methods
	resolveWebviewView(webviewView: vscode.WebviewView) {
		/* ... */
	}
	// ... other VSCode-specific functionality
}

// CLI Provider (uses CoreProvider directly)
export class CLIProvider extends CoreProvider {
	constructor(options: CLIOptions) {
		const outputAdapter = new CLIOutputAdapter(options.globalStoragePath)
		const providerContext = new CLIProviderContext(options)
		super(providerContext, outputAdapter, telemetry)
	}
}

// API Provider (uses CoreProvider directly)
export class APIProvider extends CoreProvider {
	constructor(sseAdapter: SSEOutputAdapter, options: APIOptions) {
		const outputAdapter = new APIOutputAdapter(sseAdapter)
		const providerContext = new APIProviderContext(options)
		super(providerContext, outputAdapter, telemetry)
	}
}
```

### 3. Unified Task Creation

All modes now create tasks the same way:

```typescript
// VSCode Mode
const clineProvider = new ClineProvider(context, outputChannel, ...)
const task = await clineProvider.createTaskInstance({ task: "user request" })

// CLI Mode
const cliProvider = new CLIProvider({ globalStoragePath: "~/.agentz", ... })
const task = await cliProvider.createTaskInstance({ task: "user request" })

// API Mode
const apiProvider = new APIProvider(sseAdapter, { ... })
const task = await apiProvider.createTaskInstance({ task: "user request" })
```

### 4. Abstracted Context Interface

```typescript
interface IProviderContext {
	getGlobalStoragePath(): string
	getWorkspacePath(): string
	getExtensionPath(): string

	// Persistence
	getGlobalState(key: string): any
	updateGlobalState(key: string, value: any): Promise<void>

	// Settings
	getConfiguration(): any
	updateConfiguration(config: any): Promise<void>
}

class VSCodeProviderContext implements IProviderContext {
	constructor(private context: vscode.ExtensionContext) {}

	getGlobalStoragePath(): string {
		return this.context.globalStorageUri.fsPath
	}

	getGlobalState(key: string): any {
		return this.context.globalState.get(key)
	}

	async updateGlobalState(key: string, value: any): Promise<void> {
		await this.context.globalState.update(key, value)
	}
}

class CLIProviderContext implements IProviderContext {
	constructor(private options: CLIOptions) {}

	getGlobalStoragePath(): string {
		return this.options.globalStoragePath || path.join(os.homedir(), ".agentz")
	}

	getGlobalState(key: string): any {
		// Load from JSON file
		return this.loadFromFile(key)
	}

	async updateGlobalState(key: string, value: any): Promise<void> {
		// Save to JSON file
		await this.saveToFile(key, value)
	}
}
```

## Final Architecture Flow

### All Modes Follow Same Pattern:

1. **Create Provider**: Mode-specific provider with injected IOutputAdapter
2. **Provider Creates Task**: Using comprehensive business logic
3. **Task Uses Provider**: For all state management, persistence, communication
4. **Provider Uses OutputAdapter**: For mode-specific output

### Benefits:

1. **Unified Logic**: All modes get ClineProvider's comprehensive functionality
2. **Mode Flexibility**: Each mode implements output/storage appropriately
3. **Consistent Behavior**: State management, task history, settings work the same
4. **Clean Abstraction**: Core business logic separated from platform-specific code
5. **Easy Testing**: Can inject mock adapters and contexts

### Implementation Steps:

1. **Extract CoreProvider** from ClineProvider
2. **Create IProviderContext** interface and implementations
3. **Update ClineProvider** to extend CoreProvider
4. **Create CLIProvider and APIProvider** classes
5. **Update Task creation** in all modes to use providers
6. **Implement mode-specific IOutputAdapter** classes

This architecture ensures all modes benefit from the same comprehensive business logic while maintaining appropriate mode-specific implementations.
