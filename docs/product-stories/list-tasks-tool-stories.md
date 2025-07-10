# List Tasks Tool - Product Stories

## Epic: Implement List Tasks Tool

**As a** developer using the code agent  
**I want** to be able to list and browse all stored tasks  
**So that** I can manage my task history, review past work, and understand system usage patterns

### Acceptance Criteria

- Tool follows the same pattern as existing `list_modes` tool
- Returns basic task metadata: ID, creation date, status, title, mode, and token usage
- Supports filtering similar to other list tools
- Works across all execution contexts (VSCode, CLI, API)
- Handles errors gracefully and provides meaningful feedback

---

## Story 1: Core Task Discovery and Metadata Extraction

**As a** system  
**I want** to scan the storage directory and extract task metadata  
**So that** I can provide comprehensive task information to users

### Tasks

- [ ] Create `src/core/tools/listTasksTool.ts` with main tool function
- [ ] Implement `getTasksFromStorage()` function to scan task directories
- [ ] Implement `extractTaskMetadata()` function to parse JSON files
- [ ] Create task status determination logic
- [ ] Add error handling for corrupted or missing files
- [ ] Implement token usage calculation from conversation history
- [ ] Add workspace directory extraction from environment details

### Acceptance Criteria

- [ ] Successfully scans storage/tasks directory for UUID folders
- [ ] Extracts creation date from first message timestamp
- [ ] Determines task title from first user message (truncated appropriately)
- [ ] Calculates total token usage and cost from API conversation history
- [ ] Determines task status (active, completed, failed, abandoned, unknown)
- [ ] Extracts current/last mode information from conversation
- [ ] Handles missing or corrupted JSON files gracefully
- [ ] Returns structured TaskInfo objects

### Technical Notes

```typescript
interface TaskInfo {
	id: string
	createdAt: Date
	lastActivity: Date
	status: "active" | "completed" | "failed" | "abandoned" | "unknown"
	title: string
	mode: {
		current?: string
		name?: string
	}
	tokenUsage: {
		total: number
		cost: number
	}
	messageCount: number
	duration?: number
	workspaceDir?: string
}
```

---

## Story 2: Tool Integration and Registration

**As a** system  
**I want** to register the list_tasks tool in all necessary integration points  
**So that** it can be discovered and executed by the LLM

### Tasks

- [ ] Add `ListTasksToolUse` interface to `src/shared/tools.ts`
- [ ] Add tool to `toolNamesMap` and `toolGroups` in `src/shared/tools.ts`
- [ ] Create `src/core/prompts/tools/list-tasks.ts` with tool description
- [ ] Register tool description in `src/core/prompts/tools/index.ts`
- [ ] Add execution case in `src/core/task/Task.ts`
- [ ] Add presentation logic in `src/core/assistant-message/presentAssistantMessage.ts`
- [ ] Add to streaming tools list in `src/api/streaming/MessageBuffer.ts`

### Acceptance Criteria

- [ ] Tool appears in available tools list
- [ ] Tool description is properly formatted and helpful
- [ ] Tool can be executed via `<list_tasks>` syntax
- [ ] Tool supports optional filter parameter
- [ ] Tool execution is handled in all contexts (VSCode, CLI, API)
- [ ] Tool results are properly formatted for display

### Technical Notes

- Follow exact pattern established by `list_modes` tool
- Ensure tool is added to `modes` tool group for always-available access
- Include comprehensive usage examples in tool description

---

## Story 3: Output Formatting and Filtering

**As a** user  
**I want** to see well-formatted task information with filtering capabilities  
**So that** I can quickly find and understand relevant tasks

### Tasks

- [ ] Implement `formatTasksOutput()` function for readable display
- [ ] Add filtering logic for task title, ID, mode, and status
- [ ] Create summary statistics (total tasks by status)
- [ ] Implement task sorting by creation date (newest first)
- [ ] Add duration formatting (human-readable)
- [ ] Add cost formatting with currency
- [ ] Handle empty results gracefully

### Acceptance Criteria

- [ ] Tasks are displayed in clear, readable format
- [ ] Summary shows total tasks and breakdown by status
- [ ] Filter parameter searches across title, ID, mode, and status
- [ ] Tasks are sorted by creation date (newest first)
- [ ] Duration is shown in human-readable format (e.g., "45 minutes")
- [ ] Token usage and cost are clearly displayed
- [ ] Empty results show helpful message
- [ ] Long task titles are truncated appropriately

### Output Format Example

```
Available Tasks:

Total: 45 tasks (12 active, 28 completed, 3 failed, 2 abandoned)
Storage: /path/to/storage/tasks

### Task: Fix authentication bug (a1b2c3d4-e5f6-7890-abcd-ef1234567890)
- **Created**: 2025-01-07 14:30:22
- **Status**: Completed
- **Mode**: 🪲 Debug (debug)
- **Duration**: 45 minutes
- **Messages**: 23 messages
- **Tokens**: 15,420 tokens ($0.23)
- **Workspace**: /Users/dev/project-x

### Task: Implement new feature (b2c3d4e5-f6g7-8901-bcde-f23456789012)
- **Created**: 2025-01-07 10:15:33
- **Status**: Active
- **Mode**: 💻 Code (code)
- **Messages**: 8 messages
- **Tokens**: 3,240 tokens ($0.05)
- **Workspace**: /Users/dev/project-y
```

---

## Story 4: Error Handling and Edge Cases

**As a** system  
**I want** to handle various error conditions gracefully  
**So that** the tool remains reliable even with corrupted or missing data

### Tasks

- [ ] Handle missing storage directory (create or use fallback)
- [ ] Handle permission errors with helpful messages
- [ ] Handle corrupted JSON files (skip with warning)
- [ ] Handle missing required JSON fields (use defaults)
- [ ] Handle invalid timestamp formats
- [ ] Handle large numbers of tasks (performance optimization)
- [ ] Add comprehensive logging for debugging

### Acceptance Criteria

- [ ] Tool works even if storage directory doesn't exist
- [ ] Provides clear error messages for permission issues
- [ ] Skips corrupted tasks with warning, continues processing others
- [ ] Uses sensible defaults for missing data fields
- [ ] Handles various timestamp formats gracefully
- [ ] Performs well with 100+ tasks
- [ ] Logs appropriate debug information without exposing sensitive data

### Error Scenarios to Test

- Storage directory doesn't exist
- No read permissions on storage directory
- Corrupted JSON files
- Missing ui_messages.json or api_conversation_history.json
- Empty task directories
- Invalid UUID directory names
- Very large task files
- Network storage latency

---

## Story 5: Cross-Platform Compatibility and Testing

**As a** developer  
**I want** the tool to work consistently across all platforms and contexts  
**So that** all users have the same experience regardless of their environment

### Tasks

- [ ] Test on Windows, macOS, and Linux
- [ ] Test in VSCode extension context
- [ ] Test in CLI context
- [ ] Test in API server context
- [ ] Test with custom storage paths
- [ ] Test with default storage paths
- [ ] Create unit tests for core functions
- [ ] Create integration tests for full workflow
- [ ] Add performance benchmarks

### Acceptance Criteria

- [ ] Works identically on Windows, macOS, and Linux
- [ ] Works in VSCode extension with proper UI integration
- [ ] Works in CLI mode with appropriate console output
- [ ] Works via API endpoints with JSON responses
- [ ] Respects custom storage path configurations
- [ ] Falls back to default paths when custom paths fail
- [ ] Unit tests cover all core functions with >90% coverage
- [ ] Integration tests verify end-to-end functionality
- [ ] Performance meets benchmarks (<500ms for <100 tasks)

### Test Cases

```typescript
describe("listTasksTool", () => {
	describe("metadata extraction", () => {
		it("should extract creation date from first message")
		it("should determine status from message patterns")
		it("should calculate token usage correctly")
		it("should handle missing fields gracefully")
	})

	describe("filtering", () => {
		it("should filter by task title")
		it("should filter by task ID")
		it("should filter by mode name")
		it("should filter by status")
	})

	describe("error handling", () => {
		it("should handle missing storage directory")
		it("should handle corrupted JSON files")
		it("should handle permission errors")
	})
})
```

---

## Story 6: Documentation and User Experience

**As a** user  
**I want** clear documentation and helpful tool descriptions  
**So that** I can effectively use the list_tasks tool

### Tasks

- [ ] Update tool description with comprehensive examples
- [ ] Add usage examples to documentation
- [ ] Create troubleshooting guide for common issues
- [ ] Add tool to user-facing documentation
- [ ] Create demo scenarios for testing

### Acceptance Criteria

- [ ] Tool description includes clear usage examples
- [ ] Documentation explains all available parameters
- [ ] Troubleshooting guide covers common error scenarios
- [ ] User documentation is updated with new tool
- [ ] Demo scenarios validate real-world usage patterns

### Documentation Updates

- Update main tool documentation
- Add examples to README
- Include in CLI help text
- Add to API documentation
- Create troubleshooting section

---

## Definition of Done

For this epic to be considered complete, all stories must meet their acceptance criteria and the following overall requirements:

### Functional Requirements

- [ ] Tool successfully lists tasks from storage directory
- [ ] Extracts accurate metadata from task files
- [ ] Supports filtering by title, ID, mode, and status
- [ ] Works in all execution contexts (VSCode, CLI, API)
- [ ] Handles errors gracefully with meaningful messages
- [ ] Follows existing code patterns and conventions

### Non-Functional Requirements

- [ ] Performance: <500ms response time for <100 tasks
- [ ] Memory: <50MB memory usage for 1000 tasks
- [ ] Reliability: Handles corrupted data without crashing
- [ ] Security: Validates file paths, prevents directory traversal
- [ ] Maintainability: Code follows project conventions and patterns

### Quality Assurance

- [ ] Unit tests achieve >90% code coverage
- [ ] Integration tests verify end-to-end functionality
- [ ] Manual testing completed on all supported platforms
- [ ] Code review completed by team members
- [ ] Documentation is complete and accurate

### Deployment Readiness

- [ ] No breaking changes to existing functionality
- [ ] Backward compatible with existing storage formats
- [ ] Ready for production deployment
- [ ] Monitoring and logging in place
