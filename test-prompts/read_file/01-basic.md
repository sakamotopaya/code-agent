# Read File - Basic Test

## Test Objective

Test basic file reading functionality with line numbering.

## Test Prompt

```
Create a sample JSON configuration file in test-run-output/config.json with basic settings, then read the contents and show me the first 10 lines to verify the file was created correctly.
```

## Expected Tool Usage

- Should use `read_file` tool
- Should specify line range 1-20 for efficiency
- Should display line-numbered content

## Success Criteria

- Tool correctly creates the JSON file in test-run-output
- Tool reads the file and displays content with line numbers
- Line range is respected (shows only first 10 lines)
- No errors occur during file access

## Reference File

test-run-reference/config.json should contain the expected JSON structure for validation.
