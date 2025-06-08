# List Files - Basic Test

## Test Objective

Test basic directory listing functionality.

## Test Prompt

```
Create a simple project structure in test-run-output/sample-project/ with a few JavaScript files, a package.json, and a README.md. Then list all files in the test-run-output directory to verify the structure was created correctly.
```

## Expected Tool Usage

- Should use `write_to_file` to create the project structure
- Should use `list_files` with recursive=false for top-level listing
- Should display directory contents clearly

## Success Criteria

- Tool creates the project structure successfully
- Tool lists files and directories in test-run-output
- Directory listing is accurate and complete
- Shows both files and directories appropriately

## Reference File

test-run-reference/file-listing.txt should contain the expected directory structure for validation.
