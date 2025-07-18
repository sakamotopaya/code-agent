# AC-003: Interactive Select Questions

## Story

**As an** API client user  
**I want** to be presented with interactive selection prompts  
**So that** I can choose from multiple options when the server asks questions

## Background

When the server sends select-type questions (like "What color do you prefer?" with choices), the client needs to present them as interactive lists using inquirer.js, similar to the CLI experience.

**Expected Experience:**

```
? What color do you prefer? (Use arrow keys)
❯ Blue
  Green
  Red
  Purple
  (Custom answer)
```

## Acceptance Criteria

### AC-003.1: Select Question Detection

- [ ] Detect questionType === "select" in question events
- [ ] Extract choices array from question data
- [ ] Handle questions with 2-10 choices effectively
- [ ] Support custom answer option when provided

### AC-003.2: Interactive List Presentation

- [ ] Use inquirer.js list prompt for selection
- [ ] Display question message clearly
- [ ] Show all available choices
- [ ] Support arrow key navigation
- [ ] Handle enter key selection

### AC-003.3: Choice Handling

- [ ] Support standard choice lists (string arrays)
- [ ] Support custom answer option "(Custom answer)"
- [ ] Prompt for custom input when custom option selected
- [ ] Return selected choice value as answer

### AC-003.4: User Experience

- [ ] Clear question formatting with appropriate spacing
- [ ] Consistent visual styling with CLI prompts
- [ ] Show selection feedback before submission
- [ ] Handle user cancellation gracefully (Ctrl+C)

## Technical Implementation

### Implementation in QuestionEventHandler

```typescript
// Add to src/tools/QuestionEventHandler.ts

private async presentQuestion(questionData: QuestionEventData): Promise<string> {
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
}

private async presentSelectQuestion(questionData: QuestionEventData): Promise<string> {
    if (!questionData.choices || questionData.choices.length === 0) {
        throw new Error('Select question must have choices')
    }

    // Prepare choices for inquirer
    const choices = [...questionData.choices]
    const hasCustomOption = choices.some(choice => choice.includes('Custom') || choice.includes('custom'))

    console.log('') // Add spacing before question

    const { answer } = await inquirer.prompt([{
        type: 'list',
        name: 'answer',
        message: questionData.question,
        choices: choices,
        pageSize: Math.min(10, choices.length + 2), // Reasonable page size
    }])

    // Handle custom answer option
    if (hasCustomOption && (answer.includes('Custom') || answer.includes('custom'))) {
        return await this.promptCustomAnswer()
    }

    return answer
}

private async promptCustomAnswer(): Promise<string> {
    const { customAnswer } = await inquirer.prompt([{
        type: 'input',
        name: 'customAnswer',
        message: 'Please enter your custom answer:',
        validate: (input: string) => {
            if (!input.trim()) {
                return 'Custom answer cannot be empty'
            }
            return true
        }
    }])

    return customAnswer.trim()
}
```

### Enhanced Error Handling

```typescript
private async presentSelectQuestion(questionData: QuestionEventData): Promise<string> {
    try {
        // Validation
        if (!questionData.choices || questionData.choices.length === 0) {
            throw new Error('Select question must have choices')
        }

        if (questionData.choices.length > 20) {
            console.warn('⚠️  Large number of choices detected, consider pagination')
        }

        // Present question with error handling
        console.log('') // Add spacing
        console.log(`🤔 ${questionData.question}`)

        const { answer } = await inquirer.prompt([{
            type: 'list',
            name: 'answer',
            message: 'Select your choice:',
            choices: questionData.choices,
            pageSize: Math.min(10, questionData.choices.length),
        }])

        // Handle custom answer
        if (this.isCustomAnswer(answer)) {
            return await this.promptCustomAnswer()
        }

        // Confirmation feedback
        if (this.options.verbose) {
            console.log(`✅ Selected: ${answer}`)
        }

        return answer

    } catch (error) {
        if (error.name === 'ExitPromptError') {
            console.log('\n👋 Question cancelled by user')
            throw new Error('Question cancelled by user')
        }
        throw error
    }
}

private isCustomAnswer(answer: string): boolean {
    const customIndicators = ['custom', 'Custom', 'other', 'Other', '(Custom', '(Other']
    return customIndicators.some(indicator => answer.includes(indicator))
}
```

### Integration with Existing CLI Patterns

```typescript
// Use ColorManager patterns for consistent styling (if available)
private formatQuestionMessage(question: string): string {
    // Use consistent styling with CLI prompts
    return `🤔 ${question}`
}

private formatChoices(choices: string[]): Array<{name: string, value: string}> {
    return choices.map(choice => ({
        name: choice,
        value: choice
    }))
}
```

## Testing

### Unit Tests

- [ ] Test select question with 2 choices
- [ ] Test select question with 5+ choices
- [ ] Test select question with custom answer option
- [ ] Test custom answer input validation
- [ ] Test error handling for missing choices
- [ ] Test user cancellation handling

### Integration Tests

- [ ] Test full flow: SSE event → select question → answer submission
- [ ] Test with real question data from SSEPromptManager
- [ ] Test custom answer flow end-to-end

### Manual Testing Scenarios

```typescript
// Test data examples for manual testing
const testSelectQuestion = {
	type: "question",
	questionId: "test_123",
	questionType: "select",
	question: "What color do you prefer?",
	choices: ["Blue", "Green", "Red", "Purple", "(Custom answer)"],
	timestamp: new Date().toISOString(),
}

const testSelectQuestionSimple = {
	type: "question",
	questionId: "test_456",
	questionType: "select",
	question: "Do you want to continue?",
	choices: ["Yes", "No"],
	timestamp: new Date().toISOString(),
}
```

## Definition of Done

- [ ] Select questions display as interactive lists
- [ ] User can navigate with arrow keys and select with enter
- [ ] Custom answer option works when provided
- [ ] Error handling prevents crashes
- [ ] User cancellation handled gracefully
- [ ] Consistent styling with CLI prompts
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing scenarios verified

## Dependencies

- **Depends on:** AC-002 (Question Event Handler Infrastructure)
- **Required by:** AC-008 (End-to-End Testing)
- **Parallels:** AC-004 (Input Questions), AC-005 (Confirmation Questions)

## Estimated Effort

**2 Story Points** - Straightforward implementation using established inquirer.js patterns
