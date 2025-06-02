# Story 6: Create CLI Entry Point and REPL

**Phase**: 2 - CLI Infrastructure  
**Labels**: `cli-utility`, `phase-2`, `cli-entry`, `repl`  
**Story Points**: 10  
**Priority**: High  

## User Story
As a developer, I want to run `roo-cli` in my terminal to start an interactive coding session with the Roo Code agent, so that I can use the agent's capabilities outside of VS Code.

## Acceptance Criteria

### CLI Entry Point
- [ ] Create main CLI entry point at `src/cli/index.ts`
- [ ] Support command line argument parsing
- [ ] Handle different execution modes (interactive, batch, help)
- [ ] Proper error handling and exit codes
- [ ] Support for configuration file specification

### REPL Implementation
- [ ] Interactive Read-Eval-Print Loop using Node.js readline
- [ ] Support for multi-line input
- [ ] Command history and navigation
- [ ] Auto-completion for common commands
- [ ] Graceful exit handling (Ctrl+C, exit command)

### Command Line Interface
```bash
# Interactive mode (default)
roo-cli

# Specify working directory
roo-cli --cwd /path/to/project

# Non-interactive mode
roo-cli --batch "Create a hello world function"

# Show help
roo-cli --help

# Specify config file
roo-cli --config /path/to/config.json
```

### File Structure
```
src/cli/
├── index.ts              # Main entry point
├── repl.ts              # REPL implementation
├── commands/
│   ├── interactive.ts    # Interactive mode handler
│   ├── batch.ts         # Batch mode handler
│   └── help.ts          # Help command
└── utils/
    ├── args.ts          # Argument parsing
    └── banner.ts        # CLI banner/welcome
```

## Technical Details

### Main Entry Point
```typescript
#!/usr/bin/env node

import { Command } from 'commander'
import { CliRepl } from './repl'
import { BatchProcessor } from './commands/batch'
import { showHelp } from './commands/help'

const program = new Command()

program
  .name('roo-cli')
  .description('Roo Code Agent CLI')
  .version('1.0.0')
  .option('-c, --cwd <path>', 'Working directory', process.cwd())
  .option('--config <path>', 'Configuration file path')
  .option('-b, --batch <task>', 'Run in batch mode with specified task')
  .option('-i, --interactive', 'Run in interactive mode (default)')
  .option('--no-color', 'Disable colored output')
  .action(async (options) => {
    try {
      if (options.batch) {
        await new BatchProcessor(options).run(options.batch)
      } else {
        await new CliRepl(options).start()
      }
    } catch (error) {
      console.error('Error:', error.message)
      process.exit(1)
    }
  })

program.parse()
```

### REPL Implementation
```typescript
import * as readline from 'readline'
import { createCliAdapters } from '../adapters/cli'
import { Task } from '../core/task/Task'

export class CliRepl {
  private rl: readline.Interface
  private currentTask: Task | null = null

  constructor(private options: CliOptions) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'roo> ',
      historySize: 100
    })
  }

  async start(): Promise<void> {
    this.showBanner()
    this.setupEventHandlers()
    this.rl.prompt()

    return new Promise((resolve) => {
      this.rl.on('close', resolve)
    })
  }

  private setupEventHandlers(): void {
    this.rl.on('line', async (input) => {
      await this.handleInput(input.trim())
      this.rl.prompt()
    })

    this.rl.on('SIGINT', () => {
      console.log('\nUse "exit" to quit or Ctrl+D')
      this.rl.prompt()
    })
  }

  private async handleInput(input: string): Promise<void> {
    if (!input) return

    if (input === 'exit' || input === 'quit') {
      this.rl.close()
      return
    }

    if (input === 'clear') {
      console.clear()
      return
    }

    if (input === 'help') {
      this.showHelp()
      return
    }

    // Create new task and execute
    await this.executeTask(input)
  }

  private async executeTask(userInput: string): Promise<void> {
    try {
      const adapters = createCliAdapters(this.options.cwd, true)
      
      this.currentTask = new Task(
        {
          userInput,
          // ... other task options
        },
        adapters.userInterface,
        adapters.fileSystem,
        adapters.terminal,
        adapters.browser
      )

      await this.currentTask.execute()
    } catch (error) {
      console.error('Task execution failed:', error.message)
    }
  }
}
```

### Package.json Updates
```json
{
  "bin": {
    "roo-cli": "./dist/cli/index.js"
  },
  "scripts": {
    "build:cli": "tsc && chmod +x ./dist/cli/index.js",
    "start:cli": "node ./dist/cli/index.js"
  }
}
```

## Dependencies
- **Depends on**: Story 5 (Implement CLI Adapters)
- **Blocks**: Story 7 (Implement CLI Configuration Management)

## Definition of Done
- [ ] CLI entry point executable created
- [ ] REPL functionality working
- [ ] Command line arguments parsed correctly
- [ ] Interactive mode functional
- [ ] Batch mode operational
- [ ] Help system implemented
- [ ] Error handling robust
- [ ] Package.json bin entry configured
- [ ] Code review completed
- [ ] Integration tests pass

## GitHub Issue Template
```markdown
## Summary
Create CLI entry point and REPL interface for interactive coding sessions.

## Tasks
- [ ] Create main CLI entry point
- [ ] Implement REPL functionality
- [ ] Add command line argument parsing
- [ ] Support interactive and batch modes
- [ ] Add help system
- [ ] Configure package.json bin entry
- [ ] Write tests

Labels: cli-utility, phase-2, cli-entry, repl