# Access MCP Resource - Edge Case Test

## Test Objective

Test MCP resource access with invalid URIs and error handling.

## Test Prompt

```
Test MCP resource access error handling by trying to access both a valid resource URI and an invalid one. First try accessing a valid resource, then attempt to access a non-existent resource URI like "github://repos/nonexistent/repository". Document both results in test-run-output/resource-access-test.md.
```

## Expected Tool Usage

- Should use `access_mcp_resource` twice with different URIs
- Should handle both successful and failed resource access
- Should use `write_to_file` to document results

## Success Criteria

- Tool successfully accesses valid resource URI
- Tool handles invalid resource URI gracefully with appropriate error message
- Tool doesn't crash when accessing non-existent resources
- Both successful and error responses are documented
- Error handling provides meaningful feedback

## Reference File

test-run-reference/resource-access-test.md should contain the expected test results format for validation.
