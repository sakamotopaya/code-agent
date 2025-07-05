# Unified Custom Modes Support

## Epic Overview

Enable custom modes to work consistently across all execution contexts (VSCode Extension, CLI, API, Docker) with a unified service architecture and dependency injection for file watching.

## Problem Statement

Currently, custom modes are only available in the VSCode extension context. CLI and API contexts only support hardcoded built-in modes, limiting flexibility and consistency across different usage patterns.

## Goals

1. **Unified Service**: Single service to manage custom modes across all contexts
2. **Configurable Storage**: Support environment-variable-driven storage paths
3. **Context-Aware File Watching**: File watching only where needed (VSCode, API) but not CLI
4. **Parameter Support**: CLI `--mode` and API `mode` parameter support
5. **Backward Compatibility**: Maintain existing VSCode extension functionality

## Success Criteria

- [ ] CLI accepts custom mode slugs via `--mode` parameter
- [ ] API accepts custom mode slugs in request payload
- [ ] Docker containers can access custom modes from mounted storage
- [ ] test-api.js script supports `--mode` parameter
- [ ] File watching works in VSCode and API contexts
- [ ] No file watching overhead in CLI context
- [ ] All contexts use the same storage path configuration

## User Stories

### Story 1: Core Unified Service

**As a** developer  
**I want** a single service to manage custom modes  
**So that** all contexts have consistent behavior

**Acceptance Criteria:**

- UnifiedCustomModesService loads modes from YAML/JSON files
- Service supports configurable storage paths via environment variables
- Service merges global and project-level modes with proper precedence
- Service provides caching capabilities
- Service supports optional file watching via dependency injection

**Technical Tasks:**

- Create `src/shared/services/UnifiedCustomModesService.ts`
- Create `src/shared/services/watchers/FileWatcherInterface.ts`
- Implement file loading and parsing logic
- Implement mode merging logic with project precedence
- Add caching with TTL support
- Add comprehensive unit tests

**Effort:** 3 days  
**Priority:** High

---

### Story 2: File Watcher Implementations

**As a** developer  
**I want** different file watching strategies for different contexts  
**So that** I can optimize performance and resource usage

**Acceptance Criteria:**

- NoOpFileWatcher for CLI (no file watching)
- NodeFileWatcher for API/Docker (fs.watch based)
- VSCodeFileWatcher for extension (vscode.workspace.onDidChangeFiles)
- All implement FileWatcherInterface
- Proper disposal/cleanup methods

**Technical Tasks:**

- Create `src/shared/services/watchers/NoOpFileWatcher.ts`
- Create `src/shared/services/watchers/NodeFileWatcher.ts`
- Create `src/shared/services/watchers/VSCodeFileWatcher.ts`
- Implement proper cleanup and disposal
- Add unit tests for each implementation

**Effort:** 1 day  
**Priority:** High

---

### Story 3: CLI Custom Modes Support

**As a** CLI user  
**I want** to specify custom modes via `--mode` parameter  
**So that** I can use specialized modes for different tasks

**Acceptance Criteria:**

- CLI loads custom modes from storage path on startup
- `--mode` parameter accepts custom mode slugs
- Mode validation includes both built-in and custom modes
- Clear error messages when invalid modes are specified
- No file watching overhead in CLI context

**Technical Tasks:**

- Update `src/cli/index.ts` to initialize UnifiedCustomModesService
- Replace hardcoded mode validation with dynamic validation
- Update `src/cli/config/CliConfigManager.ts` to integrate custom modes
- Add proper error handling and user feedback
- Update CLI help documentation

**Effort:** 2 days  
**Priority:** High

**Example Usage:**

```bash
roo-cli --mode product-owner "Create a PRD for user authentication"
roo-cli --mode ticket-oracle "What's the status of ticket 12345?"
```

---

### Story 4: API Custom Modes Support

**As an** API user  
**I want** to specify custom modes in API requests  
**So that** I can use specialized modes programmatically

**Acceptance Criteria:**

- `/execute` and `/execute/stream` endpoints accept `mode` parameter
- API loads custom modes during server initialization
- Defaults to "code" mode when no mode specified
- File watching enabled for hot-reloading
- Clear error responses for invalid modes

**Technical Tasks:**

- Update `src/api/server/FastifyServer.ts` to initialize UnifiedCustomModesService
- Add mode parameter to execute endpoints
- Add mode validation with helpful error messages
- Update request/response schemas
- Add integration tests

**Effort:** 2 days  
**Priority:** High

**Example API Request:**

```json
{
	"task": "Create a PRD for user authentication",
	"mode": "product-owner",
	"verbose": true
}
```

---

### Story 5: test-api.js Script Enhancement

**As a** developer testing the API  
**I want** to specify modes in the test script  
**So that** I can easily test different mode behaviors

**Acceptance Criteria:**

- `--mode` parameter added to test script
- Mode parameter included in API request payload
- Help documentation updated with mode examples
- Default to "code" mode if not specified

**Technical Tasks:**

- Update argument parsing in `test-api.js`
- Add mode to request payload
- Update help text and examples
- Test with various custom modes

**Effort:** 0.5 days  
**Priority:** Medium

**Example Usage:**

```bash
./test-api.js --stream --mode ticket-oracle "What's the status of ticket 12345?"
./test-api.js --mode product-owner "Create a PRD for user auth"
```

---

### Story 6: Docker Integration

**As a** DevOps engineer  
**I want** custom modes to work in Docker containers  
**So that** containerized deployments have the same capabilities

**Acceptance Criteria:**

- Settings directory properly mounted in Docker containers
- Environment variables configured for storage paths
- Custom modes work in both development and production Docker setups
- File watching works in containerized API

**Technical Tasks:**

- Verify docker-compose.yml storage mounting
- Test custom modes loading in Docker environment
- Update environment variable documentation
- Add Docker-specific integration tests

**Effort:** 1 day  
**Priority:** Medium

**Docker Configuration:**

```yaml
environment:
    - ROO_GLOBAL_STORAGE_PATH=/app/.roo-storage
volumes:
    - ./storage:/app/.roo-storage:rw
```

---

### Story 7: VSCode Extension Migration

**As a** VSCode extension user  
**I want** existing custom modes functionality to continue working  
**So that** I don't lose any current capabilities

**Acceptance Criteria:**

- VSCode extension uses UnifiedCustomModesService
- Maintains backward compatibility with existing custom modes
- File watching and hot-reloading still works
- .roomodes project files still supported
- No breaking changes to user experience

**Technical Tasks:**

- Refactor `src/core/config/CustomModesManager.ts` to use UnifiedCustomModesService
- Update `src/core/webview/ClineProvider.ts` initialization
- Ensure all existing tests pass
- Add migration tests
- Update VSCode extension documentation

**Effort:** 1 day  
**Priority:** Low

---

## Technical Dependencies

### Story Dependencies

1. Story 1 (Core Service) must be completed first
2. Story 2 (File Watchers) depends on Story 1
3. Stories 3-7 can be developed in parallel after Stories 1-2

### External Dependencies

- No external API changes required
- No database schema changes required
- Existing custom modes files format remains unchanged

## Risk Assessment

### Low Risk

- File watching implementations (well-established patterns)
- CLI parameter addition (straightforward)
- Docker environment variable configuration

### Medium Risk

- VSCode extension migration (requires careful testing)
- API endpoint changes (need backward compatibility)

### Mitigation Strategies

- Comprehensive unit and integration tests
- Gradual rollout with feature flags if needed
- Thorough testing in all execution contexts
- Maintain existing CustomModesManager as fallback during transition

## Definition of Done

- [ ] All acceptance criteria met for each story
- [ ] Unit tests written and passing (>90% coverage)
- [ ] Integration tests covering all contexts
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Manual testing in all contexts (VSCode, CLI, API, Docker)
- [ ] Performance testing (no significant regression)
- [ ] Backward compatibility verified
