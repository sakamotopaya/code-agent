# API Client Question Handling: Complete Fix Guide

## ✅ Server-Side Architecture (Working Perfectly)

The server-side question handling is **fully implemented and working**:

1. **SSEPromptManager Bridge** - ✅ Implemented
2. **QUESTION_EVENT via SSE** - ✅ Working
3. **Question API Endpoint** - ✅ Working
4. **Server Blocking** - ✅ Working

## ❌ Root Cause: Missing Client QUESTION_EVENT Handler

**Current Client Behavior**:

```
Client receives: QUESTION_EVENT: {"type":"question","questionId":"q_job_md1s606p_543f603f_1752417562918_1","questionType":"select","question":"What color do you prefer?","choices":["Blue","Green","Red","Purple","(Custom answer)"],"timestamp":"2025-07-13T14:39:22.918Z"}

Client prints raw JSON and hangs ❌
```

**Required Client Behavior**:

```
Client receives QUESTION_EVENT → Present interactive prompt → Collect answer → POST to API
```

## 🔧 Complete Fix: Client-Side Implementation

### 1. Question Event Detection

The client needs to detect QUESTION_EVENT in the SSE stream:

```typescript
// In API client SSE handler
if (event.startsWith("QUESTION_EVENT:")) {
	const questionData = JSON.parse(event.replace("QUESTION_EVENT: ", ""))
	await handleQuestionEvent(questionData)
}
```

### 2. Interactive Question Presentation

Based on CLI patterns from `src/cli/services/PromptManager.ts`, implement:

```typescript
async function handleQuestionEvent(questionData: any): Promise<void> {
	const { questionId, questionType, question, choices } = questionData

	switch (questionType) {
		case "select":
			const answer = await presentSelectQuestion(question, choices)
			await submitAnswer(questionId, answer)
			break

		case "input":
			const textAnswer = await presentInputQuestion(question)
			await submitAnswer(questionId, textAnswer)
			break

		case "confirmation":
			const confirmed = await presentConfirmQuestion(question)
			await submitAnswer(questionId, confirmed ? "Yes" : "No")
			break
	}
}
```

### 3. Question Presentation Functions

Using Node.js inquirer.js (like CLI):

```typescript
import inquirer from "inquirer"

async function presentSelectQuestion(question: string, choices: string[]): Promise<string> {
	const { answer } = await inquirer.prompt([
		{
			type: "list",
			name: "answer",
			message: question,
			choices: choices,
		},
	])
	return answer
}

async function presentInputQuestion(question: string): Promise<string> {
	const { answer } = await inquirer.prompt([
		{
			type: "input",
			name: "answer",
			message: question,
		},
	])
	return answer
}

async function presentConfirmQuestion(question: string): Promise<boolean> {
	const { answer } = await inquirer.prompt([
		{
			type: "confirm",
			name: "answer",
			message: question,
		},
	])
	return answer
}
```

### 4. Answer Submission

POST answer to the existing API endpoint:

```typescript
async function submitAnswer(questionId: string, answer: string): Promise<void> {
	try {
		const response = await fetch(`${API_BASE_URL}/api/questions/${questionId}/answer`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ answer }),
		})

		if (!response.ok) {
			throw new Error(`Failed to submit answer: ${response.statusText}`)
		}

		console.log("✅ Answer submitted successfully")
	} catch (error) {
		console.error("❌ Failed to submit answer:", error)
	}
}
```

## 🌐 Existing API Infrastructure (All Working)

### Question API Endpoint

```
POST /api/questions/:questionId/answer
Body: { "answer": "user_response" }
```

### Server Response Flow

```
1. Client POSTs answer to /api/questions/:questionId/answer
2. FastifyServer calls questionManager.submitAnswer()
3. ApiQuestionManager resolves promise
4. SSEPromptManager.promptXXX() returns answer
5. Task continues execution
```

## 📋 Implementation Checklist

**Client-Side Tasks**:

- [ ] Add QUESTION_EVENT detection in SSE stream handler
- [ ] Implement interactive question presentation using inquirer.js
- [ ] Add answer submission to /api/questions/:questionId/answer
- [ ] Test select questions (multiple choice)
- [ ] Test input questions (text input)
- [ ] Test confirmation questions (yes/no)

**Shared CLI Logic to Reuse**:

- Question detection patterns from `src/cli/commands/batch.ts:685-696`
- PromptManager interface from `src/cli/services/PromptManager.ts`
- Question formatting from CLI implementation

## 🚀 Expected Result After Fix

```
User: Use ask_followup_question to ask me what color I prefer

Server: I'll ask you about your color preference.
QUESTION_EVENT sent via SSE ✅

Client: ? What color do you prefer? (Use arrow keys)
❯ Blue
  Green
  Red
  Purple
  (Custom answer)

User selects: Blue

Client: POST /api/questions/q_job_md1s606p_543f603f_1752417562918_1/answer {"answer":"Blue"} ✅

Server: You selected Blue! ✅
Task execution continues...
```

The server-side architecture is **production ready**. Only client-side QUESTION_EVENT handling needs implementation.
