# AC-001: SSE Question Event Detection

## Story

**As an** API client user  
**I want** the client to detect question events in the SSE stream  
**So that** interactive prompts can be processed instead of being ignored

## Background

Currently, the API client's SSE parser only handles standard SSE events like `start`, `progress`, `complete`, etc. However, when the server sends questions via `SSEPromptManager`, they are sent as log messages with the prefix "QUESTION_EVENT:" followed by JSON data.

**Current Behavior:**

```
Client receives: QUESTION_EVENT: {"type":"question","questionId":"q_job_md1s606p_543f603f_1752417562918_1","questionType":"select","question":"What color do you prefer?","choices":["Blue","Green","Red","Purple","(Custom answer)"],"timestamp":"2025-07-13T14:39:22.918Z"}

Client prints raw JSON and hangs ❌
```

## Acceptance Criteria

### AC-001.1: Detect QUESTION_EVENT Prefix

- [ ] SSE stream parser checks for "QUESTION_EVENT:" prefix in log messages
- [ ] When detected, extracts JSON payload after the prefix
- [ ] Validates JSON structure before processing

### AC-001.2: Question Event Routing

- [ ] Routes detected question events to QuestionEventHandler (to be implemented)
- [ ] Continues normal stream processing for non-question events
- [ ] Maintains backward compatibility with existing SSE events

### AC-001.3: Error Handling

- [ ] Gracefully handles malformed QUESTION_EVENT JSON
- [ ] Logs parsing errors in verbose mode
- [ ] Falls back to treating as regular log if parsing fails

## Technical Implementation

### Location

- File: `src/tools/api-client.ts`
- Function: `executeStreamingRequest()` > SSE data processing

### Changes Required

1. **Modify SSE Event Processing Logic**

```typescript
// In the data event handler around line 1040
for (const eventData of events) {
    if (!eventData.trim()) continue

    try {
        // Check for QUESTION_EVENT prefix
        if (eventData.includes('QUESTION_EVENT:')) {
            await this.handleQuestionEvent(eventData)
            continue
        }

        // Existing SSE event processing...
        const lines = eventData.split("\n")
        // ... rest of current logic
    }
}
```

2. **Add Question Event Detection Method**

```typescript
private async handleQuestionEvent(eventData: string): Promise<void> {
    const questionEventPrefix = 'QUESTION_EVENT: '
    const lines = eventData.split('\n')

    for (const line of lines) {
        if (line.includes(questionEventPrefix)) {
            try {
                const jsonStr = line.substring(line.indexOf(questionEventPrefix) + questionEventPrefix.length)
                const questionData = JSON.parse(jsonStr)

                // Route to question handler (AC-002)
                await this.streamProcessor.handleQuestionEvent(questionData)
            } catch (error) {
                if (this.options.verbose) {
                    console.error('Error parsing QUESTION_EVENT:', error)
                }
            }
            break
        }
    }
}
```

## Testing

### Unit Tests

- [ ] Test QUESTION_EVENT prefix detection
- [ ] Test JSON parsing with valid payloads
- [ ] Test error handling with malformed JSON
- [ ] Test that regular SSE events still work

### Integration Tests

- [ ] Test with real SSE stream containing question events
- [ ] Verify no regression in normal SSE processing

## Definition of Done

- [ ] QUESTION_EVENT detection is implemented and tested
- [ ] Regular SSE processing remains unaffected
- [ ] Error handling prevents client crashes
- [ ] Code is documented and follows existing patterns
- [ ] Unit tests pass
- [ ] Integration test demonstrates detection working

## Dependencies

- No external dependencies required
- Uses existing SSE parsing infrastructure

## Estimated Effort

**2 Story Points** - Small, focused change to existing SSE parser
