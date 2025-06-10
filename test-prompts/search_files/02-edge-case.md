# Search Files - Edge Case Test

## Test Objective

Test complex regex patterns and file type filtering.

## Test Prompt

```
Create a mixed project in test-run-output/mixed-project/ with JavaScript (.js), TypeScript (.ts), JSON (.json), and text (.txt) files. Include some files with similar patterns but different contexts. Then search for a complex regex pattern like "import.*from.*['\"].*['\"]" but only in TypeScript files using the file_pattern parameter.
```

## Expected Tool Usage

- Should use `write_to_file` to create files of different types
- Should use `search_files` with complex regex and file_pattern filter
- Should respect file type filtering (\*.ts only)

## Success Criteria

- Tool creates mixed file types successfully
- Tool applies file pattern filter correctly (only searches .ts files)
- Complex regex pattern matching works accurately
- Non-matching file types are excluded from results
- Search results include proper context and file identification

## Reference File

test-run-reference/filtered-search-results.txt should contain the expected filtered search output for validation.
