# Search and Replace - Basic Test

## Test Objective

Test basic text replacement functionality across a file.

## Test Prompt

```
Create a TypeScript debugging file at 'test-run-output/debug-utils.ts' with several console.log statements throughout the code. Then search for all occurrences of 'console.log' and replace them with 'logger.debug' using case-sensitive matching.
```

## Expected Tool Usage

- Should use `search_and_replace` tool
- Should target a specific file
- Should replace all instances of the search term

## Success Criteria

- Tool creates initial TypeScript file with console.log statements
- Tool finds and replaces all occurrences correctly
- Case sensitivity is respected
- No unintended replacements occur
- File syntax remains valid after replacement
- Shows diff preview before applying changes

## Reference File

test-run-reference/debug-utils.ts should contain the expected TypeScript file with logger.debug statements for validation.
