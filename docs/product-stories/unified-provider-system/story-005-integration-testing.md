# Story 005: Integration and Testing

## Overview

Integrate the unified provider system across all execution contexts and implement comprehensive testing to ensure the mode parameter issue is resolved and all contexts work consistently.

## Acceptance Criteria

### System Integration

- [ ] Task class uses IProvider interface exclusively
- [ ] getEnvironmentDetails uses provider for mode information
- [ ] All execution contexts (Extension, CLI, API) use appropriate providers
- [ ] Mode parameter works correctly in all contexts
- [ ] No regression in existing functionality

### Testing Coverage

- [ ] Unit tests for all provider implementations
- [ ] Integration tests across all execution contexts
- [ ] End-to-end tests for mode parameter functionality
- [ ] Performance tests for provider operations
- [ ] Regression tests for existing features

### Documentation

- [ ] Provider system architecture documentation
- [ ] Migration guide for existing configurations
- [ ] API documentation for provider interfaces
- [ ] Troubleshooting guide for common issues
- [ ] Performance tuning recommendations

## Technical Requirements

### Core Integration Changes

#### Task Class Updates

```typescript
// src/core/task/Task.ts
export class Task extends EventEmitter {
	private provider?: IProvider

	constructor(options: TaskOptions) {
		super()

		// Use provider from options or create appropriate provider
		this.provider = options.provider || (await ProviderFactory.createProvider())

		// Initialize provider
		await this.provider.initialize()

		// Use provider for mode instead of direct property
		this.mode = await this.provider.getCurrentMode()
	}

	async getCurrentMode(): Promise<string> {
		return this.provider ? await this.provider.getCurrentMode() : this.mode
	}

	async setMode(mode: string): Promise<void> {
		if (this.provider) {
			await this.provider.setMode(mode)
			this.mode = mode
			this.emit("modeChanged", mode)
		}
	}
}
```

#### Environment Details Updates

```typescript
// src/core/environment/getEnvironmentDetails.ts
export async function getEnvironmentDetails(cline: Task, includeFileDetails: boolean = false) {
	// ... existing code ...

	// Get mode from provider instead of provider state
	const provider = cline.getProvider()
	const currentMode = provider ? await provider.getCurrentMode() : cline.mode || defaultModeSlug

	// Get provider state for other settings
	const state = provider ? await provider.getState() : {}

	// ... rest of function uses currentMode and state ...
}
```

#### API Server Updates

```typescript
// src/api/server/FastifyServer.ts
export class FastifyServer {
	private async handleTaskRequest(request: TaskRequest): Promise<void> {
		// Create appropriate provider for API context
		const provider = await ProviderFactory.createProvider(ProviderType.Memory, {
			defaultState: {
				mode: request.mode || "code",
				apiConfiguration: request.apiConfiguration,
				// ... other settings
			},
		})

		const taskOptions = {
			provider,
			task: request.task,
			mode: request.mode, // Still pass mode for backward compatibility
			// ... other options
		}

		const [taskInstance, taskPromise] = Task.create(taskOptions)
		// ... rest of handling
	}
}
```

#### CLI Updates

```typescript
// src/cli/index.ts
export async function runCLI(args: CLIArgs): Promise<void> {
	// Create filesystem provider for CLI
	const provider = await ProviderFactory.createProvider(ProviderType.FileSystem, {
		configPath: args.configPath,
	})

	// Set mode if specified in args
	if (args.mode) {
		await provider.setMode(args.mode)
	}

	const taskOptions = {
		provider,
		task: args.task,
		mode: await provider.getCurrentMode(),
		// ... other options
	}

	const [taskInstance, taskPromise] = Task.create(taskOptions)
	// ... rest of CLI execution
}
```

### Provider Factory Implementation

```typescript
// src/core/providers/ProviderFactory.ts
export class ProviderFactory {
	static async createProvider(type?: ProviderType, options?: any): Promise<IProvider> {
		const providerType = type || this.detectProviderType()

		switch (providerType) {
			case ProviderType.VSCode:
				const { VSCodeProvider } = await import("./VSCodeProvider")
				return new VSCodeProvider(options?.context)

			case ProviderType.FileSystem:
				const { FileSystemProvider } = await import("./FileSystemProvider")
				return new FileSystemProvider(options?.configPath)

			case ProviderType.Memory:
				const { MemoryProvider } = await import("./MemoryProvider")
				return new MemoryProvider(options)

			default:
				throw new Error(`Unsupported provider type: ${providerType}`)
		}
	}

	static detectProviderType(): ProviderType {
		// Detect based on environment
		if (typeof vscode !== "undefined") {
			return ProviderType.VSCode
		} else if (process.env.NODE_ENV === "cli") {
			return ProviderType.FileSystem
		} else {
			return ProviderType.Memory
		}
	}
}
```

## Testing Strategy

### Unit Tests

#### Provider Interface Tests

```typescript
// src/core/providers/__tests__/IProvider.test.ts
describe("IProvider Interface", () => {
	const providers = [
		() => new VSCodeProvider(mockContext),
		() => new FileSystemProvider("/tmp/test-config"),
		() => new MemoryProvider(),
	]

	providers.forEach((createProvider, index) => {
		describe(`Provider ${index}`, () => {
			let provider: IProvider

			beforeEach(async () => {
				provider = createProvider()
				await provider.initialize()
			})

			afterEach(async () => {
				await provider.dispose()
			})

			test("implements all interface methods", () => {
				expect(provider.getState).toBeDefined()
				expect(provider.updateState).toBeDefined()
				expect(provider.getCurrentMode).toBeDefined()
				expect(provider.setMode).toBeDefined()
				// ... test all methods
			})

			test("mode management works correctly", async () => {
				await provider.setMode("test-mode")
				const mode = await provider.getCurrentMode()
				expect(mode).toBe("test-mode")
			})

			test("state persistence works", async () => {
				await provider.updateState("autoApprovalEnabled", true)
				const state = await provider.getState()
				expect(state.autoApprovalEnabled).toBe(true)
			})
		})
	})
})
```

#### Mode Parameter Tests

```typescript
// src/core/task/__tests__/mode-parameter.test.ts
describe("Mode Parameter Functionality", () => {
	test("API mode parameter works correctly", async () => {
		const provider = new MemoryProvider({
			defaultState: { mode: "ticket-oracle" },
		})

		const task = new Task({
			provider,
			task: "what is your current mode",
			mode: "ticket-oracle",
		})

		const envDetails = await getEnvironmentDetails(task)
		expect(envDetails).toContain("<slug>ticket-oracle</slug>")
	})

	test("CLI mode persistence works", async () => {
		const configPath = "/tmp/test-cli-config.json"
		const provider = new FileSystemProvider(configPath)

		await provider.setMode("architect")

		// Create new provider instance (simulating CLI restart)
		const newProvider = new FileSystemProvider(configPath)
		await newProvider.initialize()

		const mode = await newProvider.getCurrentMode()
		expect(mode).toBe("architect")
	})

	test("Extension mode works unchanged", async () => {
		const mockContext = createMockVSCodeContext()
		const provider = new VSCodeProvider(mockContext)

		await provider.setMode("debug")

		const task = new Task({
			provider,
			task: "test task",
		})

		const mode = await task.getCurrentMode()
		expect(mode).toBe("debug")
	})
})
```

### Integration Tests

#### Cross-Context Tests

```typescript
// src/__tests__/integration/cross-context.test.ts
describe("Cross-Context Integration", () => {
	test("all contexts handle mode parameter correctly", async () => {
		const testCases = [
			{
				name: "Extension",
				provider: new VSCodeProvider(mockContext),
				expectedMode: "code",
			},
			{
				name: "CLI",
				provider: new FileSystemProvider("/tmp/cli-test"),
				expectedMode: "architect",
			},
			{
				name: "API",
				provider: new MemoryProvider({ defaultState: { mode: "ticket-oracle" } }),
				expectedMode: "ticket-oracle",
			},
		]

		for (const testCase of testCases) {
			await testCase.provider.setMode(testCase.expectedMode)

			const task = new Task({
				provider: testCase.provider,
				task: "what is your current mode",
			})

			const envDetails = await getEnvironmentDetails(task)
			expect(envDetails).toContain(`<slug>${testCase.expectedMode}</slug>`)
		}
	})
})
```

### End-to-End Tests

#### API Mode Parameter Test

```typescript
// src/__tests__/e2e/api-mode-parameter.test.ts
describe("API Mode Parameter E2E", () => {
	test("API correctly reports custom mode", async () => {
		const response = await request(app)
			.post("/api/tasks")
			.send({
				task: "what is your current mode",
				mode: "ticket-oracle",
			})
			.expect(200)

		// Verify the response contains the correct mode
		expect(response.body.messages).toContain("ticket-oracle")
		expect(response.body.messages).not.toContain("💻 Code")
	})
})
```

### Performance Tests

#### Provider Performance

```typescript
// src/__tests__/performance/provider-performance.test.ts
describe("Provider Performance", () => {
	test("provider operations are fast enough", async () => {
		const provider = new MemoryProvider()
		await provider.initialize()

		const start = performance.now()

		// Perform 1000 operations
		for (let i = 0; i < 1000; i++) {
			await provider.updateState("mode", `test-mode-${i}`)
			await provider.getCurrentMode()
		}

		const end = performance.now()
		const duration = end - start

		// Should complete in under 100ms
		expect(duration).toBeLessThan(100)
	})
})
```

## Migration Strategy

### Backward Compatibility

1. **Extension**: No changes required for existing users
2. **CLI**: Automatic migration of existing config files
3. **API**: Maintains existing request format

### Migration Steps

1. Deploy provider system with feature flags
2. Gradually enable for new installations
3. Migrate existing configurations
4. Remove legacy code after validation

### Rollback Plan

1. Feature flags allow instant rollback
2. Legacy code remains available during transition
3. Configuration backups enable data recovery
4. Monitoring alerts on provider failures

## Monitoring and Observability

### Metrics to Track

- Provider initialization success rate
- Mode parameter accuracy across contexts
- Provider operation performance
- Configuration migration success rate
- Error rates by provider type

### Logging Strategy

- Provider lifecycle events
- Mode changes and their sources
- Configuration loading/saving operations
- Performance metrics for provider operations
- Error details for debugging

## Dependencies

- Stories 001-004: All provider implementations must be complete
- Testing framework setup
- Monitoring infrastructure
- Documentation platform

## Definition of Done

- [ ] All provider implementations are integrated
- [ ] Mode parameter works correctly in all contexts
- [ ] getEnvironmentDetails uses provider for mode information
- [ ] All unit tests pass with 95%+ coverage
- [ ] Integration tests verify cross-context functionality
- [ ] End-to-end tests confirm mode parameter fix
- [ ] Performance tests meet requirements
- [ ] No regression in existing functionality
- [ ] Migration strategy is tested and documented
- [ ] Monitoring and alerting are in place
- [ ] Documentation is complete and reviewed
- [ ] Code review approved by all teams
- [ ] Feature flags are ready for gradual rollout
