# Tools Overview

Roo CLI provides a comprehensive suite of tools that enable powerful automation and development workflows. These tools are categorized by functionality and can be accessed through various interfaces.

## Tool Categories

### File Operations

Tools for reading, writing, and manipulating files and directories.

| Tool                 | Description                               | Use Cases                           |
| -------------------- | ----------------------------------------- | ----------------------------------- |
| `read_file`          | Read file contents with line numbering    | Code review, analysis, debugging    |
| `write_to_file`      | Create or completely rewrite files        | File generation, template creation  |
| `apply_diff`         | Apply targeted modifications to files     | Code refactoring, bug fixes         |
| `insert_content`     | Insert content at specific line numbers   | Adding imports, functions, comments |
| `search_and_replace` | Find and replace text patterns            | Code updates, configuration changes |
| `list_files`         | List directory contents recursively       | Project exploration, file discovery |
| `search_files`       | Search for patterns across multiple files | Code search, documentation updates  |

### Browser Tools

Web browser automation for testing, scraping, and interaction.

| Tool                 | Description                  | Use Cases                         |
| -------------------- | ---------------------------- | --------------------------------- |
| `browser_action`     | Control browser interactions | UI testing, automation, scraping  |
| `browser_navigate`   | Navigate to URLs and pages   | Site navigation, page loading     |
| `browser_screenshot` | Capture page screenshots     | Visual testing, documentation     |
| `browser_extract`    | Extract content from pages   | Data extraction, content analysis |
| `browser_form`       | Fill and submit forms        | Automated testing, data entry     |

### Terminal Tools

Command execution and system interaction capabilities.

| Tool               | Description                         | Use Cases                          |
| ------------------ | ----------------------------------- | ---------------------------------- |
| `execute_command`  | Execute shell commands              | Build scripts, testing, deployment |
| `terminal_session` | Manage persistent terminal sessions | Interactive debugging, monitoring  |
| `process_monitor`  | Monitor running processes           | Performance analysis, debugging    |
| `system_info`      | Retrieve system information         | Environment setup, diagnostics     |

### Development Tools

Code analysis, testing, and development workflow tools.

| Tool                         | Description                        | Use Cases                      |
| ---------------------------- | ---------------------------------- | ------------------------------ |
| `list_code_definition_names` | Extract function/class definitions | Code navigation, documentation |
| `analyze_code`               | Perform code quality analysis      | Code review, refactoring       |
| `run_tests`                  | Execute test suites                | Quality assurance, CI/CD       |
| `generate_docs`              | Generate code documentation        | Documentation automation       |

### MCP Tools

Tools provided by Model Context Protocol servers.

| Tool           | Description                   | Source              |
| -------------- | ----------------------------- | ------------------- |
| `github_*`     | GitHub repository operations  | GitHub MCP Server   |
| `database_*`   | Database query and management | Database MCP Server |
| `kubernetes_*` | Kubernetes cluster operations | K8s MCP Server      |
| `aws_*`        | AWS service interactions      | AWS MCP Server      |

## Tool Architecture

### Built-in Tools

Core tools implemented directly in Roo CLI:

```typescript
interface Tool {
	name: string
	description: string
	category: string
	parameters: ParameterSchema
	execute(params: any): Promise<ToolResult>
	validate(params: any): ValidationResult
}
```

### MCP Tools

Tools provided by external MCP servers:

```typescript
interface MCPTool {
	name: string
	description: string
	inputSchema: JSONSchema
	server: string
	execute(params: any): Promise<any>
}
```

### Custom Tools

User-defined tools loaded from configuration:

```typescript
interface CustomTool {
	name: string
	command: string
	args: string[]
	timeout: number
	environment: Record<string, string>
}
```

## Tool Discovery

### List All Tools

```bash
# Show all available tools
roo-cli tools list

# Filter by category
roo-cli tools list --category file-operations

# Search tools
roo-cli tools list --search "browser"
```

### Tool Information

```bash
# Get detailed tool information
roo-cli tools info read_file

# Show parameter schema
roo-cli tools info write_file --schema

# Show usage examples
roo-cli tools info browser_action --examples
```

## Tool Execution

### Direct Execution

```bash
# Execute tool directly
roo-cli tools execute read_file --params '{"path": "README.md"}'

# Execute with parameter file
roo-cli tools execute write_file --file params.json

# Execute with output to file
roo-cli tools execute list_files --output files.json
```

### Interactive Usage

```bash
# In interactive mode
roo-cli
roo> "Read the contents of src/main.js"
roo> "Create a new component in src/components/"
roo> "Run the test suite and show results"
```

### Batch Processing

```bash
# Process multiple operations
roo-cli --batch "Analyze all Python files and generate documentation"
```

## Tool Configuration

### Global Configuration

```json
{
	"tools": {
		"enabledCategories": ["file", "browser", "terminal"],
		"customToolsPath": "./custom-tools",
		"maxConcurrent": 5,
		"timeout": 300000,
		"retries": 3
	}
}
```

### Category-Specific Settings

```json
{
	"tools": {
		"file": {
			"maxFileSize": "10MB",
			"encoding": "utf8",
			"backup": true
		},
		"browser": {
			"headless": true,
			"viewport": "1920x1080",
			"timeout": 30000
		},
		"terminal": {
			"shell": "/bin/bash",
			"timeout": 60000,
			"workingDirectory": "./"
		}
	}
}
```

## Tool Development

### Creating Custom Tools

#### JavaScript Tool

```javascript
// tools/my-tool.js
module.exports = {
	name: "my_custom_tool",
	description: "A custom development tool",
	category: "custom",

	parameters: {
		input: {
			type: "string",
			required: true,
			description: "Input data to process",
		},
		options: {
			type: "object",
			required: false,
			description: "Optional configuration",
		},
	},

	async execute(params) {
		const { input, options = {} } = params

		try {
			// Tool implementation
			const result = await processInput(input, options)

			return {
				success: true,
				data: result,
				message: "Tool executed successfully",
			}
		} catch (error) {
			return {
				success: false,
				error: error.message,
				message: "Tool execution failed",
			}
		}
	},

	validate(params) {
		const errors = []

		if (!params.input) {
			errors.push("Input parameter is required")
		}

		if (typeof params.input !== "string") {
			errors.push("Input must be a string")
		}

		return {
			valid: errors.length === 0,
			errors,
		}
	},
}
```

#### Python Tool

```python
#!/usr/bin/env python3
# tools/data_processor.py

import json
import sys
import argparse

def execute(params):
    """Execute the data processing tool"""
    try:
        input_data = params.get('input')
        options = params.get('options', {})

        # Tool implementation
        result = process_data(input_data, options)

        return {
            'success': True,
            'data': result,
            'message': 'Data processed successfully'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': 'Data processing failed'
        }

def validate(params):
    """Validate tool parameters"""
    errors = []

    if 'input' not in params:
        errors.append('Input parameter is required')

    return {
        'valid': len(errors) == 0,
        'errors': errors
    }

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--params', required=True, help='JSON parameters')
    parser.add_argument('--validate', action='store_true', help='Validate only')

    args = parser.parse_args()
    params = json.loads(args.params)

    if args.validate:
        result = validate(params)
    else:
        result = execute(params)

    print(json.dumps(result))
```

### Tool Registration

```json
{
	"tools": {
		"customTools": {
			"my_custom_tool": {
				"command": "node",
				"args": ["./tools/my-tool.js"],
				"timeout": 30000,
				"category": "custom"
			},
			"data_processor": {
				"command": "python3",
				"args": ["./tools/data_processor.py"],
				"timeout": 60000,
				"category": "data"
			}
		}
	}
}
```

## Tool Performance

### Optimization Strategies

1. **Caching**: Cache frequently accessed data
2. **Parallelization**: Execute independent operations concurrently
3. **Streaming**: Process large datasets in chunks
4. **Resource Pooling**: Reuse connections and processes

### Performance Monitoring

```bash
# Benchmark tools
roo-cli tools benchmark --iterations 100

# Monitor resource usage
roo-cli tools test --performance

# Profile specific tool
roo-cli tools benchmark read_file --profile
```

### Performance Configuration

```json
{
	"tools": {
		"performance": {
			"maxConcurrent": 10,
			"timeout": 300000,
			"memoryLimit": "1GB",
			"cacheSize": "100MB",
			"cacheTTL": 3600
		}
	}
}
```

## Tool Security

### Security Best Practices

1. **Input Validation**: Always validate and sanitize inputs
2. **Permission Checks**: Verify file and system permissions
3. **Resource Limits**: Implement timeouts and memory limits
4. **Secure Defaults**: Use secure default configurations
5. **Audit Logging**: Log tool usage for security monitoring

### Security Configuration

```json
{
	"tools": {
		"security": {
			"allowedPaths": ["/src", "/docs", "/tests"],
			"deniedPaths": ["/etc", "/bin", "/usr"],
			"maxFileSize": "10MB",
			"maxExecutionTime": 300000,
			"auditLog": true,
			"sandboxed": true
		}
	}
}
```

### Sandboxing

```bash
# Run tools in sandboxed environment
roo-cli tools execute my_tool --sandbox

# Configure sandbox restrictions
roo-cli config set tools.sandbox.enabled true
roo-cli config set tools.sandbox.allowNetwork false
roo-cli config set tools.sandbox.allowFileSystem "/project"
```

## Tool Integration

### Workflow Integration

Tools can be chained and combined for complex workflows:

```bash
# Multi-step workflow
roo-cli --batch "
1. List all Python files in the project
2. Analyze code quality for each file
3. Generate a quality report
4. Create improvement suggestions
"
```

### Pipeline Processing

```json
{
	"pipeline": [
		{
			"tool": "list_files",
			"params": { "path": "src", "pattern": "*.py" }
		},
		{
			"tool": "analyze_code",
			"params": { "files": "${previous.result}" }
		},
		{
			"tool": "generate_report",
			"params": { "analysis": "${previous.result}" }
		}
	]
}
```

### Event-Driven Tools

```javascript
// tools/file-watcher.js
module.exports = {
	name: "file_watcher",
	type: "event-driven",

	watch(patterns, callback) {
		const watcher = chokidar.watch(patterns)

		watcher.on("change", (path) => {
			callback({
				event: "file_changed",
				path: path,
				timestamp: new Date().toISOString(),
			})
		})

		return watcher
	},
}
```

## Tool Ecosystem

### Community Tools

Discover and share tools with the community:

- **Tool Registry**: Central repository of community tools
- **Package Management**: Install tools via package managers
- **Version Control**: Manage tool versions and updates
- **Documentation**: Comprehensive tool documentation

### Tool Marketplace

```bash
# Search community tools
roo-cli tools search "database"

# Install community tool
roo-cli tools install @community/postgres-tools

# Publish your tool
roo-cli tools publish ./my-awesome-tool
```

## Troubleshooting

### Common Issues

1. **Tool Not Found**: Check tool name and availability
2. **Permission Denied**: Verify file and execution permissions
3. **Timeout Errors**: Increase timeout or optimize tool performance
4. **Parameter Validation**: Check parameter format and requirements

### Debugging Tools

```bash
# Debug tool execution
roo-cli tools execute my_tool --debug --verbose

# Validate parameters
roo-cli tools validate my_tool --params '{"test": "data"}'

# Test tool availability
roo-cli tools test my_tool
```

### Error Handling

```javascript
// Robust error handling in custom tools
module.exports = {
	async execute(params) {
		try {
			// Tool logic
			return { success: true, data: result }
		} catch (error) {
			console.error("Tool execution failed:", error)

			return {
				success: false,
				error: error.message,
				stack: error.stack,
				code: error.code || "UNKNOWN_ERROR",
			}
		}
	},
}
```

For detailed information about specific tool categories, see:

- [File Operations](./file-operations.md)
- [Browser Tools](./browser-tools.md)
- [Terminal Tools](./terminal-tools.md)
- [Custom Tools](./custom-tools.md)
