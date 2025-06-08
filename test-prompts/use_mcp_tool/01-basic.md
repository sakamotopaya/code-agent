# Use MCP Tool - Basic Test

## Test Objective

Test basic MCP tool usage with GitHub server functionality.

## Test Prompt

```
Use the GitHub MCP server to search for repositories related to "typescript cli tools". Create a summary file in test-run-output/github-search-results.md with the search results, including repository names, descriptions, and URLs.
```

## Expected Tool Usage

- Should use `use_mcp_tool` with GitHub MCP server
- Should call search_repositories tool with appropriate parameters
- Should use `write_to_file` to save results

## Success Criteria

- Tool successfully connects to GitHub MCP server
- Tool executes search_repositories with "typescript cli tools" query
- Search results are returned with repository information
- Results are formatted and saved to markdown file
- No connection or authentication errors occur

## Reference File

test-run-reference/github-search-results.md should contain the expected search results format for validation.
