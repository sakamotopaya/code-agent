# Story 3: Add Configuration Options for Raw Chunk Logging

## Story Overview

**Epic**: Configuration and CLI Integration  
**Points**: 3  
**Dependencies**: Story 2 (API Client Integration)  
**Priority**: Medium

## User Story

As a developer, I want to configure raw chunk logging through command-line arguments so that I can easily enable/disable it and specify where logs are stored.

## Acceptance Criteria

### AC1: Command-Line Arguments

- [ ] Add `--log-raw-chunks` flag to enable raw chunk logging
- [ ] Add `--raw-chunk-log-dir <path>` option to specify log directory
- [ ] Arguments parsed correctly in `parseCommandLineArgs()`
- [ ] Arguments integrated with existing option parsing

### AC2: Type Updates

- [ ] Update `ApiClientOptions` interface to include logging options
- [ ] Add `logRawChunks?: boolean` property
- [ ] Add `rawChunkLogDir?: string` property
- [ ] Maintain backward compatibility

### AC3: Default Values

- [ ] `logRawChunks` defaults to `false` (opt-in)
- [ ] `rawChunkLogDir` defaults to global storage path + `/logs`
- [ ] Falls back to current directory if global path unavailable
- [ ] Respects existing logging directory patterns

### AC4: Help Text Updates

- [ ] Update help text with new options
- [ ] Clear descriptions of what each option does
- [ ] Examples of usage
- [ ] Consistent formatting with existing options

### AC5: Configuration Validation

- [ ] Validate log directory path exists or can be created
- [ ] Handle invalid directory paths gracefully
- [ ] Provide clear error messages for invalid configurations
- [ ] Continue execution with warnings when possible

## Technical Implementation

### Type Updates

```typescript
// In src/tools/types/api-client-types.ts
export interface ApiClientOptions {
	// ... existing options
	logRawChunks?: boolean
	rawChunkLogDir?: string
}
```

### Command-Line Parsing

```typescript
// In src/tools/api-client.ts parseCommandLineArgs()
function parseCommandLineArgs(): ParsedArgs {
	const options: ApiClientOptions = {
		// ... existing defaults
		logRawChunks: false,
		rawChunkLogDir: undefined, // Will use default from getGlobalStoragePath()
	}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]

		switch (arg) {
			// ... existing cases
			case "--log-raw-chunks":
				options.logRawChunks = true
				break
			case "--raw-chunk-log-dir":
				options.rawChunkLogDir = args[++i]
				if (!options.rawChunkLogDir) {
					console.error("Error: --raw-chunk-log-dir requires a directory path")
					process.exit(1)
				}
				break
			// ... rest of cases
		}
	}

	return { options, task, showHelp }
}
```

### Default Directory Logic

```typescript
// In ApiChunkLogger constructor or initialization
function getDefaultLogDirectory(): string {
	try {
		const globalPath = getGlobalStoragePath()
		return path.join(globalPath, "logs")
	} catch (error) {
		console.warn("Failed to get global storage path, using current directory")
		return path.join(process.cwd(), "logs")
	}
}
```

### Configuration Validation

```typescript
async function validateLogDirectory(dir: string): Promise<boolean> {
	try {
		await fs.mkdir(dir, { recursive: true })
		return true
	} catch (error) {
		console.error(`Invalid log directory: ${dir} - ${error.message}`)
		return false
	}
}
```

## Files to Create/Modify

### Modified Files

- `src/tools/api-client.ts` - Update argument parsing and help text
- `src/tools/types/api-client-types.ts` - Add configuration options
- `src/shared/logging/ApiChunkLogger.ts` - Use default directory logic

### Updated Help Text

```
Raw Chunk Logging Options:
  --log-raw-chunks              Enable raw HTTP chunk logging
  --raw-chunk-log-dir <path>    Directory for raw chunk log files
                               (default: ~/.agentz/logs)

Examples:
  # Enable raw chunk logging with default directory
  ./api-client.ts --stream --log-raw-chunks "debug this task"

  # Enable with custom log directory
  ./api-client.ts --stream --log-raw-chunks --raw-chunk-log-dir ./debug-logs "test"
```

## Definition of Done

- [ ] Command-line arguments parse correctly
- [ ] Type definitions updated
- [ ] Default values work as expected
- [ ] Help text is clear and accurate
- [ ] Configuration validation works
- [ ] Error handling is appropriate
- [ ] Backward compatibility maintained
- [ ] Integration tests pass

## Testing Requirements

### Test Scenarios

- [ ] Parse `--log-raw-chunks` flag correctly
- [ ] Parse `--raw-chunk-log-dir` with valid path
- [ ] Handle missing directory path argument
- [ ] Validate directory creation
- [ ] Handle invalid directory paths
- [ ] Test default directory fallback
- [ ] Verify help text includes new options

### Test Structure

```typescript
describe("Raw Chunk Logging Configuration", () => {
	test("parses --log-raw-chunks flag")
	test("parses --raw-chunk-log-dir with path")
	test("validates log directory creation")
	test("handles invalid directory paths")
	test("uses default directory when not specified")
	test("shows error for missing directory argument")
	test("help text includes new options")
})
```

## Implementation Details

### Argument Processing Flow

1. Parse command-line arguments
2. Set default values for new options
3. Validate configuration
4. Pass to API client execution

### Error Handling Strategy

- Invalid directory: Show error and exit
- Missing directory argument: Show error and exit
- Directory creation failure: Show warning and continue
- Global path unavailable: Use current directory with warning

### Integration Points

- Uses existing `getGlobalStoragePath()` for defaults
- Follows existing argument parsing patterns
- Integrates with existing help text format
- Maintains existing error handling style

## Review Checklist

- [ ] New arguments follow existing patterns
- [ ] Type definitions are correct
- [ ] Default values are sensible
- [ ] Help text is comprehensive
- [ ] Error messages are clear
- [ ] Configuration validation works
- [ ] Tests cover all scenarios
- [ ] Backward compatibility maintained
- [ ] Integration with existing code is clean
- [ ] Documentation is updated

## Usage Examples

### Basic Usage

```bash
# Enable raw chunk logging
./api-client.ts --stream --log-raw-chunks "debug streaming issue"

# With custom log directory
./api-client.ts --stream --log-raw-chunks --raw-chunk-log-dir ./debug "test task"

# Combined with other options
./api-client.ts --stream --verbose --log-raw-chunks --show-thinking "complex task"
```

### Expected Behavior

- `--log-raw-chunks`: Enables logging, uses default directory
- `--raw-chunk-log-dir ./custom`: Uses custom directory
- Invalid directory: Shows error and exits
- Help text: Shows new options with examples
