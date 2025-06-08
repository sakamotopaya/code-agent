# Write to File - Basic Test

## Test Objective

Test basic file creation functionality.

## Test Prompt

```
Create a simple JavaScript utility file at `test-run-output/utils.js` with a function that calculates the sum of two numbers. Include proper JSDoc comments and export the function.
```

## Expected Tool Usage

- Should use `write_to_file` tool
- Should create necessary directories automatically
- Should write complete file content

## Success Criteria

- Tool creates file with complete content
- Directories are created as needed
- File contains valid JavaScript with proper documentation
- Line count is calculated correctly
- Function is properly exported

## Reference File

test-run-reference/utils.js should contain the expected JavaScript utility file for validation.
