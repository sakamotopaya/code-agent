# Insert Content - Edge Case Test

## Test Objective

Test inserting content at the beginning and end of files, including multi-line inserts.

## Test Prompt

```
Create a TypeScript module file at `test-run-output/math-utils.ts` with some basic math functions. Then insert a copyright header at the very beginning (line 1), and append a multi-line export statement at the end of the same file (line 0 for append). Test both insertion points.
```

## Expected Tool Usage

- Should use `insert_content` twice
- First insert at line 1 (beginning)
- Second insert at line 0 (append to end)
- Should handle multi-line content correctly

## Success Criteria

- Tool creates initial TypeScript file successfully
- Content inserted at beginning shifts existing content down
- Content appended at end is added after all existing lines
- Multi-line content preserves formatting and line breaks
- Original file structure remains intact between insertions
- Final file maintains valid TypeScript syntax

## Reference File

test-run-reference/math-utils.ts should contain the expected TypeScript file with copyright header and export statement for validation.
