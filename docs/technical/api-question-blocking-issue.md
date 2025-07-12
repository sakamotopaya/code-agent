# API Question Blocking Issue

## Problem Summary

The `ask_followup_question` tool does not properly block in API mode, causing the AI agent to continue processing without waiting for the user's response. This results in tasks completing prematurely without actual user interaction.

## Root Cause Analysis

### Current Architecture Issue

There are **two separate question handling systems** operating in parallel:

#### System 1: Task Internal Messaging (VSCode-oriented)

- **Location**: `src/core/task/TaskMessaging.ts`
- **Mechanism**: Uses polling with `pWaitFor()` to wait for `this.askResponse` to be set
- **Trigger**: Expects `handleWebviewAskResponse()` to be called to provide responses
- **Current Usage**: This is what the `ask_followup_question` tool uses via `cline.ask()`

#### System 2: SSEOutputAdapter Question System (API-oriented)

- **Location**: `src/api/streaming/SSEOutputAdapter.ts`
- **Mechanism**: Uses `ApiQuestionManager` with proper blocking promises
- **Features**: Correctly emits SSE events, waits for user responses via API endpoints
- **State Management**: Has proper timeout and state management

### The Disconnect

When the AI calls `ask_followup_question`, the flow is:

1. **`askFollowupQuestionTool.ts:59`** → `await cline.ask("followup", ...)`
2. **`Task.ts:801`** → `await this.messaging.ask(...)`
3. **`TaskMessaging.ts:266`** → `await pWaitFor(() => this.askResponse !== undefined ...)`

But there's **NO bridge** between:

- The Task's expectation of `this.askResponse` being set
- The SSEOutputAdapter's question management system
- The API endpoints that handle user responses

### Evidence from Log Analysis

From the API log (`docker/development/logs/api.log`), we can see:

1. **Line 4257-4285**: The AI agent calls `ask_followup_question`
2. **Line 18305-18307**: The AI agent immediately calls `attempt_completion` without waiting
3. **No blocking occurred**: The stream completes without ever pausing for user input

## Current Implementation Details

### Task Configuration (API Mode)

```typescript
// src/api/server/FastifyServer.ts:374
const taskOptions = {
	// ...
	userInterface: sseAdapter, // SSEOutputAdapter instance
	// ...
}
```

### SSEOutputAdapter Question Methods

```typescript
// src/api/streaming/SSEOutputAdapter.ts:94-134
async askQuestion(question: string, options: QuestionOptions): Promise<string | undefined> {
    // Creates blocking question using ApiQuestionManager
    const { questionId, promise } = await this.questionManager.createQuestion(this.jobId, question, suggestions)
    // Emits SSE event
    this.emitEvent(event)
    // Waits for user response (blocks properly)
    const answer = await promise
    return answer
}
```

### Task's Ask Method

```typescript
// src/core/task/TaskMessaging.ts:266
await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 })
```

## Impact Assessment

### Current Behavior

- ❌ Questions don't block execution
- ❌ AI continues processing without user input
- ❌ Tasks complete prematurely
- ❌ No actual user interaction occurs

### Expected Behavior

- ✅ Questions should block execution until answered
- ✅ AI should wait for user input before continuing
- ✅ Tasks should pause at question points
- ✅ User responses should be properly captured and processed

## Solution Architecture

### Option 1: Delegate Task.ask() to UserInterface (Recommended)

Modify the Task's `ask()` method to delegate to the userInterface when available:

```typescript
// In TaskMessaging.ts
async ask(type: ClineAsk, text?: string, partial?: boolean, ...): Promise<{...}> {
    // If userInterface supports blocking questions, use it
    if (this.userInterface && typeof this.userInterface.askQuestion === 'function') {
        // Delegate to userInterface (SSEOutputAdapter in API mode)
        return await this.delegateToUserInterface(type, text, partial, ...)
    }

    // Fall back to existing VSCode-style messaging
    // ... existing implementation
}
```

### Option 2: Bridge the Two Systems

Create a bridge that connects ApiQuestionManager responses back to TaskMessaging:

```typescript
// New ApiTaskQuestionBridge class
class ApiTaskQuestionBridge {
	constructor(
		private taskMessaging: TaskMessaging,
		private questionManager: ApiQuestionManager,
	) {
		this.questionManager.on("questionAnswered", this.handleQuestionAnswered.bind(this))
	}

	private handleQuestionAnswered(question: ApiQuestion) {
		// Bridge the response back to TaskMessaging
		this.taskMessaging.handleWebviewAskResponse("yesButtonTapped", question.answer)
	}
}
```

### Option 3: Modify ask_followup_question Tool

Directly modify the `ask_followup_question` tool to use the userInterface when available:

```typescript
// In askFollowupQuestionTool.ts
if (cline.userInterface && typeof cline.userInterface.askQuestion === "function") {
	// Use userInterface directly (API mode)
	const answer = await cline.userInterface.askQuestion(question, { choices: suggestions })
	// ... process answer
} else {
	// Fall back to existing Task.ask() (VSCode mode)
	const { text, images } = await cline.ask("followup", JSON.stringify(follow_up_json), false)
	// ... existing implementation
}
```

## Recommended Solution: Option 1

**Rationale**:

- Maintains existing API contracts
- Centralizes the logic in TaskMessaging
- Automatically works for all question types (askQuestion, askConfirmation, askInput)
- Minimal changes to existing code
- Preserves backward compatibility

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Modify TaskMessaging.ask()** to detect and delegate to userInterface
2. **Add userInterface parameter** to TaskMessaging constructor
3. **Update Task constructor** to pass userInterface to TaskMessaging

### Phase 2: Interface Standardization

1. **Define standard question interface** that both VSCode and API modes can use
2. **Ensure SSEOutputAdapter** implements the standard interface
3. **Add proper type mapping** between Task ask types and userInterface methods

### Phase 3: Testing & Validation

1. **Create comprehensive tests** for both VSCode and API question flows
2. **Add integration tests** for blocking behavior
3. **Validate timeout handling** in API mode
4. **Test question cancellation** scenarios

### Phase 4: Documentation & Cleanup

1. **Update technical documentation** for question handling
2. **Add API endpoint documentation** for question submission
3. **Create troubleshooting guide** for question-related issues

## Files to Modify

### Core Changes

- `src/core/task/TaskMessaging.ts` - Main ask() method delegation
- `src/core/task/Task.ts` - Pass userInterface to TaskMessaging
- `src/core/interfaces/IUserInterface.ts` - Standardize question interface

### API Integration

- `src/api/streaming/SSEOutputAdapter.ts` - Ensure interface compliance
- `src/api/server/FastifyServer.ts` - Verify userInterface injection
- `src/api/questions/ApiQuestionManager.ts` - Potential enhancements

### Testing

- `src/core/task/__tests__/TaskMessaging.test.ts` - New delegation tests
- `src/api/streaming/__tests__/SSEOutputAdapter.test.ts` - Question blocking tests
- `src/core/tools/__tests__/askFollowupQuestionTool.test.ts` - Integration tests

## Risk Assessment

### Low Risk

- Changes are backward compatible
- Existing VSCode functionality preserved
- Clear fallback mechanism

### Medium Risk

- Need to ensure proper error handling in delegation
- Timeout behavior consistency between modes
- Question cancellation edge cases

### Mitigation Strategies

- Comprehensive testing of both modes
- Feature flags for gradual rollout
- Monitoring and alerting for question timeouts
- Clear error messages for debugging

## Success Criteria

### Functional Requirements

- [ ] `ask_followup_question` blocks properly in API mode
- [ ] User responses are captured and processed correctly
- [ ] VSCode extension question flow remains unchanged
- [ ] All question types work consistently (askQuestion, askConfirmation, askInput)

### Non-Functional Requirements

- [ ] No performance degradation in question handling
- [ ] Proper timeout handling in API mode
- [ ] Clear error messages for debugging
- [ ] Comprehensive test coverage

### Integration Requirements

- [ ] API endpoints properly handle question submissions
- [ ] SSE events are emitted correctly
- [ ] Question state is persisted appropriately
- [ ] Concurrent question handling works as expected

## Timeline Estimate

- **Phase 1**: 2-3 days (Core infrastructure)
- **Phase 2**: 1-2 days (Interface standardization)
- **Phase 3**: 2-3 days (Testing & validation)
- **Phase 4**: 1 day (Documentation)

**Total**: 6-9 days for complete implementation and testing.
