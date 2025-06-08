# Execute Command - Edge Case Test

## Test Objective

Test command execution with error handling and directory changes.

## Test Prompt

```
Create a test script file in test-run-output/test-script.sh (or .bat for Windows) that contains both successful and failing commands. Execute the script and also test running commands that change directories. Verify that error handling works correctly and that directory context is maintained.
```

## Expected Tool Usage

- Should use `write_to_file` to create test script with mixed success/failure commands
- Should use `execute_command` to run the script and handle errors
- Should test directory changes and context preservation

## Success Criteria

- Tool creates test script with both passing and failing commands
- Tool executes script and captures both stdout and stderr
- Tool handles command failures gracefully without crashing
- Tool maintains proper directory context between commands
- Error messages are properly captured and displayed
- Exit codes are handled appropriately

## Reference File

test-run-reference/script-output.txt should contain the expected script execution output for validation.
