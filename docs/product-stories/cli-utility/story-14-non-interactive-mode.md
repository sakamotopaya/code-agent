# Story 14: Add Non-Interactive Mode Support

**Phase**: 4 - Advanced Features  
**Labels**: `cli-utility`, `phase-4`, `automation`, `non-interactive`  
**Story Points**: 8  
**Priority**: Medium  

## User Story
As a developer, I want to run the CLI in non-interactive mode for automation, so that I can integrate it into CI/CD pipelines and scripts.

## Acceptance Criteria

### Batch Processing Mode
- [ ] Support for running commands without user interaction
- [ ] Process multiple commands from input files
- [ ] Handle command sequences and dependencies
- [ ] Support for conditional command execution
- [ ] Parallel command execution capabilities

### Input Sources
- [ ] Read commands from stdin
- [ ] Process commands from files (batch files)
- [ ] Support for JSON/YAML command definitions
- [ ] Environment variable substitution in commands
- [ ] Template processing for dynamic commands

### Automated Responses
- [ ] Pre-configured responses for interactive prompts
- [ ] Default behavior for confirmation dialogs
- [ ] Timeout handling for long-running operations
- [ ] Fallback mechanisms for failed operations
- [ ] Skip or fail modes for problematic commands

### Exit Code Management
- [ ] Meaningful exit codes for different scenarios
- [ ] Configurable error handling strategies
- [ ] Early termination on critical failures
- [ ] Continue-on-error mode for non-critical failures
- [ ] Summary reporting of batch execution results

### Logging and Monitoring
- [ ] Structured logging for automation systems
- [ ] Progress reporting without interactive elements
- [ ] Performance metrics collection
- [ ] Error aggregation and reporting
- [ ] Audit trail for executed commands

## Technical Details

### Non-Interactive Mode Service
```typescript
// src/cli/services/NonInteractiveModeService.ts
interface INonInteractiveModeService {
  // Batch execution
  executeBatch(batchConfig: BatchConfig): Promise<BatchResult>
  executeFromFile(filePath: string): Promise<BatchResult>
  executeFromStdin(): Promise<BatchResult>
  
  // Configuration
  setNonInteractiveMode(enabled: boolean): void
  configureDefaults(defaults: NonInteractiveDefaults): void
  setErrorHandling(strategy: ErrorHandlingStrategy): void
  
  // Monitoring
  getExecutionStatus(): ExecutionStatus
  getMetrics(): ExecutionMetrics
}
```

### Batch Configuration
```typescript
interface BatchConfig {
  commands: BatchCommand[]
  settings: BatchSettings
  defaults: NonInteractiveDefaults
  errorHandling: ErrorHandlingStrategy
}

interface BatchCommand {
  id: string
  command: string
  args: string[]
  environment?: Record<string, string>
  workingDirectory?: string
  timeout?: number
  retries?: number
  dependsOn?: string[]
  condition?: CommandCondition
}

interface BatchSettings {
  parallel: boolean
  maxConcurrency: number
  continueOnError: boolean
  verbose: boolean
  dryRun: boolean
  outputFormat: OutputFormat
}

interface NonInteractiveDefaults {
  confirmations: boolean // default response to Y/N prompts
  fileOverwrite: boolean
  createDirectories: boolean
  timeout: number
  retryCount: number
}
```

### Command Processing
```typescript
class BatchProcessor {
  async executeBatch(config: BatchConfig): Promise<BatchResult> {
    const executor = new CommandExecutor(config.settings)
    const results: CommandResult[] = []
    
    if (config.settings.parallel) {
      results.push(...await this.executeParallel(config.commands, executor))
    } else {
      results.push(...await this.executeSequential(config.commands, executor))
    }
    
    return this.generateBatchResult(results, config)
  }
  
  private async executeSequential(
    commands: BatchCommand[], 
    executor: CommandExecutor
  ): Promise<CommandResult[]> {
    const results: CommandResult[] = []
    
    for (const command of commands) {
      if (!this.shouldExecute(command, results)) {
        continue
      }
      
      try {
        const result = await executor.execute(command)
        results.push(result)
        
        if (!result.success && !this.settings.continueOnError) {
          break
        }
      } catch (error) {
        const errorResult = this.createErrorResult(command, error)
        results.push(errorResult)
        
        if (!this.settings.continueOnError) {
          break
        }
      }
    }
    
    return results
  }
}
```

### Input File Formats
```typescript
// JSON batch file format
interface JSONBatchFile {
  version: string
  settings: BatchSettings
  defaults: NonInteractiveDefaults
  commands: BatchCommand[]
}

// YAML batch file format
interface YAMLBatchFile {
  version: string
  settings: BatchSettings
  defaults: NonInteractiveDefaults
  commands: BatchCommand[]
}

// Simple text format (one command per line)
// # Comment
// create-app my-app --template react
// cd my-app && npm install
// test --coverage
```

### Exit Codes
```typescript
enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_ARGUMENTS = 2,
  COMMAND_NOT_FOUND = 3,
  PERMISSION_DENIED = 4,
  FILE_NOT_FOUND = 5,
  TIMEOUT = 6,
  INTERRUPTED = 7,
  BATCH_PARTIAL_FAILURE = 8,
  BATCH_COMPLETE_FAILURE = 9,
  CONFIGURATION_ERROR = 10
}
```

### CLI Integration
```typescript
// Non-interactive CLI options
interface NonInteractiveOptions {
  batch?: string // batch file path
  stdin?: boolean // read from stdin
  yes?: boolean // assume yes for all prompts
  no?: boolean // assume no for all prompts
  timeout?: number // global timeout
  parallel?: boolean // parallel execution
  continueOnError?: boolean
  dryRun?: boolean
  quiet?: boolean
  verbose?: boolean
}

// Usage examples:
// roo --batch commands.json
// echo "create-app my-app" | roo --stdin --yes
// roo --non-interactive --timeout 300 "analyze codebase"
```

### Logging Configuration
```typescript
interface NonInteractiveLogging {
  level: LogLevel
  format: LogFormat
  destination: LogDestination
  includeTimestamps: boolean
  includeMetrics: boolean
  structuredOutput: boolean
}

enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

enum LogFormat {
  JSON = 'json',
  TEXT = 'text',
  CSV = 'csv'
}
```

### File Structure
```
src/cli/services/
├── NonInteractiveModeService.ts
├── BatchProcessor.ts
├── CommandExecutor.ts
└── AutomationLogger.ts

src/cli/types/
├── batch-types.ts
├── automation-types.ts
└── exit-codes.ts

src/cli/parsers/
├── BatchFileParser.ts
├── JSONBatchParser.ts
├── YAMLBatchParser.ts
└── TextBatchParser.ts
```

## Dependencies
- Story 12: Add Output Formatting Options
- Story 13: Implement Session Persistence
- `js-yaml` for YAML batch file parsing
- `commander` for enhanced CLI argument parsing

## Definition of Done
- [ ] Non-interactive mode service implemented
- [ ] Batch processing capabilities working
- [ ] Multiple input formats supported (JSON, YAML, text)
- [ ] Stdin processing functional
- [ ] Exit codes properly implemented
- [ ] Automated response handling working
- [ ] Logging and monitoring in place
- [ ] Unit tests for all automation features
- [ ] Integration tests with CI/CD scenarios
- [ ] Documentation for automation usage
- [ ] Performance benchmarks for batch operations

## Implementation Notes
- Ensure graceful handling of interrupted operations
- Implement proper resource cleanup in non-interactive mode
- Add support for environment variable expansion
- Consider Docker integration for containerized automation
- Implement job queuing for large batch operations

## CI/CD Integration Examples
```bash
# GitHub Actions example
- name: Run Roo CLI Analysis
  run: |
    echo "analyze codebase --format json" | roo --stdin --yes > analysis.json
    
# Jenkins pipeline example
pipeline {
  stage('Code Analysis') {
    steps {
      sh 'roo --batch analysis-commands.json --quiet'
    }
  }
}

# Docker example
FROM node:18
COPY batch-commands.json /app/
RUN roo --batch /app/batch-commands.json --non-interactive
```

## GitHub Issue Template
```markdown
## Summary
Add non-interactive mode support for automation, CI/CD integration, and batch processing.

## Tasks
- [ ] Implement NonInteractiveModeService
- [ ] Create batch processing capabilities
- [ ] Add support for multiple input formats
- [ ] Implement automated response handling
- [ ] Add proper exit code management
- [ ] Create automation logging system
- [ ] Write comprehensive tests
- [ ] Update documentation with automation examples

## Acceptance Criteria
[Copy from story document]

Labels: cli-utility, phase-4, automation, non-interactive