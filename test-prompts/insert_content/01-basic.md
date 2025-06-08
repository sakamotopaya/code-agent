# Insert Content - Basic Test

## Test Objective

Test basic content insertion at specific line numbers.

## Test Prompt

```
Create a package.json file at `test-run-output/package.json` with basic project information and a few dependencies. Then insert a new dependency entry `"lodash": "^4.17.21",` at the appropriate location in the dependencies section using insert_content.
```

## Expected Tool Usage

- Should use `read_file` first to understand file structure
- Should use `insert_content` with correct line number
- Should insert content at the specified location

## Success Criteria

- Tool creates initial package.json file successfully
- Tool reads file to determine correct insertion point
- Content is inserted at the exact line specified
- Existing content is preserved and shifted appropriately
- File remains valid JSON after insertion

## Reference File

test-run-reference/package.json should contain the expected package.json with the added lodash dependency for validation.
