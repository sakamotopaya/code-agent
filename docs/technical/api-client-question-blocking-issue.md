# API Client Question Blocking Issue Analysis

## Problem Statement

When the LLM asks questions or provides choices in the API client, the questions appear in the output but the LLM appears to continue without waiting for user responses.

## Root Cause Analysis

### Server-Side Behavior (Correct)

1. **LLM calls `askQuestion()`** → Server execution blocks
2. **Question Manager creates question** with Promise that resolves when answered
3. **SSE event emitted** to client with `question_ask` type
4. **Server waits** for answer via `/api/questions/:questionId/answer` endpoint
5. **When answer submitted**, Promise resolves and server resumes

### Client-Side Behavior (Issues Identified)

1. **Receives `question_ask` event**
2. **Handles asynchronously** with IIFE `(async () => { ... })()`
3. **Continues processing SSE events** while user is prompted
4. **May fail to submit answer properly** due to various issues

### Fallback Mechanism (The Real Culprit)

In `SSEOutputAdapter.askQuestion()`, there's a catch block:

```typescript
} catch (error) {
    // If question fails (timeout, cancellation, etc.), fall back to default
    this.logger.warn(`Question failed for job ${this.jobId}: ${error}`)

    return options.defaultChoice || options.choices[0]  // ← AUTOMATIC FALLBACK!
}
```

**This means if ANY issue occurs with the question system, the server automatically returns a default answer and continues execution.**

## Potential Failure Points

### 1. Question Manager Configuration

- Default timeout: `0` (disabled)
- Enable timeout: `false`
- **Questions should not timeout by default**

### 2. Client Answer Submission Issues

- Network connectivity problems
- API endpoint errors
- Race conditions in async handling
- Client not properly waiting for user input

### 3. Question Manager State Issues

- Question not found when answer submitted
- Question already answered/expired
- Concurrent question limits exceeded

## Investigation Steps

1. **Add detailed logging** to identify where questions are failing
2. **Check client answer submission** success/failure rates
3. **Monitor question manager state** during question lifecycle
4. **Verify client-server communication** during question flow

## Proposed Solutions

### Phase 1: Diagnostic Enhancement

1. Add comprehensive logging to question lifecycle
2. Add client-side success/failure tracking for answer submission
3. Add server-side question failure reason tracking

### Phase 2: Client Behavior Fix

1. **Pause SSE stream processing** during questions
2. **Ensure proper error handling** in client answer submission
3. **Add retry logic** for failed answer submissions

### Phase 3: Robustness Improvements

1. **Remove automatic fallback** or make it configurable
2. **Add question timeout warnings** before fallback
3. **Implement question retry mechanism**

## Technical Implementation Plan

### 1. Enhanced Logging

- Add question lifecycle events to server logs
- Add client answer submission tracking
- Add failure reason categorization

### 2. Client Stream Pausing

```javascript
case "question_ask":
    // PAUSE stream processing
    pauseStreamProcessing()
    try {
        const answer = await promptUser(filteredData.message, filteredData.choices)
        const success = await submitAnswer(filteredData.questionId, answer)
        if (!success) {
            console.error("Failed to submit answer")
        }
    } finally {
        // RESUME stream processing
        resumeStreamProcessing()
    }
    break
```

### 3. Fallback Configuration

```typescript
interface QuestionOptions {
	choices: string[]
	defaultChoice?: string
	enableFallback?: boolean // New option
	fallbackTimeout?: number // New option
}
```

## Success Criteria

1. **Questions properly block** both server and client execution
2. **User sees only the question** until they respond
3. **Failed questions are logged** with clear failure reasons
4. **Fallback behavior is configurable** and well-documented
5. **Client handles network issues gracefully** with retries

## Testing Strategy

1. **Unit tests** for question manager edge cases
2. **Integration tests** for client-server question flow
3. **Network failure simulation** tests
4. **Concurrent question handling** tests
5. **Manual testing** with various question types and failure scenarios
