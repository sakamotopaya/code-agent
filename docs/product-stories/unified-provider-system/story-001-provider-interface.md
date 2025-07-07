# Story 001: Provider Interface Definition

## Overview

Define the core `IProvider` interface and provider factory pattern that will be implemented by all execution contexts.

## Acceptance Criteria

### Interface Definition

- [ ] Create `IProvider` interface with all required methods
- [ ] Define `ProviderState` type for consistent state structure
- [ ] Create `ProviderType` enum for different execution contexts
- [ ] Add comprehensive TypeScript documentation

### Provider Factory

- [ ] Implement `ProviderFactory` class with context detection
- [ ] Support automatic provider selection based on environment
- [ ] Add manual provider override capability
- [ ] Include error handling for unsupported contexts

### Type Safety

- [ ] All provider methods are strongly typed
- [ ] State schema is validated at runtime
- [ ] Configuration types are consistent across providers
- [ ] Generic types support custom state extensions

## Technical Requirements

### Core Interface

```typescript
interface IProvider {
	// Identification
	readonly type: ProviderType
	readonly isInitialized: boolean

	// State management
	getState(): Promise<ProviderState>
	updateState(key: keyof ProviderState, value: any): Promise<void>
	setState(state: Partial<ProviderState>): Promise<void>

	// Mode management
	getCurrentMode(): string
	setMode(mode: string): Promise<void>
	getModeHistory(): string[]

	// Configuration
	getApiConfiguration(): ProviderSettings
	setApiConfiguration(config: ProviderSettings): Promise<void>
	listApiConfigurations(): Promise<ProviderSettingsEntry[]>

	// Storage
	getStoragePath(): string
	getGlobalStoragePath(): string

	// Lifecycle
	initialize(): Promise<void>
	dispose(): Promise<void>

	// Events
	on(event: ProviderEvent, listener: (...args: any[]) => void): void
	off(event: ProviderEvent, listener: (...args: any[]) => void): void
	emit(event: ProviderEvent, ...args: any[]): void
}
```

### Provider State Schema

```typescript
interface ProviderState {
	// Core settings
	mode: string
	apiConfiguration: ProviderSettings

	// User preferences
	autoApprovalEnabled: boolean
	alwaysApproveResubmit: boolean
	requestDelaySeconds: number

	// Context settings
	autoCondenseContext: boolean
	autoCondenseContextPercent: number

	// UI settings (extension-specific)
	maxOpenTabsContext?: number
	terminalOutputLineLimit?: number
	maxWorkspaceFiles?: number
	showRooIgnoredFiles?: boolean

	// Custom settings
	customInstructions?: string
	language?: string
	experiments?: Record<string, boolean>

	// Mode configurations
	customModes?: any[]
	customModePrompts?: any[]

	// Session data
	lastUsed?: Date
	sessionId?: string
}
```

### Provider Factory

```typescript
class ProviderFactory {
	static async createProvider(type?: ProviderType): Promise<IProvider>
	static detectProviderType(): ProviderType
	static registerProvider(type: ProviderType, factory: () => IProvider): void
}
```

## Implementation Details

### File Structure

```
src/core/providers/
├── IProvider.ts              # Core interface
├── ProviderFactory.ts        # Factory implementation
├── ProviderState.ts          # State type definitions
├── ProviderEvents.ts         # Event type definitions
├── BaseProvider.ts           # Shared implementation
└── __tests__/
    ├── IProvider.test.ts
    └── ProviderFactory.test.ts
```

### Error Handling

- Provider initialization failures should be graceful
- Invalid state should trigger validation errors
- Missing configurations should use sensible defaults
- Provider disposal should clean up resources

### Event System

```typescript
type ProviderEvent = "stateChanged" | "modeChanged" | "configurationChanged" | "initialized" | "disposed"
```

## Testing Requirements

### Unit Tests

- [ ] Interface compliance tests for all methods
- [ ] Provider factory context detection
- [ ] State validation and type safety
- [ ] Event system functionality

### Integration Tests

- [ ] Provider factory creates correct provider types
- [ ] State persistence across provider lifecycle
- [ ] Event propagation between components
- [ ] Error handling in edge cases

## Dependencies

- TypeScript 4.5+ for advanced type features
- Event emitter implementation
- JSON schema validation library
- Existing ProviderSettings types

## Definition of Done

- [ ] All interfaces are defined with comprehensive TypeScript types
- [ ] Provider factory can detect and create appropriate providers
- [ ] State schema is validated and documented
- [ ] Event system is implemented and tested
- [ ] All unit tests pass with 100% coverage
- [ ] Integration tests verify factory behavior
- [ ] Documentation is complete with examples
- [ ] Code review approved by team
