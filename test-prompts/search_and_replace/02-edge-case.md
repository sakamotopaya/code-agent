# Search and Replace - Edge Case Test

## Test Objective

Test regex pattern replacement and restricted line range functionality.

## Test Prompt

```
Create a test file in test-run-output/search-replace-test.js with multiple function declarations, then use regex to replace all function names starting with "old" and replace them with "new" (e.g., "oldFunction" becomes "newFunction"). Use regex pattern matching for this replacement.
```

## Expected Tool Usage

- Should use `write_to_file` to create test file first
- Should use `search_and_replace` with regex enabled
- Should handle regex pattern replacement correctly

## Success Criteria

- Tool correctly creates test file with multiple functions
- Regex pattern finds and replaces function names correctly
- Only intended matches are replaced
- File syntax remains valid after replacement
- Shows diff preview before applying changes

## Reference File

test-run-reference/search-replace-test.js should contain the expected output after replacement.
