# Commands Overview

Roo CLI provides a comprehensive set of commands for managing your AI-powered development workflow. Commands are organized into categories for easy discovery and use.

## Command Categories

### Core Commands

- [`help`](#help) - Show help information and documentation
- [`version`](#version) - Display version and system information
- [`config`](#config) - Configuration management
- Interactive mode - Start conversational development session

### Session Management

- [`session list`](#session-list) - List all saved sessions
- [`session save`](#session-save) - Save current session
- [`session load`](#session-load) - Load a saved session
- [`session delete`](#session-delete) - Delete sessions
- [`session export`](#session-export) - Export session data
- [`session import`](#session-import) - Import session data
- [`session cleanup`](#session-cleanup) - Clean up old sessions

### MCP (Model Context Protocol)

- [`mcp list`](#mcp-list) - List configured MCP servers
- [`mcp connect`](#mcp-connect) - Connect to MCP servers
- [`mcp disconnect`](#mcp-disconnect) - Disconnect from MCP servers
- [`mcp tools`](#mcp-tools) - List available MCP tools
- [`mcp resources`](#mcp-resources) - List available MCP resources
- [`mcp execute`](#mcp-execute) - Execute MCP tools

### Batch Processing

- [`--batch`](#batch-mode) - Execute single tasks or batch files
- [`--stdin`](#stdin-mode) - Read commands from standard input

## Core Commands

### help

Show comprehensive help information for commands, tools, and topics.

```bash
# General help
roo-cli help

# Command-specific help
roo-cli help config
roo-cli help session

# Tool help
roo-cli help tools
roo-cli help tools read_file

# Configuration help
roo-cli help config

# Search help topics
roo-cli help search browser
roo-cli help search "file operations"
```

**Options:**

- `[topic]` - Help topic (command, config, tools, search)
- `[subtopic]` - Subtopic or search query

### version

Display detailed version and system information.

```bash
# Basic version
roo-cli --version
roo-cli version

# Detailed version info
roo-cli version --json

# System information
roo-cli version
```

**Output includes:**

- Roo CLI version
- Node.js version
- Platform and architecture
- Installation path

### config

Comprehensive configuration management commands.

```bash
# Show current configuration
roo-cli config --show

# Validate configuration file
roo-cli config --validate ./config.json

# Generate default configuration
roo-cli config --generate $HOME/.roo-cli/config.json

# Interactive configuration setup
roo-cli config init
```

**Subcommands:**

- `--show` - Display current configuration
- `--validate <path>` - Validate configuration file
- `--generate <path>` - Generate default configuration
- `init` - Interactive configuration setup

## Global Options

These options can be used with any command:

### Input/Output Options

```bash
--cwd <path>              # Working directory
--config <path>           # Configuration file path
--format <format>         # Output format (json, yaml, plain, csv, markdown)
--output <file>           # Output file path
--verbose                 # Enable verbose logging
--quiet                   # Suppress non-essential output
--no-color                # Disable colored output
--color-scheme <scheme>   # Color scheme (default, dark, light, etc.)
```

### Agent Options

```bash
--model <name>            # AI model to use
--mode <mode>             # Agent mode (code, debug, architect, etc.)
--temperature <value>     # Model temperature (0.0-1.0)
--max-tokens <count>      # Maximum response tokens
```

### Browser Options

```bash
--headless                # Run browser in headless mode (default)
--no-headless             # Run browser in headed mode
--browser-viewport <size> # Browser viewport size (e.g., 1920x1080)
--browser-timeout <ms>    # Browser operation timeout
--screenshot-output <dir> # Directory for screenshots
--user-agent <agent>      # Custom user agent string
```

### MCP Options

```bash
--mcp-config <path>       # MCP configuration file
--mcp-server <id>         # MCP server IDs to connect (repeatable)
--mcp-timeout <ms>        # Timeout for MCP operations
--mcp-retries <count>     # Number of retry attempts
--mcp-auto-connect        # Automatically connect to enabled servers
--mcp-log-level <level>   # MCP logging level (error, warn, info, debug)
```

### Non-Interactive Options

```bash
--batch <task>            # Run in batch mode
--stdin                   # Read commands from stdin
--yes                     # Assume yes for all prompts
--no                      # Assume no for all prompts
--timeout <ms>            # Global timeout for operations
--parallel                # Execute commands in parallel
--continue-on-error       # Continue execution on errors
--dry-run                 # Show what would be executed
```

## Usage Patterns

### Interactive Mode

Start a conversational development session:

```bash
# Basic interactive mode
roo-cli

# With specific configuration
roo-cli --config ./dev-config.json --verbose

# With custom working directory
roo-cli --cwd /path/to/project

# With specific agent mode
roo-cli --mode debug --verbose
```

### Batch Mode

Execute tasks without interaction:

```bash
# Single task
roo-cli --batch "Create a hello world function"

# Task with output formatting
roo-cli --batch "Analyze code quality" --format json --output report.json

# Task with specific mode
roo-cli --mode test --batch "Generate unit tests for User model"

# Batch file processing
roo-cli --batch tasks.json
roo-cli --batch commands.yaml --parallel
```

### Configuration Management

```bash
# Show current settings
roo-cli config --show

# Generate new configuration
roo-cli --generate-config $HOME/.roo-cli/config.json

# Validate existing configuration
roo-cli config --validate ./project-config.json

# Use custom configuration
roo-cli --config ./special-config.json config --show
```

### Session Workflows

```bash
# List all sessions
roo-cli session list

# Start working and save session
roo-cli
# ... do work in interactive mode ...
roo> session save "feature-implementation"

# Later, load the session
roo-cli session load <session-id>

# Export session for sharing
roo-cli session export <session-id> --output session.json

# Clean up old sessions
roo-cli session cleanup --max-age 30
```

### MCP Integration

```bash
# List available MCP servers
roo-cli mcp list

# Connect to specific servers
roo-cli mcp connect github-server filesystem-server

# List available tools
roo-cli mcp tools

# Execute MCP tools
roo-cli mcp execute github-server get_repository owner=user repo=project

# Use MCP in batch mode
roo-cli --mcp-server github-server --batch "Get repository information"
```

## Command Chaining and Pipelines

### Unix Pipeline Integration

```bash
# Pipe output to other tools
roo-cli --batch "List all TODO comments" --format csv | sort | uniq

# Use with find
find . -name "*.py" -exec roo-cli --batch "Analyze this file: {}" \;

# Process JSON output
roo-cli config --show --format json | jq '.model'

# Save and process results
roo-cli --batch "Generate metrics" --format json --output metrics.json
cat metrics.json | jq '.complexity > 5'
```

### Batch Processing

```bash
# Sequential processing
roo-cli --batch tasks.json

# Parallel processing
roo-cli --batch tasks.json --parallel

# Continue on errors
roo-cli --batch tasks.json --continue-on-error

# Dry run mode
roo-cli --batch tasks.json --dry-run
```

## Environment Integration

### Environment Variables

```bash
# Set default behavior
export ROO_MODE="debug"
export ROO_OUTPUT_FORMAT="json"
export ROO_VERBOSE="true"

# Run with environment settings
roo-cli --batch "Debug this issue"
```

### Configuration Profiles

```bash
# Development profile
roo-cli --config ./profiles/dev.json

# Production profile
roo-cli --config ./profiles/prod.json

# Testing profile
roo-cli --config ./profiles/test.json
```

## Error Handling

### Verbose Mode

Enable detailed logging to understand command execution:

```bash
# Verbose output
roo-cli --verbose --batch "Complex task"

# Debug level logging
roo-cli --verbose --mcp-log-level debug mcp list

# Quiet mode (minimal output)
roo-cli --quiet --batch "Simple task"
```

### Error Recovery

```bash
# Continue on command failures
roo-cli --batch tasks.json --continue-on-error

# Timeout handling
roo-cli --timeout 60000 --batch "Long running task"

# Retry with different configuration
roo-cli --config fallback.json --batch "Retry task"
```

## Getting Help

### Built-in Help

```bash
# Command help
roo-cli --help
roo-cli help
roo-cli help config
roo-cli help session

# Tool help
roo-cli help tools
roo-cli help tools read_file

# Search help
roo-cli help search browser
roo-cli help search "configuration"
```

### Online Documentation

- **Complete documentation**: [https://docs.roocode.com/cli](https://docs.roocode.com/cli)
- **Command reference**: [https://docs.roocode.com/cli/commands](https://docs.roocode.com/cli/commands)
- **Troubleshooting**: [https://docs.roocode.com/cli/troubleshooting](https://docs.roocode.com/cli/troubleshooting)

## Next Steps

- [Core Commands](./core-commands.md) - Detailed reference for essential commands
- [Session Commands](./session-commands.md) - Session management in depth
- [MCP Commands](./mcp-commands.md) - Model Context Protocol integration
- [Configuration Guide](../configuration/overview.md) - Configuration management
- [Tools Reference](../tools/overview.md) - Available tools and capabilities
