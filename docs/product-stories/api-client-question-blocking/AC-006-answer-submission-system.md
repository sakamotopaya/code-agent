# AC-006: Answer Submission System

## Story

**As an** API client user  
**I want** my answers to be submitted to the server automatically  
**So that** task execution can continue after I respond to questions

## Background

After the user provides an answer to any question type (select, input, confirmation), the client must submit the answer to the server via HTTP POST to `/api/questions/:questionId/answer`. The server's ApiQuestionManager is waiting for this response to continue task execution.

**Expected Flow:**

1. User selects/types answer in interactive prompt
2. Client sends POST request with answer
3. Server receives answer and continues task
4. SSE stream resumes with task progress

## Acceptance Criteria

### AC-006.1: HTTP Answer Submission

- [ ] Implement POST request to `/api/questions/:questionId/answer` endpoint
- [ ] Send answer in correct JSON format: `{"answer": "user_response"}`
- [ ] Use proper HTTP headers (Content-Type: application/json)
- [ ] Handle HTTP response status codes appropriately
- [ ] Support retry logic for network failures

### AC-006.2: Answer Format Handling

- [ ] Submit string answers for select and input questions
- [ ] Submit text answers for confirmation questions ("Yes"/"No")
- [ ] Ensure answer format matches server expectations
- [ ] Handle special characters and encoding properly
- [ ] Validate answer before submission

### AC-006.3: Error Handling & Retry

- [ ] Handle network timeouts gracefully
- [ ] Retry failed submissions with exponential backoff
- [ ] Provide clear error messages for submission failures
- [ ] Fall back gracefully when server is unreachable
- [ ] Log submission attempts in verbose mode

### AC-006.4: Response Validation

- [ ] Verify successful submission (HTTP 200/201)
- [ ] Handle server error responses (4xx, 5xx)
- [ ] Parse and display server error messages when available
- [ ] Ensure question is marked as completed on successful submission
- [ ] Resume stream processing after successful submission

## Technical Implementation

### Core Answer Submission Method

```typescript
// Add to src/tools/QuestionEventHandler.ts

private async submitAnswer(questionId: string, answer: string): Promise<void> {
    const maxRetries = 3
    const baseDelay = 1000 // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await this.attemptSubmission(questionId, answer)

            if (this.options.verbose) {
                console.log(`✅ Answer submitted successfully on attempt ${attempt}`)
            }

            return // Success, exit retry loop

        } catch (error) {
            const isLastAttempt = attempt === maxRetries

            if (isLastAttempt) {
                console.error(`❌ Failed to submit answer after ${maxRetries} attempts`)
                throw error
            }

            // Calculate delay with exponential backoff
            const delay = baseDelay * Math.pow(2, attempt - 1)

            if (this.options.verbose) {
                console.log(`⚠️  Submission attempt ${attempt} failed, retrying in ${delay}ms...`)
                console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`)
            }

            await this.sleep(delay)
        }
    }
}

private async attemptSubmission(questionId: string, answer: string): Promise<void> {
    const url = `${this.baseUrl}/api/questions/${questionId}/answer`
    const payload = JSON.stringify({ answer })

    if (this.options.verbose) {
        console.log(`📤 Submitting answer to ${url}`)
        console.log(`   Payload: ${payload}`)
    }

    return new Promise((resolve, reject) => {
        const { request: httpRequest } = this.baseUrl.startsWith('https')
            ? { request: require('https').request }
            : { request: require('http').request }

        const req = httpRequest(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Accept': 'application/json',
            },
            timeout: 10000, // 10 second timeout
        }, (res) => {
            this.handleSubmissionResponse(res, resolve, reject)
        })

        req.on('error', (error) => {
            reject(new Error(`Network error: ${error.message}`))
        })

        req.on('timeout', () => {
            req.destroy()
            reject(new Error('Request timeout'))
        })

        req.write(payload)
        req.end()
    })
}

private handleSubmissionResponse(
    res: any,
    resolve: () => void,
    reject: (error: Error) => void
): void {
    let responseBody = ''

    res.on('data', (chunk: any) => {
        responseBody += chunk.toString()
    })

    res.on('end', () => {
        if (this.options.verbose) {
            console.log(`   Response status: ${res.statusCode}`)
            console.log(`   Response body: ${responseBody}`)
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve()
        } else {
            const errorMessage = this.parseErrorMessage(responseBody, res.statusCode)
            reject(new Error(errorMessage))
        }
    })

    res.on('error', (error: any) => {
        reject(new Error(`Response error: ${error.message}`))
    })
}

private parseErrorMessage(responseBody: string, statusCode: number): string {
    try {
        const errorData = JSON.parse(responseBody)
        return errorData.error || errorData.message || `HTTP ${statusCode}`
    } catch {
        return `HTTP ${statusCode}: ${responseBody || 'Unknown error'}`
    }
}

private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}
```

### Enhanced Error Handling

```typescript
private async submitAnswer(questionId: string, answer: string): Promise<void> {
    try {
        await this.validateAnswerBeforeSubmission(answer)
        await this.attemptSubmissionWithRetry(questionId, answer)

    } catch (error) {
        // Enhanced error reporting
        if (error instanceof ValidationError) {
            console.error(`❌ Answer validation failed: ${error.message}`)
            throw error
        }

        if (error instanceof NetworkError) {
            console.error(`❌ Network error during submission: ${error.message}`)
            console.error(`   Please check your connection and try again`)
            throw error
        }

        if (error instanceof ServerError) {
            console.error(`❌ Server rejected the answer: ${error.message}`)
            throw error
        }

        // Unknown error
        console.error(`❌ Unexpected error during answer submission: ${error}`)
        throw error
    }
}

private async validateAnswerBeforeSubmission(answer: string): Promise<void> {
    if (typeof answer !== 'string') {
        throw new ValidationError('Answer must be a string')
    }

    if (answer.length === 0) {
        throw new ValidationError('Answer cannot be empty')
    }

    if (answer.length > 10000) {
        throw new ValidationError('Answer is too long (max 10,000 characters)')
    }

    // Check for potentially problematic content
    if (this.containsSuspiciousContent(answer)) {
        console.warn('⚠️  Answer contains unusual content, submitting anyway...')
    }
}

private containsSuspiciousContent(answer: string): boolean {
    // Basic check for very long lines or unusual characters
    const lines = answer.split('\n')
    return lines.some(line => line.length > 1000) ||
           /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(answer)
}

// Custom error classes
class ValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ValidationError'
    }
}

class NetworkError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'NetworkError'
    }
}

class ServerError extends Error {
    constructor(message: string, public statusCode: number) {
        super(message)
        this.name = 'ServerError'
    }
}
```

### Integration with Question Processing

```typescript
// Update the main processQuestion method to handle submission errors

private async processQuestion(questionData: QuestionEventData): Promise<void> {
    this.state.isProcessing = true
    this.state.currentQuestion = questionData

    try {
        console.log(`🤔 Processing ${questionData.questionType} question: ${questionData.questionId}`)

        // Present question to user
        const answer = await this.presentQuestion(questionData)

        // Submit answer to server
        console.log('📤 Submitting answer...')
        await this.submitAnswer(questionData.questionId, answer)

        console.log('✅ Question completed successfully')

    } catch (error) {
        console.error(`❌ Question processing failed: ${error}`)

        // For certain errors, we might want to retry the question
        if (this.shouldRetryQuestion(error)) {
            console.log('🔄 Retrying question...')
            throw error // Let retry logic handle it
        }

        // For other errors, fail gracefully
        console.error('💥 Question failed permanently')
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

private shouldRetryQuestion(error: any): boolean {
    // Retry for network errors, but not for validation or server errors
    return error instanceof NetworkError
}
```

## Testing

### Unit Tests

- [ ] Test successful answer submission
- [ ] Test network error handling and retries
- [ ] Test server error response handling (4xx, 5xx)
- [ ] Test answer validation before submission
- [ ] Test timeout handling
- [ ] Test retry logic with exponential backoff
- [ ] Test response parsing and error extraction

### Integration Tests

- [ ] Test full flow: question → answer → submission → server response
- [ ] Test with real API server endpoints
- [ ] Test submission during network interruptions
- [ ] Test concurrent question submissions

### Manual Testing Scenarios

```bash
# Test successful submission
curl -X POST http://localhost:3000/api/questions/test123/answer \
  -H "Content-Type: application/json" \
  -d '{"answer": "Blue"}'

# Test server error response
curl -X POST http://localhost:3000/api/questions/invalid/answer \
  -H "Content-Type: application/json" \
  -d '{"answer": "test"}'

# Test network timeout (simulate with long delay)
```

## Definition of Done

- [ ] Answer submission via HTTP POST working reliably
- [ ] Retry logic handles network failures gracefully
- [ ] Error messages are clear and actionable
- [ ] Server responses processed correctly
- [ ] Answer validation prevents invalid submissions
- [ ] Timeout handling prevents hanging requests
- [ ] Verbose logging shows submission details
- [ ] Unit tests covering all error scenarios
- [ ] Integration tests with real server endpoints
- [ ] Manual testing scenarios verified

## Dependencies

- **Depends on:** AC-002 (Question Event Handler Infrastructure)
- **Depends on:** AC-003, AC-004, AC-005 (Question Types - to get answers to submit)
- **Required by:** AC-008 (End-to-End Testing)

## Estimated Effort

**3 Story Points** - Medium complexity due to network handling, error cases, and retry logic
