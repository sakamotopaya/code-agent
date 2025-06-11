# List Code Definition Names - Basic Test

## Test Objective

Test extraction of function and class definitions from source code.

## Test Prompt

```
Create a TypeScript file at 'test-run-output/sample-code.ts' with various code definitions including classes, functions, interfaces, and enums. Then use list_code_definition_names to extract all the definitions and verify they are correctly identified.
```

## Expected Tool Usage

- Should use `write_to_file` to create TypeScript file with various definitions
- Should use `list_code_definition_names` to analyze the file
- Should extract classes, functions, interfaces, and enums

## Success Criteria

- Tool creates TypeScript file with diverse code constructs
- Tool correctly identifies all classes, functions, interfaces, and enums
- Definition names are accurately extracted
- Tool provides clear categorization of different definition types
- No syntax errors in parsing

## Reference File

test-run-reference/code-definitions.txt should contain the expected list of definitions for validation.
