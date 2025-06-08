# Apply Diff - Edge Case Test

## Test Objective

Test multiple diff operations in a single apply_diff call and handling whitespace/indentation.

## Test Prompt

```
Create a TypeScript class file at `test-run-output/UserManager.ts` with basic user management functionality. Then make multiple changes at once using apply_diff: add a new import statement at the top, modify a function parameter in the middle, and add a new method at the end. Use a single apply_diff call with multiple SEARCH/REPLACE blocks to test the multi-edit functionality.
```

## Expected Tool Usage

- Should use `read_file` first to examine the content
- Should use `apply_diff` with multiple SEARCH/REPLACE blocks
- Should handle different sections of the file correctly

## Success Criteria

- Tool creates the initial TypeScript class file successfully
- Tool performs multiple edits in one operation
- Each SEARCH block matches existing content exactly
- Whitespace and indentation are preserved correctly
- All changes are applied without conflicts
- Final file maintains valid TypeScript syntax

## Reference File

test-run-reference/UserManager.ts should contain the expected TypeScript class with all modifications for validation.
