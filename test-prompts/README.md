# CLI Tool Test Prompts

This directory contains comprehensive test prompts for all 11 CLI-compatible tools identified in the CLI compatibility analysis.

## Test Structure

Each tool has its own subdirectory with test prompts:

### File Operation Tools

- **read_file/** - Test file reading with line numbering and ranges
- **write_to_file/** - Test file creation and complete rewrites
- **apply_diff/** - Test targeted file modifications with search/replace blocks
- **insert_content/** - Test content insertion at specific line numbers
- **search_and_replace/** - Test find/replace operations with regex support

### Discovery and Analysis Tools

- **list_files/** - Test directory listing (recursive and non-recursive)
- **search_files/** - Test pattern search across multiple files
- **list_code_definition_names/** - Test code definition extraction from source files

### Execution Tools

- **execute_command/** - Test shell command execution and error handling

### MCP Integration Tools

- **use_mcp_tool/** - Test MCP server tool usage (GitHub, SQL Server, etc.)
- **access_mcp_resource/** - Test MCP resource access and error handling

## Test Prompt Format

Each tool directory contains:

- **01-basic.md** - Basic functionality test
- **02-edge-case.md** - Edge cases and error handling

## Testing Strategy

### CLI --batch Integration

All prompts are designed for CLI --batch capability testing where:

- **test-run-output/** - Working directory for all generated files
- **test-run-reference/** - Expected output files for validation

### Validation Approach

Each test prompt includes:

1. **Test Objective** - What functionality is being tested
2. **Test Prompt** - The actual prompt to execute
3. **Expected Tool Usage** - Which tools should be used and how
4. **Success Criteria** - What constitutes a successful test
5. **Reference File** - Expected output in test-run-reference/ for validation

## Usage

These prompts can be executed via CLI --batch mode and validated against reference files to ensure tool functionality works correctly in CLI environments.

## Coverage

**Total Tools Tested:** 11  
**Test Prompts Created:** 22 (2 per tool)  
**CLI Compatibility:** 100% of identified CLI-ready tools
