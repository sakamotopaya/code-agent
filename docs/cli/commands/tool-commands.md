# Tool Commands

Tool commands provide access to the various tools available through Roo CLI, including built-in tools and those provided by MCP servers.

## tools list

List all available tools from all sources (built-in and MCP servers).

### Usage

```bash
roo-cli tools list [options]
```

### Options

| Option                  | Description                             |
| ----------------------- | --------------------------------------- |
| `--format <format>`     | Output format (table, json, yaml, csv)  |
| `--category <category>` | Filter by tool category                 |
| `--source <source>`     | Filter by source (builtin, mcp, custom) |
| `--search <query>`      | Search tools by name or description     |
| `--available`           | Show only available tools               |
| `--detailed`            | Show detailed tool information          |

### Examples

```bash
# List all available tools
roo-cli tools list

# List file operation tools
roo-cli tools list --category file-operations

# List tools from MCP servers only
roo-cli tools list --source mcp

# Search for browser-related tools
roo-cli tools list --search "browser"

# Show detailed information
roo-cli tools list --detailed

# JSON format for scripting
roo-cli tools list --format json --available
```

### Output Format

```bash
# Table format (default)
TOOL                SOURCE    CATEGORY         STATUS      DESCRIPTION
read_file           builtin   file-ops         available   Read file contents
write_file          builtin   file-ops         available   Write content to file
browser_action      builtin   browser          available   Control browser actions
execute_command     builtin   terminal         available   Execute shell commands
github_create_pr    mcp       version-control  available   Create GitHub pull request

# Detailed format
Tool: read_file
  Source: builtin
  Category: file-operations
  Status: available
  Description: Read the contents of a file with optional encoding
  Parameters:
    - path (string, required): File path to read
    - encoding (string, optional): File encoding (default: utf8)
    - line_range (array, optional): Specific line range to read
  Examples:
    - Read entire file: {"path": "/path/to/file.txt"}
    - Read with encoding: {"path": "/path/to/file.txt", "encoding": "latin1"}
    - Read specific lines: {"path": "/path/to/file.txt", "line_range": [10, 50]}
```

---

## tools info

Show detailed information about a specific tool.

### Usage

```bash
roo-cli tools info <tool-name> [options]
```

### Arguments

| Argument    | Description                 |
| ----------- | --------------------------- |
| `tool-name` | Name of the tool (required) |

### Options

| Option              | Description                      |
| ------------------- | -------------------------------- |
| `--format <format>` | Output format (text, json, yaml) |
| `--examples`        | Show usage examples              |
| `--schema`          | Show parameter schema            |
| `--source-info`     | Show source information          |

### Examples

```bash
# Show tool information
roo-cli tools info read_file

# Show with examples
roo-cli tools info browser_action --examples

# Show parameter schema
roo-cli tools info write_file --schema

# JSON format
roo-cli tools info execute_command --format json
```

### Information Display

```bash
Tool Information: read_file
===========================
Name: read_file
Source: builtin
Category: file-operations
Status: available
Version: 1.0.0

Description:
  Request to read the contents of a file. The tool outputs line-numbered
  content for easy reference when creating diffs or discussing code.

Parameters:
  path (string, required)
    File path relative to workspace directory

  line_range (array, optional)
    One or more line range elements in format "start-end" (1-based, inclusive)

  encoding (string, optional)
    File encoding (default: utf8)

Examples:
  Basic usage:
    {"path": "src/main.js"}

  With line range:
    {"path": "src/main.js", "line_range": ["1-50", "100-150"]}

  With encoding:
    {"path": "data/latin.txt", "encoding": "latin1"}

Limitations:
  - Maximum file size: 10MB
  - Binary files not supported
  - Requires read permissions
```

---

## tools execute

Execute a tool directly from the command line.

### Usage

```bash
roo-cli tools execute <tool-name> [options]
```

### Arguments

| Argument    | Description                            |
| ----------- | -------------------------------------- |
| `tool-name` | Name of the tool to execute (required) |

### Options

| Option              | Description                                 |
| ------------------- | ------------------------------------------- |
| `--params <json>`   | Tool parameters as JSON string              |
| `--file <path>`     | Read parameters from file                   |
| `--output <path>`   | Save output to file                         |
| `--format <format>` | Output format                               |
| `--timeout <ms>`    | Execution timeout in milliseconds           |
| `--retry <count>`   | Number of retry attempts                    |
| `--dry-run`         | Show what would be executed without running |

### Examples

```bash
# Execute tool with inline parameters
roo-cli tools execute read_file --params '{"path": "README.md"}'

# Execute with parameters from file
roo-cli tools execute write_file --file write-params.json

# Execute with output to file
roo-cli tools execute list_files \
  --params '{"path": "src", "recursive": true}' \
  --output file-list.json

# Execute with timeout
roo-cli tools execute execute_command \
  --params '{"command": "npm test"}' \
  --timeout 60000

# Dry run to see what would be executed
roo-cli tools execute browser_action \
  --params '{"action": "launch", "url": "https://example.com"}' \
  --dry-run
```

### Parameter File Format

```json
{
	"path": "/path/to/output.txt",
	"content": "Hello, World!\nThis is a test file.",
	"encoding": "utf8",
	"create_directories": true
}
```

---

## tools validate

Validate tool parameters before execution.

### Usage

```bash
roo-cli tools validate <tool-name> [options]
```

### Arguments

| Argument    | Description                             |
| ----------- | --------------------------------------- |
| `tool-name` | Name of the tool to validate (required) |

### Options

| Option            | Description                   |
| ----------------- | ----------------------------- |
| `--params <json>` | Tool parameters to validate   |
| `--file <path>`   | Read parameters from file     |
| `--schema`        | Show parameter schema         |
| `--examples`      | Show valid parameter examples |

### Examples

```bash
# Validate parameters
roo-cli tools validate read_file --params '{"path": "test.txt"}'

# Validate from file
roo-cli tools validate write_file --file params.json

# Show parameter schema
roo-cli tools validate browser_action --schema

# Show examples
roo-cli tools validate execute_command --examples
```

### Validation Output

```bash
✓ Parameter validation successful

Tool: read_file
Parameters validated:
  ✓ path: "test.txt" (valid file path)
  ✓ encoding: "utf8" (valid encoding)
  ✓ line_range: [1, 100] (valid range)

Warnings:
  ⚠ File size is large (5.2MB), consider using line_range

Ready to execute.
```

---

## tools test

Test tool functionality and performance.

### Usage

```bash
roo-cli tools test [tool-name] [options]
```

### Arguments

| Argument    | Description                      |
| ----------- | -------------------------------- |
| `tool-name` | Specific tool to test (optional) |

### Options

| Option                  | Description                     |
| ----------------------- | ------------------------------- |
| `--category <category>` | Test tools in specific category |
| `--source <source>`     | Test tools from specific source |
| `--performance`         | Include performance tests       |
| `--report <path>`       | Save test report to file        |
| `--timeout <ms>`        | Test timeout per tool           |
| `--parallel`            | Run tests in parallel           |

### Examples

```bash
# Test all tools
roo-cli tools test

# Test specific tool
roo-cli tools test read_file

# Test file operation tools
roo-cli tools test --category file-operations

# Test with performance metrics
roo-cli tools test --performance --report test-report.json

# Test MCP tools only
roo-cli tools test --source mcp --timeout 30000
```

### Test Output

```bash
Tool Testing Report
==================
Date: 2024-01-15T14:30:00Z
Duration: 45.2s
Tools Tested: 12

Results:
✓ read_file (0.15s) - PASS
✓ write_file (0.23s) - PASS
✓ list_files (0.42s) - PASS
✓ browser_action (2.15s) - PASS
✗ github_create_pr (timeout) - FAIL
⚠ execute_command (3.45s) - SLOW

Summary:
- Passed: 10/12 (83.3%)
- Failed: 1/12 (8.3%)
- Warnings: 1/12 (8.3%)
- Average execution time: 1.2s
```

---

## tools benchmark

Benchmark tool performance for optimization.

### Usage

```bash
roo-cli tools benchmark [tool-name] [options]
```

### Arguments

| Argument    | Description                           |
| ----------- | ------------------------------------- |
| `tool-name` | Specific tool to benchmark (optional) |

### Options

| Option                 | Description                    |
| ---------------------- | ------------------------------ |
| `--iterations <count>` | Number of benchmark iterations |
| `--warmup <count>`     | Number of warmup iterations    |
| `--params <json>`      | Parameters for benchmarking    |
| `--output <path>`      | Save benchmark results         |
| `--compare <baseline>` | Compare with baseline results  |
| `--profile`            | Enable detailed profiling      |

### Examples

```bash
# Benchmark all tools
roo-cli tools benchmark

# Benchmark specific tool
roo-cli tools benchmark read_file --iterations 100

# Benchmark with custom parameters
roo-cli tools benchmark write_file \
  --params '{"path": "test.txt", "content": "test"}' \
  --iterations 50

# Compare with baseline
roo-cli tools benchmark --compare baseline.json

# Profile execution
roo-cli tools benchmark execute_command --profile
```

### Benchmark Results

```bash
Benchmark Results: read_file
===========================
Iterations: 100
Warmup: 10
Parameters: {"path": "test.txt"}

Performance Metrics:
  Mean execution time: 145.2ms
  Median: 142.0ms
  95th percentile: 180.5ms
  99th percentile: 220.1ms
  Standard deviation: 18.3ms

Memory Usage:
  Peak memory: 25.4MB
  Average memory: 22.1MB
  Memory efficiency: 95.2%

Resource Utilization:
  CPU usage: 12.5%
  I/O operations: 156
  Network requests: 0

Comparison to baseline:
  ✓ 15% faster than baseline
  ✓ 8% less memory usage
  ⚠ 5% more I/O operations
```

---

## Built-in Tool Categories

### File Operations

Tools for file and directory manipulation:

| Tool                 | Description                            |
| -------------------- | -------------------------------------- |
| `read_file`          | Read file contents with line numbering |
| `write_to_file`      | Create or overwrite files              |
| `apply_diff`         | Apply targeted file modifications      |
| `insert_content`     | Insert content at specific line        |
| `search_and_replace` | Find and replace text patterns         |
| `list_files`         | List directory contents                |
| `search_files`       | Search for patterns across files       |

### Browser Tools

Web browser automation and control:

| Tool                 | Description                  |
| -------------------- | ---------------------------- |
| `browser_action`     | Control browser interactions |
| `browser_screenshot` | Capture page screenshots     |
| `browser_navigate`   | Navigate to URLs             |
| `browser_extract`    | Extract page content         |
| `browser_fill_form`  | Fill and submit forms        |

### Terminal Tools

Command execution and system interaction:

| Tool               | Description               |
| ------------------ | ------------------------- |
| `execute_command`  | Execute shell commands    |
| `terminal_session` | Manage terminal sessions  |
| `process_monitor`  | Monitor running processes |
| `system_info`      | Get system information    |

### Development Tools

Code analysis and development assistance:

| Tool                         | Description              |
| ---------------------------- | ------------------------ |
| `list_code_definition_names` | Extract code definitions |
| `analyze_code`               | Analyze code quality     |
| `generate_docs`              | Generate documentation   |
| `run_tests`                  | Execute test suites      |

---

## Custom Tools

### Creating Custom Tools

Custom tools can be created as:

1. **JavaScript/Node.js scripts**
2. **Python scripts**
3. **Shell scripts**
4. **MCP servers**

### Tool Directory Structure

```
custom-tools/
├── package.json
├── index.js
├── tools/
│   ├── my-tool.js
│   ├── another-tool.py
│   └── scripts/
│       └── helper.sh
└── docs/
    └── tool-reference.md
```

### JavaScript Tool Example

```javascript
// tools/my-tool.js
module.exports = {
	name: "my_custom_tool",
	description: "A custom tool for specific tasks",
	category: "custom",
	parameters: {
		input: { type: "string", required: true },
		options: { type: "object", required: false },
	},

	async execute(params) {
		const { input, options = {} } = params

		// Tool implementation
		const result = await processInput(input, options)

		return {
			success: true,
			data: result,
			message: "Tool executed successfully",
		}
	},
}
```

### Python Tool Example

```python
# tools/my-tool.py
import json
import sys

def execute(params):
    """Execute the custom tool"""
    input_data = params.get('input')
    options = params.get('options', {})

    # Tool implementation
    result = process_input(input_data, options)

    return {
        'success': True,
        'data': result,
        'message': 'Tool executed successfully'
    }

if __name__ == '__main__':
    params = json.loads(sys.argv[1])
    result = execute(params)
    print(json.dumps(result))
```

### Tool Registration

```json
{
	"tools": {
		"customToolsPath": "./custom-tools",
		"enabledCategories": ["file", "browser", "terminal", "custom"],
		"customTools": {
			"my_custom_tool": {
				"command": "node",
				"args": ["./custom-tools/tools/my-tool.js"],
				"timeout": 30000
			},
			"python_tool": {
				"command": "python3",
				"args": ["./custom-tools/tools/my-tool.py"],
				"timeout": 60000
			}
		}
	}
}
```

## Tool Development Guidelines

### Best Practices

1. **Error Handling**: Implement comprehensive error handling
2. **Parameter Validation**: Validate all input parameters
3. **Documentation**: Provide clear documentation and examples
4. **Testing**: Include unit tests for tool functionality
5. **Performance**: Optimize for performance and resource usage

### Security Considerations

1. **Input Sanitization**: Sanitize all user inputs
2. **Permission Checks**: Verify permissions before file operations
3. **Resource Limits**: Implement timeouts and resource limits
4. **Secure Defaults**: Use secure default configurations

### Testing Tools

```bash
# Test custom tool
roo-cli tools test my_custom_tool

# Validate tool parameters
roo-cli tools validate my_custom_tool --params '{"input": "test"}'

# Benchmark tool performance
roo-cli tools benchmark my_custom_tool --iterations 10
```

For more information, see:

- [Tools Overview](../tools/overview.md)
- [File Operations](../tools/file-operations.md)
- [Browser Tools](../tools/browser-tools.md)
- [Terminal Tools](../tools/terminal-tools.md)
- [Custom Tools Guide](../tools/custom-tools.md)
