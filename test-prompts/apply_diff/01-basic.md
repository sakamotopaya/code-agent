# Apply Diff - Basic Test

## Test Objective

Test basic diff application for targeted file modifications.

## Test Prompt

```
Create a TypeScript utility file at `test-run-output/calculator.ts` with a basic add function. Then use apply_diff to add a new parameter called `debugMode: boolean = false` to the function, making a targeted modification.
```

## Expected Tool Usage

- Should use `read_file` first to examine the current content
- Should use `apply_diff` with proper SEARCH/REPLACE blocks
- Should include correct line numbers in the diff

## Success Criteria

- Tool creates the initial TypeScript file successfully
- Tool reads file first to understand structure
- Diff correctly targets specific function
- SEARCH block matches existing content exactly
- REPLACE block adds the new parameter correctly
- Modified function maintains valid TypeScript syntax

## Reference File

test-run-reference/calculator.ts should contain the expected TypeScript file with the added parameter for validation.
