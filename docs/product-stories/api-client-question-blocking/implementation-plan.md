# API Question Blocking - Implementation Plan

## Overview

This document provides a detailed step-by-step implementation plan for fixing the API question blocking issue where `ask_followup_question` tool does not properly block execution.

## Implementation Strategy

We will implement **Option 1**: Delegate Task.ask() to UserInterface, which maintains backward compatibility while enabling proper API question blocking.

## Phase 1: Core Infrastructure (Days 1-3)

### Step 1.1: Modify TaskMessaging Constructor

**File**: `src/core/task/TaskMessaging.ts`

```typescript
// Add userInterface parameter to constructor
constructor(
    private taskId: string,
    private instanceId: string,
    private userInterface?: IUserInterface, // Add this parameter
    // ... existing parameters
) {
    // ... existing constructor code
}
```

### Step 1.2: Add Delegation Method to TaskMessaging

**File**: `src/core/task/TaskMessaging.ts`

```typescript
private async delegateToUserInterface(
    type: ClineAsk,
    text?: string,
    partial?: boolean,
    progressStatus?: ToolProgressStatus,
): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
    if (!this.userInterface) {
        throw new Error('UserInterface not available for delegation')
    }

    switch (type) {
        case 'followup':
            // Parse the question JSON format
            const followupData = JSON.parse(text || '{}')
            const question = followupData.question
            const suggestions = followupData.suggest || []

            // Convert to QuestionOptions format
            const options: QuestionOptions = {
                choices: suggestions.map((s: any) => s.answer),
                defaultChoice: suggestions[0]?.answer
            }

            const answer = await this.userInterface.askQuestion(question, options)
            return {
                response: 'yesButtonTapped',
                text: answer
            }

        case 'confirmation':
            const result = await this.userInterface.askConfirmation(text || '')
            return {
                response: result ? 'yesButtonTapped' : 'noButtonTapped',
                text: result ? 'Yes' : 'No'
            }

        case 'input':
            const input = await this.userInterface.askInput(text || '')
            return {
                response: 'yesButtonTapped',
                text: input
            }

        default:
            throw new Error(`Unsupported ask type for delegation: ${type}`)
    }
}
```

### Step 1.3: Modify TaskMessaging.ask() Method

**File**: `src/core/task/TaskMessaging.ts`

```typescript
async ask(
    type: ClineAsk,
    text?: string,
    partial?: boolean,
    progressStatus?: ToolProgressStatus,
    abort?: boolean,
    onMessage?: (action: "created" | "updated", message: ClineMessage) => void,
): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
    if (abort) {
        throw new Error(`[RooCode#ask] task ${this.taskId}.${this.instanceId} aborted`)
    }

    // NEW: Check if userInterface is available and supports the operation
    if (this.userInterface && this.supportsUserInterfaceDelegation(type)) {
        try {
            console.log(`[TaskMessaging] Delegating ${type} to userInterface`)
            return await this.delegateToUserInterface(type, text, partial, progressStatus)
        } catch (error) {
            console.error(`[TaskMessaging] UserInterface delegation failed, falling back to messaging:`, error)
            // Fall through to existing implementation
        }
    }

    // EXISTING: Original implementation for VSCode mode
    // ... rest of existing ask() method implementation
}

private supportsUserInterfaceDelegation(type: ClineAsk): boolean {
    // Only delegate question types that userInterface can handle
    return ['followup', 'confirmation', 'input'].includes(type)
}
```

### Step 1.4: Update Task Constructor

**File**: `src/core/task/Task.ts`

```typescript
// Find the constructor and TaskMessaging initialization
constructor(options: TaskOptions) {
    // ... existing constructor code

    // Update TaskMessaging initialization to pass userInterface
    this.messaging = new TaskMessaging(
        this.taskId,
        this.instanceId,
        options.userInterface, // Add this parameter
        // ... existing parameters
    )

    // ... rest of constructor
}
```

## Phase 2: Interface Standardization (Days 4-5)

### Step 2.1: Verify IUserInterface Contract

**File**: `src/core/interfaces/IUserInterface.ts`

Ensure the interface includes all necessary question methods:

```typescript
export interface IUserInterface {
	// ... existing methods

	askQuestion(question: string, options: QuestionOptions): Promise<string | undefined>
	askConfirmation(message: string, options?: ConfirmationOptions): Promise<boolean>
	askInput(prompt: string, options?: InputOptions): Promise<string | undefined>

	// ... other methods
}
```

### Step 2.2: Verify SSEOutputAdapter Compliance

**File**: `src/api/streaming/SSEOutputAdapter.ts`

Ensure SSEOutputAdapter properly implements the IUserInterface contract (it already does, but verify):

```typescript
export class SSEOutputAdapter implements IUserInterface {
	// Verify these methods exist and work correctly:
	// - askQuestion()
	// - askConfirmation()
	// - askInput()
}
```

## Phase 3: Testing & Validation (Days 6-8)

### Step 3.1: Unit Tests for TaskMessaging

**File**: `src/core/task/__tests__/TaskMessaging.test.ts`

```typescript
describe("TaskMessaging Delegation", () => {
	it("should delegate followup questions to userInterface when available", async () => {
		const mockUserInterface = {
			askQuestion: jest.fn().mockResolvedValue("Test Answer"),
		}

		const messaging = new TaskMessaging("test-task", "test-instance", mockUserInterface)

		const result = await messaging.ask(
			"followup",
			JSON.stringify({
				question: "Test question?",
				suggest: [{ answer: "Option 1" }, { answer: "Option 2" }],
			}),
		)

		expect(mockUserInterface.askQuestion).toHaveBeenCalledWith("Test question?", {
			choices: ["Option 1", "Option 2"],
			defaultChoice: "Option 1",
		})
		expect(result.text).toBe("Test Answer")
	})

	it("should fall back to messaging when userInterface delegation fails", async () => {
		// Test fallback behavior
	})

	it("should not delegate when userInterface is not available", async () => {
		// Test VSCode mode behavior
	})
})
```

### Step 3.2: Integration Tests for API Question Flow

**File**: `src/api/streaming/__tests__/SSEOutputAdapter.test.ts`

```typescript
describe("SSEOutputAdapter Question Blocking", () => {
	it("should block execution until question is answered", async () => {
		const questionManager = new ApiQuestionManager()
		const adapter = new SSEOutputAdapter(streamManager, "test-job", false, questionManager)

		// Start question (should block)
		const questionPromise = adapter.askQuestion("Test question?", {
			choices: ["A", "B", "C"],
		})

		// Verify question is pending
		expect(questionManager.getPendingQuestions("test-job")).toHaveLength(1)

		// Submit answer
		const questions = questionManager.getPendingQuestions("test-job")
		await questionManager.submitAnswer(questions[0].id, "A")

		// Verify promise resolves
		const answer = await questionPromise
		expect(answer).toBe("A")
	})
})
```

### Step 3.3: End-to-End Tests

**File**: `src/api/__tests__/e2e/question-blocking.test.ts`

```typescript
describe("Question Blocking E2E", () => {
	it("should block API task execution for ask_followup_question", async () => {
		// Create API task with ask_followup_question
		// Verify execution pauses
		// Submit answer via API
		// Verify execution continues
	})
})
```

## Phase 4: Documentation & Cleanup (Day 9)

### Step 4.1: Update API Documentation

**File**: `docs/api/question-handling.md`

Document the question submission API endpoints and SSE event formats.

### Step 4.2: Update Troubleshooting Guide

**File**: `docs/troubleshooting/questions.md`

Add troubleshooting information for question blocking issues.

## Testing Checklist

### Functional Testing

- [ ] `ask_followup_question` blocks properly in API mode
- [ ] Questions are presented via SSE events
- [ ] User responses are captured correctly
- [ ] VSCode extension questions still work
- [ ] All question types work (askQuestion, askConfirmation, askInput)

### Error Handling Testing

- [ ] Timeout handling works correctly
- [ ] Question cancellation works
- [ ] Fallback to messaging works when delegation fails
- [ ] Proper error messages are shown

### Performance Testing

- [ ] No performance degradation in question handling
- [ ] Concurrent questions handled correctly
- [ ] Memory usage is acceptable

## Deployment Plan

### Stage 1: Feature Flag

- Deploy with feature flag disabled
- Enable for testing environments
- Monitor for issues

### Stage 2: Gradual Rollout

- Enable for 10% of API requests
- Monitor metrics and error rates
- Increase percentage if stable

### Stage 3: Full Rollout

- Enable for all API requests
- Monitor for regressions
- Keep fallback mechanism active

## Rollback Plan

If issues arise:

1. Disable feature flag to revert to old behavior
2. Analyze logs and error reports
3. Fix issues and redeploy
4. Re-enable feature flag

## Success Metrics

### Pre-Fix Metrics (Current State)

- 0% of questions block properly in API mode
- Users report tasks complete without interaction
- API client adoption limited due to non-interactive nature

### Post-Fix Target Metrics

- 100% of questions block properly in API mode
- <2 second response time for question presentation
- 0% regression in VSCode extension functionality
- Increased API client usage

## Risk Mitigation

### Technical Risks

- **Integration complexity**: Mitigated by comprehensive testing
- **Performance impact**: Mitigated by performance testing
- **Backward compatibility**: Mitigated by fallback mechanism

### Business Risks

- **User disruption**: Mitigated by gradual rollout
- **Production issues**: Mitigated by feature flags and monitoring

## Communication Plan

### Development Team

- Daily standups during implementation
- Code reviews for all changes
- Testing results shared in team channel

### Stakeholders

- Weekly progress updates
- Demo of working functionality
- Go/no-go decision before deployment

## Completion Criteria

- [ ] All code implemented and tested
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] Deployed to staging
- [ ] Manual testing completed
- [ ] Stakeholder approval received
- [ ] Deployed to production
- [ ] Metrics confirm success
