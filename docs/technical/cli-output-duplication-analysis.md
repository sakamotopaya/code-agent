# CLI Output Duplication Analysis

## Problem Summary

The CLI is experiencing severe output duplication where the same content is written to stdout multiple times. This is caused by multiple output adapters writing to the same stream without coordination.

## Root Causes Identified

### 1. Multiple Output Adapters

Multiple adapters are simultaneously writing to `process.stdout`:

- `CLIOutputAdapter.outputContent()` - Line 45
- `CLIOutputAdapter.outputPartialContent()` - Line 67
- `CLIOutputAdapter.streamChunk()` - Line 72
- `CLIStreamingAdapter.streamRawChunk()` - Line 285
- `ConsoleOutputWriter.writeContent()` - Line 28
- `ConsoleOutputWriter.writeToolIndicator()` - Line 46

### 2. BatchProcessor Architecture Issue

The `BatchProcessor` creates multiple processing components that all output content:

```typescript
// Multiple components instantiated in constructor
this.contentProcessor = new CLIContentProcessor()
this.sharedContentProcessor = new SharedContentProcessor()
this.cliStreamingAdapter = new CLIStreamingAdapter()
this.cliContentOutputAdapter = new CLIContentOutputAdapter(options.color)
```

### 3. Task Event System

The Task class emits events that trigger multiple handlers, causing the same content to be processed and output through different paths.

### 4. No Output Coordination

There's no central coordinator to:

- Deduplicate content
- Manage output flow
- Prevent simultaneous writes
- Coordinate between different adapters

## Evidence from LLM Log

The raw LLM log shows clean output:

```
say hello•{"request":"<task>\nsay hello\n</task>\n\nLoading..."}•Hello•Hello! I'm ready to help...
```

Content is properly separated by bullet characters (•), indicating the duplication occurs in the CLI output processing, not the LLM generation.

## Architecture Problems

1. **Violation of Single Responsibility**: Multiple adapters doing the same job
2. **No Coordination**: Adapters unaware of each other's output
3. **Race Conditions**: Multiple writes to stdout simultaneously
4. **Interface Confusion**: Multiple implementations of similar interfaces
5. **Legacy Compatibility**: Old adapters still active alongside new ones

## Impact Assessment

- **Severity**: High - Makes CLI unusable for production
- **Scope**: All CLI output scenarios (simple responses, tool usage, streaming, errors)
- **User Experience**: Severely degraded, confusing output
- **Debug Impact**: Makes troubleshooting difficult due to noise

## Solution Requirements

1. **Single Output Path**: All CLI output must go through one coordinated system
2. **Deduplication**: Prevent same content from being output multiple times
3. **Backward Compatibility**: Maintain all existing CLI functionality
4. **Performance**: No significant latency increase
5. **Debugging**: Clear separation between raw LLM output and processed CLI output
