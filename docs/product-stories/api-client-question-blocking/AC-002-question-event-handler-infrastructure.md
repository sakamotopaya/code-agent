# AC-002: Question Event Handler Infrastructure

## Story

**As an** API client developer  
**I want** a dedicated QuestionEventHandler class  
**So that** question events can be processed systematically with proper state management

## Background

Building on AC-001 (SSE Question Event Detection), we need infrastructure to handle the detected question events. This includes parsing question data, managing question state, and coordinating with the answer submission system.

## Acceptance Criteria

### AC-002.1: QuestionEventHandler Class

- [ ] Create QuestionEventHandler class that manages question processing
- [ ] Integrates with existing StreamProcessor architecture
- [ ] Maintains question state during processing
- [ ] Supports question queuing if multiple questions arrive

### AC-002.2: Question Data Structure

- [ ] Define TypeScript interfaces for question event data
- [ ] Support all question types: select, input, confirmation, password
- [ ] Validate question data structure on receipt
- [ ] Handle missing or malformed question properties gracefully

### AC-002.3: Stream Processing Integration

- [ ] Extend StreamProcessor to handle question events
- [ ] Pause regular stream processing during questions
- [ ] Resume stream processing after question completion
- [ ] Maintain event queue for events received during question handling

## Technical Implementation

### New Types Required

```typescript
// Add to src/tools/types/api-client-types.ts

export interface QuestionEventData {
	type: "question"
	questionId: string
	questionType: "select" | "input" | "confirmation" | "password"
	question: string
	timestamp: string
	choices?: string[]
	placeholder?: string
	password?: boolean
	yesText?: string
	noText?: string
}

export interface QuestionHandlerState {
	currentQuestion: QuestionEventData | null
	isProcessing: boolean
	questionQueue: QuestionEventData[]
}
```

### QuestionEventHandler Class

```typescript
// New file: src/tools/QuestionEventHandler.ts

import inquirer from "inquirer"
import { QuestionEventData, QuestionHandlerState, ApiClientOptions } from "./types/api-client-types"

export class QuestionEventHandler {
	private state: QuestionHandlerState
	private options: ApiClientOptions
	private baseUrl: string

	constructor(options: ApiClientOptions) {
		this.options = options
		this.baseUrl = `http://${options.host}:${options.port}`
		this.state = {
			currentQuestion: null,
			isProcessing: false,
			questionQueue: [],
		}
	}

	async handleQuestionEvent(questionData: QuestionEventData): Promise<void> {
		// Validate question data
		if (!this.isValidQuestionData(questionData)) {
			throw new Error(`Invalid question data: ${JSON.stringify(questionData)}`)
		}

		// Queue question if currently processing another
		if (this.state.isProcessing) {
			this.state.questionQueue.push(questionData)
			return
		}

		await this.processQuestion(questionData)
	}

	private async processQuestion(questionData: QuestionEventData): Promise<void> {
		this.state.isProcessing = true
		this.state.currentQuestion = questionData

		try {
			// Present question based on type (AC-003, AC-004, AC-005)
			const answer = await this.presentQuestion(questionData)

			// Submit answer (AC-006)
			await this.submitAnswer(questionData.questionId, answer)

			console.log("✅ Question answered successfully")
		} catch (error) {
			console.error(`❌ Question handling failed: ${error}`)
			throw error
		} finally {
			this.state.isProcessing = false
			this.state.currentQuestion = null

			// Process next queued question
			if (this.state.questionQueue.length > 0) {
				const nextQuestion = this.state.questionQueue.shift()!
				setImmediate(() => this.processQuestion(nextQuestion))
			}
		}
	}

	private async presentQuestion(questionData: QuestionEventData): Promise<string> {
		// Implementation in subsequent stories (AC-003, AC-004, AC-005)
		throw new Error("presentQuestion not implemented yet")
	}

	private async submitAnswer(questionId: string, answer: string): Promise<void> {
		// Implementation in AC-006
		throw new Error("submitAnswer not implemented yet")
	}

	private isValidQuestionData(data: any): data is QuestionEventData {
		return (
			data &&
			typeof data === "object" &&
			data.type === "question" &&
			typeof data.questionId === "string" &&
			typeof data.questionType === "string" &&
			["select", "input", "confirmation", "password"].includes(data.questionType) &&
			typeof data.question === "string"
		)
	}

	public isProcessing(): boolean {
		return this.state.isProcessing
	}

	public getCurrentQuestion(): QuestionEventData | null {
		return this.state.currentQuestion
	}
}
```

### StreamProcessor Integration

```typescript
// Modify src/tools/api-client.ts StreamProcessor class

import { QuestionEventHandler } from "./QuestionEventHandler"

class StreamProcessor {
	// ... existing properties
	private questionHandler: QuestionEventHandler

	constructor(options: StreamProcessorOptions = {}) {
		// ... existing initialization
		this.questionHandler = new QuestionEventHandler(options)
	}

	async handleQuestionEvent(questionData: any): Promise<void> {
		// Pause regular stream processing
		this.pauseProcessing()

		try {
			await this.questionHandler.handleQuestionEvent(questionData)
		} finally {
			// Resume stream processing
			this.resumeProcessing()
		}
	}

	private pauseProcessing(): void {
		this.state.isPaused = true
		if (this.verbose) {
			console.log("⏸️  Stream processing paused for question")
		}
	}

	private resumeProcessing(): void {
		this.state.isPaused = false
		if (this.verbose) {
			console.log("▶️  Stream processing resumed")
		}

		// Process any queued events
		this.processQueuedEvents()
	}
}
```

## Testing

### Unit Tests

- [ ] Test QuestionEventHandler creation and initialization
- [ ] Test question data validation with valid/invalid inputs
- [ ] Test question queuing when already processing
- [ ] Test state management during question processing
- [ ] Test StreamProcessor integration

### Integration Tests

- [ ] Test end-to-end question event flow (detection → handling)
- [ ] Test multiple questions queued properly
- [ ] Test stream processing pause/resume behavior

## Definition of Done

- [ ] QuestionEventHandler class implemented with full state management
- [ ] TypeScript interfaces defined for question data structures
- [ ] StreamProcessor integration complete
- [ ] Question data validation working
- [ ] Question queuing system working
- [ ] Unit tests passing
- [ ] Code documented and follows existing patterns

## Dependencies

- **Depends on:** AC-001 (SSE Question Event Detection)
- **Required by:** AC-003, AC-004, AC-005, AC-006

## Estimated Effort

**3 Story Points** - Medium complexity, new class with state management
