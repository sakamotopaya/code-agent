# AC-007: Error Handling & Edge Cases

## Story

**As an** API client user  
**I want** robust error handling for all question scenarios  
**So that** the client gracefully handles unexpected situations without crashing

## Background

The question handling system needs comprehensive error handling to deal with edge cases like malformed questions, network failures, server timeouts, user interruptions, and concurrent questions. The system should fail gracefully and provide meaningful feedback.

## Acceptance Criteria

### AC-007.1: Malformed Question Handling

- [ ] Handle missing required question fields gracefully
- [ ] Validate question data structure before processing
- [ ] Provide meaningful error messages for invalid questions
- [ ] Continue stream processing despite question errors
- [ ] Log detailed error information in verbose mode

### AC-007.2: Network & Server Error Handling

- [ ] Handle server unavailability during answer submission
- [ ] Handle partial network connectivity issues
- [ ] Handle server timeouts during question processing
- [ ] Retry transient failures with appropriate backoff
- [ ] Fail gracefully when server is permanently unreachable

### AC-007.3: User Interaction Edge Cases

- [ ] Handle user cancellation (Ctrl+C) gracefully
- [ ] Handle terminal resize during questions
- [ ] Handle invalid user input (beyond validation)
- [ ] Handle very long user input (memory management)
- [ ] Handle rapid fire questions from server

### AC-007.4: Stream Processing Edge Cases

- [ ] Handle questions received during stream reconnection
- [ ] Handle duplicate question events
- [ ] Handle questions with very long question text
- [ ] Handle questions with extremely large choice lists
- [ ] Handle questions received after stream ends

## Technical Implementation

### Robust Question Data Validation

```typescript
// Add to src/tools/QuestionEventHandler.ts

private async handleQuestionEvent(questionData: QuestionEventData): Promise<void> {
    try {
        // Comprehensive validation
        const validationResult = this.validateQuestionData(questionData)
        if (!validationResult.isValid) {
            throw new QuestionValidationError(validationResult.errors.join(', '))
        }

        // Check for duplicate questions
        if (this.isDuplicateQuestion(questionData.questionId)) {
            if (this.options.verbose) {
                console.log(`⚠️  Duplicate question detected: ${questionData.questionId}`)
            }
            return
        }

        // Queue question if currently processing another
        if (this.state.isProcessing) {
            this.addToQueue(questionData)
            return
        }

        await this.processQuestion(questionData)

    } catch (error) {
        this.handleQuestionError(error, questionData)
    }
}

private validateQuestionData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Basic structure validation
    if (!data || typeof data !== 'object') {
        errors.push('Question data must be an object')
        return { isValid: false, errors }
    }

    // Required fields
    if (!data.questionId || typeof data.questionId !== 'string') {
        errors.push('questionId is required and must be a string')
    }

    if (!data.questionType || typeof data.questionType !== 'string') {
        errors.push('questionType is required and must be a string')
    }

    if (!data.question || typeof data.question !== 'string') {
        errors.push('question is required and must be a string')
    }

    // Validate question type
    const validTypes = ['select', 'input', 'confirmation', 'password']
    if (data.questionType && !validTypes.includes(data.questionType)) {
        errors.push(`questionType must be one of: ${validTypes.join(', ')}`)
    }

    // Type-specific validation
    if (data.questionType === 'select') {
        if (!Array.isArray(data.choices) || data.choices.length === 0) {
            errors.push('Select questions must have a non-empty choices array')
        }

        if (data.choices && data.choices.length > 50) {
            errors.push('Too many choices (max 50)')
        }
    }

    // Length validation
    if (data.question && data.question.length > 1000) {
        errors.push('Question text is too long (max 1000 characters)')
    }

    return { isValid: errors.length === 0, errors }
}

private isDuplicateQuestion(questionId: string): boolean {
    return this.processedQuestions.has(questionId)
}

private addToQueue(questionData: QuestionEventData): void {
    if (this.state.questionQueue.length >= 10) {
        console.warn('⚠️  Question queue is full, dropping oldest question')
        this.state.questionQueue.shift()
    }

    this.state.questionQueue.push(questionData)

    if (this.options.verbose) {
        console.log(`📝 Question queued: ${questionData.questionId} (${this.state.questionQueue.length} in queue)`)
    }
}
```

### Enhanced Error Handling

```typescript
private handleQuestionError(error: any, questionData?: QuestionEventData): void {
    const timestamp = new Date().toISOString()

    if (error instanceof QuestionValidationError) {
        console.error(`❌ Question validation failed: ${error.message}`)
        if (this.options.verbose && questionData) {
            console.error(`   Question data: ${JSON.stringify(questionData, null, 2)}`)
        }
        return
    }

    if (error instanceof NetworkError) {
        console.error(`❌ Network error during question handling: ${error.message}`)
        console.error(`   Please check your connection and try again`)
        return
    }

    if (error instanceof UserCancellationError) {
        console.log(`👋 Question cancelled by user`)
        if (questionData) {
            console.log(`   Question: ${questionData.question}`)
        }
        return
    }

    if (error instanceof TimeoutError) {
        console.error(`⏰ Question timed out: ${error.message}`)
        if (questionData) {
            console.error(`   Question: ${questionData.questionId}`)
        }
        return
    }

    // Unknown error
    console.error(`💥 Unexpected error during question handling:`)
    console.error(`   Error: ${error.message || error}`)
    if (this.options.verbose) {
        console.error(`   Stack: ${error.stack}`)
        if (questionData) {
            console.error(`   Question data: ${JSON.stringify(questionData, null, 2)}`)
        }
    }
}

// Custom error classes
class QuestionValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'QuestionValidationError'
    }
}

class UserCancellationError extends Error {
    constructor(message: string = 'User cancelled the question') {
        super(message)
        this.name = 'UserCancellationError'
    }
}

class TimeoutError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'TimeoutError'
    }
}
```

### Graceful User Cancellation

```typescript
private async presentQuestion(questionData: QuestionEventData): Promise<string> {
    // Set up cancellation handling
    const cancellationHandler = this.setupCancellationHandler()

    try {
        switch (questionData.questionType) {
            case 'select':
                return await this.presentSelectQuestion(questionData)
            case 'input':
                return await this.presentInputQuestion(questionData)
            case 'confirmation':
                return await this.presentConfirmationQuestion(questionData)
            case 'password':
                return await this.presentPasswordQuestion(questionData)
            default:
                throw new Error(`Unsupported question type: ${questionData.questionType}`)
        }
    } catch (error) {
        if (error.name === 'ExitPromptError' || error.message?.includes('canceled')) {
            throw new UserCancellationError()
        }
        throw error
    } finally {
        this.cleanupCancellationHandler(cancellationHandler)
    }
}

private setupCancellationHandler(): NodeJS.SignalHandler {
    const handler: NodeJS.SignalHandler = (signal) => {
        console.log(`\n👋 Received ${signal}, cancelling current question...`)
        process.exit(0)
    }

    process.on('SIGINT', handler)
    process.on('SIGTERM', handler)

    return handler
}

private cleanupCancellationHandler(handler: NodeJS.SignalHandler): void {
    process.removeListener('SIGINT', handler)
    process.removeListener('SIGTERM', handler)
}
```

### Memory Management & Resource Cleanup

```typescript
private async processQuestion(questionData: QuestionEventData): Promise<void> {
    const questionId = questionData.questionId
    const startTime = Date.now()

    // Add to processed questions set (with cleanup)
    this.addToProcessedQuestions(questionId)

    // Set question timeout
    const timeoutHandle = this.setQuestionTimeout(questionId)

    try {
        this.state.isProcessing = true
        this.state.currentQuestion = questionData

        // Present question with memory-conscious handling
        const answer = await this.presentQuestionSafely(questionData)

        // Submit answer
        await this.submitAnswer(questionId, answer)

        const duration = Date.now() - startTime
        if (this.options.verbose) {
            console.log(`✅ Question completed in ${duration}ms`)
        }

    } finally {
        // Cleanup
        clearTimeout(timeoutHandle)
        this.state.isProcessing = false
        this.state.currentQuestion = null

        // Process next queued question
        this.processNextQueuedQuestion()

        // Periodic cleanup
        this.performPeriodicCleanup()
    }
}

private addToProcessedQuestions(questionId: string): void {
    this.processedQuestions.add(questionId)

    // Limit size to prevent memory leaks
    if (this.processedQuestions.size > 1000) {
        const oldestEntries = Array.from(this.processedQuestions).slice(0, 500)
        oldestEntries.forEach(id => this.processedQuestions.delete(id))
    }
}

private setQuestionTimeout(questionId: string): NodeJS.Timeout {
    return setTimeout(() => {
        if (this.state.currentQuestion?.questionId === questionId) {
            console.error(`⏰ Question timed out after 5 minutes: ${questionId}`)
            this.handleQuestionError(new TimeoutError('Question timed out'), this.state.currentQuestion)
        }
    }, 5 * 60 * 1000) // 5 minute timeout
}

private performPeriodicCleanup(): void {
    // Clean up old queue entries
    if (this.state.questionQueue.length > 20) {
        console.warn('⚠️  Question queue too large, clearing old entries')
        this.state.questionQueue = this.state.questionQueue.slice(-10)
    }
}
```

### Stream Processing Resilience

```typescript
// Integration with StreamProcessor for robust stream handling

class StreamProcessor {
	private questionEventBuffer: QuestionEventData[] = []
	private lastQuestionEventTime: number = 0

	async handleQuestionEvent(questionData: any): Promise<void> {
		try {
			// Rate limiting for rapid fire questions
			const now = Date.now()
			if (now - this.lastQuestionEventTime < 100) {
				// 100ms between questions
				this.questionEventBuffer.push(questionData)
				this.scheduleBufferedQuestionProcessing()
				return
			}

			this.lastQuestionEventTime = now

			// Pause regular stream processing
			this.pauseProcessing()

			try {
				await this.questionHandler.handleQuestionEvent(questionData)
			} finally {
				// Always resume stream processing
				this.resumeProcessing()
			}
		} catch (error) {
			console.error(`❌ Stream question handling failed: ${error}`)
			// Continue stream processing despite question errors
			this.resumeProcessing()
		}
	}

	private scheduleBufferedQuestionProcessing(): void {
		if (this.questionBufferTimeout) {
			clearTimeout(this.questionBufferTimeout)
		}

		this.questionBufferTimeout = setTimeout(() => {
			this.processBufferedQuestions()
		}, 500) // Process buffered questions after 500ms of quiet
	}

	private async processBufferedQuestions(): Promise<void> {
		const questions = [...this.questionEventBuffer]
		this.questionEventBuffer = []

		for (const question of questions) {
			try {
				await this.questionHandler.handleQuestionEvent(question)
			} catch (error) {
				console.error(`❌ Buffered question failed: ${error}`)
			}
		}
	}
}
```

## Testing

### Unit Tests

- [ ] Test malformed question data validation
- [ ] Test duplicate question detection
- [ ] Test user cancellation handling
- [ ] Test question timeout handling
- [ ] Test memory management and cleanup
- [ ] Test rapid fire question buffering
- [ ] Test error recovery and continuation

### Integration Tests

- [ ] Test network failure during question processing
- [ ] Test server timeout scenarios
- [ ] Test concurrent question handling
- [ ] Test stream interruption during questions

### Stress Tests

- [ ] Test with 100+ rapid fire questions
- [ ] Test with very large question text (1MB+)
- [ ] Test with 1000+ choice options
- [ ] Test memory usage over extended periods

## Definition of Done

- [ ] All error scenarios handled gracefully
- [ ] System continues operation despite individual question failures
- [ ] Memory leaks prevented with proper cleanup
- [ ] User cancellation doesn't crash the client
- [ ] Network errors don't block stream processing
- [ ] Comprehensive error logging in verbose mode
- [ ] Error messages are clear and actionable
- [ ] Unit tests covering all error scenarios
- [ ] Stress tests validate system resilience
- [ ] Integration tests validate error recovery

## Dependencies

- **Depends on:** All previous stories (AC-001 through AC-006)
- **Required by:** AC-008 (End-to-End Testing)

## Estimated Effort

**3 Story Points** - Complex due to comprehensive error handling and edge case coverage
