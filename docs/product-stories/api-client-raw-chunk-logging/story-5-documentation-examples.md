# Story 5: Documentation and Examples for Raw Chunk Logging

## Story Overview

**Epic**: Documentation  
**Points**: 2  
**Dependencies**: Story 1, 2, 3 (All implementation stories)  
**Priority**: Medium

## User Story

As a developer, I want clear documentation and examples for raw chunk logging so that I can understand how to use the feature effectively.

## Acceptance Criteria

### AC1: CLI Help Documentation

- [ ] Update `showHelpText()` function with raw chunk logging options
- [ ] Clear descriptions of `--log-raw-chunks` and `--raw-chunk-log-dir`
- [ ] Include usage examples in help text
- [ ] Consistent formatting with existing help sections

### AC2: Technical Documentation

- [ ] Update existing technical documentation
- [ ] Document log file format and structure
- [ ] Explain chunk separator usage
- [ ] Include performance considerations
- [ ] Document error handling behavior

### AC3: Usage Examples

- [ ] Create comprehensive usage examples
- [ ] Show different configuration scenarios
- [ ] Include troubleshooting guidance
- [ ] Provide sample log file outputs
- [ ] Document integration with existing features

### AC4: API Documentation

- [ ] Document `ApiChunkLogger` class interface
- [ ] Include code examples for programmatic usage
- [ ] Document configuration options
- [ ] Include error handling examples
- [ ] Document performance characteristics

### AC5: User Guide Updates

- [ ] Update user guides with new feature
- [ ] Include screenshots or examples of log output
- [ ] Provide debugging workflow guidance
- [ ] Include best practices recommendations
- [ ] Document when to use this feature

## Technical Implementation

### Updated Help Text

```typescript
function showHelpText(): void {
	console.log(`
Roo Code Agent API Client

Usage: node api-client.js [options] [task]

Basic Options:
  --stream                      Use streaming API endpoint
  --mode <mode>                 Set agent mode (default: code)
  --host <host>                 API host (default: localhost)
  --port <port>                 API port (default: 3000)
  --verbose, -v                 Enable verbose output
  --help, -h                    Show this help message

Output Control:
  --show-thinking               Show reasoning content
  --show-tools                  Show tool usage
  --show-system                 Show system messages
  --show-response               Show full responses
  --show-completion             Show completion messages
  --show-mcp-use                Show MCP tool usage
  --show-token-usage            Show token usage (default: true)
  --hide-token-usage            Hide token usage
  --show-timing                 Show timing information

Raw Chunk Logging:
  --log-raw-chunks              Enable raw HTTP chunk logging
  --raw-chunk-log-dir <path>    Directory for raw chunk log files
                               (default: ~/.agentz/logs)

Advanced Options:
  --log-system-prompt           Log system prompt to file
  --log-llm                     Log LLM interactions to file
  --task <task-id>              Resume existing task
  --repl                        Enter interactive REPL mode

Examples:
  # Basic streaming request
  node api-client.js --stream "Fix the bug in app.js"

  # Enable raw chunk logging for debugging
  node api-client.js --stream --log-raw-chunks --verbose "debug streaming issue"

  # Custom log directory
  node api-client.js --stream --log-raw-chunks --raw-chunk-log-dir ./debug-logs "test task"

  # Combined with other logging options
  node api-client.js --stream --log-raw-chunks --log-llm --verbose "complex debugging"

  # REPL mode with chunk logging
  node api-client.js --repl --log-raw-chunks

Raw Chunk Log Files:
  Log files are named: raw-api-chunks-YYYY-MM-DD_HH-mm-ss.log
  Chunks are separated by bullet character (•)
  Includes request context and metadata
  `)
}
```

### Technical Documentation Updates

```markdown
# Raw Chunk Logging

## Overview

Raw chunk logging captures HTTP response chunks as they arrive from the API server, before any parsing or processing occurs. This is useful for debugging streaming issues, analyzing performance, and troubleshooting network problems.

## Configuration

- **Enable**: `--log-raw-chunks`
- **Directory**: `--raw-chunk-log-dir <path>`
- **Default location**: `~/.agentz/logs`

## Log File Format
```

=== API Chunk Log - 2025-01-17T12:34:56.789Z ===
Host: localhost:3000
Endpoint: /api/v1/task/stream
Task ID: 12345678-1234-5678-9012-123456789012
Request ID: req-1705488896789-x7k9m2n4p
===

data: {"type":"start","taskId":"12345678-1234-5678-9012-123456789012"}

•data: {"type":"text","content":"Hello"}

•data: {"type":"text","content":" world"}

•data: {"type":"completion","result":"success"}

•data: {"type":"stream_end"}

````

## Usage Patterns

### Debugging Stream Issues
```bash
# Enable verbose logging with raw chunks
node api-client.js --stream --log-raw-chunks --verbose "debug this streaming issue"

# Check the log file
cat ~/.agentz/logs/raw-api-chunks-2025-01-17_12-34-56.log
````

### Performance Analysis

```bash
# Log chunks with timing information
node api-client.js --stream --log-raw-chunks --show-timing "performance test"
```

### Custom Log Location

```bash
# Use custom directory for organization
node api-client.js --stream --log-raw-chunks --raw-chunk-log-dir ./project-debug "test task"
```

## Best Practices

1. **Enable only when needed**: Raw logging has minimal but measurable overhead
2. **Use custom directories**: Organize logs by project or issue
3. **Combine with other logging**: Use with `--log-llm` for complete debugging
4. **Check disk space**: Raw logs can be large for long-running streams

## Troubleshooting

### Common Issues

- **Permission errors**: Ensure write access to log directory
- **Disk space**: Raw logs can grow large with long streams
- **Performance**: Disable when not needed for debugging

### Log Analysis

- **Chunk boundaries**: Look for bullet separators (•)
- **Timing**: Compare with `--show-timing` output
- **Content**: Verify SSE event format is correct
- **Completion**: Check for `stream_end` event

```

## Files to Create/Modify

### Modified Files
- `src/tools/api-client.ts` - Update help text function
- `docs/technical/api-client-raw-chunk-logging.md` - Add usage examples
- `docs/cli/configuration/logging.md` - Add raw chunk logging section
- `README.md` - Update with new feature mention

### New Documentation Files
- `docs/cli/examples/raw-chunk-logging.md` - Comprehensive examples
- `docs/technical/debugging-streaming.md` - Debugging guide
- `docs/api/api-chunk-logger.md` - API documentation

## Definition of Done
- [ ] CLI help text updated and accurate
- [ ] Technical documentation comprehensive
- [ ] Usage examples cover common scenarios
- [ ] API documentation complete
- [ ] User guides updated
- [ ] Examples tested and verified
- [ ] Documentation reviewed for clarity
- [ ] Links and references updated

## Documentation Structure

### User Documentation
```

docs/
├── cli/
│ ├── configuration/
│ │ └── logging.md # Updated with raw chunk logging
│ └── examples/
│ └── raw-chunk-logging.md # New: Comprehensive examples
├── technical/
│ ├── api-client-raw-chunk-logging.md # Updated with examples
│ └── debugging-streaming.md # New: Debugging guide
└── api/
└── api-chunk-logger.md # New: API documentation

```

### Example Content Topics

#### Usage Examples
- Basic enabling of raw chunk logging
- Custom log directory configuration
- Combining with other logging options
- REPL mode with chunk logging
- Performance analysis workflows
- Debugging specific issues

#### API Documentation
- `ApiChunkLogger` class interface
- Configuration options
- Error handling
- Performance characteristics
- Integration examples

#### Debugging Guide
- When to use raw chunk logging
- How to analyze log files
- Common patterns and issues
- Performance considerations
- Troubleshooting steps

## Review Checklist
- [ ] Help text is clear and comprehensive
- [ ] Examples are tested and accurate
- [ ] Documentation follows existing patterns
- [ ] API documentation is complete
- [ ] User guides are updated
- [ ] Links and references work
- [ ] Code examples are syntactically correct
- [ ] Performance guidance is accurate
- [ ] Troubleshooting section is helpful
- [ ] Documentation is accessible to different skill levels

## User Feedback Integration
- [ ] Include common use cases from development
- [ ] Address anticipated user questions
- [ ] Provide clear troubleshooting steps
- [ ] Include performance guidance
- [ ] Show integration with existing workflows
```
