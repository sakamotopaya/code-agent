# List Modes Tool Architecture

## Overview

This document outlines the architecture for implementing a new `list_modes` tool that lists both built-in modes and custom modes across all runtime contexts (CLI, API, VSCode Extension).

## Requirements

- **Tool Name**: `list_modes`
- **Purpose**: List all available modes (built-in and custom) with comprehensive details
- **Cross-Platform**: Must work in CLI, API, and VSCode Extension contexts
- **Filtering**: Support optional filtering by slug, name, and description (case-insensitive contains)
- **Output**: Return full mode details for LLM decision-making

## Current Architecture Analysis

The project follows established patterns for tools:

1. **Type Definitions**: `packages/types/src/tool.ts` - defines available tools
2. **Shared Tool Logic**: `src/shared/tools.ts` - common interfaces and types
3. **Tool Implementation**: `src/core/tools/` - actual tool logic
4. **Tool Integration**: `src/core/task/Task.ts` - tool execution routing
5. **Tool Descriptions**: `src/core/prompts/tools/` - prompt descriptions
6. **Mode Management**: `UnifiedCustomModesService` - unified mode loading across contexts

## Implementation Plan

```mermaid
graph TB
    subgraph "Type System Updates"
        A[packages/types/src/tool.ts<br/>Add 'list_modes' to toolNames]
        B[src/shared/tools.ts<br/>Add ListModesToolUse interface<br/>Add tool display name<br/>Add to TOOL_GROUPS]
    end

    subgraph "Tool Implementation"
        C[src/core/tools/listModesTool.ts<br/>New tool implementation]
        D[src/core/prompts/tools/list-modes.ts<br/>Tool description for prompts]
        E[src/core/prompts/tools/index.ts<br/>Register tool description]
    end

    subgraph "Integration Points"
        F[src/core/task/Task.ts<br/>Add case for 'list_modes']
        G[src/shared/modes.ts<br/>Enhance mode utilities if needed]
    end

    subgraph "Cross-Platform Support"
        H[UnifiedCustomModesService<br/>Already supports getAllModes()]
        I[CLI Context<br/>Tool available via existing infrastructure]
        J[API Context<br/>Tool available via existing infrastructure]
        K[VSCode Context<br/>Tool available via existing infrastructure]
    end

    A --> C
    B --> C
    C --> F
    D --> E
    C --> H
    H --> I
    H --> J
    H --> K

    style C fill:#e1f5fe
    style H fill:#f3e5f5
```

## Detailed Implementation Stories

### Story 1: Type System Updates

#### File: `packages/types/src/tool.ts`

**Changes**:

- Add `"list_modes"` to the `toolNames` array
- This ensures the tool is recognized across all contexts

```typescript
export const toolNames = [
	"execute_command",
	"read_file",
	// ... existing tools
	"codebase_search",
	"list_modes", // NEW
] as const
```

#### File: `src/shared/tools.ts`

**Changes**:

- Add `ListModesToolUse` interface with optional `filter` parameter
- Add tool display name to `TOOL_DISPLAY_NAMES`
- Add tool to appropriate tool group

```typescript
export interface ListModesToolUse extends ToolUse {
	name: "list_modes"
	params: Partial<Pick<Record<ToolParamName, string>, "filter">>
}

export const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
	// ... existing tools
	codebase_search: "codebase search",
	list_modes: "list modes", // NEW
} as const

export const TOOL_GROUPS: Record<ToolGroup, ToolGroupConfig> = {
	// ... existing groups
	modes: {
		tools: ["switch_mode", "new_task", "list_modes"], // ADD list_modes
		alwaysAvailable: true,
	},
}
```

**Parameter Addition**:

- Add `"filter"` to `toolParamNames` array

### Story 2: Core Tool Implementation

#### File: `src/core/tools/listModesTool.ts`

**Purpose**: Main tool implementation following established patterns

**Key Features**:

- Use `UnifiedCustomModesService` to get all modes
- Support filtering by slug, name, and description
- Return comprehensive mode information
- Handle all execution contexts (CLI, API, VSCode)

**Implementation Structure**:

```typescript
export async function listModesTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	// 1. Extract filter parameter
	const filter = block.params.filter?.toLowerCase()

	// 2. Get modes using context-appropriate service
	const modes = await getAllModesForContext(cline)

	// 3. Apply filtering if specified
	const filteredModes = filter
		? modes.filter(
				(mode) =>
					mode.slug.toLowerCase().includes(filter) ||
					mode.name.toLowerCase().includes(filter) ||
					mode.roleDefinition?.toLowerCase().includes(filter) ||
					mode.whenToUse?.toLowerCase().includes(filter),
			)
		: modes

	// 4. Format comprehensive output
	const result = formatModesOutput(filteredModes)

	// 5. Return results
	pushToolResult(result)
}
```

**Mode Information Included**:

- slug, name, roleDefinition
- customInstructions, whenToUse
- groups (tool groups)
- source (built-in vs custom)
- File restrictions (if any)

### Story 3: Tool Description and Integration

#### File: `src/core/prompts/tools/list-modes.ts`

**Purpose**: Tool description for LLM prompts

```typescript
export function getListModesDescription(args: ToolArgs): string {
	return `## list_modes
Description: Request to list all available modes (both built-in and custom modes) with comprehensive details. This tool provides information about mode capabilities, tool groups, restrictions, and usage guidelines.

Parameters:
- filter: (optional) Filter modes by slug, name, or description (case-insensitive contains match)

Usage:
<list_modes>
<filter>optional filter text</filter>
</list_modes>

Examples:

1. List all modes:
<list_modes>
</list_modes>

2. Filter modes containing "code":
<list_modes>
<filter>code</filter>
</list_modes>`
}
```

#### File: `src/core/prompts/tools/index.ts`

**Changes**: Register the new tool description

```typescript
export const toolDescriptions: Record<ToolName, (args: ToolArgs) => string> = {
	// ... existing tools
	codebase_search: (args) => getCodebaseSearchDescription(args),
	list_modes: (args) => getListModesDescription(args), // NEW
}
```

#### File: `src/core/task/Task.ts`

**Changes**: Add case for tool execution

```typescript
switch (toolName) {
	// ... existing cases

	case "list_modes": {
		const { listModesTool } = await import("../tools/listModesTool")
		await listModesTool(this, toolUse, askApproval, handleError, pushToolResult, removeClosingTag)
		break
	}
}
```

### Story 4: Context-Aware Mode Loading

The tool needs to work across different contexts, each with different ways of accessing modes:

#### VSCode Extension Context

- Uses `UnifiedCustomModesService` with VSCode file watcher
- Has access to workspace for project modes

#### CLI Context

- Uses `UnifiedCustomModesService` with NoOp file watcher
- Has access to current working directory for project modes

#### API Context

- Uses `UnifiedCustomModesService` with Node file watcher
- Typically no workspace context (global modes only)

**Implementation Strategy**:

```typescript
async function getAllModesForContext(cline: Task): Promise<ModeConfig[]> {
	// Try to get custom modes service from context
	if (cline.customModesService) {
		return await cline.customModesService.getAllModes()
	}

	// Fallback: create service based on available context
	const service = createCustomModesService(cline)
	return await service.getAllModes()
}
```

## Output Format

The tool will return structured information:

```
Available Modes:

## Built-in Modes

### 💻 Code (code)
- **Role**: Highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.
- **Tools**: read, edit, browser, command, mcp
- **When to Use**: For coding tasks
- **Custom Instructions**: [if any]

### 🏗️ Architect (architect)
- **Role**: Experienced technical leader who is inquisitive and an excellent planner.
- **Tools**: read, edit (markdown only), browser, mcp
- **File Restrictions**: Can only edit *.md files
- **When to Use**: For planning and architecture tasks
- **Custom Instructions**: 1. Do some information gathering...

## Custom Modes

### 🎫 Ticket Oracle (ticket-oracle)
- **Source**: Custom (global)
- **Role**: [custom role definition]
- **Tools**: [custom tool groups]
- **When to Use**: [custom when to use]
- **Custom Instructions**: [custom instructions]

Total: 8 modes (5 built-in, 3 custom)
[Showing 3 modes matching filter "oracle"] // if filtered
```

## Cross-Platform Testing Strategy

### CLI Testing

```bash
# Test basic functionality
roo-cli --batch "list all available modes"

# Test with filtering
roo-cli --batch "list modes containing 'code'"

# Test in project with custom modes
cd /path/to/project/with/.roomodes
roo-cli --batch "show me all available modes"
```

### API Testing

```bash
# Test via API
./api-client.js --stream "list all available modes"

# Test with custom modes in Docker
docker-compose up -d
./api-client.js --stream "what modes are available?"
```

### VSCode Testing

- Test tool availability in extension
- Test with global custom modes
- Test with project-specific .roomodes file
- Test file watching (mode updates)

## Benefits

1. **Consistent with Existing Patterns**: Follows established tool implementation patterns
2. **Cross-Platform Support**: Works automatically in all execution contexts
3. **Leverages Existing Infrastructure**: Uses `UnifiedCustomModesService`
4. **Comprehensive Information**: Provides all mode details for LLM decision-making
5. **Flexible Filtering**: Supports filtering by multiple criteria
6. **Maintainable**: Clear separation of concerns
7. **Extensible**: Easy to add more filtering options or output formats

## Implementation Order

1. **Type System Updates** - Foundation for tool recognition
2. **Tool Implementation** - Core functionality
3. **Integration Points** - Wire up tool execution
4. **Tool Description** - Enable LLM usage
5. **Cross-Platform Testing** - Validate all contexts
6. **Documentation Updates** - Update user-facing docs

## Testing Checklist

- [ ] Tool recognized in type system
- [ ] Tool executes without errors
- [ ] Returns comprehensive mode information
- [ ] Filtering works correctly
- [ ] Works in CLI context
- [ ] Works in API context
- [ ] Works in VSCode context
- [ ] Handles custom modes correctly
- [ ] Handles built-in modes correctly
- [ ] Error handling works properly
- [ ] Tool description is accurate
- [ ] Performance is acceptable

This architecture ensures the `list_modes` tool integrates seamlessly with the existing codebase while providing comprehensive mode information across all execution contexts.
