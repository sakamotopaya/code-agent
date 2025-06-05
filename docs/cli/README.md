# Roo CLI Documentation

Welcome to the Roo Command Line Interface (CLI) documentation. Roo CLI is a powerful AI-powered development assistant that brings the capabilities of the Roo Code VS Code extension to the command line.

## Quick Start

### Installation

```bash
npm install -g roo-cli
```

### Basic Usage

#### Interactive Mode (Main Usage)

```bash
# Start interactive mode
roo-cli
```

Once started, simply type your prompts directly and press Enter:

```
🤖 Roo> Create a React todo app with TypeScript
🤖 Roo> Debug the memory leak in my authentication code
🤖 Roo> Refactor this function to be more efficient
🤖 Roo> Add unit tests for the user service
```

**Multi-line prompts:** Use ` ``` ` to start/end multi-line input:

````
🤖 Roo> ```
Create a new user registration form
with validation and error handling
using React and TypeScript
````

````

**Available REPL commands:**
- `help` - Show help information
- `exit` or `quit` - Exit the CLI
- `clear` - Clear screen
- `status` - Show current task status
- `abort` - Abort current running task
- `config show` - Show configuration

#### Batch Mode (Single Tasks)

```bash
# Run a single task and exit
roo-cli --batch "Create a hello world function"

# Run with specific configuration
roo-cli --config ./my-config.json --batch "Analyze this codebase"

# Pipe input from stdin
echo "Fix the bug in user.js" | roo-cli --stdin
````

#### Configuration

```bash
# Generate default configuration
roo-cli --generate-config ~/.roo-cli/config.json

# Show current configuration
roo-cli config --show

# Validate configuration
roo-cli config --validate
```

## Documentation Structure

### 📚 Getting Started

- [Installation Guide](./installation.md) - Installation and setup instructions
- [Getting Started](./getting-started.md) - First steps with Roo CLI

### ⚙️ Configuration

- [Configuration Overview](./configuration/overview.md) - Configuration system overview
- [File Format](./configuration/file-format.md) - Configuration file format reference
- [Environment Variables](./configuration/environment-variables.md) - Environment variable reference
- [Examples](./configuration/examples.md) - Configuration examples

### 🖥️ Commands

- [Commands Overview](./commands/overview.md) - All available commands
- [Core Commands](./commands/core-commands.md) - Essential commands
- [Tool Commands](./commands/tool-commands.md) - Tool-related commands
- [Session Commands](./commands/session-commands.md) - Session management
- [MCP Commands](./commands/mcp-commands.md) - Model Context Protocol commands

### 🔧 Tools

- [Tools Overview](./tools/overview.md) - Available tools and capabilities
- [File Operations](./tools/file-operations.md) - File manipulation tools
- [Browser Tools](./tools/browser-tools.md) - Web browser automation
- [Terminal Tools](./tools/terminal-tools.md) - Terminal and command execution
- [Custom Tools](./tools/custom-tools.md) - Creating custom tools

### 📖 Guides

- [Workflows](./guides/workflows.md) - Common workflow patterns
- [Automation](./guides/automation.md) - Automating tasks with Roo CLI
- [Integration](./guides/integration.md) - Integrating with other tools
- [Best Practices](./guides/best-practices.md) - Best practices and tips

### 🔍 Troubleshooting

- [Common Issues](./troubleshooting/common-issues.md) - Frequently encountered problems
- [Debugging](./troubleshooting/debugging.md) - Debugging techniques
- [Performance](./troubleshooting/performance.md) - Performance optimization
- [Platform-Specific](./troubleshooting/platform-specific.md) - OS-specific issues

### 🚀 Migration

- [From VS Code](./migration/from-vscode.md) - Migrating from VS Code extension
- [Feature Comparison](./migration/feature-comparison.md) - CLI vs VS Code features
- [Workflow Adaptation](./migration/workflow-adaptation.md) - Adapting workflows

### 🔌 API Reference

- [Interfaces](./api/interfaces.md) - Core interfaces and types
- [Services](./api/services.md) - Service layer documentation
- [Extensions](./api/extensions.md) - Extending Roo CLI

## Key Features

- **Interactive Mode**: Full-featured REPL for conversational development
- **Batch Processing**: Execute multiple tasks from files or command line
- **Multiple Output Formats**: JSON, YAML, CSV, Markdown, and plain text
- **Session Management**: Save, load, and manage development sessions
- **MCP Integration**: Connect to Model Context Protocol servers
- **Browser Automation**: Headless and headed browser control
- **Configuration Management**: Flexible configuration system
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Support

- **Documentation**: [https://docs.roocode.com/cli](https://docs.roocode.com/cli)
- **GitHub Issues**: [https://github.com/roo-dev/roo/issues](https://github.com/roo-dev/roo/issues)
- **Community**: [Discord](https://discord.gg/roo) | [GitHub Discussions](https://github.com/roo-dev/roo/discussions)

## Quick Reference

### Most Common Commands

```bash
roo-cli                                    # Interactive mode
roo-cli --batch "task description"        # Single task
roo-cli config --show                     # Show configuration
roo-cli session list                      # List sessions
roo-cli mcp list                          # List MCP servers
roo-cli --help                           # Show help
```

### Environment Variables

```bash
export ROO_API_KEY="your-api-key"
export ROO_CONFIG_PATH="./config.json"
export ROO_OUTPUT_FORMAT="json"
```

For detailed information, explore the documentation sections above or run `roo-cli --help` for command-line help.
