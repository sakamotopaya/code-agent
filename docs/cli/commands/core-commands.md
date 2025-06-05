# Core Commands

This document covers the essential core commands that provide the foundation of Roo CLI functionality.

## help

Display help information for commands, tools, and topics.

### Usage

```bash
roo-cli help [command|topic]
roo-cli help tools [tool-name]
roo-cli help search <query>
```

### Options

| Option           | Description                                      |
| ---------------- | ------------------------------------------------ |
| `command`        | Show help for a specific command                 |
| `topic`          | Show help for a topic (config, modes, etc.)      |
| `tools`          | Show available tools or help for a specific tool |
| `search <query>` | Search help content                              |

### Examples

```bash
# General help
roo-cli help

# Command-specific help
roo-cli help config
roo-cli help session

# Tool help
roo-cli help tools
roo-cli help tools read_file

# Search help
roo-cli help search "browser"
roo-cli help search "configuration"
```

### Interactive Help

In interactive mode, help provides contextual assistance:

```bash
roo-cli
roo> help
roo> help config
roo> help tools write_to_file
```

---

## config

Manage configuration settings, files, and validation.

### Usage

```bash
roo-cli config [options]
```

### Options

| Option              | Description                             |
| ------------------- | --------------------------------------- |
| `--show`            | Display current configuration           |
| `--show-sources`    | Show configuration sources and priority |
| `--validate [path]` | Validate configuration file             |
| `--generate <path>` | Generate default configuration          |
| `--backup <path>`   | Backup current configuration            |
| `--restore <path>`  | Restore configuration from backup       |
| `--migrate`         | Migrate configuration to latest format  |
| `--test`            | Test configuration loading              |

### Examples

```bash
# Show current configuration
roo-cli config --show

# Show configuration with sources
roo-cli config --show-sources

# Validate configuration
roo-cli config --validate
roo-cli config --validate ./my-config.json

# Generate default configuration
roo-cli config --generate ~/.roo-cli/config.json

# Create project-specific config
roo-cli config --generate .roo-cli.json --template project

# Backup current configuration
roo-cli config --backup ./config-backup.json

# Test configuration loading
roo-cli config --test --verbose
```

### Configuration Management

#### Generate Configuration

```bash
# Interactive generation
roo-cli config --generate --interactive

# From template
roo-cli config --generate --template web-dev

# Minimal configuration
roo-cli config --generate --minimal
```

#### Validation

```bash
# Validate current config
roo-cli config --validate

# Validate with detailed output
roo-cli config --validate --verbose

# Validate specific file
roo-cli config --validate /path/to/config.json

# Validate and fix common issues
roo-cli config --validate --fix
```

---

## version

Display version information and system details.

### Usage

```bash
roo-cli version [options]
roo-cli --version
roo-cli -v
```

### Options

| Option              | Description                       |
| ------------------- | --------------------------------- |
| `--full`            | Show detailed version information |
| `--check`           | Check for updates                 |
| `--format <format>` | Output format (plain, json, yaml) |

### Examples

```bash
# Basic version
roo-cli version
roo-cli --version

# Detailed version information
roo-cli version --full

# Check for updates
roo-cli version --check

# JSON format
roo-cli version --format json
```

### Version Information

The version command shows:

- **CLI Version**: Current Roo CLI version
- **Node.js Version**: Runtime version
- **Platform**: Operating system and architecture
- **API Version**: Anthropic API version
- **Configuration**: Current config file location
- **Extensions**: Installed extensions and versions

---

## Interactive Mode

Start Roo CLI in interactive mode for conversational development.

### Usage

```bash
roo-cli [options]
```

### Options

| Option            | Description                     |
| ----------------- | ------------------------------- |
| `--mode <mode>`   | Start in specific agent mode    |
| `--config <path>` | Use specific configuration file |
| `--session <id>`  | Load specific session           |
| `--prompt <text>` | Start with initial prompt       |

### Examples

```bash
# Start interactive mode
roo-cli

# Start in debug mode
roo-cli --mode debug

# Start with specific configuration
roo-cli --config ./project-config.json

# Load previous session
roo-cli --session abc123

# Start with initial prompt
roo-cli --prompt "Analyze this codebase"
```

### Interactive Commands

Once in interactive mode, use these commands:

| Command               | Description           |
| --------------------- | --------------------- |
| `help`                | Show help             |
| `config`              | Show configuration    |
| `session save <name>` | Save current session  |
| `session load <id>`   | Load session          |
| `mode <mode>`         | Switch agent mode     |
| `format <format>`     | Change output format  |
| `clear`               | Clear screen          |
| `exit`                | Exit interactive mode |

### Interactive Features

- **Tab Completion**: Auto-complete commands and options
- **History**: Access previous commands with ↑/↓ arrows
- **Multi-line Input**: Use `\` for line continuation
- **Syntax Highlighting**: Colored output for better readability
- **Progress Indicators**: Visual feedback for long operations

---

## Batch Mode

Execute single tasks or batch operations.

### Usage

```bash
roo-cli --batch <task> [options]
roo-cli --file <input-file> [options]
```

### Options

| Option              | Description             |
| ------------------- | ----------------------- |
| `--batch <task>`    | Execute single task     |
| `--file <path>`     | Execute tasks from file |
| `--output <path>`   | Save output to file     |
| `--format <format>` | Output format           |
| `--mode <mode>`     | Agent mode              |
| `--cwd <path>`      | Working directory       |

### Examples

```bash
# Single task
roo-cli --batch "Create a hello world function"

# With specific output
roo-cli --batch "Analyze this codebase" --format json --output analysis.json

# From file
roo-cli --file tasks.txt --output results/

# With custom mode
roo-cli --batch "Debug this error log" --mode debug

# In specific directory
roo-cli --cwd /path/to/project --batch "Add unit tests"
```

### Batch File Format

Create task files for batch processing:

```text
# tasks.txt
Create a README.md for this project
Add unit tests for the Calculator class
Generate API documentation
Optimize database queries in user.py
```

With YAML format:

```yaml
# tasks.yaml
tasks:
    - description: "Create a README.md for this project"
      output: "README.md"
      format: "markdown"

    - description: "Add unit tests for the Calculator class"
      output: "tests/"
      mode: "test"

    - description: "Generate API documentation"
      output: "docs/api.md"
      format: "markdown"
```

---

## Global Options

These options work with all commands:

| Option              | Description             |
| ------------------- | ----------------------- |
| `--config <path>`   | Configuration file path |
| `--cwd <path>`      | Working directory       |
| `--mode <mode>`     | Agent mode              |
| `--format <format>` | Output format           |
| `--output <path>`   | Output file             |
| `--verbose`         | Verbose logging         |
| `--quiet`           | Suppress output         |
| `--no-color`        | Disable colors          |
| `--debug`           | Debug mode              |

### Agent Modes

| Mode               | Description                      |
| ------------------ | -------------------------------- |
| `code`             | General coding tasks (default)   |
| `debug`            | Debugging and troubleshooting    |
| `architect`        | Software design and architecture |
| `ask`              | Question answering and research  |
| `test`             | Testing and quality assurance    |
| `design-engineer`  | UI/UX and design tasks           |
| `release-engineer` | Release and deployment           |
| `translate`        | Localization and translation     |
| `product-owner`    | Product management               |
| `orchestrator`     | Workflow coordination            |

### Output Formats

| Format     | Description                   |
| ---------- | ----------------------------- |
| `plain`    | Human-readable text (default) |
| `json`     | Structured JSON data          |
| `yaml`     | YAML format                   |
| `csv`      | Comma-separated values        |
| `markdown` | Markdown documentation        |
| `xml`      | XML format                    |

## Exit Codes

Roo CLI uses standard exit codes:

| Code | Meaning              |
| ---- | -------------------- |
| `0`  | Success              |
| `1`  | General error        |
| `2`  | Invalid arguments    |
| `3`  | Configuration error  |
| `4`  | API error            |
| `5`  | File system error    |
| `6`  | Network error        |
| `7`  | Authentication error |
| `8`  | Resource limit error |

## Environment Variables

Core commands respect these environment variables:

| Variable            | Description             |
| ------------------- | ----------------------- |
| `ROO_API_KEY`       | Anthropic API key       |
| `ROO_MODE`          | Default agent mode      |
| `ROO_CONFIG_PATH`   | Configuration file path |
| `ROO_OUTPUT_FORMAT` | Default output format   |
| `ROO_VERBOSE`       | Enable verbose output   |
| `ROO_DEBUG`         | Enable debug mode       |

## Common Patterns

### Development Workflow

```bash
# Start with configuration
roo-cli config --show

# Begin interactive session
roo-cli --mode code

# Or run specific tasks
roo-cli --batch "Create a new React component" --output src/components/
roo-cli --batch "Add unit tests" --mode test --output tests/
```

### Automation

```bash
# Save configuration
roo-cli config --generate .roo-cli.json

# Create task list
echo "Analyze code quality" > tasks.txt
echo "Generate documentation" >> tasks.txt

# Process tasks
roo-cli --file tasks.txt --output results/
```

### Team Usage

```bash
# Validate team configuration
roo-cli config --validate .roo-cli.json

# Consistent formatting
roo-cli --batch "Review pull request" --format markdown --output reviews/
```

For more information, see:

- [Session Commands](./session-commands.md)
- [MCP Commands](./mcp-commands.md)
- [Tool Commands](./tool-commands.md)
- [Configuration Guide](../configuration/overview.md)
