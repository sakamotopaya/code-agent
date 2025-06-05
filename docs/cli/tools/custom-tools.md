# Custom Tools Development

This guide covers how to create, deploy, and maintain custom tools for Roo CLI to extend its capabilities for your specific needs.

## Overview

Custom tools allow you to extend Roo CLI with domain-specific functionality, integrate with internal systems, or create specialized workflows. Tools can be implemented in various languages and integrated seamlessly with the CLI.

## Tool Architecture

### Tool Interface

All tools must implement a standard interface:

```typescript
interface Tool {
	name: string
	description: string
	category: string
	parameters: ParameterSchema
	execute(params: any): Promise<ToolResult>
	validate?(params: any): ValidationResult
}
```

### Tool Result Format

```typescript
interface ToolResult {
	success: boolean
	data?: any
	message?: string
	error?: string
	metadata?: {
		duration?: number
		resourceUsage?: ResourceUsage
		warnings?: string[]
	}
}
```

## Implementation Languages

### Node.js/JavaScript Tools

Most flexible and performant option for Roo CLI integration.

```javascript
// tools/data-processor.js
module.exports = {
	name: "data_processor",
	description: "Process and transform data files",
	category: "data",

	parameters: {
		inputFile: {
			type: "string",
			required: true,
			description: "Path to input data file",
		},
		outputFormat: {
			type: "string",
			required: false,
			default: "json",
			enum: ["json", "csv", "xml"],
			description: "Output format",
		},
		transformations: {
			type: "array",
			required: false,
			description: "List of transformations to apply",
		},
	},

	async execute(params) {
		const startTime = Date.now()

		try {
			// Validate input file
			if (!fs.existsSync(params.inputFile)) {
				return {
					success: false,
					error: `Input file not found: ${params.inputFile}`,
				}
			}

			// Read and process data
			const rawData = await fs.readFile(params.inputFile, "utf8")
			const data = JSON.parse(rawData)

			// Apply transformations
			let processedData = data
			if (params.transformations) {
				for (const transform of params.transformations) {
					processedData = await applyTransformation(processedData, transform)
				}
			}

			// Format output
			const output = formatOutput(processedData, params.outputFormat)

			return {
				success: true,
				data: output,
				message: `Processed ${data.length} records`,
				metadata: {
					duration: Date.now() - startTime,
					recordCount: data.length,
					transformationsApplied: params.transformations?.length || 0,
				},
			}
		} catch (error) {
			return {
				success: false,
				error: error.message,
				metadata: {
					duration: Date.now() - startTime,
				},
			}
		}
	},

	validate(params) {
		const errors = []

		if (!params.inputFile) {
			errors.push("Input file is required")
		}

		if (params.outputFormat && !["json", "csv", "xml"].includes(params.outputFormat)) {
			errors.push("Invalid output format")
		}

		return {
			valid: errors.length === 0,
			errors,
		}
	},
}
```

### Python Tools

Great for data science, machine learning, and scientific computing.

```python
#!/usr/bin/env python3
# tools/ml-analyzer.py

import json
import sys
import argparse

def execute(params):
    """Execute the ML analysis tool"""
    try:
        input_data = params.get('input')
        options = params.get('options', {})

        # Tool implementation
        result = process_data(input_data, options)

        return {
            'success': True,
            'data': result,
            'message': 'Analysis completed successfully'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': 'Analysis failed'
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

### Shell Script Tools

Simple tools for system operations and existing tool integration.

```bash
#!/bin/bash
# tools/git-analyzer.sh

show_help() {
    cat << 'EOF'
{
  "name": "git_analyzer",
  "description": "Analyze Git repository statistics",
  "category": "vcs",
  "parameters": {
    "repository": {
      "type": "string",
      "required": true,
      "description": "Path to Git repository"
    },
    "branch": {
      "type": "string",
      "required": false,
      "default": "main",
      "description": "Branch to analyze"
    }
  }
}
EOF
}

execute_analysis() {
    local params="$1"
    local repository=$(echo "$params" | jq -r '.repository')
    local branch=$(echo "$params" | jq -r '.branch // "main"')

    cd "$repository" || {
        echo '{"success": false, "error": "Cannot access repository"}'
        return 1
    }

    # Gather statistics
    local total_commits=$(git rev-list --count "$branch")
    local contributors=$(git log --format='%an' "$branch" | sort | uniq | wc -l)

    cat << EOF
{
    "success": true,
    "data": {
        "repository": "$repository",
        "branch": "$branch",
        "total_commits": $total_commits,
        "contributors": $contributors
    },
    "message": "Analyzed repository successfully"
}
EOF
}

case "${1:-}" in
    --help) show_help ;;
    --execute) execute_analysis "$2" ;;
    *) echo '{"success": false, "error": "Invalid command"}'; exit 1 ;;
esac
```

## Tool Registration

### Configuration-Based Registration

Register tools in your Roo CLI configuration:

```json
{
	"tools": {
		"customToolsPath": "./tools",
		"customTools": {
			"data_processor": {
				"command": "node",
				"args": ["./tools/data-processor.js"],
				"timeout": 60000,
				"category": "data"
			},
			"ml_analyzer": {
				"command": "python3",
				"args": ["./tools/ml-analyzer.py"],
				"timeout": 120000,
				"category": "ml"
			},
			"git_analyzer": {
				"command": "bash",
				"args": ["./tools/git-analyzer.sh"],
				"timeout": 30000,
				"category": "vcs"
			}
		}
	}
}
```

## Best Practices

### Error Handling

```javascript
async function robustExecute(params) {
	const startTime = Date.now()

	try {
		// Validate parameters
		const validation = this.validate(params)
		if (!validation.valid) {
			return {
				success: false,
				error: "Parameter validation failed",
				details: validation.errors,
			}
		}

		// Execute with timeout
		const result = await this.executeImpl(params)

		return {
			success: true,
			data: result,
			metadata: {
				duration: Date.now() - startTime,
			},
		}
	} catch (error) {
		return {
			success: false,
			error: error.message,
			metadata: {
				duration: Date.now() - startTime,
			},
		}
	}
}
```

### Parameter Validation

```javascript
function validateParameters(params, schema) {
	const errors = []

	// Check required parameters
	for (const [name, spec] of Object.entries(schema)) {
		if (spec.required && !(name in params)) {
			errors.push(`Required parameter missing: ${name}`)
			continue
		}

		if (name in params) {
			const value = params[name]

			// Type validation
			if (spec.type && typeof value !== spec.type) {
				errors.push(`Parameter ${name} must be of type ${spec.type}`)
			}

			// Enum validation
			if (spec.enum && !spec.enum.includes(value)) {
				errors.push(`Parameter ${name} must be one of: ${spec.enum.join(", ")}`)
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	}
}
```

## Testing Custom Tools

### Unit Testing

```javascript
// tools/__tests__/data-processor.test.js
const DataProcessor = require("../data-processor")

describe("DataProcessor", () => {
	let processor

	beforeEach(() => {
		processor = new DataProcessor()
	})

	test("should process valid JSON data", async () => {
		const result = await processor.execute({
			inputFile: "./test-data/sample.json",
			outputFormat: "json",
		})

		expect(result.success).toBe(true)
		expect(result.data).toBeDefined()
	})

	test("should validate parameters correctly", () => {
		const validation = processor.validate({})
		expect(validation.valid).toBe(false)
		expect(validation.errors).toContain("Input file is required")
	})
})
```

## Deployment

### Package Structure

```
my-roo-tools/
├── package.json
├── README.md
├── tools/
│   ├── data-processor.js
│   ├── ml-analyzer.py
│   └── git-analyzer.sh
├── tests/
│   └── data-processor.test.js
└── docs/
    └── tools-reference.md
```

### Installation

```bash
# Install tool package
npm install -g @company/roo-tools

# Register with Roo CLI
roo-tools install

# Verify installation
roo-cli tools list --source custom
```

## Security Considerations

### Input Validation

Always validate and sanitize all inputs:

```javascript
function sanitizeInput(input) {
	// Remove potentially dangerous characters
	return input.replace(/[<>\"'%;()&+]/g, "")
}

function validateFilePath(path) {
	// Ensure path is within allowed directories
	const allowedPaths = ["/src", "/docs", "/tests"]
	return allowedPaths.some((allowed) => path.startsWith(allowed))
}
```

### Resource Limits

Implement timeouts and resource limits:

```javascript
class ResourceManager {
	constructor(limits = {}) {
		this.memoryLimit = limits.memory || 100 * 1024 * 1024 // 100MB
		this.timeoutMs = limits.timeout || 30000 // 30 seconds
	}

	async executeWithLimits(fn) {
		const timeout = setTimeout(() => {
			throw new Error("Execution timeout")
		}, this.timeoutMs)

		try {
			const result = await fn()
			return result
		} finally {
			clearTimeout(timeout)
		}
	}
}
```

## Advanced Topics

### Tool Composition

```javascript
// Chain multiple tools together
async function executeToolChain(tools, initialData) {
	let data = initialData

	for (const toolConfig of tools) {
		const tool = await loadTool(toolConfig.name)
		const result = await tool.execute({
			...toolConfig.params,
			input: data,
		})

		if (!result.success) {
			throw new Error(`Tool ${toolConfig.name} failed: ${result.error}`)
		}

		data = result.data
	}

	return data
}
```

### Performance Monitoring

```javascript
class PerformanceMonitor {
	constructor() {
		this.metrics = new Map()
	}

	startTimer(toolName) {
		this.metrics.set(toolName, {
			start: Date.now(),
			memory: process.memoryUsage(),
		})
	}

	endTimer(toolName) {
		const metric = this.metrics.get(toolName)
		if (metric) {
			metric.duration = Date.now() - metric.start
			metric.memoryDelta = process.memoryUsage().heapUsed - metric.memory.heapUsed
		}
		return metric
	}
}
```

## Troubleshooting

### Common Issues

1. **Tool not found**: Check tool registration and path
2. **Permission denied**: Verify file permissions and execution rights
3. **Timeout errors**: Increase timeout or optimize tool performance
4. **Memory errors**: Implement streaming for large data processing

### Debug Mode

```bash
# Enable debug mode for custom tools
export DEBUG=roo-cli:tools
roo-cli tools execute my_tool --params '{"debug": true}'

# Check tool registration
roo-cli tools list --verbose

# Validate tool configuration
roo-cli config --validate
```

For more information, see:

- [Tools Overview](./overview.md)
- [File Operations](./file-operations.md)
- [Browser Tools](./browser-tools.md)
- [Terminal Tools](./terminal-tools.md)
