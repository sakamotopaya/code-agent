# Story 19: Create CLI Usage Examples

**Phase**: 5 - Testing & Documentation  
**Labels**: `cli-utility`, `phase-5`, `examples`, `user-experience`  
**Story Points**: 5  
**Priority**: Medium  

## User Story
As a new user of the CLI utility, I want practical examples, so that I can quickly learn how to use the tool effectively.

## Acceptance Criteria

### Basic Usage Examples
- [ ] Simple command examples with explanations
- [ ] Common workflow demonstrations
- [ ] Input/output format examples
- [ ] Error handling examples
- [ ] Help and discovery examples

### Advanced Workflow Examples
- [ ] Multi-step development workflows
- [ ] Automation and scripting examples
- [ ] Integration with other tools
- [ ] Complex configuration scenarios
- [ ] Performance optimization examples

### Integration Examples
- [ ] CI/CD pipeline integration
- [ ] IDE and editor integration
- [ ] Docker and containerization examples
- [ ] Cloud platform integration
- [ ] Version control workflow integration

### Configuration Examples
- [ ] Basic configuration setup
- [ ] Advanced configuration patterns
- [ ] Environment-specific configurations
- [ ] MCP server configuration examples
- [ ] Custom tool configuration

### Troubleshooting Examples
- [ ] Common error scenarios and solutions
- [ ] Debug mode usage examples
- [ ] Performance troubleshooting
- [ ] Platform-specific issue resolution
- [ ] Recovery from failed operations

## Technical Details

### Example Categories Structure
```
examples/
├── basic/
│   ├── getting-started.md
│   ├── first-commands.md
│   ├── help-system.md
│   └── output-formats.md
├── workflows/
│   ├── web-development.md
│   ├── data-analysis.md
│   ├── code-review.md
│   ├── project-setup.md
│   └── testing-automation.md
├── integration/
│   ├── github-actions.md
│   ├── jenkins.md
│   ├── docker.md
│   ├── vscode.md
│   └── git-hooks.md
├── configuration/
│   ├── basic-setup.md
│   ├── advanced-config.md
│   ├── mcp-servers.md
│   ├── custom-tools.md
│   └── environment-vars.md
├── troubleshooting/
│   ├── common-errors.md
│   ├── debug-mode.md
│   ├── performance.md
│   └── platform-issues.md
└── recipes/
    ├── quick-tasks.md
    ├── automation.md
    ├── best-practices.md
    └── tips-tricks.md
```

### Basic Usage Examples
```markdown
# Getting Started Examples

## Your First Command
```bash
# Get help
roo --help

# Check version
roo --version

# Simple task
roo "create a hello world script in Python"
```

## Working with Files
```bash
# Analyze a file
roo "analyze this file: app.js"

# Create multiple files
roo "create a React component with tests"

# Refactor code
roo "refactor this function to use async/await: utils.js"
```

## Configuration Basics
```bash
# Initialize configuration
roo config init

# View current configuration
roo config list

# Set a configuration value
roo config set api.provider anthropic
```

## Output Formats
```bash
# JSON output for scripting
roo --format json "list all functions in this file"

# YAML output for configuration
roo --format yaml "show project structure"

# Plain text for human reading (default)
roo "explain this code"
```
```

### Advanced Workflow Examples
```typescript
// examples/workflows/web-development.md
interface WebDevelopmentWorkflow {
  projectSetup: Example[]
  development: Example[]
  testing: Example[]
  deployment: Example[]
}

const webDevExamples: WebDevelopmentWorkflow = {
  projectSetup: [
    {
      title: "Create a new React project",
      command: `roo "create a React project with TypeScript, Tailwind CSS, and Jest"`,
      description: "Sets up a complete React development environment",
      expectedOutput: "Project structure with all dependencies configured"
    },
    {
      title: "Initialize project configuration",
      command: `roo config init --project-type react`,
      description: "Creates project-specific configuration",
      expectedOutput: "Configuration file created with React defaults"
    }
  ],
  
  development: [
    {
      title: "Generate component with tests",
      command: `roo "create a UserProfile component with props validation and unit tests"`,
      description: "Creates component, types, and test files",
      expectedOutput: "Component files with TypeScript interfaces and Jest tests"
    },
    {
      title: "Add API integration",
      command: `roo "add API service for user management with error handling"`,
      description: "Creates API service layer with proper error handling",
      expectedOutput: "Service files with TypeScript types and error boundaries"
    }
  ]
}
```

### Integration Examples
```yaml
# examples/integration/github-actions.md

# GitHub Actions Integration Examples

## Basic CI/CD Pipeline
```yaml
name: Roo CLI Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Roo CLI
        run: npm install -g @roo/cli
        
      - name: Run Code Analysis
        run: |
          roo --format json "analyze codebase for security issues" > analysis.json
          
      - name: Upload Analysis Results
        uses: actions/upload-artifact@v3
        with:
          name: code-analysis
          path: analysis.json

## Automated Code Review
```yaml
name: Automated Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
          
      - name: Get Changed Files
        id: changed-files
        run: |
          echo "files=$(git diff --name-only ${{ github.event.pull_request.base.sha }} ${{ github.sha }} | tr '\n' ' ')" >> $GITHUB_OUTPUT
          
      - name: Review Changes
        run: |
          roo --format json "review these changed files for best practices: ${{ steps.changed-files.outputs.files }}" > review.json
          
      - name: Post Review Comment
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const review = JSON.parse(fs.readFileSync('review.json', 'utf8'));
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Automated Code Review\n\n${review.data.summary}`
            });
```

### Configuration Examples
```json
// examples/configuration/advanced-config.md

{
  "version": "1.0.0",
  "api": {
    "provider": "anthropic",
    "model": "claude-3-sonnet-20240229",
    "timeout": 30000,
    "retries": 3
  },
  "output": {
    "defaultFormat": "plain",
    "colorEnabled": true,
    "verboseMode": false
  },
  "tools": {
    "fileOperations": {
      "autoBackup": true,
      "confirmOverwrite": true
    },
    "browser": {
      "headless": true,
      "timeout": 30000,
      "viewport": {
        "width": 1920,
        "height": 1080
      }
    }
  },
  "sessions": {
    "autoSave": true,
    "autoSaveInterval": 300,
    "maxHistory": 1000,
    "compression": true
  },
  "mcp": {
    "servers": [
      {
        "id": "github",
        "name": "GitHub MCP Server",
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
        }
      }
    ],
    "autoConnect": true,
    "timeout": 15000
  },
  "automation": {
    "nonInteractive": false,
    "continueOnError": false,
    "parallelExecution": false,
    "maxConcurrency": 3
  }
}
```

### Recipe Collection
```bash
# examples/recipes/quick-tasks.md

# Quick Task Recipes

## Code Analysis
```bash
# Find potential bugs
roo "scan for potential bugs and security issues"

# Check code quality
roo --format json "analyze code quality metrics" | jq '.data.score'

# Find unused code
roo "identify unused functions and variables"
```

## File Operations
```bash
# Batch file processing
find . -name "*.js" -exec roo "optimize this JavaScript file: {}" \;

# Generate documentation
roo "create README.md with project overview and setup instructions"

# Create test files
roo "generate unit tests for all functions in src/"
```

## Project Management
```bash
# Project health check
roo "analyze project structure and suggest improvements"

# Dependency analysis
roo "check for outdated dependencies and security vulnerabilities"

# Performance analysis
roo "identify performance bottlenecks in the codebase"
```

## Automation Scripts
```bash
#!/bin/bash
# Daily development routine

echo "Starting daily code analysis..."

# Update dependencies
roo "check for dependency updates" --format json > deps.json

# Run security scan
roo "scan for security vulnerabilities" --format json > security.json

# Generate daily report
roo "create daily development report from analysis results" \
  --input deps.json,security.json \
  --output daily-report.md

echo "Daily analysis complete. Report saved to daily-report.md"
```
```

### Interactive Example Browser
```typescript
// src/cli/commands/ExamplesCommand.ts
interface IExamplesCommand {
  listCategories(): void
  showCategory(category: string): void
  searchExamples(query: string): void
  runExample(exampleId: string): Promise<void>
  createCustomExample(): Promise<void>
}

class ExamplesCommand implements IExamplesCommand {
  async showCategory(category: string): Promise<void> {
    const examples = await this.loadExamples(category)
    
    console.log(`\n📚 ${category.toUpperCase()} EXAMPLES\n`)
    
    examples.forEach((example, index) => {
      console.log(`${index + 1}. ${example.title}`)
      console.log(`   ${example.description}`)
      console.log(`   Command: ${chalk.cyan(example.command)}`)
      console.log()
    })
    
    const choice = await inquirer.prompt([{
      type: 'list',
      name: 'example',
      message: 'Select an example to run:',
      choices: [
        ...examples.map((ex, i) => ({ name: ex.title, value: i })),
        { name: 'Back to categories', value: -1 }
      ]
    }])
    
    if (choice.example >= 0) {
      await this.runExample(examples[choice.example])
    }
  }
  
  async runExample(example: Example): Promise<void> {
    console.log(`\n🚀 Running: ${example.title}\n`)
    console.log(`Command: ${chalk.cyan(example.command)}\n`)
    
    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Do you want to execute this command?',
      default: false
    }])
    
    if (confirm.proceed) {
      // Execute the command
      await this.executeCommand(example.command)
    } else {
      console.log('Command not executed. You can copy and modify it as needed.')
    }
  }
}
```

### File Structure
```
examples/
├── README.md
├── basic/
│   ├── getting-started.md
│   ├── first-commands.md
│   ├── help-system.md
│   └── output-formats.md
├── workflows/
│   ├── web-development.md
│   ├── data-analysis.md
│   ├── code-review.md
│   ├── project-setup.md
│   └── testing-automation.md
├── integration/
│   ├── github-actions.md
│   ├── jenkins.md
│   ├── docker.md
│   ├── vscode.md
│   └── git-hooks.md
├── configuration/
│   ├── basic-setup.md
│   ├── advanced-config.md
│   ├── mcp-servers.md
│   ├── custom-tools.md
│   └── environment-vars.md
├── troubleshooting/
│   ├── common-errors.md
│   ├── debug-mode.md
│   ├── performance.md
│   └── platform-issues.md
├── recipes/
│   ├── quick-tasks.md
│   ├── automation.md
│   ├── best-practices.md
│   └── tips-tricks.md
└── scripts/
    ├── generate-examples.js
    ├── validate-examples.js
    └── interactive-browser.js
```

## Dependencies
- Story 18: Update Documentation
- Interactive CLI framework (inquirer)
- Example validation tools
- Markdown processing

## Definition of Done
- [ ] Basic usage examples created with clear explanations
- [ ] Advanced workflow examples for common development tasks
- [ ] Integration examples for popular tools and platforms
- [ ] Configuration examples for different scenarios
- [ ] Troubleshooting examples with step-by-step solutions
- [ ] Interactive example browser implemented
- [ ] Example validation system in place
- [ ] Video tutorials for complex examples
- [ ] Community contribution guidelines for examples
- [ ] Example search and filtering functionality

## Implementation Notes
- Ensure all examples are tested and working
- Include expected outputs for examples
- Provide both simple and complex variations
- Add timing estimates for longer examples
- Include links to related documentation

## Community Contribution
- Create templates for community-contributed examples
- Implement example rating and feedback system
- Add example categories based on user needs
- Provide guidelines for example quality and style
- Set up automated testing for community examples

## GitHub Issue Template
```markdown
## Summary
Create comprehensive practical examples for CLI utility covering basic usage, advanced workflows, integrations, and troubleshooting scenarios.

## Tasks
- [ ] Create basic usage examples
- [ ] Develop advanced workflow examples
- [ ] Add integration examples for popular tools
- [ ] Create configuration examples
- [ ] Write troubleshooting examples
- [ ] Implement interactive example browser
- [ ] Add example validation system
- [ ] Create video tutorials
- [ ] Set up community contribution system

## Acceptance Criteria
[Copy from story document]

Labels: cli-utility, phase-5, examples, user-experience