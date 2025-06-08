# Use MCP Tool - Edge Case Test

## Test Objective

Test complex MCP tool usage with SQL Server functionality and error handling.

## Test Prompt

```
Use the mssql-dpsp MCP server to list all tables in the connected database, then get the schema for one of the tables. If the database connection fails, handle the error gracefully. Save the table information to test-run-output/database-schema.json in a structured format.
```

## Expected Tool Usage

- Should use `use_mcp_tool` with mssql-dpsp MCP server
- Should call list_tables and get_table_schema tools
- Should handle potential connection errors
- Should use `write_to_file` to save structured results

## Success Criteria

- Tool successfully connects to SQL Server MCP server
- Tool executes list_tables to get available tables
- Tool gets schema for at least one table using get_table_schema
- Error handling works if database is unavailable
- Results are saved in structured JSON format
- Tool gracefully handles MCP server unavailability

## Reference File

test-run-reference/database-schema.json should contain the expected database schema format for validation.
