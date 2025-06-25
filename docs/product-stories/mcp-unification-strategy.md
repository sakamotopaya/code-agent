# MCP Service Unification Strategy - Product Stories

## Epic: Unify MCP Services Between VSCode Extension and CLI

### Background

The CLI currently uses a completely separate MCP service architecture from the VSCode extension, leading to:

1. **Immediate Issue**: CLI hangs due to aggressive cleanup that interferes with MCP SDK
2. **Long-term Issue**: Code duplication and inconsistent behavior between platforms

### Strategy: Phased Unification

## Phase 1: Extract Core MCP Logic & Fix CLI Hanging

### Story 1: Create BaseMcpService

**As a** developer  
**I want** a shared core MCP service that both CLI and VSCode can use  
**So that** we have consistent MCP behavior and eliminate code duplication

**Acceptance Criteria:**

- Extract core MCP logic from `McpHub` into `BaseMcpService`
- Include: connection management, tool execution, resource access, simple cleanup
- Remove VSCode-specific dependencies from core logic
- Use simple `transport.close()` + `client.close()` cleanup approach
- Maintain all existing functionality

**Technical Details:**

- Create `src/services/mcp/BaseMcpService.ts`
- Move connection creation, tool execution, resource access from `McpHub`
- Abstract platform-specific services through interfaces
- Keep VSCode-specific logic in `McpHub` extending `BaseMcpService`

---

### Story 2: Create CLI MCP Adapter

**As a** CLI user  
**I want** the CLI to use the same proven MCP logic as the VSCode extension  
**So that** the CLI exits cleanly without hanging

**Acceptance Criteria:**

- Create `CliMcpAdapter` that extends `BaseMcpService`
- Implement CLI-specific platform services (file system, logging, state)
- Use simple cleanup approach matching VSCode extension
- Replace existing `GlobalCLIMcpService` → `CLIMcpService` chain
- CLI exits cleanly after task completion

**Technical Details:**

- Create `src/cli/adapters/CliMcpAdapter.ts`
- Implement `IFileSystemService`, `IUserInterfaceService` for CLI
- Remove complex cleanup logic from CLI MCP services
- Update CLI entry point to use new adapter

---

### Story 3: Define Platform Service Interfaces

**As a** developer  
**I want** clear interfaces for platform-specific services  
**So that** different platforms can implement MCP consistently

**Acceptance Criteria:**

- Define `IFileSystemService` for file operations
- Define `IUserInterfaceService` for notifications
- Define `IStateService` for configuration storage
- Define `IFileWatcherService` for file monitoring
- All interfaces support both VSCode and CLI implementations

**Technical Details:**

- Create `src/services/mcp/interfaces/` directory
- Define interfaces for all platform-specific operations
- Ensure interfaces work for both synchronous (CLI) and async (VSCode) operations
- Document interface contracts and expected behaviors

---

## Phase 2: Full VSCode Integration

### Story 4: Migrate McpHub to Use BaseMcpService

**As a** VSCode extension user  
**I want** the extension to use the unified MCP service  
**So that** VSCode and CLI have identical MCP behavior

**Acceptance Criteria:**

- Refactor `McpHub` to extend `BaseMcpService`
- Implement VSCode-specific platform services
- Maintain all existing VSCode MCP functionality
- No breaking changes to webview or user experience
- Performance matches or exceeds current implementation

**Technical Details:**

- Create `VsCodeMcpAdapter` implementing platform services
- Migrate `McpHub` to use `BaseMcpService` + adapter pattern
- Ensure all VSCode-specific features still work (file watching, UI notifications, etc.)
- Update `McpServerManager` to use new architecture

---

### Story 5: Unified Configuration Management

**As a** user  
**I want** consistent MCP configuration across CLI and VSCode  
**So that** settings work the same way in both environments

**Acceptance Criteria:**

- Unified configuration schema between platforms
- CLI can read VSCode MCP settings and vice versa
- Consistent validation and error handling
- Path resolution works correctly in both contexts

**Technical Details:**

- Create shared configuration validation logic
- Abstract workspace/working directory concepts
- Ensure CLI can find and use VSCode MCP configurations
- Handle global vs project configurations consistently

---

## Phase 3: Advanced Features

### Story 6: Unified Testing Framework

**As a** developer  
**I want** shared tests for MCP functionality  
**So that** both platforms are tested consistently

**Acceptance Criteria:**

- Shared test suite for core MCP logic
- Platform-specific tests for adapters
- Integration tests for both CLI and VSCode
- Performance benchmarks for both platforms

---

### Story 7: API Platform Support

**As a** developer  
**I want** to easily add MCP support to the API platform  
**So that** all three platforms (VSCode, CLI, API) use identical MCP logic

**Acceptance Criteria:**

- Create `ApiMcpAdapter` for HTTP/SSE context
- MCP tools and resources accessible via API endpoints
- Consistent error handling and responses
- Same configuration format across all platforms

---

## Benefits

### Immediate (Phase 1)

- ✅ Fixes CLI hanging issue
- ✅ Starts code unification
- ✅ Minimal risk to existing functionality
- ✅ Foundation for future phases

### Medium-term (Phase 2)

- ✅ Complete code unification
- ✅ Consistent behavior across platforms
- ✅ Easier maintenance and testing
- ✅ Single source of truth for MCP logic

### Long-term (Phase 3)

- ✅ Unified testing and quality assurance
- ✅ Easy platform expansion (API, future platforms)
- ✅ Performance optimizations benefit all platforms
- ✅ Single documentation and configuration approach

## Risk Mitigation

- **Phase 1 Risk**: Breaking existing functionality
    - **Mitigation**: Extract logic incrementally, maintain existing interfaces
- **Phase 2 Risk**: VSCode extension regression
    - **Mitigation**: Comprehensive testing, gradual migration
- **Phase 3 Risk**: Over-engineering
    - **Mitigation**: Only add features when needed, keep interfaces simple

## Success Metrics

- CLI exits cleanly within 2 seconds of task completion
- No code duplication between CLI and VSCode MCP logic
- All existing MCP functionality works identically across platforms
- New platform support can be added with <100 lines of adapter code
