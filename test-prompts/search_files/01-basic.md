# Search Files - Basic Test

## Test Objective

Test basic pattern search across multiple files.

## Test Prompt

```
Create several TypeScript files in test-run-output/search-test/ containing different function declarations and imports. Then search for all occurrences of the pattern "function" across all files in the test-run-output directory to verify the search functionality works correctly.
```

## Expected Tool Usage

- Should use `write_to_file` to create multiple TypeScript files
- Should use `search_files` with basic regex pattern
- Should display context-rich results with surrounding lines

## Success Criteria

- Tool creates multiple files with function declarations
- Tool finds all occurrences of "function" pattern across files
- Search results include surrounding context lines
- File paths are correctly displayed in results
- Pattern matching is accurate

## Reference File

test-run-reference/search-results.txt should contain the expected search output for validation.
