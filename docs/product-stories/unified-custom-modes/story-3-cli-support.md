# Story 3: CLI Custom Modes Support

## Overview

**As a** CLI user  
**I want** to specify custom modes via `--mode` parameter  
**So that** I can use specialized modes for different tasks

## Acceptance Criteria

- [ ] CLI loads custom modes from storage path on startup
- [ ] `--mode` parameter accepts custom mode slugs
- [ ] Mode validation includes both built-in and custom modes
- [ ] Clear error messages when invalid modes are specified
- [ ] No file watching overhead in CLI context
- [ ] Backward compatibility with existing built-in modes
- [ ] Help text updated to reflect custom mode support

## Technical Implementation

### Files to Modify

- `src/cli/index.ts` - Initialize UnifiedCustomModesService and update validation
- `src/cli/config/CliConfigManager.ts` - Integrate custom modes loading

### Current State

```typescript
// Current hardcoded validation in src/cli/index.ts
function validateMode(value: string): string {
	const validModes = [
		"code",
		"debug",
		"architect",
		"ask",
		"test",
		"design-engineer",
		"release-engineer",
		"translate",
		"product-owner",
		"orchestrator",
	]
	if (!validModes.includes(value)) {
		throw new Error(`Invalid mode: ${value}. Valid modes are: ${validModes.join(", ")}`)
	}
	return value
}
```

### Target State

```typescript
// Dynamic validation with custom modes
async function validateMode(value: string, customModesService: UnifiedCustomModesService): Promise<string> {
	const allModes = await customModesService.getAllModes()
	const validModes = allModes.map((m) => m.slug)

	if (!validModes.includes(value)) {
		throw new Error(`Invalid mode: ${value}. Valid modes are: ${validModes.join(", ")}`)
	}
	return value
}
```

### CLI Initialization

```typescript
// In src/cli/index.ts main action
const storagePath = getStoragePath()
const customModesService = new UnifiedCustomModesService({
	storagePath,
	fileWatcher: new NoOpFileWatcher(), // No file watching in CLI
	enableProjectModes: true,
	workspacePath: options.cwd,
})

// Load modes for validation
await customModesService.loadCustomModes()
```

## User Experience

### Current CLI Usage

```bash
roo-cli --mode code "Fix this bug"
roo-cli --mode architect "Plan this feature"
```

### Enhanced CLI Usage

```bash
# Built-in modes (unchanged)
roo-cli --mode code "Fix this bug"
roo-cli --mode architect "Plan this feature"

# Custom modes (new capability)
roo-cli --mode product-owner "Create a PRD for user authentication"
roo-cli --mode ticket-oracle "What's the status of ticket 12345?"

# Error handling
roo-cli --mode invalid-mode "test"
# Error: Invalid mode: invalid-mode. Valid modes are: code, debug, architect, ask, test, design-engineer, release-engineer, translate, product-owner, orchestrator, ticket-oracle
```

### Help Text Updates

```bash
roo-cli --help

Options:
  --mode <mode>        Agent mode. Built-in modes: code, debug, architect, ask, test,
                       design-engineer, release-engineer, translate, product-owner, orchestrator.
                       Custom modes loaded from storage path. Use --list-modes to see all available modes.
```

## Technical Tasks

- [ ] Create NoOpFileWatcher implementation
- [ ] Update CLI initialization to create UnifiedCustomModesService
- [ ] Replace hardcoded mode validation with dynamic validation
- [ ] Update error messages to be more helpful
- [ ] Add custom modes loading to CliConfigManager
- [ ] Update help text and documentation
- [ ] Add CLI integration tests
- [ ] Test with various custom mode configurations
- [ ] Verify no performance regression from mode loading

## Error Handling

### Invalid Mode Specified

```bash
$ roo-cli --mode invalid-mode "test task"
Error: Invalid mode: invalid-mode.

Available modes:
  Built-in: code, debug, architect, ask, test, design-engineer, release-engineer, translate, product-owner, orchestrator
  Custom: ticket-oracle (from global), project-mode (from .roomodes)

Use one of the available modes or check your custom modes configuration.
```

### Custom Modes File Error

```bash
$ roo-cli --mode product-owner "test task"
Warning: Failed to load custom modes from /home/user/.agentz/settings/custom_modes.yaml: Invalid YAML format
Falling back to built-in modes only.

Error: Invalid mode: product-owner. Valid modes are: code, debug, architect, ask, test, design-engineer, release-engineer, translate, orchestrator
```

## Testing Strategy

### Unit Tests

- [ ] Mode validation with built-in modes
- [ ] Mode validation with custom modes
- [ ] Error handling for invalid modes
- [ ] Custom modes service initialization
- [ ] NoOpFileWatcher behavior

### Integration Tests

- [ ] CLI with custom modes from global settings
- [ ] CLI with custom modes from .roomodes
- [ ] CLI with mixed built-in and custom modes
- [ ] CLI with corrupted custom modes files
- [ ] CLI performance with large custom modes files

### Manual Testing Scenarios

- [ ] Fresh installation (no custom modes)
- [ ] Global custom modes only
- [ ] Project custom modes only
- [ ] Both global and project custom modes
- [ ] Invalid custom modes file
- [ ] Missing storage directory

## Performance Considerations

- **No File Watching**: CLI uses NoOpFileWatcher to avoid overhead
- **Startup Loading**: Custom modes loaded once at startup
- **Caching**: Service caches modes to avoid repeated file reads
- **Graceful Degradation**: CLI works even if custom modes fail to load

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Dynamic mode validation working
- [ ] NoOpFileWatcher implemented
- [ ] Error messages are clear and helpful
- [ ] Help text updated
- [ ] Unit tests passing with >90% coverage
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Performance verified (no significant regression)
- [ ] Documentation updated

## Effort Estimate

**2 days**

## Priority

**High** - Core CLI functionality

## Dependencies

- Story 1: Core Unified Service (must be completed first)
- Story 2: File Watcher Implementations (NoOpFileWatcher needed)

## Risks

- **Low Risk**: Straightforward parameter addition and validation update
- **Mitigation**: Comprehensive testing and graceful error handling
