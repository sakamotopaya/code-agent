# CLI Output Coordinator Architecture

## Overview

The CLI Output Coordinator is a centralized system that manages all CLI output to prevent duplication and ensure consistent formatting. It serves as the single point of truth for all stdout/stderr operations in CLI mode.

## Architecture Design

### Core Components

#### 1. CLIOutputCoordinator (New)

- **Responsibility**: Single point of control for all CLI output
- **Features**:
    - Content deduplication using content hashing
    - Output throttling and buffering
    - Format consistency enforcement
    - Debug/verbose output separation
    - Error handling and fallback mechanisms

#### 2. OutputContentTracker (New)

- **Responsibility**: Track and deduplicate content
- **Features**:
    - Content fingerprinting (hash-based)
    - Timestamp tracking for content freshness
    - Similar content detection
    - Output history management

#### 3. Unified Output Interface (New)

- **Responsibility**: Standardized interface for all output operations
- **Features**:
    - Streaming content support
    - Batch content support
    - Tool indicator formatting
    - Progress indication
    - Error formatting

### Integration Points

#### Task System Integration

```typescript
// Task events → CLIOutputCoordinator
task.on("message", (event) => {
	coordinator.processTaskMessage(event)
})

// Single output path instead of multiple adapters
coordinator.outputContent(content, options)
```

#### Adapter Refactoring

```typescript
// Old: Multiple adapters writing directly to stdout
CLIOutputAdapter.outputContent() → process.stdout.write()
CLIStreamingAdapter.streamRawChunk() → process.stdout.write()
ConsoleOutputWriter.writeContent() → process.stdout.write()

// New: All adapters use coordinator
CLIOutputAdapter.outputContent() → coordinator.outputContent()
CLIStreamingAdapter.streamRawChunk() → coordinator.streamContent()
ConsoleOutputWriter.writeContent() → coordinator.writeContent()
```

### Content Flow Architecture

```
LLM Response → Content Processing → CLIOutputCoordinator → stdout
                     ↓
              [Deduplication]
                     ↓
              [Format Application]
                     ↓
              [Single Write Operation]
```

### Deduplication Strategy

#### 1. Content Hashing

- Generate SHA-256 hash of content
- Track recent hashes (sliding window of 100 items)
- Ignore duplicate hashes within 5-second window

#### 2. Semantic Deduplication

- Detect similar content (95% similarity threshold)
- Handle partial vs complete content overlap
- Smart merging of incremental updates

#### 3. Event-Based Deduplication

- Track message source (Task event, direct call, etc.)
- Prevent same event from generating multiple outputs
- Event ID tracking and correlation

### Error Handling

#### Fallback Mechanisms

1. **Coordinator Failure**: Fall back to direct stdout.write()
2. **Hash Collision**: Allow output with warning in debug mode
3. **Memory Pressure**: Clear deduplication cache and continue
4. **Performance Issues**: Disable deduplication temporarily

#### Debug Support

- Verbose mode shows deduplication decisions
- Debug logs show content flow through system
- Performance metrics for output operations
- Content inspection capabilities

### Configuration Options

```typescript
interface CLIOutputCoordinatorConfig {
	// Deduplication settings
	enableDeduplication: boolean
	contentHashWindow: number
	similarityThreshold: number

	// Performance settings
	bufferSize: number
	flushInterval: number

	// Debug settings
	enableDebugLogging: boolean
	showDuplicationWarnings: boolean

	// Fallback settings
	enableFallbackMode: boolean
	maxRetries: number
}
```

## Implementation Strategy

### Phase 1: Create Core Coordinator

1. Implement `CLIOutputCoordinator` class
2. Implement `OutputContentTracker` for deduplication
3. Add configuration system
4. Create unit tests

### Phase 2: Integrate with Existing Adapters

1. Modify `CLIOutputAdapter` to use coordinator
2. Update `CLIStreamingAdapter` integration
3. Refactor `ConsoleOutputWriter`
4. Update `BatchProcessor` to use single output path

### Phase 3: Task System Integration

1. Modify Task event handling to use coordinator
2. Update message processing pipeline
3. Ensure proper event deduplication
4. Add coordinator to Task constructor options

### Phase 4: Legacy Cleanup

1. Remove deprecated direct stdout writes
2. Consolidate similar adapters
3. Update all CLI services to use coordinator
4. Remove redundant output classes

### Phase 5: Testing and Validation

1. Integration testing with real CLI scenarios
2. Performance benchmarking
3. Memory leak testing
4. Backward compatibility validation

## Benefits

### Immediate Benefits

- **Eliminates Output Duplication**: Single source of truth prevents multiple writes
- **Improved Performance**: Reduced redundant stdout operations
- **Better Debugging**: Clear content flow tracking
- **Consistent Formatting**: Unified output formatting rules

### Long-term Benefits

- **Maintainability**: Single point to modify output behavior
- **Extensibility**: Easy to add new output features
- **Testing**: Simplified output testing and mocking
- **Performance Monitoring**: Built-in metrics and profiling

## Compatibility

### Backward Compatibility

- All existing CLI functionality preserved
- No changes to user-facing CLI interface
- Existing configuration options maintained
- Gradual migration path for internal components

### Forward Compatibility

- Extensible architecture for future output needs
- Plugin system for custom output formatters
- Support for additional output targets (files, sockets, etc.)
- Async output pipeline support

## Success Metrics

### Primary Metrics

- **Zero Output Duplication**: No repeated content in CLI output
- **Performance**: No significant latency increase (<10ms overhead)
- **Memory**: Stable memory usage under load
- **Reliability**: 99.9% uptime for output operations

### Secondary Metrics

- **Code Quality**: Reduced cyclomatic complexity in output code
- **Test Coverage**: >95% coverage for output-related code
- **Documentation**: Complete API documentation
- **Developer Experience**: Simplified output debugging
