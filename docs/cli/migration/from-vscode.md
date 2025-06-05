# Migrating from VS Code Extension to CLI

This guide helps you transition from using the Roo Code VS Code extension to the Roo CLI command-line interface.

## Overview

Roo CLI provides the same powerful AI-assisted development capabilities as the VS Code extension but in a command-line interface that works with any editor or development environment.

## Key Differences

### Interface

- **VS Code Extension**: Graphical interface within VS Code
- **CLI**: Command-line interface that works anywhere

### Execution Model

- **VS Code Extension**: Interactive panels and commands
- **CLI**: Interactive mode, batch processing, and direct commands

### Configuration

- **VS Code Extension**: VS Code settings.json
- **CLI**: Dedicated configuration files and environment variables

## Migration Steps

### 1. Install Roo CLI

```bash
# Install globally via npm
npm install -g roo-cli

# Verify installation
roo-cli --version
```

### 2. Export VS Code Configuration

First, export your existing VS Code configuration:

```bash
# Create migration directory
mkdir ~/roo-migration
cd ~/roo-migration

# Export VS Code settings (manual process)
# Copy relevant settings from VS Code settings.json
code ~/.vscode/settings.json
```

**VS Code Settings to Migrate**:

```json
{
	"roo.apiKey": "your-api-key",
	"roo.model": "claude-3-5-sonnet-20241022",
	"roo.maxTokens": 4096,
	"roo.temperature": 0.1,
	"roo.customInstructions": "Your custom instructions",
	"roo.autoSave": true,
	"roo.sessionManagement": true
}
```

### 3. Convert Configuration

Create equivalent CLI configuration:

```bash
# Generate base CLI configuration
roo-cli config --generate ~/.roo-cli/config.json

# Edit the configuration file
```

**CLI Configuration Equivalent**:

```json
{
	"apiKey": "your-api-key",
	"model": "claude-3-5-sonnet-20241022",
	"maxTokens": 4096,
	"temperature": 0.1,
	"customInstructions": "Your custom instructions",
	"session": {
		"autoSave": true,
		"maxHistory": 100
	},
	"mode": "code",
	"outputFormat": "plain"
}
```

### 4. Migrate Workflows

#### VS Code Interactive Chat

**Before (VS Code)**:

- Open Roo panel
- Type message in chat
- Review response in panel

**After (CLI)**:

```bash
# Start interactive mode
roo-cli

# Or use batch mode for single tasks
roo-cli --batch "Your task description"
```

#### VS Code Commands

**Before (VS Code)**:

- Use Command Palette (Cmd/Ctrl+Shift+P)
- Select "Roo: Analyze Code"
- Select files in explorer

**After (CLI)**:

```bash
# Analyze current directory
roo-cli --batch "Analyze the code in this directory"

# Analyze specific files
roo-cli --batch "Analyze the code in src/main.js and src/utils.js"

# Use with specific working directory
roo-cli --cwd /path/to/project --batch "Analyze this codebase"
```

#### VS Code File Operations

**Before (VS Code)**:

- Right-click file in explorer
- Select "Roo: Review File"

**After (CLI)**:

```bash
# Review specific file
roo-cli --batch "Review the code in src/components/UserProfile.tsx"

# Create new file
roo-cli --batch "Create a new React component called UserSettings"

# Modify existing file
roo-cli --batch "Add error handling to the login function in auth.js"
```

### 5. Session Migration

#### Export VS Code Session Data

Unfortunately, VS Code extension session data cannot be directly exported. You'll need to start fresh with CLI sessions.

**Workaround**: Document your current VS Code sessions manually:

```bash
# Create session documentation
cat > session-migration.md << 'EOF'
# Previous VS Code Sessions

## Project Analysis Session
- Files analyzed: src/main.js, src/utils.js
- Issues found: Missing error handling, unused variables
- Recommendations: Add try-catch blocks, remove unused code

## Refactoring Session
- Target: User authentication module
- Changes made: Extracted validation logic, added tests
- Next steps: Implement password reset functionality
EOF
```

#### Start New CLI Sessions

```bash
# Start interactive mode
roo-cli

# Work on your project
roo> "Continue refactoring the user authentication module based on previous analysis"

# Save session
roo> session save "auth-refactoring-continuation"
```

## Feature Mapping

### VS Code Extension Features → CLI Equivalents

| VS Code Feature  | CLI Equivalent     | Command Example                                   |
| ---------------- | ------------------ | ------------------------------------------------- |
| Interactive Chat | Interactive Mode   | `roo-cli`                                         |
| Quick Tasks      | Batch Mode         | `roo-cli --batch "task"`                          |
| File Analysis    | File Operations    | `roo-cli --batch "analyze file.js"`               |
| Code Generation  | Code Mode          | `roo-cli --mode code --batch "create component"`  |
| Debugging Help   | Debug Mode         | `roo-cli --mode debug --batch "debug this error"` |
| Session History  | Session Management | `roo-cli session list`                            |
| Settings         | Configuration      | `roo-cli config --show`                           |

### Tool Mapping

| VS Code Tool              | CLI Tool                  | Usage             |
| ------------------------- | ------------------------- | ----------------- |
| File Explorer Integration | `read_file`, `list_files` | Built-in tools    |
| Terminal Integration      | `execute_command`         | Built-in tool     |
| Git Integration           | `execute_command` + git   | Command execution |
| Browser Preview           | `browser_action`          | Built-in tool     |
| Search & Replace          | `search_and_replace`      | Built-in tool     |

## Workflow Adaptations

### Development Workflow

#### Before (VS Code)

1. Open VS Code
2. Open Roo panel
3. Ask questions in chat
4. Apply suggestions via commands
5. Continue development

#### After (CLI)

```bash
# Option 1: Interactive workflow
roo-cli
roo> "Analyze the current codebase for optimization opportunities"
roo> "Implement the suggested performance improvements"
roo> session save "performance-optimization"

# Option 2: Task-based workflow
roo-cli --batch "Review code quality in src/ directory" --output review.md
roo-cli --batch "Create unit tests for UserService class" --mode test
roo-cli --batch "Optimize database queries in user.js" --mode code
```

### Code Review Workflow

#### Before (VS Code)

1. Open files in VS Code
2. Use Roo panel to review code
3. Apply suggestions interactively

#### After (CLI)

```bash
# Comprehensive code review
roo-cli --batch "Perform comprehensive code review of the entire project" \
  --format markdown --output code-review.md

# Review specific pull request
roo-cli --batch "Review the changes in the user-authentication branch" \
  --cwd /path/to/feature-branch

# Security review
roo-cli --mode debug --batch "Analyze security vulnerabilities in auth module"
```

### Testing Workflow

#### Before (VS Code)

1. Write code in VS Code
2. Use Roo to generate tests
3. Run tests in terminal

#### After (CLI)

```bash
# Generate comprehensive test suite
roo-cli --mode test --batch "Create unit tests for all components in src/components/"

# Test-driven development
roo-cli --batch "Create failing tests for the new payment processing feature"
roo-cli --batch "Implement the payment processing feature to make tests pass"

# Test analysis
roo-cli --batch "Analyze test coverage and suggest improvements"
```

## Advanced Migration

### Custom Workflows

#### VS Code Snippets → CLI Aliases

**Before (VS Code snippets)**:

```json
{
	"Roo Analyze": {
		"prefix": "roo-analyze",
		"body": ["// Ask Roo to analyze this code"],
		"description": "Analyze code with Roo"
	}
}
```

**After (CLI aliases)**:

```bash
# Add to ~/.bashrc or ~/.zshrc
alias roo-analyze='roo-cli --batch "Analyze the current file for improvements"'
alias roo-test='roo-cli --mode test --batch "Create tests for the current code"'
alias roo-review='roo-cli --batch "Review this code for quality and security"'
alias roo-optimize='roo-cli --batch "Suggest performance optimizations"'

# Usage
cd /path/to/project
roo-analyze
roo-test
```

#### VS Code Tasks → CLI Scripts

**Before (VS Code tasks.json)**:

```json
{
	"version": "2.0.0",
	"tasks": [
		{
			"label": "Roo Code Review",
			"type": "shell",
			"command": "echo 'Review with Roo'"
		}
	]
}
```

**After (CLI scripts)**:

```bash
#!/bin/bash
# scripts/roo-workflows.sh

# Code review workflow
roo_review() {
  echo "Starting code review workflow..."
  roo-cli --batch "Analyze code quality and security" --format markdown --output review.md
  roo-cli --batch "Generate improvement recommendations" --format markdown --output improvements.md
  echo "Review complete. Check review.md and improvements.md"
}

# Testing workflow
roo_test() {
  echo "Starting testing workflow..."
  roo-cli --mode test --batch "Analyze test coverage" --format json --output coverage.json
  roo-cli --mode test --batch "Generate missing unit tests" --output tests/
  echo "Testing workflow complete."
}

# Make functions available
export -f roo_review roo_test
```

### Integration with Existing Tools

#### Git Hooks

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running Roo CLI code analysis..."
roo-cli --batch "Analyze staged changes for issues" --format plain

if [ $? -ne 0 ]; then
  echo "Code analysis found issues. Please review and fix."
  exit 1
fi
```

#### CI/CD Integration

```yaml
# .github/workflows/roo-analysis.yml
name: Roo Code Analysis

on: [push, pull_request]

jobs:
    analyze:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v2
            - uses: actions/setup-node@v2
              with:
                  node-version: "18"

            - name: Install Roo CLI
              run: npm install -g roo-cli

            - name: Analyze Code
              env:
                  ROO_API_KEY: ${{ secrets.ROO_API_KEY }}
              run: |
                  roo-cli --batch "Analyze this codebase for issues" \
                    --format json --output analysis.json

            - name: Upload Analysis
              uses: actions/upload-artifact@v2
              with:
                  name: code-analysis
                  path: analysis.json
```

## Best Practices for Migration

### 1. Gradual Migration

- Start with simple tasks in CLI
- Keep VS Code extension for complex workflows initially
- Gradually move all workflows to CLI

### 2. Workflow Documentation

```bash
# Document your migration
cat > migration-log.md << 'EOF'
# Roo CLI Migration Log

## Week 1
- [x] Installed Roo CLI
- [x] Migrated basic configuration
- [x] Tested simple code analysis tasks

## Week 2
- [x] Created CLI aliases for common tasks
- [x] Migrated code review workflow
- [ ] Set up CI/CD integration

## Issues Encountered
- Configuration format differences (resolved)
- Session data not transferable (documented workaround)
EOF
```

### 3. Team Migration

```bash
# Create team migration guide
cat > team-migration.md << 'EOF'
# Team Roo CLI Migration

## Prerequisites
- Node.js 18+ installed
- Access to shared configuration repository
- Team API key access

## Installation for Team
1. Install Roo CLI: `npm install -g roo-cli`
2. Clone config: `git clone team-configs/roo-cli-config.git ~/.roo-cli`
3. Set API key: `export ROO_API_KEY=$TEAM_ROO_API_KEY`
4. Test: `roo-cli --batch "Hello World"`

## Team Workflows
- Code reviews: `roo-cli --batch "review" --output reviews/`
- Documentation: `roo-cli --batch "document APIs" --format markdown`
- Testing: `roo-cli --mode test --batch "generate tests"`
EOF
```

## Troubleshooting Migration Issues

### Configuration Problems

```bash
# Compare configurations
echo "VS Code config (manual extraction needed):"
cat vscode-settings.json

echo "CLI config:"
roo-cli config --show

# Test API connectivity
roo-cli --batch "test connection" --verbose
```

### Workflow Differences

```bash
# Test CLI equivalents
roo-cli --help | grep -E "(mode|format|batch)"

# Compare output formats
roo-cli --batch "simple task" --format plain
roo-cli --batch "simple task" --format json
roo-cli --batch "simple task" --format markdown
```

### Performance Comparison

```bash
# Time CLI operations
time roo-cli --batch "analyze small file"
time roo-cli --batch "analyze large codebase"

# Monitor resource usage
roo-cli --batch "complex task" --verbose | grep -i "time\|memory"
```

## Post-Migration Validation

### Functional Testing

```bash
# Test core functionality
roo-cli --version
roo-cli config --validate
roo-cli --batch "Hello, World!" --format json

# Test file operations
roo-cli --batch "List files in current directory"
roo-cli --batch "Analyze README.md file"

# Test session management
roo-cli
roo> session save "migration-test"
roo> session list
roo> exit
```

### Performance Validation

```bash
# Benchmark common operations
roo-cli tools benchmark read_file --iterations 10
roo-cli tools benchmark execute_command --iterations 5

# Compare with previous VS Code workflows
echo "Migration complete! CLI is ready for production use."
```

## Support and Resources

### Getting Help

- **Documentation**: [CLI Documentation](../README.md)
- **Configuration Help**: `roo-cli config --help`
- **Interactive Help**: `roo-cli help`
- **Community**: [GitHub Discussions](https://github.com/roo-dev/roo/discussions)

### Additional Resources

- [Configuration Guide](../configuration/overview.md)
- [Commands Reference](../commands/overview.md)
- [Troubleshooting](../troubleshooting/common-issues.md)
- [Best Practices](../guides/best-practices.md)

The migration from VS Code extension to CLI opens up new possibilities for automation, CI/CD integration, and editor-agnostic development workflows. Take advantage of CLI's scriptability and flexibility to enhance your development process.
