# Getting Started with Roo CLI

This guide will help you get up and running with Roo CLI quickly. By the end of this guide, you'll know how to use the basic features and be ready to explore more advanced capabilities.

## Prerequisites

Before starting, make sure you have:

- [Installed Roo CLI](./installation.md)
- An Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))
- Basic familiarity with command line interfaces

## Step 1: Initial Setup

### Set Your API Key

Choose one of these methods to configure your API key:

#### Method A: Environment Variable (Recommended)

```bash
# Set for current session
export ROO_API_KEY="your-anthropic-api-key-here"

# Make permanent (add to ~/.bashrc, ~/.zshrc, etc.)
echo 'export ROO_API_KEY="your-anthropic-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

#### Method B: Configuration File

```bash
# Generate default configuration
roo-cli --generate-config ~/.roo-cli/config.json

# Edit the configuration file
{
  "apiKey": "your-anthropic-api-key-here",
  "model": "claude-3-5-sonnet-20241022",
  "mode": "code"
}
```

### Verify Setup

```bash
# Check if CLI is working
roo-cli --version

# Test configuration
roo-cli config --show
```

## Step 2: Your First Task

### Interactive Mode

Start with interactive mode to get familiar with Roo CLI:

```bash
# Launch interactive mode
roo-cli
```

You'll see the Roo CLI prompt:

```
🤖 Roo CLI - Interactive Mode
Type 'help' for commands, 'exit' to quit

roo>
```

Try these commands:

```bash
# Get help
roo> help

# Show current configuration
roo> config

# Run a simple task
roo> "Create a simple hello world function in Python"

# Exit interactive mode
roo> exit
```

### Batch Mode

For single tasks, use batch mode:

```bash
# Run a single task
roo-cli --batch "Create a hello world function in Python"

# Run with specific output format
roo-cli --batch "Analyze this directory structure" --format json

# Run in specific directory
roo-cli --cwd /path/to/project --batch "Add unit tests to this project"
```

## Step 3: Working with Files

### File Operations

Roo CLI can work with files in your project:

```bash
# Analyze code files
roo-cli --batch "Review the code in src/main.py and suggest improvements"

# Create new files
roo-cli --batch "Create a README.md file for this project"

# Modify existing files
roo-cli --batch "Add error handling to the functions in utils.py"
```

### Output to Files

Save results to files:

```bash
# Save analysis to file
roo-cli --batch "Analyze this codebase" --output analysis.md --format markdown

# Generate documentation
roo-cli --batch "Create API documentation" --output docs/api.json --format json
```

## Step 4: Configuration and Modes

### Agent Modes

Roo CLI supports different specialized modes:

```bash
# Code mode (default) - for development tasks
roo-cli --mode code --batch "Implement a sorting algorithm"

# Debug mode - for troubleshooting
roo-cli --mode debug --batch "Find the bug in this error log"

# Test mode - for testing tasks
roo-cli --mode test --batch "Create unit tests for the Calculator class"

# Architect mode - for design and planning
roo-cli --mode architect --batch "Design a REST API for user management"
```

### Output Formats

Choose different output formats based on your needs:

```bash
# Plain text (default) - human readable
roo-cli --batch "List project dependencies" --format plain

# JSON - structured data
roo-cli --batch "Analyze project structure" --format json

# YAML - configuration friendly
roo-cli --batch "Generate CI/CD config" --format yaml

# Markdown - documentation
roo-cli --batch "Create project overview" --format markdown

# CSV - tabular data
roo-cli --batch "List all functions with complexity" --format csv
```

## Step 5: Session Management

### Save and Load Sessions

Preserve your work across sessions:

```bash
# Start interactive mode
roo-cli

# In interactive mode, work on your project
roo> "Create a web scraper for news articles"
roo> "Add error handling and logging"
roo> "Create unit tests"

# Save the session
roo> session save "news-scraper-project"

# Later, load the session
roo-cli
roo> session load "news-scraper-project"

# List all sessions
roo> session list
```

### Session Commands

```bash
# List sessions from command line
roo-cli session list

# Load specific session
roo-cli session load <session-id>

# Export session
roo-cli session export <session-id> --output session.json

# Clean up old sessions
roo-cli session cleanup --max-age 30
```

## Step 6: Browser Automation

### Headless Browser Tasks

Roo CLI can control web browsers for automation:

```bash
# Web scraping
roo-cli --batch "Scrape the latest news from example.com"

# UI testing
roo-cli --batch "Test the login form on localhost:3000"

# Screenshot capture
roo-cli --batch "Take screenshots of the homepage" --screenshot-output ./screenshots

# Headed mode for debugging
roo-cli --no-headless --batch "Debug the checkout process on the e-commerce site"
```

## Step 7: Advanced Configuration

### Project-Level Configuration

Create project-specific settings:

```bash
# Create project config
cat > .roo-cli.json << EOF
{
  "mode": "code",
  "outputFormat": "markdown",
  "browser": {
    "headless": true,
    "viewport": "1920x1080"
  },
  "session": {
    "autoSave": true,
    "maxHistory": 100
  }
}
EOF

# Use project config
roo-cli --batch "Analyze this project"
```

### Environment-Specific Settings

```bash
# Development environment
export ROO_MODE="debug"
export ROO_OUTPUT_FORMAT="json"
export ROO_VERBOSE=true

# Production environment
export ROO_MODE="code"
export ROO_OUTPUT_FORMAT="plain"
export ROO_QUIET=true
```

## Common Workflows

### Code Review Workflow

```bash
# 1. Analyze the codebase
roo-cli --batch "Analyze code quality and suggest improvements" --format markdown --output review.md

# 2. Check specific files
roo-cli --batch "Review security issues in auth.py" --mode debug

# 3. Generate documentation
roo-cli --batch "Create API documentation from the code" --format markdown --output api-docs.md
```

### Testing Workflow

```bash
# 1. Switch to test mode
roo-cli --mode test

# 2. Generate tests interactively
roo-cli
roo> "Create unit tests for the User model"
roo> "Add integration tests for the API endpoints"
roo> "Generate test data fixtures"

# 3. Save test session
roo> session save "project-testing"
```

### Debugging Workflow

```bash
# 1. Debug mode with verbose output
roo-cli --mode debug --verbose

# 2. Analyze error logs
roo-cli --batch "Analyze this error log and suggest fixes" --input error.log

# 3. Step-by-step debugging
roo-cli
roo> "Help me debug this function step by step"
roo> "Add logging statements to track the issue"
roo> "Suggest unit tests to prevent this bug"
```

## Tips and Best Practices

### 1. Use Descriptive Task Descriptions

```bash
# Good: Specific and clear
roo-cli --batch "Create a REST API endpoint for user registration with email validation and password hashing"

# Better: Include context
roo-cli --batch "Add a user registration endpoint to the existing Express.js API, include email validation, password hashing with bcrypt, and return JWT token"
```

### 2. Combine with Unix Tools

```bash
# Pipe output to other tools
roo-cli --batch "List all TODO comments in the code" --format csv | sort | uniq

# Use with find
find . -name "*.py" -exec roo-cli --batch "Analyze this Python file for security issues: {}" \;

# Save and process results
roo-cli --batch "Generate project metrics" --format json --output metrics.json
cat metrics.json | jq '.complexity'
```

### 3. Use Configuration Files for Teams

```bash
# Team configuration
cat > .roo-cli.json << EOF
{
  "mode": "code",
  "outputFormat": "markdown",
  "codeStyle": "team-standard",
  "testFramework": "jest",
  "documentation": {
    "format": "jsdoc",
    "includeExamples": true
  }
}
EOF
```

### 4. Automate with Scripts

```bash
#!/bin/bash
# daily-review.sh

echo "Running daily code review..."

# Security review
roo-cli --batch "Security audit of recent changes" --format markdown --output security-review.md

# Code quality check
roo-cli --batch "Analyze code quality metrics" --format json --output quality-metrics.json

# Documentation updates
roo-cli --batch "Update documentation for new features" --format markdown --output doc-updates.md

echo "Review complete. Check output files."
```

## Getting Help

### Built-in Help

```bash
# General help
roo-cli --help

# Command-specific help
roo-cli config --help
roo-cli session --help

# Interactive help
roo-cli
roo> help
roo> help config
roo> help session
```

### Verbose Mode

Use verbose mode to understand what's happening:

```bash
# Enable verbose logging
roo-cli --verbose --batch "Create a simple web server"

# Or set environment variable
export ROO_VERBOSE=true
roo-cli --batch "Debug this issue"
```

## Next Steps

Now that you're familiar with the basics, explore these advanced topics:

- [Configuration Guide](./configuration/overview.md) - Deep dive into configuration options
- [Commands Reference](./commands/overview.md) - Complete command reference
- [Tools Documentation](./tools/overview.md) - Available tools and capabilities
- [Workflow Guides](./guides/workflows.md) - Advanced workflow patterns
- [MCP Integration](./commands/mcp-commands.md) - Model Context Protocol support
- [Troubleshooting](./troubleshooting/common-issues.md) - Common issues and solutions

## Quick Reference Card

```bash
# Essential commands
roo-cli                                    # Interactive mode
roo-cli --batch "task"                     # Single task
roo-cli --help                            # Show help
roo-cli config --show                     # Show config
roo-cli session list                      # List sessions

# Common options
--cwd <path>                              # Working directory
--config <path>                           # Config file
--mode <mode>                             # Agent mode
--format <format>                         # Output format
--output <file>                           # Output file
--verbose                                 # Verbose logging
```

Happy coding with Roo CLI! 🚀
