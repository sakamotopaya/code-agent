# API Question Flow: Complete Solution Architecture

## Current API Question Flow (Working)

### 1. Question Presentation (SSE to Client)

```
SSEQuestionPresenter → sseAdapter.log() → Client receives QUESTION_EVENT
```

- **SSEQuestionPresenter** sends questions via SSE streams
- Questions formatted as: `QUESTION_EVENT: {"type":"question","questionId":"q_123","question":"text","choices":["A","B"]}`
- Client receives structured question data in real-time

### 2. Answer Collection (Client to API)

```
Client HTTP POST → ApiQuestionManager → ApiAnswerCollector → UnifiedQuestionManager
```

- **ApiQuestionManager** manages persistent question state with promises
- **ApiAnswerCollector** integrates with ApiQuestionManager event system
- Questions block via `resolvePromise`/`rejectPromise` until client responds

### 3. The Problem: Task Class CLI Fallback

**Current Failing Code (Task.ts lines 1170-1190)**:

```typescript
// This tries to get CLI PromptManager in API mode
if (this.cliUIService) {
	promptManager = this.cliUIService.getPromptManager() // ← FAILS!
} else {
	// Fallback never executes because cliUIService is truthy (SSEOutputAdapter)
}
```

**Root Cause**:

- `FastifyServer.ts` sets: `cliUIService: sseAdapter`
- `SSEOutputAdapter` doesn't have `getPromptManager()` method
- Task tries CLI patterns instead of using unified question system

## The Complete Solution

### Option A: Implement SSEPromptManager (Recommended)

Create an API-specific prompt manager that implements the CLI interface but uses SSE/API patterns:

```typescript
// New: SSEPromptManager.ts
export class SSEPromptManager {
	constructor(
		private sseAdapter: SSEOutputAdapter,
		private questionManager: ApiQuestionManager,
	) {}

	async promptText(options: TextPromptOptions): Promise<string> {
		// Send question via SSE, block until API client responds
		const questionId = this.generateQuestionId()

		// Send via SSE
		await this.sseAdapter.log(
			`QUESTION_EVENT: ${JSON.stringify({
				type: "question",
				questionId,
				questionType: "input",
				question: options.message,
				placeholder: options.placeholder,
			})}`,
		)

		// Block until client responds via API
		return this.questionManager.waitForAnswer(questionId)
	}

	// Implement all PromptManager methods (promptConfirm, promptSelect, etc.)
}
```

### Option B: Fix Task Class to Use Unified System

Modify Task class to detect API mode and use unified question manager instead of CLI fallback:

```typescript
// In Task.ts - instead of trying to get PromptManager
if (this.isApiMode()) {
	// Use unified question manager that's already initialized
	const questionService = this.getUnifiedQuestionService()
} else {
	// Use CLI PromptManager for CLI mode only
}
```

### Option C: Remove Incorrect cliUIService Assignment

Remove `cliUIService: sseAdapter` assignment in FastifyServer.ts and let CLI fallback handle it.

## Recommended Implementation: Option A

**Why Option A is best**:

1. **Maintains Compatibility**: Existing CLI code continues to work unchanged
2. **Leverages Existing API Infrastructure**: Uses proven SSE presentation + API collection
3. **Implements Blocking Pattern**: Client must respond before server continues
4. **Follows Interface Pattern**: SSEPromptManager implements same interface as CLI PromptManager

### Implementation Steps:

1. **Create SSEPromptManager** that implements CLI PromptManager interface
2. **Add getPromptManager() to SSEOutputAdapter** that returns SSEPromptManager
3. **Integrate with existing ApiQuestionManager** for blocking/answer collection
4. **Test the complete flow**: SSE question → Client response → Server continues

### Question Flow with SSEPromptManager:

```
Task.askFollowupQuestion()
  → this.cliUIService.getPromptManager()
  → SSEPromptManager.promptText()
  → SSEOutputAdapter.log(QUESTION_EVENT)
  → [SSE stream to client]
  → [Client sends HTTP POST with answer]
  → ApiQuestionManager.resolveQuestion()
  → SSEPromptManager.promptText() returns answer
  → Task continues with answer
```

This creates a seamless bridge between CLI prompt patterns and API question architecture.
