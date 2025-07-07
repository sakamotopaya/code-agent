# Story 003: FileSystem Provider Implementation

## Overview

Implement a file system-based provider for CLI usage that stores configuration and state in JSON files, enabling persistent mode preferences and settings.

## Acceptance Criteria

### Core Functionality

- [ ] Implements `IProvider` interface completely
- [ ] Stores state in JSON configuration files
- [ ] Supports mode persistence between CLI sessions
- [ ] Handles configuration file creation and migration
- [ ] Provides atomic file operations for data integrity

### File Management

- [ ] Creates configuration directory if it doesn't exist
- [ ] Uses appropriate file permissions for security
- [ ] Handles concurrent access safely
- [ ] Provides backup and recovery mechanisms
- [ ] Supports configuration file validation

### CLI Integration

- [ ] Automatically detects and loads existing configurations
- [ ] Supports configuration file path override
- [ ] Provides CLI commands for configuration management
- [ ] Integrates with existing CLI argument parsing
- [ ] Maintains backward compatibility with current CLI usage

## Technical Requirements

### File Structure

```
~/.agentz/                    # Default configuration directory
├── config.json              # Main configuration file
├── state.json               # Runtime state file
├── modes/                   # Custom mode definitions
│   ├── custom-mode-1.json
│   └── custom-mode-2.json
├── api-configs/             # API configuration profiles
│   ├── default.json
│   └── production.json
└── backups/                 # Automatic backups
    ├── config.backup.json
    └── state.backup.json
```

### Configuration Schema

```typescript
interface FileSystemConfig {
	version: string
	lastUpdated: Date
	provider: {
		type: "filesystem"
		configPath: string
		backupEnabled: boolean
		maxBackups: number
	}
	state: ProviderState
	apiConfigurations: Record<string, ProviderSettings>
	customModes: any[]
}
```

### Implementation

```typescript
class FileSystemProvider extends BaseProvider implements IProvider {
	private configPath: string
	private statePath: string
	private state: ProviderState
	private fileWatcher?: fs.FSWatcher

	constructor(configPath?: string) {
		super(ProviderType.FileSystem)
		this.configPath = configPath || this.getDefaultConfigPath()
		this.statePath = path.join(path.dirname(this.configPath), "state.json")
	}

	async initialize(): Promise<void> {
		await this.ensureConfigDirectory()
		await this.loadConfiguration()
		await this.setupFileWatcher()
		await this.createBackup()
	}

	async getState(): Promise<ProviderState> {
		return { ...this.state }
	}

	async updateState(key: keyof ProviderState, value: any): Promise<void> {
		this.state[key] = value
		await this.saveState()
		this.emit("stateChanged", key, value)
	}

	// ... other interface methods
}
```

### File Operations

- **Atomic Writes**: Use temporary files and atomic rename operations
- **File Locking**: Prevent concurrent modification issues
- **Validation**: JSON schema validation on load/save
- **Backup**: Automatic backup before modifications
- **Recovery**: Restore from backup on corruption

### Security Considerations

- Set appropriate file permissions (600 for config files)
- Validate file paths to prevent directory traversal
- Sanitize configuration data before writing
- Use secure temporary file creation

## Implementation Details

### Configuration Management

```typescript
private async loadConfiguration(): Promise<void> {
    try {
        if (await this.fileExists(this.configPath)) {
            const config = await this.readJsonFile<FileSystemConfig>(this.configPath)
            await this.validateConfiguration(config)
            this.state = config.state
        } else {
            await this.createDefaultConfiguration()
        }
    } catch (error) {
        await this.handleCorruptedConfig(error)
    }
}

private async saveConfiguration(): Promise<void> {
    const config: FileSystemConfig = {
        version: '1.0.0',
        lastUpdated: new Date(),
        provider: {
            type: 'filesystem',
            configPath: this.configPath,
            backupEnabled: true,
            maxBackups: 5
        },
        state: this.state,
        apiConfigurations: this.apiConfigurations,
        customModes: this.customModes
    }

    await this.writeJsonFileAtomic(this.configPath, config)
}
```

### File Watching

```typescript
private async setupFileWatcher(): Promise<void> {
    this.fileWatcher = fs.watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
            await this.reloadConfiguration()
        }
    })
}
```

### Migration Support

```typescript
private async migrateConfiguration(config: any): Promise<FileSystemConfig> {
    // Handle migration from older configuration formats
    if (!config.version) {
        // Migrate from v0 to v1
        config = await this.migrateFromV0(config)
    }

    return config
}
```

### CLI Integration

```typescript
// Add CLI commands for configuration management
export const configCommands = {
	"config:show": () => showCurrentConfiguration(),
	"config:set": (key: string, value: string) => setConfigurationValue(key, value),
	"config:reset": () => resetConfiguration(),
	"config:backup": () => createManualBackup(),
	"config:restore": (backupPath: string) => restoreFromBackup(backupPath),
}
```

## Testing Requirements

### Unit Tests

- [ ] Configuration file creation and loading
- [ ] State persistence and retrieval
- [ ] Atomic file operations
- [ ] Error handling for corrupted files
- [ ] Migration from older formats

### Integration Tests

- [ ] CLI integration with persistent modes
- [ ] Concurrent access handling
- [ ] File system permission handling
- [ ] Configuration validation
- [ ] Backup and recovery operations

### Edge Case Tests

- [ ] Disk space exhaustion
- [ ] Permission denied scenarios
- [ ] Corrupted configuration files
- [ ] Network file system usage
- [ ] Symlink handling

## Error Handling

### File System Errors

- **ENOENT**: Create default configuration
- **EACCES**: Provide clear permission error message
- **ENOSPC**: Handle disk space issues gracefully
- **Corrupted JSON**: Restore from backup or create new

### Recovery Strategies

- Automatic backup restoration
- Default configuration creation
- Graceful degradation to in-memory mode
- Clear error messages with resolution steps

## Performance Considerations

### Optimization Strategies

- Cache configuration in memory
- Debounce file writes to reduce I/O
- Use streaming for large configuration files
- Implement lazy loading for custom modes

### Monitoring

- Track file operation performance
- Monitor configuration file sizes
- Log file system errors for debugging
- Measure startup time impact

## Dependencies

- Story 001: Provider Interface Definition (must be complete)
- Node.js fs/promises API
- JSON schema validation library
- File locking mechanism
- CLI argument parsing updates

## Definition of Done

- [ ] FileSystemProvider implements IProvider interface completely
- [ ] Configuration persists correctly between CLI sessions
- [ ] File operations are atomic and safe
- [ ] Error handling covers all edge cases
- [ ] All unit and integration tests pass
- [ ] Performance benchmarks meet requirements
- [ ] CLI integration works seamlessly
- [ ] Documentation includes configuration examples
- [ ] Migration from existing CLI configs works
- [ ] Code review approved by CLI team
