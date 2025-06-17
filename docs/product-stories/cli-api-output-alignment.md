# CLI and API Output Alignment Plan

## Project Overview

Align the output formats between CLI and API modes to provide consistent user experience across all interfaces. Currently, the CLI displays tool usage indicators like `execute_command...` and `use_mcp_tool...`, while the API does not. This project will unify the output processing pipeline while maintaining interface-specific formatting.

## Project Goals

1. **Consistency**: Both CLI and API should display identical tool usage indicators
2. **Maintainability**: Use shared components to reduce code duplication
3. **Flexibility**: Allow future customization of output formats
4. **Backward Compatibility**: Ensure existing API clients continue to work
5. **Performance**: Maintain current performance characteristics

## Technical Context

Based on the [CLI vs API Output Divergence Analysis](../technical/cli-api-output-divergence.md), the root cause is:

- CLI uses: `MessageBuffer → CLIDisplayFormatter → ContentHandlers → Tool Indicators`
- API uses: `MessageBuffer → Direct SSE Emission → No Tool Indicators`

## Implementation Strategy

### Phase 1: Shared Output Processing Infrastructure

Create a unified output processing system that both CLI and API can use.

### Phase 2: API Output Adapter Refactoring

Modify the API to use the shared processing system.

### Phase 3: Output Format Standardization

Ensure both systems produce identical content with appropriate formatting.

### Phase 4: Testing and Validation

Comprehensive testing to ensure parity and no regressions.

---

## Story 1: Create Shared Output Processing Interface

**Epic**: Shared Infrastructure  
**Story Points**: 5  
**Priority**: High

### User Story

As a developer, I want a shared interface for output processing so that both CLI and API can use the same formatting logic.

### Technical Requirements

- Create `IOutputProcessor` interface
- Create `IOutputFormatter` interface
- Define common `OutputContext` type
- Ensure interfaces support both CLI and SSE output modes

### Acceptance Criteria

- [ ] `IOutputProcessor` interface is defined with methods for processing content
- [ ] `IOutputFormatter` interface is defined with methods for formatting output
- [ ] `OutputContext` type includes color, verbosity, and output mode settings
- [ ] Interfaces are documented with usage examples
- [ ] Unit tests validate interface contracts

### Implementation Details

```typescript
// src/core/interfaces/IOutputProcessor.ts
export interface IOutputProcessor {
	processContent(content: string): ProcessedMessage[]
	reset(): void
	getState(): any
}

// src/core/interfaces/IOutputFormatter.ts
export interface IOutputFormatter {
	formatContent(message: ProcessedMessage, context: OutputContext): FormattedOutput | null
	formatToolIndicator(toolName: string, context: OutputContext): FormattedOutput
}

// src/core/interfaces/OutputContext.ts
export interface OutputContext {
	useColor: boolean
	showThinking: boolean
	outputMode: "cli" | "sse" | "json"
	verbosity: "normal" | "verbose" | "quiet"
}
```

### Files to Create

- `src/core/interfaces/IOutputProcessor.ts`
- `src/core/interfaces/IOutputFormatter.ts`
- `src/core/interfaces/OutputContext.ts`
- `src/core/interfaces/__tests__/output-interfaces.test.ts`

---

## Story 2: Refactor CLI Components to Use Shared Interfaces

**Epic**: Shared Infrastructure  
**Story Points**: 8  
**Priority**: High

### User Story

As a developer, I want the CLI components to implement the shared interfaces so they can be reused by the API.

### Technical Requirements

- Refactor `CLIContentProcessor` to implement `IOutputProcessor`
- Refactor `CLIDisplayFormatter` to implement `IOutputFormatter`
- Update `ContentHandlers` to work with `OutputContext`
- Maintain all existing CLI functionality

### Acceptance Criteria

- [ ] `CLIContentProcessor` implements `IOutputProcessor` interface
- [ ] `CLIDisplayFormatter` implements `IOutputFormatter` interface
- [ ] All `ContentHandlers` updated to use `OutputContext`
- [ ] CLI output remains identical to current behavior
- [ ] All existing CLI tests pass
- [ ] No breaking changes to CLI interface

### Implementation Details

```typescript
// Update CLIContentProcessor
export class CLIContentProcessor implements IOutputProcessor {
	processContent(content: string): ProcessedMessage[] {
		// Existing implementation using MessageBuffer
	}
}

// Update CLIDisplayFormatter
export class CLIDisplayFormatter implements IOutputFormatter {
	formatContent(message: ProcessedMessage, context: OutputContext): FormattedOutput | null {
		// Adapt existing logic to use OutputContext
	}
}

// Update ContentHandlers
export abstract class ContentHandler {
	abstract handle(message: ProcessedMessage, context: OutputContext): FormattedOutput | null
}
```

### Files to Modify

- `src/cli/services/streaming/CLIContentProcessor.ts`
- `src/cli/services/streaming/CLIDisplayFormatter.ts`
- `src/cli/services/streaming/ContentHandlers.ts`
- `src/cli/services/streaming/interfaces.ts`

---

## Story 3: Create Shared Output Processing Service

**Epic**: Shared Infrastructure  
**Story Points**: 5  
**Priority**: High

### User Story

As a developer, I want a shared service that coordinates output processing so both CLI and API can use the same logic.

### Technical Requirements

- Create `SharedOutputProcessor` service
- Implement tool tracking to prevent duplicate indicators
- Support both CLI and SSE output modes
- Handle error cases gracefully

### Acceptance Criteria

- [ ] `SharedOutputProcessor` service is created
- [ ] Service implements `IOutputProcessor` interface
- [ ] Tool tracking prevents duplicate indicators
- [ ] Service works with both CLI and SSE contexts
- [ ] Error handling preserves system stability
- [ ] Comprehensive unit tests

### Implementation Details

```typescript
// src/core/services/SharedOutputProcessor.ts
export class SharedOutputProcessor implements IOutputProcessor {
	private messageBuffer: MessageBuffer
	private formatter: IOutputFormatter
	private displayedTools: Set<string> = new Set()

	constructor(formatter: IOutputFormatter) {
		this.messageBuffer = new MessageBuffer()
		this.formatter = formatter
	}

	processContent(content: string, context: OutputContext): FormattedOutput[] {
		const messages = this.messageBuffer.processMessage(content)
		return messages.map((msg) => this.formatter.formatContent(msg, context)).filter((output) => output !== null)
	}

	generateToolIndicator(toolName: string, context: OutputContext): FormattedOutput | null {
		if (this.displayedTools.has(toolName)) {
			return null
		}

		this.displayedTools.add(toolName)
		return this.formatter.formatToolIndicator(toolName, context)
	}
}
```

### Files to Create

- `src/core/services/SharedOutputProcessor.ts`
- `src/core/services/__tests__/SharedOutputProcessor.test.ts`

---

## Story 4: Create SSE-Compatible Output Formatter

**Epic**: API Integration  
**Story Points**: 6  
**Priority**: High

### User Story

As a developer, I want an SSE-compatible formatter that generates the same content as CLI but in JSON format.

### Technical Requirements

- Create `SSEOutputFormatter` implementing `IOutputFormatter`
- Generate tool indicators in SSE-compatible format
- Preserve all formatting logic from CLI
- Support SSE event structure

### Acceptance Criteria

- [ ] `SSEOutputFormatter` implements `IOutputFormatter` interface
- [ ] Tool indicators are generated in SSE format
- [ ] Content formatting matches CLI output
- [ ] SSE events maintain proper structure
- [ ] All content types are handled correctly
- [ ] Unit tests validate output format

### Implementation Details

```typescript
// src/core/services/SSEOutputFormatter.ts
export class SSEOutputFormatter implements IOutputFormatter {
	formatContent(message: ProcessedMessage, context: OutputContext): FormattedOutput | null {
		// Convert CLI formatting to SSE event format
		const cliFormatter = new CLIDisplayFormatter()
		const cliOutput = cliFormatter.formatContent(message, context)

		if (!cliOutput) return null

		return {
			displayText: cliOutput,
			sseEvent: {
				type: this.getSSEEventType(message.contentType),
				message: cliOutput,
				contentType: message.contentType,
				toolName: message.toolName,
				timestamp: new Date().toISOString(),
			},
		}
	}

	formatToolIndicator(toolName: string, context: OutputContext): FormattedOutput {
		const indicator = context.useColor ? `${toolName}...` : `${toolName}...`

		return {
			displayText: `\n${indicator}\n`,
			sseEvent: {
				type: "tool_indicator",
				message: indicator,
				toolName,
				timestamp: new Date().toISOString(),
			},
		}
	}
}
```

### Files to Create

- `src/core/services/SSEOutputFormatter.ts`
- `src/core/services/__tests__/SSEOutputFormatter.test.ts`

---

## Story 5: Modify SSEOutputAdapter to Use Shared Processing

**Epic**: API Integration  
**Story Points**: 8  
**Priority**: High

### User Story

As an API user, I want to see the same tool indicators as CLI users so I have consistent feedback about task progress.

### Technical Requirements

- Modify `SSEOutputAdapter` to use `SharedOutputProcessor`
- Replace direct MessageBuffer usage with shared service
- Maintain existing SSE event structure
- Preserve backward compatibility

### Acceptance Criteria

- [ ] `SSEOutputAdapter` uses `SharedOutputProcessor`
- [ ] Tool indicators appear in SSE stream
- [ ] Existing SSE event structure is preserved
- [ ] No breaking changes for API clients
- [ ] All existing API tests pass
- [ ] Performance impact is minimal

### Implementation Details

```typescript
// Modify src/api/streaming/SSEOutputAdapter.ts
export class SSEOutputAdapter implements IUserInterface {
	private outputProcessor: SharedOutputProcessor

	constructor(streamManager: StreamManager, jobId: string, verbose: boolean = false) {
		// ... existing constructor logic

		const formatter = new SSEOutputFormatter()
		this.outputProcessor = new SharedOutputProcessor(formatter)
	}

	async showProgress(message: string, progress?: number): Promise<void> {
		const context: OutputContext = {
			useColor: false, // SSE doesn't use color
			showThinking: this.verbose,
			outputMode: "sse",
			verbosity: this.verbose ? "verbose" : "normal",
		}

		const formattedOutputs = this.outputProcessor.processContent(message, context)

		for (const output of formattedOutputs) {
			if (output.sseEvent) {
				this.emitEvent({
					...output.sseEvent,
					jobId: this.jobId,
					progress,
				})
			}
		}
	}
}
```

### Files to Modify

- `src/api/streaming/SSEOutputAdapter.ts`
- `src/api/streaming/__tests__/SSEOutputAdapter.test.ts`

---

## Story 6: Add Tool Indicator Support to SSE Events

**Epic**: API Integration  
**Story Points**: 3  
**Priority**: Medium

### User Story

As an API client developer, I want a new SSE event type for tool indicators so I can display them appropriately in my UI.

### Technical Requirements

- Add `tool_indicator` event type to SSE events
- Update SSE event type definitions
- Ensure proper event serialization
- Document new event type

### Acceptance Criteria

- [ ] `tool_indicator` event type is added to SSE_EVENTS
- [ ] Event type is properly serialized in SSE stream
- [ ] Event includes tool name and formatted message
- [ ] Documentation updated with new event type
- [ ] Example usage provided

### Implementation Details

```typescript
// Update src/api/streaming/types.ts
export const SSE_EVENTS = {
	// ... existing events
	TOOL_INDICATOR: "tool_indicator",
} as const

export interface SSEEvent {
	type: (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS]
	// ... existing properties
	toolName?: string
	contentType?: ContentType
}
```

### Files to Modify

- `src/api/streaming/types.ts`
- `src/api/streaming/__tests__/types.test.ts`
- `docs/api/sse-events.md`

---

## Story 7: Create Output Alignment Integration Tests

**Epic**: Testing & Validation  
**Story Points**: 5  
**Priority**: Medium

### User Story

As a QA engineer, I want comprehensive tests that verify CLI and API output alignment so I can ensure consistency.

### Technical Requirements

- Create integration tests comparing CLI and API outputs
- Test all tool types and content types
- Verify tool indicators appear correctly
- Test edge cases and error conditions

### Acceptance Criteria

- [ ] Integration tests compare CLI and API outputs
- [ ] All tool types tested for indicator generation
- [ ] Content type handling verified
- [ ] Error scenarios tested
- [ ] Performance benchmarks included
- [ ] Tests run in CI/CD pipeline

### Implementation Details

```typescript
// src/__tests__/integration/output-alignment.test.ts
describe("CLI and API Output Alignment", () => {
	test("should generate identical tool indicators", async () => {
		const task = "use the github mcp server to summarize issue #18"

		// Capture CLI output
		const cliOutput = await runCLITask(task)

		// Capture API output
		const apiOutput = await runAPITask(task)

		// Compare tool indicators
		expect(extractToolIndicators(apiOutput)).toEqual(extractToolIndicators(cliOutput))
	})

	test("should handle all content types consistently", async () => {
		// Test each content type
		const contentTypes = ["content", "thinking", "tool_call", "system", "tool_result"]

		for (const contentType of contentTypes) {
			const cliResult = await processCLIContent(contentType)
			const apiResult = await processAPIContent(contentType)

			expect(normalizeOutput(apiResult)).toEqual(normalizeOutput(cliResult))
		}
	})
})
```

### Files to Create

- `src/__tests__/integration/output-alignment.test.ts`
- `src/__tests__/helpers/output-comparison.ts`
- `src/__tests__/fixtures/sample-outputs.ts`

---

## Story 8: Update CLI to Use Shared Processing (Backward Compatibility)

**Epic**: Testing & Validation  
**Story Points**: 4  
**Priority**: Medium

### User Story

As a CLI user, I want the same functionality and output format as before so my workflows are not disrupted.

### Technical Requirements

- Update CLI to use shared processing while maintaining identical output
- Ensure no performance regression
- Preserve all existing functionality
- Maintain color and formatting options

### Acceptance Criteria

- [ ] CLI uses shared processing infrastructure
- [ ] Output format is identical to current behavior
- [ ] No performance regression
- [ ] All CLI options work as before
- [ ] Existing CLI tests pass without modification
- [ ] User experience is unchanged

### Implementation Details

```typescript
// Update src/cli/commands/batch.ts
export class BatchProcessor {
	private outputProcessor: SharedOutputProcessor

	constructor(options: BatchOptions) {
		// ... existing constructor logic

		const formatter = new CLIDisplayFormatter()
		this.outputProcessor = new SharedOutputProcessor(formatter)
	}

	private setupResponseCompletionDetection(task: Task, complete: (reason: string) => void): void {
		// ... existing logic

		task.on("message", (event: any) => {
			if (event.message?.type === "say") {
				const content = event.message?.text || ""

				// Use shared processor
				const context: OutputContext = {
					useColor: this.options.color,
					showThinking: false,
					outputMode: "cli",
					verbosity: this.options.verbose ? "verbose" : "normal",
				}

				const formattedOutputs = this.outputProcessor.processContent(content, context)

				for (const output of formattedOutputs) {
					if (output.displayText) {
						console.log(output.displayText)
					}
				}
			}
		})
	}
}
```

### Files to Modify

- `src/cli/commands/batch.ts`
- `src/cli/services/streaming/CLIDisplayFormatter.ts`

---

## Story 9: Performance Optimization and Monitoring

**Epic**: Performance & Monitoring  
**Story Points**: 3  
**Priority**: Low

### User Story

As a system administrator, I want to monitor the performance impact of output alignment changes so I can ensure system stability.

### Technical Requirements

- Add performance monitoring to output processing
- Optimize hot paths in shared components
- Monitor memory usage of output processing
- Add performance benchmarks

### Acceptance Criteria

- [ ] Performance monitoring added to output processing
- [ ] Memory usage tracking implemented
- [ ] Performance benchmarks created
- [ ] Hot paths optimized
- [ ] Monitoring dashboard shows metrics
- [ ] No significant performance degradation

### Implementation Details

```typescript
// src/core/services/OutputPerformanceMonitor.ts
export class OutputPerformanceMonitor {
	private metrics: Map<string, PerformanceMetric> = new Map()

	measureProcessing<T>(operation: string, fn: () => T): T {
		const start = performance.now()
		const result = fn()
		const duration = performance.now() - start

		this.recordMetric(operation, duration)
		return result
	}

	private recordMetric(operation: string, duration: number): void {
		// Record performance metrics
	}
}
```

### Files to Create

- `src/core/services/OutputPerformanceMonitor.ts`
- `src/core/services/__tests__/OutputPerformanceMonitor.test.ts`
- `scripts/performance-benchmarks.ts`

---

## Implementation Timeline

### Week 1-2: Foundation

- Story 1: Create Shared Output Processing Interface
- Story 2: Refactor CLI Components to Use Shared Interfaces
- Story 3: Create Shared Output Processing Service

### Week 3-4: API Integration

- Story 4: Create SSE-Compatible Output Formatter
- Story 5: Modify SSEOutputAdapter to Use Shared Processing
- Story 6: Add Tool Indicator Support to SSE Events

### Week 5-6: Testing & Validation

- Story 7: Create Output Alignment Integration Tests
- Story 8: Update CLI to Use Shared Processing
- Story 9: Performance Optimization and Monitoring

## Risk Assessment

### High Risk

- **Breaking API Changes**: Mitigation via backward compatibility tests
- **Performance Regression**: Mitigation via performance monitoring
- **Complex Refactoring**: Mitigation via incremental implementation

### Medium Risk

- **Content Formatting Differences**: Mitigation via comprehensive testing
- **Tool Indicator Duplication**: Mitigation via proper state management

### Low Risk

- **Documentation Updates**: Mitigation via automated documentation
- **Testing Coverage**: Mitigation via comprehensive test suite

## Success Criteria

1. **Functional Parity**: CLI and API produce identical tool indicators
2. **No Regressions**: All existing functionality preserved
3. **Performance**: No significant performance impact
4. **Maintainability**: Shared codebase reduces duplication
5. **Extensibility**: Easy to add new output formats

## Rollback Plan

If issues arise during implementation:

1. **Immediate**: Feature flags to disable shared processing
2. **Short-term**: Revert to original implementations
3. **Long-term**: Redesign with lessons learned

## Conclusion

This plan provides a structured approach to aligning CLI and API outputs while maintaining system stability and performance. The phased approach allows for incremental implementation and testing, reducing risk while achieving the desired consistency.
