# Task Data Layer Integration

This document shows how the Task class integrates with the data layer abstraction, enabling both backwards compatibility and external application integration.

## Overview

The Task class now supports optional data layer integration through dependency injection. This allows:

- **Backwards Compatibility**: Existing Task usage continues unchanged
- **Native Mode**: VS Code extension can use native repositories
- **External Mode**: NPM package users can inject their own data layer implementations
- **Runtime Detection**: Code can safely check for data layer availability

## Task Integration API

### Constructor Options

```typescript
export type TaskOptions = {
	// ... existing options
	repositories?: RepositoryContainer // NEW: Optional data layer
}
```

### Task Instance Methods

```typescript
class Task {
	// Check if data layer is available
	get hasDataLayer(): boolean

	// Safe access to repositories (undefined if not available)
	get dataRepositories(): RepositoryContainer | undefined

	// ... existing methods
}
```

## Usage Patterns

### 1. Legacy Usage (Unchanged)

```typescript
// Existing code continues to work exactly the same
const task = new Task({
	apiConfiguration,
	task: "Implement a new feature",
	fileSystem: adapters.fileSystem,
	terminal: adapters.terminal,
	browser: adapters.browser,
})

// No data layer integration - traditional behavior
console.log(task.hasDataLayer) // false
```

### 2. Native Mode (VS Code Extension)

```typescript
import { createNativeRepositoryContainer } from "@code-agent/data"

// Create native repositories using existing services
const repositories = await createNativeRepositoryContainer({
	workspaceStorageService: vscodeStorageService,
	conversationStorageService: historyStorageService,
	providerStorageService: settingsStorageService,
	contextStorageService: contextService,
	taskStorageService: taskService,
})

// Inject repositories into Task
const task = new Task({
	apiConfiguration,
	task: "Implement a new feature",
	repositories, // ✨ Data layer integration
	// ... other options
})

// Now task has data layer access
if (task.hasDataLayer) {
	// Can persist task state, track conversations, etc.
	const taskRepo = task.dataRepositories?.task
	await taskRepo?.create({
		workspaceId: "workspace-123",
		type: "conversation",
		name: "Feature Implementation",
		// ...
	})
}
```

### 3. External Mode (NPM Package Integration)

```typescript
import { createExternalRepositoryContainer } from "code-agent"

// External application implements data adapter
class MyAppDataAdapter implements IExternalDataAdapter {
	constructor(private database: MyDatabase) {}

	async read<T>(collection: string, id: string): Promise<T | null> {
		// Query their database
		return await this.database.query(`SELECT * FROM ${collection} WHERE id = ?`, [id])
	}

	async create<T>(collection: string, data: any): Promise<T> {
		// Insert into their database
		return await this.database.insert(collection, data)
	}

	// ... other methods
}

// Create repositories using their adapter
const repositories = await createExternalRepositoryContainer(new MyAppDataAdapter(myDatabase), "/path/to/workspace")

// Create Task with external data layer
const task = new Task({
	apiConfiguration,
	task: "Analyze codebase",
	repositories, // ✨ Their data layer
	// ... other options
})

// All data operations now flow through their system
console.log(task.hasDataLayer) // true
```

## Safe Data Layer Usage

### In Tools and Services

```typescript
// Tools can safely check for data layer availability
export class SomeTaskTool {
	async execute(task: Task) {
		// Safe to use traditional approach
		const result = await this.performOperation()

		// Optionally enhance with data layer
		if (task.hasDataLayer) {
			const taskRepo = task.dataRepositories?.task
			if (taskRepo) {
				await taskRepo.addTaskLog(task.taskId, {
					timestamp: new Date(),
					level: "info",
					message: "Operation completed",
					context: { result },
				})
			}
		}

		return result
	}
}
```

### In Task Event Handlers

```typescript
task.on("taskCompleted", async (taskId, tokenUsage, toolUsage) => {
	// Traditional completion handling
	console.log(`Task ${taskId} completed`)

	// Enhanced with data layer tracking
	if (task.hasDataLayer) {
		const taskRepo = task.dataRepositories?.task
		if (taskRepo) {
			await taskRepo.completeTask(taskId, {
				success: true,
				metrics: { tokenUsage, toolUsage },
				completedAt: new Date(),
			})
		}
	}
})
```

## Data Layer Lifecycle

### Initialization

```typescript
// Repositories are initialized before being injected
const repositories = await createExternalRepositoryContainer(adapter, workspace)
await repositories.initialize() // Ensures all repositories are ready

const task = new Task({ repositories /* ... */ })
```

### Cleanup

```typescript
// Task disposal includes repository cleanup
await task.dispose() // Automatically calls repositories.dispose()
```

## Benefits for Different Use Cases

### VS Code Extension Benefits

- **Gradual Migration**: Can enable data layer features incrementally
- **Enhanced Persistence**: Rich conversation and task tracking
- **Better Analytics**: Detailed usage metrics and history
- **Improved UX**: More sophisticated state management

### NPM Package Benefits

- **Data Ownership**: External apps control all data storage
- **Integration**: Seamless integration with existing app databases
- **Customization**: Full control over data schemas and operations
- **Compliance**: Meet specific data residency/security requirements

### CLI Benefits

- **Flexibility**: Can work with or without data persistence
- **Adaptability**: Can connect to different backends as needed
- **Scalability**: Can integrate with enterprise data systems

## Migration Guide

### For Existing VS Code Extension

1. **Phase 1**: No changes needed - everything continues working
2. **Phase 2**: Optionally create native repositories and inject them
3. **Phase 3**: Gradually enhance features to use data layer when available

### For NPM Package Users

1. **Implement IExternalDataAdapter** for your data system
2. **Create repository container** using your adapter
3. **Inject repositories** into Task instances
4. **Enjoy full data integration** with your application

## Error Handling

```typescript
// Robust error handling
try {
	const repositories = await createExternalRepositoryContainer(adapter, workspace)
	await repositories.initialize()

	const task = new Task({ repositories /* ... */ })

	// Use task normally - data layer failures don't break core functionality
} catch (error) {
	console.warn("Data layer initialization failed, falling back to legacy mode:", error)

	// Create task without repositories - everything still works
	const task = new Task({
		/* no repositories */
	})
}
```

## Summary

The Task data layer integration provides:

✅ **Backwards Compatibility** - Zero breaking changes  
✅ **Optional Enhancement** - Data layer features when available  
✅ **Flexible Architecture** - Works in all deployment scenarios  
✅ **Type Safety** - Full TypeScript support with safe access patterns  
✅ **Clean Separation** - Core functionality independent of data layer  
✅ **Enterprise Ready** - Supports external application requirements

This architecture enables code-agent to work as both a standalone VS Code extension and as an NPM package dependency with full data layer integration.
