# Execute Command - Basic Test

## Test Objective

Test basic shell command execution functionality.

## Test Prompt

```
Create a simple Node.js project structure in test-run-output/node-project/ with a package.json file. Then execute commands to initialize npm, install a package like "lodash", and run "npm list" to verify the installation worked correctly.
```

## Expected Tool Usage

- Should use `write_to_file` to create initial project structure
- Should use `execute_command` multiple times for npm operations
- Should handle command output and success/failure status

## Success Criteria

- Tool creates initial project structure successfully
- Tool executes npm init command successfully
- Tool installs lodash package via npm install
- Tool runs npm list and shows installed packages
- Commands execute in correct directory context
- Command output is captured and displayed

## Reference File

test-run-reference/npm-output.txt should contain the expected npm list output for validation.
