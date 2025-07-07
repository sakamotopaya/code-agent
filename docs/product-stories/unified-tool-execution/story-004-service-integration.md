# Story 004: UnifiedCustomModesService Integration

## Epic

Epic 2: Unified Service Integration

## Story Title

Integrate UnifiedCustomModesService across all execution contexts and update tools to use unified service

## User Story

**As a user in any context (VSCode, CLI, API)**, I want custom modes to work consistently and display the same information, **so that** I have a unified experience regardless of how I access the system.

## Acceptance Criteria

### Service Integration Across Contexts

- [ ] `UnifiedCustomModesService` injected into Task constructor for all contexts
- [ ] CLI creates and passes service instance to Task
- [ ] API creates and passes service instance to Task
- [ ] VSCode continues using existing service instance
- [ ] Service properly configured for each context (storage paths, file watching)

### Tool Updates

- [ ] `listModesTool` uses `UnifiedCustomModesService.getAllModes()` instead of placeholder
- [ ] `switchModeTool` uses service for mode validation
- [ ] `newTaskTool` uses service for mode selection
- [ ] All mode-related tools use consistent service interface

### Custom Modes Functionality

- [ ] Global custom modes work in all contexts
- [ ] Project-specific modes work in CLI/API when workspace is available
- [ ] Mode filtering works consistently across contexts
- [ ] Custom mode metadata displays properly in all contexts

### Service Configuration

- [ ] CLI configures service with appropriate storage path and no file watching
- [ ] API configures service with appropriate storage path and optional file watching
- [ ] VSCode maintains existing configuration with file watching enabled
- [ ] Service gracefully handles missing storage directories

## Technical Requirements

### Task Constructor Enhancement

```typescript
interface TaskOptions {
    // ... existing options
    customModesService?: UnifiedCustomModesService
}

constructor(options: TaskOptions) {
    // ... existing constructor
    this.customModesService = options.customModesService
}
```

### Context-Specific Service Creation

#### CLI Service Creation

```typescript
// In src/cli/index.ts
const customModesService = new UnifiedCustomModesService({
	storagePath: getStoragePath(),
	fileWatcher: new NoOpFileWatcher(), // No file watching in CLI
	enableProjectModes: !!workspacePath,
	workspacePath,
})
```

#### API Service Creation

```typescript
// In src/api/server/FastifyServer.ts (already exists, needs Task integration)
this.customModesService = new UnifiedCustomModesService({
	storagePath: process.env.ROO_GLOBAL_STORAGE_PATH || getStoragePath(),
	fileWatcher: new NodeFileWatcher(), // File watching enabled for API
	enableProjectModes: false, // API typically doesn't have workspace context
})
```

### Tool Implementation Updates

#### listModesTool Update

```typescript
// Replace getCustomModesForContext placeholder
async function getCustomModesForContext(cline: Task): Promise<ModeConfig[]> {
	if (cline.customModesService) {
		return await cline.customModesService.getAllModes()
	}

	// Fallback to built-in modes only
	const { getAllModes } = await import("../../shared/modes")
	return getAllModes([])
}
```

## Dependencies

### Internal Dependencies

- `UnifiedCustomModesService` (existing)
- `NoOpFileWatcher` for CLI context
- `NodeFileWatcher` for API context
- `VSCodeFileWatcher` for VSCode context (existing)
- All mode-related tools

### External Dependencies

- None

## Testing Strategy

### Unit Tests

- Test service injection into Task constructor
- Test tool behavior with and without service
- Test service configuration for each context
- Mock service to test tool integration

### Integration Tests

- Test custom modes loading in CLI context
- Test custom modes loading in API context
- Test mode filtering across contexts
- Test project vs global mode precedence

### End-to-End Tests

- Create custom mode and verify it appears in all contexts
- Test `list_modes` tool in all contexts with custom modes
- Test mode switching with custom modes
- Verify consistent mode information display

### Test Files

- `src/core/tools/__tests__/listModesTool-service-integration.test.ts`
- `src/cli/__tests__/custom-modes-integration.test.ts`
- `src/api/__tests__/custom-modes-integration.test.ts`

## Implementation Steps

### Step 1: Task Constructor Enhancement

- Add `customModesService` parameter to TaskOptions
- Update Task constructor to store service reference
- Update all Task creation sites to pass service

### Step 2: CLI Service Integration

- Update CLI Task creation to pass service instance
- Configure service appropriately for CLI context
- Test CLI custom modes functionality

### Step 3: API Service Integration

- Update API Task creation to pass existing service instance
- Verify service configuration for API context
- Test API custom modes functionality

### Step 4: Tool Updates

- Update `listModesTool` to use service
- Update other mode-related tools
- Remove placeholder implementations

### Step 5: Validation

- Test custom modes work in all contexts
- Verify consistent behavior across contexts
- Performance and reliability testing

## Risk Mitigation

### Medium Risk: Service Configuration Issues

- **Mitigation**: Comprehensive testing of service configuration
- **Mitigation**: Graceful fallback when service unavailable
- **Mitigation**: Clear error messages for configuration problems

### Low Risk: File Watching Performance

- **Mitigation**: Use NoOpFileWatcher in CLI to avoid overhead
- **Mitigation**: Configure file watching appropriately per context
- **Mitigation**: Monitor file watching performance impact

### Low Risk: Storage Path Issues

- **Mitigation**: Validate storage paths exist and are writable
- **Mitigation**: Graceful degradation when storage unavailable
- **Mitigation**: Clear error messages for storage issues

## Implementation Notes

### Context-Specific Considerations

- **CLI**: No file watching needed, may have workspace context
- **API**: Optional file watching, typically no workspace context
- **VSCode**: Full file watching, workspace context available

### Service Lifecycle

- Service should be created once per context
- Service should be properly disposed when context ends
- Service should handle concurrent access gracefully

### Error Handling

- Graceful fallback to built-in modes when service fails
- Clear error messages for service configuration issues
- Logging for debugging service integration problems

### Performance Considerations

- Service caching should work across tool calls
- File watching should not impact CLI performance
- Service initialization should not block Task creation

## Definition of Done

- [ ] All acceptance criteria met
- [ ] `UnifiedCustomModesService` integrated in all contexts
- [ ] `listModesTool` uses service and displays custom modes
- [ ] Custom modes work consistently across CLI, API, and VSCode
- [ ] No breaking changes to existing functionality
- [ ] Unit and integration tests passing
- [ ] Code review completed
- [ ] Documentation updated

## Estimated Effort

**3 story points** (2-3 days)

## Priority

**High** - Resolves the immediate `list_modes` issue and provides foundation for consistent mode handling

## Related Stories

- Story 001: Context-Aware Tool Interface Adapters
- Story 002: CLI Tool Execution Integration
- Story 003: API Tool Execution Integration

## Success Metrics

- Custom modes display consistently across all contexts
- `list_modes` tool shows same information in CLI, API, and VSCode
- No performance degradation in any context
- Custom mode creation/editing works from any context
