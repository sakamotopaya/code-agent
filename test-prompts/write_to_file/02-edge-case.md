# Write to File - Edge Case Test

## Test Objective

Test file overwriting and deep directory creation.

## Test Prompt

```
Create a configuration file at `test-run-output/deep/nested/directories/config.json` with some sample API settings. Then overwrite it with completely different database configuration content to test the overwrite functionality.
```

## Expected Tool Usage

- Should use `write_to_file` tool twice
- Should create deep directory structure
- Should overwrite existing file completely

## Success Criteria

- Tool creates deep nested directories in test-run-output
- First file creation succeeds with API settings
- Second write completely overwrites the file with database config
- No remnants of original content remain
- Directory structure is preserved

## Reference File

test-run-reference/deep/nested/directories/config.json should contain the expected final configuration for validation.
