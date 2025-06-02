# Story 5: Implement CLI Adapters

**Phase**: 2 - CLI Infrastructure  
**Labels**: `cli-utility`, `phase-2`, `adapters`, `cli`  
**Story Points**: 13  
**Priority**: High  

## User Story
As a developer working on the CLI utility implementation, I need to create CLI adapter implementations for all abstraction interfaces, so that the Task class can work in a command-line environment without VS Code dependencies.

## Acceptance Criteria

### CLI Adapter Implementation
- [ ] Create `CliUserInterface.ts` implementing `IUserInterface`
- [ ] Create `CliFileSystem.ts` implementing `IFileSystem`
- [ ] Create `CliTerminal.ts` implementing `ITerminal`
- [ ] Create `CliBrowser.ts` implementing `IBrowser`

### CLI-Specific Features
- [ ] Implement terminal-based user interactions
- [ ] Support headless browser operations
- [ ] Handle file system operations without VS Code workspace
- [ ] Provide CLI-appropriate progress indicators
- [ ] Support both interactive and non-interactive modes

### File Structure
```
src/adapters/cli/
├── CliUserInterface.ts
├── CliFileSystem.ts
├── CliTerminal.ts
├── CliBrowser.ts
├── utils/
│   ├── CliProgressIndicator.ts
│   ├── CliPrompts.ts
│   └── OutputFormatter.ts
└── index.ts (barrel export)
```

### Dependencies Integration
- [ ] Integrate `inquirer` for interactive prompts
- [ ] Use `chalk` for colored terminal output
- [ ] Implement `ora` for progress spinners
- [ ] Use Node.js `fs` APIs for file operations
- [ ] Integrate `child_process` for command execution

## Technical Details

### CliUserInterface Implementation
```typescript
import inquirer from 'inquirer'
import chalk from 'chalk'
import ora from 'ora'

export class CliUserInterface implements IUserInterface {
  private isInteractive: boolean

  constructor(isInteractive: boolean = true) {
    this.isInteractive = isInteractive
  }

  async showMessage(message: string, type: 'info' | 'warning' | 'error'): Promise<void> {
    const coloredMessage = this.colorizeMessage(message, type)
    console.log(coloredMessage)
  }

  async askQuestion(question: string, options?: string[]): Promise<string> {
    if (!this.isInteractive) {
      throw new Error('Cannot ask questions in non-interactive mode')
    }

    if (options) {
      const { answer } = await inquirer.prompt([{
        type: 'list',
        name: 'answer',
        message: question,
        choices: options
      }])
      return answer
    } else {
      const { answer } = await inquirer.prompt([{
        type: 'input',
        name: 'answer',
        message: question
      }])
      return answer
    }
  }

  showProgress(title: string): IProgressIndicator {
    return new CliProgressIndicator(title)
  }

  private colorizeMessage(message: string, type: string): string {
    switch (type) {
      case 'error': return chalk.red(message)
      case 'warning': return chalk.yellow(message)
      case 'info': return chalk.blue(message)
      default: return message
    }
  }
}
```

### CliFileSystem Implementation
```typescript
import * as fs from 'fs/promises'
import * as path from 'path'
import { watch } from 'chokidar'

export class CliFileSystem implements IFileSystem {
  private workspaceRoot: string

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot
  }

  async readFile(filePath: string, encoding: string = 'utf8'): Promise<string> {
    const fullPath = this.resolvePath(filePath)
    return await fs.readFile(fullPath, encoding)
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf8')
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(filePath)
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }

  async listFiles(directory: string, recursive: boolean = false): Promise<string[]> {
    const fullPath = this.resolvePath(directory)
    return await this.listFilesRecursive(fullPath, recursive)
  }

  resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath
    }
    return path.resolve(this.workspaceRoot, filePath)
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot
  }

  // ... other interface methods
}
```

### CliTerminal Implementation
```typescript
import { spawn, ChildProcess } from 'child_process'

export class CliTerminal implements ITerminal {
  private activeSessions: Map<string, ITerminalSession> = new Map()

  async executeCommand(command: string, options: ExecuteOptions): Promise<ExecuteResult> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, [], {
        shell: true,
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env }
      })

      let stdout = ''
      let stderr = ''

      process.stdout?.on('data', (data) => {
        const output = data.toString()
        stdout += output
        options.onOutput?.(output)
      })

      process.stderr?.on('data', (data) => {
        const output = data.toString()
        stderr += output
        options.onError?.(output)
      })

      process.on('close', (code) => {
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          success: code === 0
        })
      })

      process.on('error', reject)
    })
  }

  createSession(name: string): ITerminalSession {
    const session = new CliTerminalSession(name)
    this.activeSessions.set(session.id, session)
    return session
  }

  // ... other interface methods
}
```

### CliBrowser Implementation
```typescript
import puppeteer from 'puppeteer'

export class CliBrowser implements IBrowser {
  private activeSessions: Map<string, IBrowserSession> = new Map()

  async launch(options: BrowserLaunchOptions): Promise<IBrowserSession> {
    const browser = await puppeteer.launch({
      headless: options.headless !== false,
      args: options.args || []
    })

    const session = new CliBrowserSession(browser, options)
    this.activeSessions.set(session.id, session)
    return session
  }

  async getActiveSessions(): Promise<IBrowserSession[]> {
    return Array.from(this.activeSessions.values())
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (session) {
      await session.close()
      this.activeSessions.delete(sessionId)
    }
  }

  isHeadlessSupported(): boolean {
    return true
  }
}
```

### CLI Adapter Factory
```typescript
export function createCliAdapters(
  workspaceRoot: string,
  isInteractive: boolean = true
): {
  userInterface: IUserInterface
  fileSystem: IFileSystem
  terminal: ITerminal
  browser: IBrowser
} {
  return {
    userInterface: new CliUserInterface(isInteractive),
    fileSystem: new CliFileSystem(workspaceRoot),
    terminal: new CliTerminal(),
    browser: new CliBrowser()
  }
}
```

## Dependencies
- **Depends on**: Story 1 (Create Interface Definitions)
- **Depends on**: Story 4 (Ensure VS Code Functionality Preservation)
- **Blocks**: Story 6 (Create CLI Entry Point and REPL)

## Definition of Done
- [ ] All CLI adapter classes implement their respective interfaces
- [ ] Adapters work correctly in Node.js environment
- [ ] Interactive and non-interactive modes supported
- [ ] Headless browser operations functional
- [ ] File system operations work without VS Code workspace
- [ ] Terminal operations execute properly
- [ ] Code review completed
- [ ] Unit tests written for each adapter
- [ ] Integration tests pass with CLI adapters

## Testing Strategy
- Test each adapter individually in Node.js environment
- Verify headless browser functionality
- Test file operations in various directory structures
- Validate terminal command execution
- Test both interactive and non-interactive modes

## Notes
- Focus on making adapters work well in terminal environment
- Ensure proper error handling for CLI-specific scenarios
- Consider performance implications of CLI operations
- Plan for future extensibility

## GitHub Issue Template
```markdown
## Summary
Implement CLI adapter implementations for all abstraction interfaces to enable Task class operation in command-line environment.

## Tasks
- [ ] Create CliUserInterface adapter
- [ ] Create CliFileSystem adapter
- [ ] Create CliTerminal adapter
- [ ] Create CliBrowser adapter
- [ ] Implement CLI utilities (progress, prompts, formatting)
- [ ] Create CLI adapter factory
- [ ] Write tests
- [ ] Test headless browser functionality

## Acceptance Criteria
[Copy from story document]

Labels: cli-utility, phase-2, adapters, cli