# AC-008: End-to-End Testing

## Story

**As a** development team  
**I want** comprehensive end-to-end testing for the question handling system  
**So that** we can verify the complete flow works correctly and catch regressions

## Background

This story validates that the entire question handling system works correctly from server question initiation through client interaction to server response processing. It requires all previous stories to be complete and tests the full integration.

**Complete Flow to Test:**

1. Server task execution asks a question via SSEPromptManager
2. SSEPromptManager sends "QUESTION_EVENT:" via SSE log
3. API client detects and parses the question event
4. QuestionEventHandler presents interactive prompt to user
5. User provides answer via inquirer.js interface
6. Client submits answer via POST /api/questions/:questionId/answer
7. Server receives answer and continues task execution
8. Client resumes processing SSE stream

## Acceptance Criteria

### AC-008.1: Full Question Flow Testing

- [ ] Test complete select question flow (server → client → server)
- [ ] Test complete input question flow (server → client → server)
- [ ] Test complete confirmation question flow (server → client → server)
- [ ] Test password question flow if implemented
- [ ] Verify task execution continues after each question type

### AC-008.2: Multiple Question Scenarios

- [ ] Test multiple questions in sequence within one task
- [ ] Test questions from different task executions
- [ ] Test rapid fire questions (stress test)
- [ ] Test mixed question types in one session
- [ ] Test question queue handling with concurrent questions

### AC-008.3: Error Recovery Testing

- [ ] Test network interruption during question processing
- [ ] Test server restart during question handling
- [ ] Test client cancellation and recovery
- [ ] Test malformed question handling in real flow
- [ ] Test timeout scenarios with real server delays

### AC-008.4: User Experience Validation

- [ ] Test actual user interaction experience
- [ ] Verify question formatting and readability
- [ ] Test arrow key navigation in select questions
- [ ] Test input validation feedback in real scenarios
- [ ] Verify stream processing continues smoothly after questions

## Technical Implementation

### Test Infrastructure Setup

```typescript
// New file: src/tools/__tests__/question-flow-e2e.test.ts

import { spawn, ChildProcess } from "child_process"
import { EventEmitter } from "events"
import fetch from "node-fetch"

describe("Question Flow End-to-End Tests", () => {
	let apiServer: ChildProcess
	let apiClient: ChildProcess
	const TEST_PORT = 3001
	const TEST_HOST = "localhost"

	beforeAll(async () => {
		// Start test API server
		apiServer = await startTestApiServer(TEST_PORT)
		await waitForServerReady(`http://${TEST_HOST}:${TEST_PORT}`)
	})

	afterAll(async () => {
		if (apiServer) {
			apiServer.kill()
		}
	})

	describe("Select Questions", () => {
		it("should handle select question with multiple choices", async () => {
			const questionPromise = triggerSelectQuestion()
			const clientPromise = runApiClient(
				'--stream --mode architect "Use ask_followup_question to ask me what color I prefer"',
			)

			// Wait for question to be sent
			const questionData = await questionPromise
			expect(questionData.questionType).toBe("select")
			expect(questionData.choices).toContain("Blue")

			// Simulate user selection (automated for testing)
			await simulateUserSelection(questionData.questionId, "Blue")

			// Verify task completion
			const result = await clientPromise
			expect(result.success).toBe(true)
			expect(result.output).toContain("You selected Blue")
		})

		it("should handle custom answer selection", async () => {
			const questionPromise = triggerSelectQuestionWithCustom()
			const clientPromise = runApiClient('--stream "Ask me to pick a custom option"')

			const questionData = await questionPromise
			await simulateCustomAnswer(questionData.questionId, "My Custom Color")

			const result = await clientPromise
			expect(result.output).toContain("My Custom Color")
		})
	})

	describe("Input Questions", () => {
		it("should handle text input questions", async () => {
			const questionPromise = triggerInputQuestion()
			const clientPromise = runApiClient('--stream "Ask me for my name"')

			const questionData = await questionPromise
			expect(questionData.questionType).toBe("input")

			await simulateTextInput(questionData.questionId, "John Smith")

			const result = await clientPromise
			expect(result.output).toContain("John Smith")
		})

		it("should handle file path input with validation", async () => {
			const questionPromise = triggerFilePathQuestion()
			const clientPromise = runApiClient('--stream "Ask me for a file path"')

			const questionData = await questionPromise
			await simulateTextInput(questionData.questionId, "/path/to/file.txt")

			const result = await clientPromise
			expect(result.success).toBe(true)
		})
	})

	describe("Confirmation Questions", () => {
		it("should handle yes/no confirmations", async () => {
			const questionPromise = triggerConfirmationQuestion()
			const clientPromise = runApiClient('--stream "Ask me to confirm something"')

			const questionData = await questionPromise
			expect(questionData.questionType).toBe("confirmation")

			await simulateConfirmation(questionData.questionId, true)

			const result = await clientPromise
			expect(result.output).toContain("confirmed")
		})

		it("should handle destructive action confirmations", async () => {
			const questionPromise = triggerDestructiveConfirmation()
			const clientPromise = runApiClient('--stream "Ask me to delete something"')

			const questionData = await questionPromise
			await simulateConfirmation(questionData.questionId, false)

			const result = await clientPromise
			expect(result.output).toContain("cancelled")
		})
	})

	describe("Multiple Questions", () => {
		it("should handle multiple questions in sequence", async () => {
			const clientPromise = runApiClient('--stream "Ask me three different questions"')

			// Handle first question (select)
			const q1 = await waitForQuestion()
			await simulateUserSelection(q1.questionId, "Option 1")

			// Handle second question (input)
			const q2 = await waitForQuestion()
			await simulateTextInput(q2.questionId, "Test input")

			// Handle third question (confirmation)
			const q3 = await waitForQuestion()
			await simulateConfirmation(q3.questionId, true)

			const result = await clientPromise
			expect(result.success).toBe(true)
		})

		it("should handle rapid fire questions", async () => {
			const clientPromise = runApiClient('--stream "Ask me 5 questions rapidly"')

			const questions = []
			for (let i = 0; i < 5; i++) {
				const question = await waitForQuestion()
				questions.push(question)
				await simulateQuickAnswer(question)
			}

			const result = await clientPromise
			expect(result.success).toBe(true)
			expect(questions).toHaveLength(5)
		})
	})

	describe("Error Scenarios", () => {
		it("should recover from network interruption", async () => {
			const clientPromise = runApiClient('--stream "Ask me something during network issues"')

			// Wait for question
			const question = await waitForQuestion()

			// Simulate network interruption
			await simulateNetworkInterruption(1000)

			// Answer should still work with retry
			await simulateUserSelection(question.questionId, "Answer")

			const result = await clientPromise
			expect(result.success).toBe(true)
		})

		it("should handle server timeout gracefully", async () => {
			const clientPromise = runApiClient('--stream --timeout 5000 "Ask me something with server delay"')

			const question = await waitForQuestion()

			// Simulate slow server response
			await sleep(6000)
			await simulateUserSelection(question.questionId, "Answer")

			const result = await clientPromise
			// Should handle timeout gracefully
			expect(result.stderr).not.toContain("crash")
		})
	})
})

// Helper functions for test infrastructure

async function startTestApiServer(port: number): Promise<ChildProcess> {
	return new Promise((resolve, reject) => {
		const server = spawn("node", ["dist/api/api-entry.js"], {
			env: { ...process.env, PORT: port.toString() },
			stdio: "pipe",
		})

		server.stdout?.on("data", (data) => {
			if (data.toString().includes("Server running")) {
				resolve(server)
			}
		})

		server.on("error", reject)

		setTimeout(() => reject(new Error("Server start timeout")), 10000)
	})
}

async function runApiClient(args: string): Promise<{ success: boolean; output: string; stderr: string }> {
	return new Promise((resolve) => {
		const client = spawn("node", [`dist/tools/api-client.js`, ...args.split(" ")], {
			stdio: "pipe",
		})

		let output = ""
		let stderr = ""

		client.stdout?.on("data", (data) => {
			output += data.toString()
		})

		client.stderr?.on("data", (data) => {
			stderr += data.toString()
		})

		client.on("close", (code) => {
			resolve({
				success: code === 0,
				output,
				stderr,
			})
		})
	})
}

async function simulateUserSelection(questionId: string, answer: string): Promise<void> {
	const response = await fetch(`http://${TEST_HOST}:${TEST_PORT}/api/questions/${questionId}/answer`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ answer }),
	})

	if (!response.ok) {
		throw new Error(`Failed to submit answer: ${response.statusText}`)
	}
}

async function waitForQuestion(): Promise<any> {
	// Implementation would monitor SSE stream for QUESTION_EVENT
	// This is a simplified version for the test framework
	return new Promise((resolve) => {
		// Mock implementation - in real tests this would listen to SSE
		setTimeout(() => {
			resolve({
				questionId: `test_q_${Date.now()}`,
				questionType: "select",
				question: "Test question?",
				choices: ["Option 1", "Option 2"],
			})
		}, 100)
	})
}
```

### Manual Testing Scenarios

```bash
# Test Script: manual-test-scenarios.sh

#!/bin/bash

echo "🧪 API Client Question Handling - Manual Test Scenarios"
echo "======================================================"

# Test 1: Basic Select Question
echo "Test 1: Basic Select Question"
echo "Run: api-client --stream --mode architect 'Use ask_followup_question to ask me what color I prefer'"
echo "Expected: Interactive selection with Blue, Green, Red, Purple, Custom"
echo "Action: Select Blue"
echo "Expected: Task continues with 'You selected Blue'"
echo ""

# Test 2: Text Input Question
echo "Test 2: Text Input Question"
echo "Run: api-client --stream --mode architect 'Ask me for my name using ask_followup_question'"
echo "Expected: Text input prompt"
echo "Action: Enter 'John Smith'"
echo "Expected: Task continues with name"
echo ""

# Test 3: Confirmation Question
echo "Test 3: Confirmation Question"
echo "Run: api-client --stream --mode architect 'Ask me to confirm something'"
echo "Expected: Yes/No confirmation"
echo "Action: Select Yes"
echo "Expected: Task continues with confirmation"
echo ""

# Test 4: Multiple Questions
echo "Test 4: Multiple Questions in Sequence"
echo "Run: api-client --stream --mode architect 'Ask me 3 different questions in sequence'"
echo "Expected: Three questions presented one after another"
echo "Action: Answer each question"
echo "Expected: All answers processed, task completes"
echo ""

# Test 5: Error Recovery
echo "Test 5: Network Error Recovery"
echo "Run: api-client --stream 'Ask me a question'"
echo "Action: Disconnect network during question, then reconnect"
echo "Expected: Client retries and continues"
echo ""

# Test 6: User Cancellation
echo "Test 6: User Cancellation"
echo "Run: api-client --stream 'Ask me a question'"
echo "Action: Press Ctrl+C during question"
echo "Expected: Graceful exit with proper cleanup"
echo ""
```

### Performance Testing

```typescript
// Performance test for question handling
describe("Question Performance Tests", () => {
	it("should handle 100 questions in reasonable time", async () => {
		const startTime = Date.now()

		for (let i = 0; i < 100; i++) {
			const question = await createTestQuestion()
			await simulateQuickAnswer(question)
		}

		const duration = Date.now() - startTime
		expect(duration).toBeLessThan(30000) // 30 seconds for 100 questions
	})

	it("should not leak memory with many questions", async () => {
		const initialMemory = process.memoryUsage()

		for (let i = 0; i < 1000; i++) {
			const question = await createTestQuestion()
			await simulateQuickAnswer(question)
		}

		global.gc?.() // Force garbage collection if available

		const finalMemory = process.memoryUsage()
		const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

		// Memory increase should be reasonable (less than 100MB)
		expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)
	})
})
```

## Testing

### Automated E2E Tests

- [ ] Select question flow with real server
- [ ] Input question flow with validation
- [ ] Confirmation question flow with defaults
- [ ] Multiple questions in sequence
- [ ] Error recovery scenarios
- [ ] Performance tests with many questions
- [ ] Memory leak detection tests

### Manual Testing Checklist

- [ ] Visual formatting of questions looks correct
- [ ] Arrow key navigation works smoothly
- [ ] Input validation provides helpful feedback
- [ ] Error messages are clear and actionable
- [ ] Stream processing resumes correctly after questions
- [ ] User cancellation works as expected
- [ ] Network interruption recovery works

### Integration Testing

- [ ] Test with real SSEPromptManager implementation
- [ ] Test with real ApiQuestionManager
- [ ] Test with actual task execution scenarios
- [ ] Test with different modes (architect, code, etc.)

## Definition of Done

- [ ] All question types work end-to-end with real server
- [ ] Multiple questions in sequence work correctly
- [ ] Error scenarios are handled gracefully
- [ ] Performance is acceptable for normal usage
- [ ] Memory usage is stable over extended use
- [ ] User experience meets design expectations
- [ ] Manual testing scenarios all pass
- [ ] Automated E2E tests all pass
- [ ] Integration tests with real server components pass
- [ ] Documentation updated with testing results

## Dependencies

- **Depends on:** All previous stories (AC-001 through AC-007)
- **Validates:** Complete question handling system

## Estimated Effort

**5 Story Points** - High effort due to comprehensive testing setup and validation of entire system

## Success Criteria

When this story is complete, the following should work perfectly:

```bash
# User runs this command:
api-client --stream --mode architect "Use ask_followup_question to ask me what color I prefer"

# Expected output:
🌊 Testing POST /execute/stream (SSE)...
🚀 Task started: abc123-def456...

? What color do you prefer? (Use arrow keys)
❯ Blue
  Green
  Red
  Purple
  (Custom answer)

# User selects Blue

✅ Answer submitted successfully
You selected Blue! I'll use that in my recommendations.

📊 Token Usage:
   Input tokens: 150
   Output tokens: 45
   Total tokens: 195

✅ Stream completed
```

This demonstrates the complete integration of server-side question handling with client-side interactive prompts.
