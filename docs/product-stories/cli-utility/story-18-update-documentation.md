# Story 18: Update Documentation

**Phase**: 5 - Testing & Documentation  
**Labels**: `cli-utility`, `phase-5`, `documentation`, `user-experience`  
**Story Points**: 8  
**Priority**: High  

## User Story
As a user of the CLI utility, I want comprehensive documentation, so that I can effectively use all features and capabilities.

## Acceptance Criteria

### CLI Usage Documentation
- [ ] Complete command reference with examples
- [ ] Interactive help system within CLI
- [ ] Man pages for Unix-like systems
- [ ] Command auto-completion documentation
- [ ] Usage patterns and best practices

### Configuration Guide
- [ ] Configuration file format documentation
- [ ] Environment variable reference
- [ ] CLI argument precedence explanation
- [ ] Configuration validation and troubleshooting
- [ ] Migration guide for configuration updates

### Tool Reference Documentation
- [ ] Comprehensive tool catalog with descriptions
- [ ] Tool parameter documentation
- [ ] Tool usage examples and patterns
- [ ] Tool integration guides
- [ ] Custom tool development guide

### Troubleshooting Guide
- [ ] Common error scenarios and solutions
- [ ] Debug mode usage instructions
- [ ] Performance optimization tips
- [ ] Platform-specific issues and workarounds
- [ ] Community support resources

### Migration Guide
- [ ] Migration from VS Code extension to CLI
- [ ] Feature comparison between VS Code and CLI
- [ ] Workflow adaptation strategies
- [ ] Configuration migration tools
- [ ] Compatibility considerations

## Technical Details

### Documentation Structure
```
docs/
├── cli/
│   ├── README.md
│   ├── getting-started.md
│   ├── installation.md
│   ├── configuration/
│   │   ├── overview.md
│   │   ├── file-format.md
│   │   ├── environment-variables.md
│   │   └── examples.md
│   ├── commands/
│   │   ├── overview.md
│   │   ├── core-commands.md
│   │   ├── tool-commands.md
│   │   ├── session-commands.md
│   │   └── mcp-commands.md
│   ├── tools/
│   │   ├── overview.md
│   │   ├── file-operations.md
│   │   ├── browser-tools.md
│   │   ├── terminal-tools.md
│   │   └── custom-tools.md
│   ├── guides/
│   │   ├── workflows.md
│   │   ├── automation.md
│   │   ├── integration.md
│   │   └── best-practices.md
│   ├── troubleshooting/
│   │   ├── common-issues.md
│   │   ├── debugging.md
│   │   ├── performance.md
│   │   └── platform-specific.md
│   ├── migration/
│   │   ├── from-vscode.md
│   │   ├── feature-comparison.md
│   │   └── workflow-adaptation.md
│   └── api/
│       ├── interfaces.md
│       ├── services.md
│       └── extensions.md
```

### Interactive Help System
```typescript
// src/cli/commands/HelpCommand.ts
interface IHelpCommand {
  showGeneralHelp(): void
  showCommandHelp(command: string): void
  showToolHelp(tool: string): void
  showConfigHelp(): void
  searchHelp(query: string): void
}

class HelpCommand implements IHelpCommand {
  showGeneralHelp(): void {
    console.log(`
Roo CLI - AI-powered development assistant

USAGE:
  roo [OPTIONS] [COMMAND] [ARGS...]

COMMANDS:
  help              Show this help message
  config            Manage configuration
  session           Manage sessions
  mcp               Manage MCP servers
  tools             List available tools
  
OPTIONS:
  --help, -h        Show help
  --version, -v     Show version
  --config, -c      Specify config file
  --format, -f      Output format (json|yaml|plain)
  --debug           Enable debug mode
  --quiet, -q       Suppress output
  
EXAMPLES:
  roo "create a todo app"
  roo --format json "analyze this codebase"
  roo config init
  roo session list
  
For more information, visit: https://docs.roo.dev/cli
    `)
  }
  
  showCommandHelp(command: string): void {
    const helpContent = this.getCommandHelp(command)
    if (helpContent) {
      console.log(helpContent)
    } else {
      console.log(`No help available for command: ${command}`)
      this.suggestSimilarCommands(command)
    }
  }
}
```

### Documentation Generation System
```typescript
// src/cli/docs/DocumentationGenerator.ts
interface IDocumentationGenerator {
  generateCommandDocs(): Promise<void>
  generateToolDocs(): Promise<void>
  generateConfigDocs(): Promise<void>
  generateAPIReference(): Promise<void>
  validateDocumentation(): Promise<ValidationResult>
}

class DocumentationGenerator implements IDocumentationGenerator {
  async generateCommandDocs(): Promise<void> {
    const commands = this.discoverCommands()
    
    for (const command of commands) {
      const doc = this.generateCommandDoc(command)
      await this.writeDocFile(`commands/${command.name}.md`, doc)
    }
  }
  
  private generateCommandDoc(command: CommandInfo): string {
    return `
# ${command.name}

${command.description}

## Usage
\`\`\`bash
${command.usage}
\`\`\`

## Options
${command.options.map(opt => `- \`${opt.flag}\`: ${opt.description}`).join('\n')}

## Examples
${command.examples.map(ex => `\`\`\`bash\n${ex.command}\n\`\`\`\n${ex.description}`).join('\n\n')}

## See Also
${command.relatedCommands.map(cmd => `- [${cmd}](${cmd}.md)`).join('\n')}
    `
  }
}
```

### Man Page Generation
```typescript
// src/cli/docs/ManPageGenerator.ts
class ManPageGenerator {
  generateManPage(): string {
    return `
.TH ROO 1 "${new Date().toISOString().split('T')[0]}" "Roo CLI ${this.getVersion()}" "User Commands"

.SH NAME
roo \\- AI-powered development assistant

.SH SYNOPSIS
.B roo
[\\fIOPTIONS\\fR] [\\fICOMMAND\\fR] [\\fIARGS\\fR...]

.SH DESCRIPTION
Roo is an AI-powered development assistant that helps with coding tasks,
code analysis, project management, and automation.

.SH OPTIONS
.TP
.BR \\-h ", " \\-\\-help
Show help message and exit.

.TP
.BR \\-v ", " \\-\\-version
Show version information and exit.

.TP
.BR \\-c ", " \\-\\-config " " \\fIFILE\\fR
Specify configuration file path.

.TP
.BR \\-f ", " \\-\\-format " " \\fIFORMAT\\fR
Output format: json, yaml, or plain (default: plain).

.SH COMMANDS
.TP
.B config
Manage configuration settings.

.TP
.B session
Manage CLI sessions.

.TP
.B mcp
Manage MCP servers.

.SH EXAMPLES
.TP
Create a new application:
.B roo "create a todo app with React"

.TP
Analyze codebase with JSON output:
.B roo --format json "analyze this codebase"

.TP
Initialize configuration:
.B roo config init

.SH FILES
.TP
.I ~/.roo/config.json
User configuration file.

.TP
.I ~/.roo/sessions/
Directory containing saved sessions.

.SH SEE ALSO
.BR node (1),
.BR npm (1)

.SH BUGS
Report bugs at: https://github.com/roo-dev/roo/issues

.SH AUTHOR
Roo Development Team
    `
  }
}
```

### Auto-completion Scripts
```bash
# scripts/completion/roo-completion.bash
_roo_completion() {
    local cur prev opts commands
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    # Main commands
    commands="config session mcp tools help"
    
    # Global options
    opts="--help --version --config --format --debug --quiet"
    
    case "${prev}" in
        roo)
            COMPREPLY=( $(compgen -W "${commands} ${opts}" -- ${cur}) )
            return 0
            ;;
        config)
            COMPREPLY=( $(compgen -W "init list set get validate" -- ${cur}) )
            return 0
            ;;
        session)
            COMPREPLY=( $(compgen -W "list save load delete export import" -- ${cur}) )
            return 0
            ;;
        mcp)
            COMPREPLY=( $(compgen -W "list connect disconnect tools resources" -- ${cur}) )
            return 0
            ;;
        --format)
            COMPREPLY=( $(compgen -W "json yaml plain csv markdown" -- ${cur}) )
            return 0
            ;;
        *)
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
    esac
}

complete -F _roo_completion roo
```

### Documentation Website Structure
```typescript
// docs/website/docusaurus.config.js
module.exports = {
  title: 'Roo CLI Documentation',
  tagline: 'AI-powered development assistant',
  url: 'https://docs.roo.dev',
  baseUrl: '/cli/',
  
  themeConfig: {
    navbar: {
      title: 'Roo CLI',
      items: [
        {
          type: 'doc',
          docId: 'getting-started',
          position: 'left',
          label: 'Getting Started',
        },
        {
          type: 'doc',
          docId: 'commands/overview',
          position: 'left',
          label: 'Commands',
        },
        {
          type: 'doc',
          docId: 'tools/overview',
          position: 'left',
          label: 'Tools',
        },
        {
          type: 'doc',
          docId: 'guides/workflows',
          position: 'left',
          label: 'Guides',
        },
        {
          href: 'https://github.com/roo-dev/roo',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Getting Started', to: '/getting-started' },
            { label: 'Commands', to: '/commands/overview' },
            { label: 'Configuration', to: '/configuration/overview' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'Discord', href: 'https://discord.gg/roo' },
            { label: 'GitHub Discussions', href: 'https://github.com/roo-dev/roo/discussions' },
          ],
        },
      ],
    },
  },
  
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/roo-dev/roo/edit/main/docs/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
}
```

### Documentation Validation
```typescript
// src/cli/docs/DocumentationValidator.ts
interface DocumentationValidator {
  validateLinks(): Promise<ValidationResult>
  validateCodeExamples(): Promise<ValidationResult>
  validateCommandReferences(): Promise<ValidationResult>
  validateCompleteness(): Promise<ValidationResult>
}

class DocumentationValidator implements DocumentationValidator {
  async validateCodeExamples(): Promise<ValidationResult> {
    const errors: string[] = []
    const docFiles = await this.findDocumentationFiles()
    
    for (const file of docFiles) {
      const content = await fs.readFile(file, 'utf8')
      const codeBlocks = this.extractCodeBlocks(content)
      
      for (const block of codeBlocks) {
        if (block.language === 'bash') {
          const isValid = await this.validateBashCommand(block.code)
          if (!isValid) {
            errors.push(`Invalid bash command in ${file}: ${block.code}`)
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
}
```

### File Structure
```
docs/cli/
├── README.md
├── getting-started.md
├── installation.md
├── configuration/
├── commands/
├── tools/
├── guides/
├── troubleshooting/
├── migration/
└── api/

scripts/
├── docs/
│   ├── generate-docs.js
│   ├── validate-docs.js
│   └── deploy-docs.js
├── completion/
│   ├── roo-completion.bash
│   ├── roo-completion.zsh
│   └── roo-completion.fish
└── man/
    └── roo.1
```

## Dependencies
- Story 17: Comprehensive CLI Testing
- Docusaurus for documentation website
- Markdown processing tools
- Man page generation tools

## Definition of Done
- [ ] Complete CLI usage documentation written
- [ ] Configuration guide with examples created
- [ ] Comprehensive tool reference documentation
- [ ] Troubleshooting guide with common scenarios
- [ ] Migration guide from VS Code extension
- [ ] Interactive help system implemented
- [ ] Man pages generated for Unix systems
- [ ] Auto-completion scripts created
- [ ] Documentation website deployed
- [ ] Documentation validation system in place
- [ ] Search functionality implemented
- [ ] Documentation versioning strategy established

## Implementation Notes
- Use automated documentation generation where possible
- Implement documentation testing to ensure accuracy
- Create interactive examples and tutorials
- Add video tutorials for complex workflows
- Implement feedback collection system for documentation

## Documentation Standards
- Use consistent formatting and style
- Include practical examples for all features
- Provide both quick reference and detailed guides
- Ensure accessibility compliance
- Support multiple output formats (web, PDF, man pages)

## GitHub Issue Template
```markdown
## Summary
Create comprehensive documentation for CLI utility including usage guides, configuration reference, troubleshooting, and migration information.

## Tasks
- [ ] Write CLI usage documentation
- [ ] Create configuration guide
- [ ] Document all tools and commands
- [ ] Write troubleshooting guide
- [ ] Create migration guide from VS Code
- [ ] Implement interactive help system
- [ ] Generate man pages
- [ ] Create auto-completion scripts
- [ ] Set up documentation website
- [ ] Implement documentation validation

## Acceptance Criteria
[Copy from story document]

Labels: cli-utility, phase-5, documentation, user-experience