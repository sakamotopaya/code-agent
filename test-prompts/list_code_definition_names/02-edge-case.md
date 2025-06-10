# List Code Definition Names - Edge Case Test

## Test Objective

Test definition extraction from multiple files in a directory and complex nested structures.

## Test Prompt

```
Create a project structure in test-run-output/code-analysis/ with multiple TypeScript files containing nested classes, generic functions, abstract classes, and complex inheritance patterns. Then use list_code_definition_names on the entire directory to test batch analysis of multiple files.
```

## Expected Tool Usage

- Should use `write_to_file` to create multiple TypeScript files with complex structures
- Should use `list_code_definition_names` on the directory (not individual files)
- Should handle complex TypeScript constructs and inheritance

## Success Criteria

- Tool creates multiple files with complex TypeScript patterns
- Tool analyzes all files in the directory
- Tool correctly identifies nested classes and abstract classes
- Tool handles generic functions and complex inheritance
- Results are organized by file and definition type
- No parsing errors with complex syntax

## Reference File

test-run-reference/directory-definitions.txt should contain the expected definitions from all files for validation.
