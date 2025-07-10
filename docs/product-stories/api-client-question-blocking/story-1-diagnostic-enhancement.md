# Story 1: Diagnostic Enhancement

## User Story

**As a developer**, I want comprehensive logging of the question lifecycle so I can identify where and why questions are failing.

## Background

Currently, when questions fail in the API client, there's limited visibility into what went wrong. Questions may be failing silently and falling back to default answers, making it difficult to debug and improve the system.

## Acceptance Criteria

### Server-Side Logging

- [ ] Question creation events are logged with timestamps and metadata
- [ ] Question emission via SSE is logged
- [ ] Question state changes (pending → answered/expired/cancelled) are logged
- [ ] Answer submission attempts are logged with success/failure status
- [ ] Fallback events are logged with detailed reasons
- [ ] Question manager statistics are periodically logged

### Client-Side Logging

- [ ] Question reception events are logged
- [ ] User prompt display events are logged
- [ ] Answer submission attempts are logged with response status
- [ ] Retry attempts are logged with delay information
- [ ] Stream pause/resume events are logged

### Error Categorization

- [ ] Network-related failures are categorized
- [ ] Timeout-related failures are categorized
- [ ] Question state conflicts are categorized
- [ ] Client-side errors are categorized
- [ ] Server-side errors are categorized

### Monitoring Dashboard

- [ ] Question success rate metrics
- [ ] Average question response time
- [ ] Fallback rate by error category
- [ ] Client retry rate statistics
- [ ] Concurrent question counts

## Technical Requirements

### Log Format

```typescript
interface QuestionLogEvent {
	timestamp: string
	level: "info" | "warn" | "error"
	event: "question_created" | "question_emitted" | "question_answered" | "question_failed" | "fallback_triggered"
	questionId: string
	jobId: string
	metadata: {
		question?: string
		answer?: string
		duration?: number
		errorReason?: string
		retryAttempt?: number
	}
}
```

### Server-Side Implementation

```typescript
class ApiQuestionManager extends EventEmitter {
	private logger: Logger

	async createQuestion(
		jobId: string,
		question: string,
		suggestions: Array<{ answer: string }> = [],
	): Promise<{ questionId: string; promise: Promise<string> }> {
		const questionId = `q_${jobId}_${Date.now()}_${++this.questionCounter}`

		this.logger.info("Question created", {
			questionId,
			jobId,
			question: question.substring(0, 100),
			suggestionsCount: suggestions.length,
			timestamp: new Date().toISOString(),
		})

		// ... existing logic ...

		return { questionId, promise: questionPromise }
	}

	async submitAnswer(questionId: string, answer: string): Promise<boolean> {
		const startTime = Date.now()

		this.logger.info("Answer submission attempt", {
			questionId,
			answer: answer.substring(0, 50),
			timestamp: new Date().toISOString(),
		})

		const result = await this.doSubmitAnswer(questionId, answer)
		const duration = Date.now() - startTime

		if (result) {
			this.logger.info("Answer submitted successfully", {
				questionId,
				duration,
				timestamp: new Date().toISOString(),
			})
		} else {
			this.logger.warn("Answer submission failed", {
				questionId,
				duration,
				reason: "Question not found or not pending",
				timestamp: new Date().toISOString(),
			})
		}

		return result
	}
}
```

### Client-Side Implementation

```typescript
class QuestionLogger {
	private logEvent(event: string, data: any): void {
		const logEntry = {
			timestamp: new Date().toISOString(),
			event,
			...data,
		}

		if (verbose) {
			console.log(`[QUESTION-LOG] ${JSON.stringify(logEntry)}`)
		}
	}

	logQuestionReceived(questionId: string, question: string): void {
		this.logEvent("question_received", {
			questionId,
			question: question.substring(0, 100),
		})
	}

	logAnswerSubmission(questionId: string, answer: string, attempt: number): void {
		this.logEvent("answer_submission", {
			questionId,
			answer: answer.substring(0, 50),
			attempt,
		})
	}

	logAnswerResult(questionId: string, success: boolean, error?: string): void {
		this.logEvent("answer_result", {
			questionId,
			success,
			error,
		})
	}
}
```

## Testing Requirements

### Unit Tests

- [ ] Test question lifecycle logging
- [ ] Test error categorization logic
- [ ] Test log format consistency
- [ ] Test performance impact of logging

### Integration Tests

- [ ] Test end-to-end logging flow
- [ ] Test log aggregation and analysis
- [ ] Test monitoring dashboard updates
- [ ] Test log retention and cleanup

## Definition of Done

- [ ] All logging requirements implemented
- [ ] Error categorization working correctly
- [ ] Monitoring dashboard displays real-time metrics
- [ ] Performance impact is minimal (<5% overhead)
- [ ] Documentation updated with logging configuration
- [ ] Tests pass with >90% coverage

## Dependencies

- Logger configuration system
- Monitoring infrastructure
- Error categorization framework

## Estimated Effort

**2 days** (1 day implementation, 1 day testing and documentation)

## Priority

**High** - Essential for debugging current issues and preventing future problems
