# CLI MessageBuffer Integration - SOLID Design Principles & Testing Strategy

## SOLID Principles Application

### 1. Single Responsibility Principle (SRP)

#### Current Violations:

- `CLILogger` handles both logging AND XML parsing
- `streamLLMOutput()` does parsing, filtering, and output formatting

#### SOLID Solution:

```typescript
// Separate concerns into focused classes
interface IContentProcessor {
	processContent(content: string): ProcessedMessage[]
}

interface IContentDisplayFormatter {
	formatForDisplay(message: ProcessedMessage): string | null
}

interface IDisplayOutput {
	write(content: string): void
	writeToolIndicator(toolName: string): void
}

class CLIContentProcessor implements IContentProcessor {
	constructor(private messageBuffer: MessageBuffer) {}

	processContent(content: string): ProcessedMessage[] {
		return this.messageBuffer.processMessage(content)
	}
}

class CLIDisplayFormatter implements IContentDisplayFormatter {
	constructor(
		private useColor: boolean,
		private showThinking: boolean,
	) {}

	formatForDisplay(message: ProcessedMessage): string | null {
		// Single responsibility: only format display
	}
}

class CLITerminalOutput implements IDisplayOutput {
	// Single responsibility: only handle terminal output
}
```

### 2. Open/Closed Principle (OCP)

#### Extensible Content Type Handling:

```typescript
interface IContentTypeHandler {
	canHandle(contentType: ContentType): boolean
	handle(message: ProcessedMessage, context: DisplayContext): DisplayResult | null
}

class ContentHandler implements IContentTypeHandler {
	handle(message: ProcessedMessage, context: DisplayContext): DisplayResult | null {
		// Template method pattern for extensibility
	}
}

class ThinkingContentHandler extends ContentHandler {
	canHandle(contentType: ContentType): boolean {
		return contentType === "thinking"
	}
}

class ToolCallContentHandler extends ContentHandler {
	canHandle(contentType: ContentType): boolean {
		return contentType === "tool_call"
	}
}

// New content types can be added without modifying existing code
class CustomContentHandler extends ContentHandler {
	canHandle(contentType: ContentType): boolean {
		return contentType === "custom_new_type"
	}
}
```

### 3. Liskov Substitution Principle (LSP)

#### Proper Interface Contracts:

```typescript
interface IStreamingLogger {
	streamContent(content: string): void
	reset(): void
}

class CLILogger implements IStreamingLogger {
	streamContent(content: string): void {
		// Must honor the contract - process content for display
	}

	reset(): void {
		// Must properly reset state
	}
}

class VerboseCLILogger extends CLILogger {
	streamContent(content: string): void {
		// Can extend behavior but must maintain contract
		super.streamContent(content)
		// Additional verbose logging
	}
}
```

### 4. Interface Segregation Principle (ISP)

#### Focused Interfaces:

```typescript
// Instead of one large interface, create focused ones
interface IContentProcessor {
	processContent(content: string): ProcessedMessage[]
}

interface IDisplayFormatter {
	formatContent(message: ProcessedMessage): string | null
	formatToolIndicator(toolName: string): string
}

interface IStateManager {
	reset(): void
	getState(): StreamingState
}

interface IOutputWriter {
	write(content: string): void
	clearLine(): void
}

// CLILogger only implements what it needs
class CLILogger implements IStreamingLogger, IStateManager {
	// Doesn't implement IContentProcessor - delegates to it
}
```

### 5. Dependency Inversion Principle (DIP)

#### Depend on Abstractions:

```typescript
class CLILogger {
	constructor(
		private contentProcessor: IContentProcessor,
		private displayFormatter: IDisplayFormatter,
		private outputWriter: IOutputWriter,
		private stateManager: IStateManager,
	) {}

	streamContent(content: string): void {
		const messages = this.contentProcessor.processContent(content)

		for (const message of messages) {
			const formatted = this.displayFormatter.formatContent(message)
			if (formatted) {
				this.outputWriter.write(formatted)
			}
		}
	}
}

// Easy to test and swap implementations
const logger = new CLILogger(
	new CLIContentProcessor(new MessageBuffer()),
	new CLIDisplayFormatter(true, false),
	new ConsoleOutputWriter(),
	new CLIStateManager(),
)
```

## Comprehensive Unit Testing Strategy

### 1. Test Coverage Requirements

#### Minimum Coverage Targets:

- **Lines**: 95%
- **Functions**: 100%
- **Branches**: 90%
- **Statements**: 95%

#### Test Categories:

1. **Unit Tests**: Individual class/function testing
2. **Integration Tests**: Component interaction testing
3. **Contract Tests**: Interface compliance testing
4. **Property-Based Tests**: Edge case generation
5. **Performance Tests**: Streaming performance validation

### 2. Unit Test Structure

#### Test Organization:

```
src/
├── cli/services/__tests__/
│   ├── CLILogger.test.ts
│   ├── CLIContentProcessor.test.ts
│   ├── CLIDisplayFormatter.test.ts
│   ├── CLITerminalOutput.test.ts
│   └── integration/
│       ├── CLIStreamingIntegration.test.ts
│       └── MessageBufferIntegration.test.ts
├── api/streaming/__tests__/
│   ├── MessageBuffer.test.ts (existing)
│   └── StreamingComparison.test.ts (CLI vs SSE)
```

#### CLILogger Test Suite:

```typescript
// src/cli/services/__tests__/CLILogger.test.ts
describe("CLILogger with MessageBuffer Integration", () => {
	let mockContentProcessor: jest.Mocked<IContentProcessor>
	let mockDisplayFormatter: jest.Mocked<IDisplayFormatter>
	let mockOutputWriter: jest.Mocked<IOutputWriter>
	let logger: CLILogger

	beforeEach(() => {
		mockContentProcessor = createMockContentProcessor()
		mockDisplayFormatter = createMockDisplayFormatter()
		mockOutputWriter = createMockOutputWriter()

		logger = new CLILogger(mockContentProcessor, mockDisplayFormatter, mockOutputWriter)
	})

	describe("streamContent", () => {
		it("should process content through content processor", () => {
			const content = "test content"
			logger.streamContent(content)

			expect(mockContentProcessor.processContent).toHaveBeenCalledWith(content)
		})

		it("should format each processed message", () => {
			const messages: ProcessedMessage[] = [
				{ content: "msg1", contentType: "content", isComplete: true },
				{ content: "msg2", contentType: "thinking", isComplete: true },
			]
			mockContentProcessor.processContent.mockReturnValue(messages)

			logger.streamContent("test")

			expect(mockDisplayFormatter.formatContent).toHaveBeenCalledTimes(2)
			expect(mockDisplayFormatter.formatContent).toHaveBeenCalledWith(messages[0])
			expect(mockDisplayFormatter.formatContent).toHaveBeenCalledWith(messages[1])
		})

		it("should only write formatted content that is not null", () => {
			const messages: ProcessedMessage[] = [
				{ content: "show", contentType: "content", isComplete: true },
				{ content: "hide", contentType: "thinking", isComplete: true },
			]
			mockContentProcessor.processContent.mockReturnValue(messages)
			mockDisplayFormatter.formatContent.mockReturnValueOnce("formatted show").mockReturnValueOnce(null) // thinking hidden

			logger.streamContent("test")

			expect(mockOutputWriter.write).toHaveBeenCalledTimes(1)
			expect(mockOutputWriter.write).toHaveBeenCalledWith("formatted show")
		})
	})

	describe("reset", () => {
		it("should reset content processor state", () => {
			logger.reset()

			expect(mockContentProcessor.reset).toHaveBeenCalled()
		})
	})

	// Property-based testing
	describe("streaming edge cases", () => {
		it.each([
			["empty string", ""],
			["partial XML", "<thinking>partial"],
			["malformed XML", "<invalid><thinking>mixed</invalid>"],
			["large content", "x".repeat(10000)],
			["unicode content", "🔧 Tool execution 中文"],
			["mixed content", "Normal text <thinking>hidden</thinking> more text"],
		])("should handle %s without errors", (_, content) => {
			expect(() => logger.streamContent(content)).not.toThrow()
		})
	})
})
```

### 3. Integration Testing

#### CLI vs SSE Consistency Tests:

```typescript
// src/api/streaming/__tests__/StreamingComparison.test.ts
describe("CLI and SSE Streaming Consistency", () => {
	let cliLogger: CLILogger
	let sseAdapter: SSEOutputAdapter
	let capturedCLIOutput: string[]
	let capturedSSEEvents: SSEEvent[]

	beforeEach(() => {
		capturedCLIOutput = []
		capturedSSEEvents = []

		// Mock CLI output capture
		const mockOutputWriter = {
			write: (content: string) => capturedCLIOutput.push(content),
		}

		cliLogger = new CLILogger(
			new CLIContentProcessor(new MessageBuffer()),
			new CLIDisplayFormatter(false, false), // no color, no thinking
			mockOutputWriter,
		)

		// Mock SSE event capture
		const mockStreamManager = {
			emitEvent: (event: SSEEvent) => capturedSSEEvents.push(event),
		}

		sseAdapter = new SSEOutputAdapter(mockStreamManager, "test-job", false)
	})

	it("should produce equivalent parsing results for identical input", () => {
		const testInputs = [
			"Normal content with <thinking>hidden thoughts</thinking> and more content",
			"<read_file><path>test.ts</path></read_file>",
			"Mixed <tool_call>execute_command</tool_call> with <system>args</system>",
			"Partial content ending with <thinking>unfinished",
		]

		for (const input of testInputs) {
			capturedCLIOutput.length = 0
			capturedSSEEvents.length = 0

			cliLogger.streamContent(input)
			sseAdapter.showProgress(input)

			// Both should identify the same content types and structure
			const cliContentTypes = extractContentTypes(capturedCLIOutput)
			const sseContentTypes = extractContentTypes(capturedSSEEvents)

			expect(cliContentTypes).toEqual(sseContentTypes)
		}
	})

	it("should handle tool name detection consistently", () => {
		const toolNames = ["read_file", "write_to_file", "execute_command", "use_mcp_tool", "attempt_completion"]

		for (const toolName of toolNames) {
			const input = `<${toolName}><path>test</path></${toolName}>`

			capturedCLIOutput.length = 0
			capturedSSEEvents.length = 0

			cliLogger.streamContent(input)
			sseAdapter.showProgress(input)

			const cliDetectedTools = extractToolNames(capturedCLIOutput)
			const sseDetectedTools = extractToolNames(capturedSSEEvents)

			expect(cliDetectedTools).toContain(toolName)
			expect(sseDetectedTools).toContain(toolName)
		}
	})
})
```

### 4. Performance Testing

#### Streaming Performance Tests:

```typescript
describe("MessageBuffer Performance", () => {
	let logger: CLILogger
	let performanceMonitor: PerformanceMonitor

	beforeEach(() => {
		logger = createTestCLILogger()
		performanceMonitor = new PerformanceMonitor()
	})

	it("should process streaming content within performance thresholds", () => {
		const largeContent = generateStreamingContent(10000) // 10KB of mixed content

		const startTime = performance.now()
		logger.streamContent(largeContent)
		const endTime = performance.now()

		const processingTime = endTime - startTime
		expect(processingTime).toBeLessThan(100) // 100ms threshold
	})

	it("should have minimal memory overhead compared to old implementation", async () => {
		const baseline = await measureMemoryUsage(() => {
			// Old manual parsing implementation
			processWithOldImplementation(testContent)
		})

		const newImplementation = await measureMemoryUsage(() => {
			logger.streamContent(testContent)
		})

		// Should not use more than 20% additional memory
		expect(newImplementation.peak).toBeLessThan(baseline.peak * 1.2)
	})

	it("should handle high-frequency streaming without degradation", () => {
		const chunks = generateFrequentChunks(1000) // 1000 small chunks

		const processingTimes: number[] = []

		for (const chunk of chunks) {
			const start = performance.now()
			logger.streamContent(chunk)
			const end = performance.now()
			processingTimes.push(end - start)
		}

		// Processing time should remain consistent (no degradation)
		const averageTime = processingTimes.reduce((a, b) => a + b) / processingTimes.length
		const maxTime = Math.max(...processingTimes)

		expect(maxTime).toBeLessThan(averageTime * 3) // No more than 3x average
	})
})
```

### 5. Contract Testing

#### Interface Compliance Tests:

```typescript
describe("Interface Contract Compliance", () => {
	describe("IContentProcessor contract", () => {
		let processor: IContentProcessor

		beforeEach(() => {
			processor = new CLIContentProcessor(new MessageBuffer())
		})

		it("should always return an array from processContent", () => {
			const result = processor.processContent("")
			expect(Array.isArray(result)).toBe(true)
		})

		it("should handle null/undefined input gracefully", () => {
			expect(() => processor.processContent(null as any)).not.toThrow()
			expect(() => processor.processContent(undefined as any)).not.toThrow()
		})

		it("should return ProcessedMessage objects with required properties", () => {
			const result = processor.processContent("test content")

			for (const message of result) {
				expect(message).toHaveProperty("content")
				expect(message).toHaveProperty("contentType")
				expect(message).toHaveProperty("isComplete")
				expect(typeof message.content).toBe("string")
				expect(["content", "thinking", "tool_call", "system", "tool_result"]).toContain(message.contentType)
				expect(typeof message.isComplete).toBe("boolean")
			}
		})
	})

	describe("IDisplayFormatter contract", () => {
		let formatter: IDisplayFormatter

		beforeEach(() => {
			formatter = new CLIDisplayFormatter(true, false)
		})

		it("should return string or null from formatContent", () => {
			const message: ProcessedMessage = {
				content: "test",
				contentType: "content",
				isComplete: true,
			}

			const result = formatter.formatContent(message)
			expect(result === null || typeof result === "string").toBe(true)
		})
	})
})
```

### 6. Test Data and Fixtures

#### Comprehensive Test Scenarios:

```typescript
// src/cli/services/__tests__/fixtures/streaming-scenarios.ts
export const StreamingTestScenarios = {
    simpleContent: 'Hello world',
    thinkingSection: 'Before <thinking>internal thoughts</thinking> after',
    toolExecution: '<read_file><path>test.ts</path></read_file>',
    mixedContent: `
        Normal text
        <thinking>Hidden reasoning</thinking>
        <write_to_file>
            <path>output.ts</path>
            <content>export const test = true
```
