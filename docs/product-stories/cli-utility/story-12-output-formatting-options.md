# Story 12: Add Output Formatting Options

**Phase**: 3 - Tool Adaptation  
**Labels**: `cli-utility`, `phase-3`, `formatting`, `output`  
**Story Points**: 5  
**Priority**: Medium  

## User Story
As a developer using the CLI utility, I want different output formats (JSON, plain text), so that I can integrate the tool with other systems.

## Acceptance Criteria

### Output Format Support
- [ ] JSON output format for structured data
- [ ] Plain text format for human-readable output
- [ ] YAML format for configuration-friendly output
- [ ] CSV format for tabular data
- [ ] Markdown format for documentation output

### Format Selection
- [ ] CLI argument `--format` or `-f` for format selection
- [ ] Environment variable `ROO_OUTPUT_FORMAT` support
- [ ] Configuration file setting for default format
- [ ] Auto-detection based on output redirection

### Structured Data Formatting
- [ ] Consistent schema for JSON output across all tools
- [ ] Proper escaping and encoding for all formats
- [ ] Metadata inclusion (timestamps, version, etc.)
- [ ] Error formatting consistent across formats

### Integration Features
- [ ] Machine-readable exit codes
- [ ] Structured error reporting
- [ ] Progress information in structured formats
- [ ] Streaming output support for large datasets

## Technical Details

### Output Formatter Service
```typescript
// src/cli/services/OutputFormatterService.ts
interface IOutputFormatterService {
  format(data: any, format: OutputFormat): string
  setDefaultFormat(format: OutputFormat): void
  getAvailableFormats(): OutputFormat[]
  validateFormat(format: string): boolean
  
  // Specialized formatters
  formatError(error: Error, format: OutputFormat): string
  formatProgress(progress: ProgressData, format: OutputFormat): string
  formatTable(data: TableData, format: OutputFormat): string
}

enum OutputFormat {
  JSON = 'json',
  PLAIN = 'plain',
  YAML = 'yaml',
  CSV = 'csv',
  MARKDOWN = 'markdown'
}
```

### Output Schema Definitions
```typescript
interface FormattedOutput {
  metadata: OutputMetadata
  data: any
  errors?: ErrorInfo[]
  warnings?: WarningInfo[]
}

interface OutputMetadata {
  timestamp: string
  version: string
  format: OutputFormat
  command: string
  duration: number
  exitCode: number
}

interface ErrorInfo {
  code: string
  message: string
  details?: any
  stack?: string
}

interface WarningInfo {
  code: string
  message: string
  details?: any
}
```

### Format-Specific Implementations
```typescript
// JSON Formatter
class JSONFormatter implements IFormatter {
  format(data: FormattedOutput): string {
    return JSON.stringify(data, null, 2)
  }
  
  formatError(error: Error): string {
    return JSON.stringify({
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      }
    }, null, 2)
  }
}

// Plain Text Formatter
class PlainTextFormatter implements IFormatter {
  format(data: FormattedOutput): string {
    let output = ''
    
    if (data.data) {
      output += this.formatData(data.data)
    }
    
    if (data.errors?.length) {
      output += '\nErrors:\n'
      data.errors.forEach(err => {
        output += `  ❌ ${err.message}\n`
      })
    }
    
    if (data.warnings?.length) {
      output += '\nWarnings:\n'
      data.warnings.forEach(warn => {
        output += `  ⚠️  ${warn.message}\n`
      })
    }
    
    return output
  }
}

// YAML Formatter
class YAMLFormatter implements IFormatter {
  format(data: FormattedOutput): string {
    return yaml.dump(data, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    })
  }
}
```

### CLI Integration
```typescript
// Command line argument parsing
interface CLIOptions {
  format?: OutputFormat
  quiet?: boolean
  verbose?: boolean
  output?: string // output file path
}

// Usage examples:
// roo --format json "create a todo app"
// roo -f yaml --output result.yml "analyze this code"
// ROO_OUTPUT_FORMAT=json roo "list files"
```

### File Structure
```
src/cli/services/
├── OutputFormatterService.ts
├── formatters/
│   ├── JSONFormatter.ts
│   ├── PlainTextFormatter.ts
│   ├── YAMLFormatter.ts
│   ├── CSVFormatter.ts
│   └── MarkdownFormatter.ts
└── types/
    ├── output-types.ts
    └── formatter-types.ts

src/cli/utils/
├── format-detection.ts
└── output-validation.ts
```

## Dependencies
- Story 10: Implement CLI-Specific UI Elements
- Story 11: Ensure Browser Tools Headless Mode
- `js-yaml` package for YAML formatting
- `csv-stringify` package for CSV formatting

## Definition of Done
- [ ] OutputFormatterService implemented with all format support
- [ ] CLI arguments for format selection working
- [ ] Environment variable support implemented
- [ ] All output formats properly tested
- [ ] Consistent error formatting across formats
- [ ] Integration with existing CLI tools completed
- [ ] Unit tests for all formatters
- [ ] Integration tests with real CLI usage
- [ ] Documentation updated with format examples
- [ ] Performance benchmarks for large output formatting

## Implementation Notes
- Ensure consistent schema across all structured formats
- Handle circular references in JSON formatting
- Implement streaming for large datasets
- Add validation for output format compatibility
- Consider locale-specific formatting for dates/numbers

## Format Examples

### JSON Output
```json
{
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "format": "json",
    "command": "list files",
    "duration": 150,
    "exitCode": 0
  },
  "data": {
    "files": [
      {"name": "app.js", "size": 1024, "modified": "2024-01-15T09:00:00Z"},
      {"name": "package.json", "size": 512, "modified": "2024-01-14T15:30:00Z"}
    ]
  }
}
```

### Plain Text Output
```
Files found: 2

📄 app.js (1.0 KB) - Modified: Jan 15, 09:00
📄 package.json (512 B) - Modified: Jan 14, 15:30

✅ Command completed in 150ms
```

### YAML Output
```yaml
metadata:
  timestamp: '2024-01-15T10:30:00Z'
  version: '1.0.0'
  format: yaml
  command: list files
  duration: 150
  exitCode: 0
data:
  files:
    - name: app.js
      size: 1024
      modified: '2024-01-15T09:00:00Z'
    - name: package.json
      size: 512
      modified: '2024-01-14T15:30:00Z'
```

## GitHub Issue Template
```markdown
## Summary
Add support for multiple output formats (JSON, plain text, YAML, CSV, Markdown) to enable integration with other systems.

## Tasks
- [ ] Implement OutputFormatterService
- [ ] Create format-specific formatter classes
- [ ] Add CLI argument support for format selection
- [ ] Implement environment variable support
- [ ] Add output file writing capabilities
- [ ] Write comprehensive tests
- [ ] Update documentation with examples

## Acceptance Criteria
[Copy from story document]

Labels: cli-utility, phase-3, formatting, output