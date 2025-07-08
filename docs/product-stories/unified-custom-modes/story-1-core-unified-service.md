# Story 1: Core Unified Service

## Overview

**As a** developer  
**I want** a single service to manage custom modes  
**So that** all contexts have consistent behavior

## Acceptance Criteria

- [ ] UnifiedCustomModesService loads modes from YAML/JSON files
- [ ] Service supports configurable storage paths via environment variables
- [ ] Service merges global and project-level modes with proper precedence
- [ ] Service provides caching capabilities
- [ ] Service supports optional file watching via dependency injection
- [ ] Service handles both `custom_modes.yaml` and `custom_modes.json` formats
- [ ] Service validates custom modes against schema
- [ ] Service provides clear error messages for invalid configurations

## Technical Implementation

### Files to Create

- `src/shared/services/UnifiedCustomModesService.ts`
- `src/shared/services/watchers/FileWatcherInterface.ts`

### Core Interface

```typescript
export interface CustomModesServiceOptions {
  storagePath: string
  fileWatcher?: FileWatcherInterface
  enableProjectModes?: boolean
  workspacePath?: string
}

export interface FileWatcherInterface {
  watch(paths: string[], callback: () => void): void
  dispose(): void
}

export class UnifiedCustomModesService {
  constructor(private options: CustomModesServiceOptions)
  async loadCustomModes(): Promise<ModeConfig[]>
  async getMode(slug: string): Promise<ModeConfig | undefined>
  async getAllModes(): Promise<ModeConfig[]>
  dispose(): void
}
```

### Key Features

1. **Storage Path Resolution**: Use environment variables with fallbacks
2. **File Format Support**: Both YAML and JSON custom modes files
3. **Mode Merging**: Project modes override global modes by slug
4. **Caching**: TTL-based caching with invalidation
5. **File Watching**: Optional dependency injection for hot-reloading
6. **Error Handling**: Graceful degradation when files are missing/invalid

### Storage Path Priority

1. `options.storagePath` (explicit)
2. `ROO_GLOBAL_STORAGE_PATH` environment variable
3. `API_STORAGE_ROOT` environment variable
4. Default from `getStoragePath()`

### File Loading Order

1. Global: `${storagePath}/settings/custom_modes.yaml`
2. Global: `${storagePath}/settings/custom_modes.json` (fallback)
3. Project: `${workspacePath}/.roomodes` (if enabled)

## Technical Tasks

- [ ] Create UnifiedCustomModesService class
- [ ] Implement file loading and parsing logic
- [ ] Implement mode merging with project precedence
- [ ] Add caching with TTL support (10 seconds default)
- [ ] Add schema validation using existing `customModesSettingsSchema`
- [ ] Implement file watching integration points
- [ ] Add comprehensive error handling
- [ ] Create unit tests with >90% coverage
- [ ] Add integration tests for file loading scenarios
- [ ] Document API and usage patterns

## Testing Strategy

### Unit Tests

- [ ] File loading from different paths
- [ ] YAML and JSON parsing
- [ ] Mode merging logic
- [ ] Caching behavior
- [ ] Error handling scenarios
- [ ] File watcher integration

### Integration Tests

- [ ] End-to-end mode loading
- [ ] Environment variable configuration
- [ ] File watching callbacks
- [ ] Performance with large mode files

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Unit tests passing with >90% coverage
- [ ] Integration tests passing
- [ ] Code review completed
- [ ] Documentation written
- [ ] Performance benchmarks acceptable
- [ ] Error scenarios handled gracefully

## Effort Estimate

**3 days**

## Priority

**High** - Foundation for all other stories

## Dependencies

- None (foundational story)

## Risks

- **Low Risk**: Well-defined interfaces and existing patterns to follow
- **Mitigation**: Extensive testing and gradual integration
