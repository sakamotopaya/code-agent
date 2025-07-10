# Story 2: Client Stream Pausing

## User Story

**As a user**, I want the API client to pause and wait for my response when the LLM asks a question, so I have a clear interactive experience.

## Background

Currently, when the LLM asks a question via the API client, the question appears but the client continues processing other SSE events asynchronously. This creates confusion as it appears the LLM isn't waiting for the user's response, when in fact the server is properly blocked waiting for an answer.

## Acceptance Criteria

### Stream Pausing Behavior

- [ ] SSE stream processing pauses immediately when `question_ask` event is received
- [ ] No other SSE events are processed while waiting for user input
- [ ] Only the question and choices are displayed to the user
- [ ] Stream processing resumes after answer is successfully submitted
- [ ] Queued events are processed in order after resuming

### User Experience

- [ ] Clear indication that the system is waiting for user input
- [ ] Question and choices are prominently displayed
- [ ] No other output appears until user responds
- [ ] Success confirmation when answer is submitted
- [ ] Error messages if answer submission fails

### Error Handling

- [ ] Graceful handling of network failures during answer submission
- [ ] Automatic retry with exponential backoff for failed submissions
- [ ] Manual retry option for persistent failures
- [ ] Clear error messages for different failure types
- [ ] Fallback behavior when all retries are exhausted

### Performance

- [ ] Minimal memory usage for event queuing
- [ ] Efficient pause/resume mechanism
- [ ] No blocking of other client operations
- [ ] Responsive user interface during questions

## Technical Requirements

### Stream Processor Implementation

```typescript
class StreamProcessor {
	private isPaused: boolean = false
	private eventQueue: SSEEvent[] = []
	private currentQuestion: QuestionState | null = null
	private questionLogger: QuestionLogger

	constructor(options: StreamProcessorOptions) {
		this.questionLogger = new QuestionLogger(options.verbose)
	}

	async processEvent(event: SSEEvent): Promise<void> {
		// If paused and not a question event, queue it
		if (this.isPaused && event.type !== "question_ask") {
			this.eventQueue.push(event)
			this.questionLogger.logEventQueued(event.type)
			return
		}

		switch (event.type) {
			case "question_ask":
				await this.handleQuestion(event)
				break
			default:
				await this.handleRegularEvent(event)
		}
	}

	private async handleQuestion(event: SSEEvent): Promise<void> {
		this.questionLogger.logQuestionReceived(event.questionId, event.message)

		this.pauseProcessing()
		try {
			// Display question prominently
			this.displayQuestion(event)

			// Get user input with retry logic
			const answer = await this.promptUserWithRetry(event)

			// Submit answer with retry logic
			await this.submitAnswerWithRetry(event.questionId, answer)

			this.questionLogger.logQuestionCompleted(event.questionId, answer)
		} catch (error) {
			this.questionLogger.logQuestionError(event.questionId, error)
			console.error(`❌ Question handling failed: ${error.message}`)
		} finally {
			this.resumeProcessing()
		}
	}

	private pauseProcessing(): void {
		this.isPaused = true
		this.questionLogger.logStreamPaused()
		console.log("\n⏸️  Stream paused - waiting for your response...")
	}

	private resumeProcessing(): void {
		this.isPaused = false
		this.questionLogger.logStreamResumed(this.eventQueue.length)

		if (this.eventQueue.length > 0) {
			console.log(`\n▶️  Stream resumed - processing ${this.eventQueue.length} queued events...`)
		}

		// Process all queued events
		const queuedEvents = [...this.eventQueue]
		this.eventQueue = []

		// Process events sequentially to maintain order
		queuedEvents.forEach((event) => {
			setImmediate(() => this.processEvent(event))
		})
	}

	private displayQuestion(event: SSEEvent): void {
		console.log("\n" + "=".repeat(60))
		console.log("❓ QUESTION")
		console.log("=".repeat(60))
		console.log(`\n${event.message}\n`)

		if (event.choices && event.choices.length > 0) {
			console.log("Choices:")
			event.choices.forEach((choice, index) => {
				console.log(`  ${index + 1}. ${choice}`)
			})
			console.log("")
		}
	}
}
```

### Answer Submission with Retry

```typescript
class AnswerSubmitter {
	private maxRetries: number = 3
	private baseDelay: number = 1000
	private questionLogger: QuestionLogger

	constructor(options: AnswerSubmitterOptions) {
		this.maxRetries = options.maxRetries || 3
		this.baseDelay = options.baseDelay || 1000
		this.questionLogger = options.logger
	}

	async submitAnswerWithRetry(questionId: string, answer: string): Promise<void> {
		for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
			try {
				this.questionLogger.logAnswerSubmission(questionId, answer, attempt)

				const success = await this.submitAnswer(questionId, answer)

				if (success) {
					console.log(`✅ Answer submitted successfully`)
					this.questionLogger.logAnswerResult(questionId, true)
					return
				}

				throw new Error("Answer submission returned false")
			} catch (error) {
				const isLastAttempt = attempt === this.maxRetries

				this.questionLogger.logAnswerResult(questionId, false, error.message)

				if (isLastAttempt) {
					console.error(`❌ Failed to submit answer after ${this.maxRetries} attempts`)
					throw new Error(`Answer submission failed: ${error.message}`)
				} else {
					const delay = this.baseDelay * Math.pow(2, attempt - 1)
					console.warn(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`)
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}
	}

	private async submitAnswer(questionId: string, answer: string): Promise<boolean> {
		const payload = JSON.stringify({ answer })

		const response = await makeRequest(
			{
				hostname: host,
				port: port,
				path: `/api/questions/${questionId}/answer`,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(payload),
				},
			},
			payload,
		)

		if (response.statusCode === 200) {
			const result = JSON.parse(response.body)
			return result.success === true
		} else {
			throw new Error(`HTTP ${response.statusCode}: ${response.body}`)
		}
	}
}
```

### User Prompt Enhancement

```typescript
async function promptUserWithRetry(event: SSEEvent): Promise<string> {
	const maxPromptAttempts = 3

	for (let attempt = 1; attempt <= maxPromptAttempts; attempt++) {
		try {
			const answer = await promptUser(event.message, event.choices)

			if (!answer || answer.trim() === "") {
				if (attempt < maxPromptAttempts) {
					console.log("⚠️ Empty answer provided, please try again...")
					continue
				} else {
					throw new Error("No valid answer provided")
				}
			}

			return answer.trim()
		} catch (error) {
			if (attempt < maxPromptAttempts) {
				console.log(`⚠️ Input error: ${error.message}, please try again...`)
			} else {
				throw error
			}
		}
	}

	throw new Error("Failed to get valid user input")
}
```

## Testing Requirements

### Unit Tests

- [ ] Test stream pausing and resuming logic
- [ ] Test event queuing during pause
- [ ] Test retry logic for answer submission
- [ ] Test error handling for various failure scenarios
- [ ] Test memory usage with large event queues

### Integration Tests

- [ ] Test end-to-end question flow with stream pausing
- [ ] Test concurrent questions (should be queued)
- [ ] Test network failure scenarios during answer submission
- [ ] Test user input validation and retry
- [ ] Test performance with high-frequency events

### Manual Tests

- [ ] Test user experience with various question types
- [ ] Test behavior with slow user responses
- [ ] Test behavior with network interruptions
- [ ] Test accessibility of question display
- [ ] Test behavior with very long questions/choices

## Configuration Options

### Environment Variables

```bash
# Client stream pausing configuration
API_CLIENT_PAUSE_ON_QUESTIONS=true
API_CLIENT_QUESTION_TIMEOUT=60000
API_CLIENT_MAX_RETRIES=3
API_CLIENT_RETRY_BASE_DELAY=1000
API_CLIENT_MAX_QUEUE_SIZE=100
```

### Command Line Options

```bash
# Enable/disable stream pausing
--pause-on-questions / --no-pause-on-questions

# Configure retry behavior
--question-retries=3
--question-retry-delay=1000

# Configure timeouts
--question-timeout=60000
```

## Definition of Done

- [ ] Stream processing pauses correctly during questions
- [ ] Event queuing works without memory leaks
- [ ] Answer submission retry logic is robust
- [ ] User experience is clear and intuitive
- [ ] Error handling covers all failure scenarios
- [ ] Performance impact is minimal
- [ ] Configuration options work correctly
- [ ] Tests pass with >95% coverage
- [ ] Documentation is complete

## Dependencies

- Enhanced logging system (Story 1)
- Question manager improvements
- Error handling framework

## Estimated Effort

**3 days** (2 days implementation, 1 day testing and polish)

## Priority

**High** - Core functionality fix that directly addresses the user-reported issue

## Risks & Mitigations

**Risk**: Event queue memory usage with long-running questions
**Mitigation**: Implement queue size limits and overflow handling

**Risk**: Race conditions in pause/resume logic
**Mitigation**: Careful state management and comprehensive testing

**Risk**: User confusion during paused state
**Mitigation**: Clear visual indicators and helpful messaging
