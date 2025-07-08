# Story 002: VSCode Provider Refactoring

## Overview

Refactor the existing `ClineProvider` to implement the `IProvider` interface while maintaining full backward compatibility with the VS Code extension.

## Acceptance Criteria

### Interface Implementation

- [ ] `ClineProvider` implements `IProvider` interface completely
- [ ] All existing functionality is preserved
- [ ] No breaking changes to extension API
- [ ] State management is consistent with interface

### Backward Compatibility

- [ ] Existing extension users see no behavior changes
- [ ] All webview messaging continues to work
- [ ] VS Code settings integration remains intact
- [ ] Extension activation/deactivation works normally

### Code Quality

- [ ] Remove duplicate state management code
- [ ] Improve type safety throughout provider
- [ ] Add comprehensive error handling
- [ ] Maintain performance characteristics

## Technical Requirements

### Wrapper Implementation

```typescript
class VSCodeProvider extends BaseProvider implements IProvider {
	private clineProvider: ClineProvider

	constructor(context: vscode.ExtensionContext) {
		super(ProviderType.VSCode)
		this.clineProvider = new ClineProvider(context)
	}

	// Implement IProvider methods by delegating to ClineProvider
	async getState(): Promise<ProviderState> {
		const state = await this.clineProvider.getState()
		return this.mapToProviderState(state)
	}

	// ... other interface methods
}
```

### State Mapping

- Map existing ClineProvider state to `ProviderState` schema
- Handle missing fields with sensible defaults
- Preserve all existing state data
- Add migration for new state fields

### Event Integration

- Integrate with existing ClineProvider event system
- Map ClineProvider events to `ProviderEvent` types
- Maintain webview message handling
- Preserve extension lifecycle events

## Implementation Details

### File Changes

```
src/core/webview/ClineProvider.ts     # Minimal changes, add interface compliance
src/core/providers/VSCodeProvider.ts  # New wrapper implementation
src/activate/registerCommands.ts     # Update to use IProvider interface
src/core/task/Task.ts                # Update to use IProvider interface
```

### Migration Strategy

1. **Phase 1**: Create VSCodeProvider wrapper around existing ClineProvider
2. **Phase 2**: Update Task class to use IProvider interface
3. **Phase 3**: Gradually move functionality from ClineProvider to VSCodeProvider
4. **Phase 4**: Deprecate direct ClineProvider usage (future story)

### State Schema Mapping

```typescript
private mapToProviderState(clineState: any): ProviderState {
    return {
        mode: clineState.mode || defaultModeSlug,
        apiConfiguration: clineState.apiConfiguration,
        autoApprovalEnabled: clineState.autoApprovalEnabled || false,
        alwaysApproveResubmit: clineState.alwaysApproveResubmit || false,
        requestDelaySeconds: clineState.requestDelaySeconds || 0,
        autoCondenseContext: clineState.autoCondenseContext ?? true,
        autoCondenseContextPercent: clineState.autoCondenseContextPercent || 100,

        // VS Code specific settings
        maxOpenTabsContext: clineState.maxOpenTabsContext,
        terminalOutputLineLimit: clineState.terminalOutputLineLimit,
        maxWorkspaceFiles: clineState.maxWorkspaceFiles,
        showRooIgnoredFiles: clineState.showRooIgnoredFiles,

        // Additional settings
        customInstructions: clineState.customInstructions,
        language: clineState.language,
        experiments: clineState.experiments,
        customModes: clineState.customModes,
        customModePrompts: clineState.customModePrompts,

        // Session data
        lastUsed: new Date(),
        sessionId: this.generateSessionId()
    }
}
```

### Error Handling

- Graceful fallbacks for missing VS Code APIs
- Validation of state data before mapping
- Error recovery for corrupted extension state
- Logging for debugging state issues

## Testing Requirements

### Unit Tests

- [ ] VSCodeProvider implements all IProvider methods
- [ ] State mapping preserves all existing data
- [ ] Event system integration works correctly
- [ ] Error handling covers edge cases

### Integration Tests

- [ ] Extension activation with VSCodeProvider
- [ ] Webview messaging through provider
- [ ] Task creation with provider interface
- [ ] State persistence across extension restarts

### Regression Tests

- [ ] All existing extension functionality works
- [ ] Performance is not degraded
- [ ] Memory usage remains stable
- [ ] Extension startup time unchanged

## Risk Mitigation

### Breaking Changes Risk

- Maintain existing ClineProvider API during transition
- Use feature flags for gradual rollout
- Extensive testing with real extension usage
- Rollback plan if issues are discovered

### Performance Risk

- Benchmark state access performance
- Minimize additional abstraction overhead
- Cache frequently accessed state
- Profile memory usage patterns

### Compatibility Risk

- Test with multiple VS Code versions
- Verify with different extension configurations
- Test with various workspace setups
- Validate with different operating systems

## Dependencies

- Story 001: Provider Interface Definition (must be complete)
- VS Code API compatibility
- Existing ClineProvider functionality
- Extension test suite

## Definition of Done

- [ ] VSCodeProvider implements IProvider interface completely
- [ ] All existing extension functionality preserved
- [ ] No performance regression detected
- [ ] All unit and integration tests pass
- [ ] Regression test suite passes 100%
- [ ] Code review approved by extension team
- [ ] Documentation updated for new provider usage
- [ ] Feature flag system ready for gradual rollout
