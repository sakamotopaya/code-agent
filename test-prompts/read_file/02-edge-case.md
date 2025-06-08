# Read File - Edge Case Test

## Test Objective

Test reading from a non-existent file and handling large files efficiently.

## Test Prompt

```
First, try to read a file that doesn't exist: `test-run-output/nonexistent-file.txt`. Then create a large TypeScript file in test-run-output/large-file.ts with at least 200 lines of code, and read just lines 100-150 to test efficient reading of specific sections.
```

## Expected Tool Usage

- Should use `read_file` tool twice
- First attempt should handle file not found gracefully
- Second should use line range for efficient reading

## Success Criteria

- Tool handles missing file with appropriate error message
- Tool creates large file successfully
- Tool efficiently reads specific line ranges (100-150) from created file
- Error handling doesn't crash the process
- Line range functionality works correctly

## Reference File

test-run-reference/large-file.ts should contain the expected TypeScript content for validation.
