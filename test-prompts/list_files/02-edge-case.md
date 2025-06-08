# List Files - Edge Case Test

## Test Objective

Test recursive directory listing and handling of deep nested structures.

## Test Prompt

```
Create a deep nested directory structure in test-run-output/nested/very/deep/structure/ with various file types (.js, .ts, .json, .md) at different levels. Then perform both a non-recursive listing of test-run-output/nested and a recursive listing to compare the output differences.
```

## Expected Tool Usage

- Should use `write_to_file` to create files at various nesting levels
- Should use `list_files` twice: once with recursive=false, once with recursive=true
- Should handle deep directory structures correctly

## Success Criteria

- Tool creates deep nested directory structure successfully
- Non-recursive listing shows only top-level contents
- Recursive listing shows all files and directories at all levels
- Tool handles deep paths without errors
- Output format is clear and distinguishable between modes

## Reference File

test-run-reference/nested-structure.txt should contain the expected recursive listing for validation.
