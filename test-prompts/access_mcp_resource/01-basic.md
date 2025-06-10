# Access MCP Resource - Basic Test

## Test Objective

Test basic MCP resource access functionality.

## Test Prompt

```
Access a resource from the GitHub MCP server to get repository information. Try to access a resource URI like "github://repos/microsoft/vscode" and save the retrieved resource content to test-run-output/repository-info.json for analysis.
```

## Expected Tool Usage

- Should use `access_mcp_resource` with GitHub MCP server
- Should access a specific repository resource URI
- Should use `write_to_file` to save resource content

## Success Criteria

- Tool successfully connects to GitHub MCP server
- Tool accesses the specified resource URI
- Resource content is retrieved successfully
- Content is saved in readable JSON format
- No authentication or connection errors occur

## Reference File

test-run-reference/repository-info.json should contain the expected repository resource structure for validation.
