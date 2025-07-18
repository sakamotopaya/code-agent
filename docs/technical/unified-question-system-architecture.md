# Unified Question System Architecture

## Vision

Create a unified ask/answer system where all three runtime modes (VSCode Extension, API, CLI) use the same core logic with runtime-specific implementations abstracted behind interfaces. This ensures consistency across modes while preserving all existing functionality.

## Current State Analysis

### VSCode Extension Mode

- **Presentation**: Direct webview interaction
- **Storage**: In-memory via TaskMessaging properties
- **Blocking**: Polling with `pWaitFor()` waiting for `this.askResponse`
- **Answer Collection**: Via `handleWebviewAskResponse()`

### API Mode

- **Presentation**: SSE events to client
- **Storage**: Persistent via ApiQuestionManager
- **Blocking**: Promise-based with proper async/await
- **Answer Collection**: Via API endpoints that resolve promises

### CLI Mode

- **Presentation**: Console output
- **Storage**: In-memory (likely)
- **Blocking**: Direct user input (readline or similar)
- **Answer Collection**: Direct console input

## Unified Architecture Design

### Core Interfaces

```typescript
// Question data structure
interface QuestionData {
	id: string
	type: "question" | "confirmation" | "input"
	question: string
	options?: QuestionOptions | ConfirmationOptions | InputOptions
	timestamp: Date
}

// Present questions to user in runtime-specific way
interface IQuestionPresenter {
	presentQuestion(question: QuestionData): Promise<void>
	presentConfirmation(question: QuestionData): Promise<void>
	presentInput(question: QuestionData): Promise<void>
}

// Collect answers from user in runtime-specific way
interface IAnswerCollector {
	waitForAnswer(questionId: string): Promise<string>
	cancelQuestion(questionId: string): void
	cleanup(): void
}

// Store questions during their lifecycle
interface IQuestionStore {
	storeQuestion(question: QuestionData): string // returns questionId
	getQuestion(questionId: string): QuestionData | undefined
	updateQuestion(questionId: string, updates: Partial<QuestionData>): void
	removeQuestion(questionId: string): void
	getAllQuestions(): QuestionData[]
}
```

### Unified Question Manager

```typescript
class UnifiedQuestionManager {
	constructor(
		private presenter: IQuestionPresenter,
		private collector: IAnswerCollector,
		private store: IQuestionStore,
	) {}

	async askQuestion(question: string, options: QuestionOptions): Promise<string | undefined> {
		const questionData: QuestionData = {
			id: this.generateQuestionId(),
			type: "question",
			question,
			options,
			timestamp: new Date(),
		}

		this.store.storeQuestion(questionData)

		try {
			await this.presenter.presentQuestion(questionData)
			const answer = await this.collector.waitForAnswer(questionData.id)
			return answer
		} finally {
			this.store.removeQuestion(questionData.id)
		}
	}

	async askConfirmation(message: string, options?: ConfirmationOptions): Promise<boolean> {
		const questionData: QuestionData = {
			id: this.generateQuestionId(),
			type: "confirmation",
			question: message,
			options,
			timestamp: new Date(),
		}

		this.store.storeQuestion(questionData)

		try {
			await this.presenter.presentConfirmation(questionData)
			const answer = await this.collector.waitForAnswer(questionData.id)
			return this.parseConfirmationAnswer(answer, options)
		} finally {
			this.store.removeQuestion(questionData.id)
		}
	}

	async askInput(prompt: string, options?: InputOptions): Promise<string | undefined> {
		const questionData: QuestionData = {
			id: this.generateQuestionId(),
			type: "input",
			question: prompt,
			options,
			timestamp: new Date(),
		}

		this.store.storeQuestion(questionData)

		try {
			await this.presenter.presentInput(questionData)
			const answer = await this.collector.waitForAnswer(questionData.id)
			return answer
		} finally {
			this.store.removeQuestion(questionData.id)
		}
	}

	private generateQuestionId(): string {
		return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	private parseConfirmationAnswer(answer: string, options?: ConfirmationOptions): boolean {
		const yesText = options?.yesText || "Yes"
		return answer.toLowerCase() === yesText.toLowerCase()
	}
}
```

## Runtime-Specific Implementations

### VSCode Extension Implementation

```typescript
// Adapter for existing VSCode webview system
class VSCodeQuestionPresenter implements IQuestionPresenter {
	constructor(private messaging: TaskMessaging) {}

	async presentQuestion(question: QuestionData): Promise<void> {
		// Use existing TaskMessaging methods
		const followupData = {
			question: question.question,
			suggest: (question.options as QuestionOptions)?.choices?.map((c) => ({ answer: c })) || [],
		}
		await this.messaging.addToClineMessages({
			ts: Date.now(),
			type: "ask",
			ask: "followup",
			text: JSON.stringify(followupData),
		})
	}

	async presentConfirmation(question: QuestionData): Promise<void> {
		await this.messaging.addToClineMessages({
			ts: Date.now(),
			type: "ask",
			ask: "confirmation",
			text: question.question,
		})
	}

	async presentInput(question: QuestionData): Promise<void> {
		await this.messaging.addToClineMessages({
			ts: Date.now(),
			type: "ask",
			ask: "input",
			text: question.question,
		})
	}
}

class VSCodeAnswerCollector implements IAnswerCollector {
	constructor(private messaging: TaskMessaging) {}

	async waitForAnswer(questionId: string): Promise<string> {
		// Use existing polling mechanism
		const askTs = Date.now()
		this.messaging.lastMessageTs = askTs

		await pWaitFor(() => this.messaging.askResponse !== undefined || this.messaging.lastMessageTs !== askTs, {
			interval: 100,
		})

		if (this.messaging.lastMessageTs !== askTs) {
			throw new Error("Question was superseded")
		}

		const answer = this.messaging.askResponseText || ""

		// Clean up
		this.messaging.askResponse = undefined
		this.messaging.askResponseText = undefined
		this.messaging.askResponseImages = undefined

		return answer
	}

	cancelQuestion(questionId: string): void {
		// Reset state to cancel current question
		this.messaging.askResponse = undefined
		this.messaging.askResponseText = undefined
		this.messaging.askResponseImages = undefined
	}

	cleanup(): void {
		// No cleanup needed for VSCode mode
	}
}

class InMemoryQuestionStore implements IQuestionStore {
	private questions = new Map<string, QuestionData>()

	storeQuestion(question: QuestionData): string {
		this.questions.set(question.id, question)
		return question.id
	}

	getQuestion(questionId: string): QuestionData | undefined {
		return this.questions.get(questionId)
	}

	updateQuestion(questionId: string, updates: Partial<QuestionData>): void {
		const existing = this.questions.get(questionId)
		if (existing) {
			this.questions.set(questionId, { ...existing, ...updates })
		}
	}

	removeQuestion(questionId: string): void {
		this.questions.delete(questionId)
	}

	getAllQuestions(): QuestionData[] {
		return Array.from(this.questions.values())
	}
}
```

### API Implementation

```typescript
// Adapter for existing SSE/ApiQuestionManager system
class SSEQuestionPresenter implements IQuestionPresenter {
	constructor(private sseAdapter: SSEOutputAdapter) {}

	async presentQuestion(question: QuestionData): Promise<void> {
		const options = question.options as QuestionOptions
		const suggestions = options?.choices?.map((choice) => ({ answer: choice })) || []

		const event: SSEEvent = {
			type: SSE_EVENTS.QUESTION_ASK,
			jobId: this.sseAdapter.jobId,
			timestamp: new Date().toISOString(),
			message: question.question,
			questionId: question.id,
			choices: options?.choices || [],
			suggestions,
		}

		this.sseAdapter.emitEvent(event)
	}

	async presentConfirmation(question: QuestionData): Promise<void> {
		const options = question.options as ConfirmationOptions
		const yesText = options?.yesText || "Yes"
		const noText = options?.noText || "No"
		const choices = [yesText, noText]

		const event: SSEEvent = {
			type: SSE_EVENTS.QUESTION_ASK,
			jobId: this.sseAdapter.jobId,
			timestamp: new Date().toISOString(),
			message: question.question,
			questionId: question.id,
			choices,
			suggestions: choices.map((choice) => ({ answer: choice })),
		}

		this.sseAdapter.emitEvent(event)
	}

	async presentInput(question: QuestionData): Promise<void> {
		const options = question.options as InputOptions
		const suggestions = options?.placeholder ? [{ answer: options.placeholder }] : []

		const event: SSEEvent = {
			type: SSE_EVENTS.QUESTION_ASK,
			jobId: this.sseAdapter.jobId,
			timestamp: new Date().toISOString(),
			message: question.question,
			questionId: question.id,
			suggestions,
		}

		this.sseAdapter.emitEvent(event)
	}
}

class ApiAnswerCollector implements IAnswerCollector {
	constructor(private questionManager: ApiQuestionManager) {}

	async waitForAnswer(questionId: string): Promise<string> {
		// Use existing ApiQuestionManager promise-based system
		const question = this.questionManager.getQuestion(questionId)
		if (!question) {
			throw new Error(`Question ${questionId} not found`)
		}

		// The promise should already be set up by the question manager
		// We just need to wait for it to resolve
		return new Promise<string>((resolve, reject) => {
			const apiQuestion = this.questionManager.getQuestion(questionId)
			if (apiQuestion?.resolvePromise) {
				// Replace the resolve function to intercept the answer
				const originalResolve = apiQuestion.resolvePromise
				apiQuestion.resolvePromise = (answer: string) => {
					originalResolve(answer)
					resolve(answer)
				}
			} else {
				reject(new Error(`Question ${questionId} has no resolve promise`))
			}
		})
	}

	cancelQuestion(questionId: string): void {
		this.questionManager.cancelQuestion(questionId, "Cancelled by system")
	}

	cleanup(): void {
		// ApiQuestionManager handles its own cleanup
	}
}

class PersistentQuestionStore implements IQuestionStore {
	constructor(private questionManager: ApiQuestionManager) {}

	storeQuestion(question: QuestionData): string {
		// The ApiQuestionManager already handles storage
		// We just need to ensure our QuestionData is compatible
		return question.id
	}

	getQuestion(questionId: string): QuestionData | undefined {
		const apiQuestion = this.questionManager.getQuestion(questionId)
		if (!apiQuestion) return undefined

		return {
			id: apiQuestion.id,
			type: this.inferQuestionType(apiQuestion),
			question: apiQuestion.question,
			options: this.extractOptions(apiQuestion),
			timestamp: apiQuestion.createdAt,
		}
	}

	updateQuestion(questionId: string, updates: Partial<QuestionData>): void {
		// ApiQuestionManager handles updates internally
	}

	removeQuestion(questionId: string): void {
		// ApiQuestionManager handles cleanup
	}

	getAllQuestions(): QuestionData[] {
		// Convert ApiQuestions to QuestionData
		return [] // Implementation depends on ApiQuestionManager API
	}

	private inferQuestionType(apiQuestion: any): "question" | "confirmation" | "input" {
		// Logic to infer type from ApiQuestion structure
		return "question" // Default
	}

	private extractOptions(apiQuestion: any): any {
		// Logic to extract options from ApiQuestion
		return undefined
	}
}
```

### CLI Implementation

```typescript
// New CLI implementations (assuming CLI mode exists)
class CLIQuestionPresenter implements IQuestionPresenter {
	async presentQuestion(question: QuestionData): Promise<void> {
		console.log(`\n${question.question}`)
		const options = question.options as QuestionOptions
		if (options?.choices) {
			options.choices.forEach((choice, index) => {
				console.log(`  ${index + 1}. ${choice}`)
			})
		}
	}

	async presentConfirmation(question: QuestionData): Promise<void> {
		const options = question.options as ConfirmationOptions
		const yesText = options?.yesText || "Yes"
		const noText = options?.noText || "No"
		console.log(`\n${question.question} (${yesText}/${noText})`)
	}

	async presentInput(question: QuestionData): Promise<void> {
		const options = question.options as InputOptions
		const placeholder = options?.placeholder ? ` (${options.placeholder})` : ""
		console.log(`\n${question.question}${placeholder}`)
	}
}

class CLIAnswerCollector implements IAnswerCollector {
	async waitForAnswer(questionId: string): Promise<string> {
		// Use readline or similar for CLI input
		return new Promise((resolve) => {
			process.stdin.once("data", (data) => {
				resolve(data.toString().trim())
			})
		})
	}

	cancelQuestion(questionId: string): void {
		// Cancel CLI input
	}

	cleanup(): void {
		// Cleanup CLI resources
	}
}
```

## Migration Strategy

### Phase 1: Create Unified Interfaces

- Define all interfaces
- Create UnifiedQuestionManager
- Add factory methods for creating runtime-specific implementations

### Phase 2: Implement VSCode Adapter

- Create VSCodeQuestionPresenter wrapping existing TaskMessaging
- Create VSCodeAnswerCollector wrapping existing polling mechanism
- Test that existing VSCode functionality works unchanged

### Phase 3: Implement API Adapter

- Create SSEQuestionPresenter wrapping existing SSEOutputAdapter
- Create ApiAnswerCollector wrapping existing ApiQuestionManager
- Test that API blocking works correctly

### Phase 4: Integrate with Task System

- Update Task.ask() to use UnifiedQuestionManager
- Update ask_followup_question tool to use unified system
- Ensure all modes work consistently

### Phase 5: CLI Implementation (if needed)

- Create CLI-specific implementations
- Test CLI question handling

## Benefits

1. **Consistency**: All modes use identical core logic
2. **Maintainability**: Changes to question logic only need to be made once
3. **Extensibility**: Easy to add new runtime modes
4. **Preservation**: All existing functionality is preserved behind adapters
5. **Testability**: Each component can be tested independently

## Backward Compatibility

- All existing APIs remain unchanged
- VSCode extension behavior identical
- API behavior identical but now works correctly
- No breaking changes to any existing code

This architecture ensures that we fix the API blocking issue while creating a robust, unified system that makes all three modes as consistent as possible.
