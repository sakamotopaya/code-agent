# AC-004: Interactive Input Questions

## Story

**As an** API client user  
**I want** to be presented with text input prompts  
**So that** I can provide free-form text answers when the server asks for input

## Background

When the server sends input-type questions (like "What is your name?" or "Enter a description"), the client needs to present them as text input prompts, supporting placeholders and validation.

**Expected Experience:**

```
? What is your name?
> John Smith█

? Enter a file path: (e.g., /path/to/file)
> /Users/john/documents/readme.txt█
```

## Acceptance Criteria

### AC-004.1: Input Question Detection

- [ ] Detect questionType === "input" in question events
- [ ] Extract placeholder text when provided
- [ ] Handle both simple text input and path input
- [ ] Support optional vs required input fields

### AC-004.2: Text Input Presentation

- [ ] Use inquirer.js input prompt for text entry
- [ ] Display question message clearly
- [ ] Show placeholder text as hint when available
- [ ] Support multi-line input when needed
- [ ] Handle empty input based on requirements

### AC-004.3: Input Validation

- [ ] Basic validation for required fields
- [ ] Length validation (reasonable limits)
- [ ] Special handling for file paths (if applicable)
- [ ] Trim whitespace from input
- [ ] Provide clear error messages for invalid input

### AC-004.4: User Experience

- [ ] Clear input field presentation
- [ ] Consistent styling with other question types
- [ ] Show input feedback before submission
- [ ] Support input history (up arrow) when possible
- [ ] Handle user cancellation gracefully

## Technical Implementation

### Implementation in QuestionEventHandler

```typescript
// Add to src/tools/QuestionEventHandler.ts

private async presentInputQuestion(questionData: QuestionEventData): Promise<string> {
    console.log('') // Add spacing before question

    const { answer } = await inquirer.prompt([{
        type: 'input',
        name: 'answer',
        message: questionData.question,
        default: questionData.placeholder || undefined,
        validate: (input: string) => this.validateInput(input, questionData),
        filter: (input: string) => input.trim(), // Always trim whitespace
    }])

    if (this.options.verbose) {
        console.log(`✅ Input provided: "${answer}"`)
    }

    return answer
}

private validateInput(input: string, questionData: QuestionEventData): boolean | string {
    const trimmed = input.trim()

    // Check if input is required (default behavior)
    if (!trimmed && this.isRequiredInput(questionData)) {
        return 'This field is required. Please enter a value.'
    }

    // Length validation
    if (trimmed.length > 1000) {
        return 'Input is too long. Please limit to 1000 characters.'
    }

    // Special validation for file paths
    if (this.isFilePathInput(questionData)) {
        return this.validateFilePath(trimmed)
    }

    return true
}

private isRequiredInput(questionData: QuestionEventData): boolean {
    // By default, input questions are required unless specified otherwise
    // This could be extended to check metadata in the question data
    return true
}

private isFilePathInput(questionData: QuestionEventData): boolean {
    const question = questionData.question.toLowerCase()
    const placeholder = (questionData.placeholder || '').toLowerCase()

    return (
        question.includes('path') ||
        question.includes('file') ||
        question.includes('directory') ||
        placeholder.includes('/') ||
        placeholder.includes('\\')
    )
}

private validateFilePath(path: string): boolean | string {
    if (!path) return true // Allow empty for non-required fields

    // Basic path validation
    const invalidChars = ['<', '>', '"', '|', '?', '*']
    const hasInvalidChars = invalidChars.some(char => path.includes(char))

    if (hasInvalidChars) {
        return 'Invalid characters in path. Avoid: < > " | ? *'
    }

    // Check for reasonable path length
    if (path.length > 500) {
        return 'Path is too long. Please use a shorter path.'
    }

    return true
}
```

### Enhanced Input Handling

```typescript
private async presentInputQuestion(questionData: QuestionEventData): Promise<string> {
    try {
        console.log('') // Add spacing
        console.log(`💬 ${questionData.question}`)

        // Show placeholder as a hint if available
        if (questionData.placeholder) {
            console.log(`   ${this.formatHint(questionData.placeholder)}`)
        }

        const { answer } = await inquirer.prompt([{
            type: 'input',
            name: 'answer',
            message: 'Your answer:',
            default: this.shouldUseDefaultValue(questionData) ? questionData.placeholder : undefined,
            validate: (input: string) => this.validateInput(input, questionData),
            filter: (input: string) => input.trim(),
        }])

        return answer

    } catch (error) {
        if (error.name === 'ExitPromptError') {
            console.log('\n👋 Input cancelled by user')
            throw new Error('Input cancelled by user')
        }
        throw error
    }
}

private formatHint(placeholder: string): string {
    return `💡 Hint: ${placeholder}`
}

private shouldUseDefaultValue(questionData: QuestionEventData): boolean {
    // Only use placeholder as default if it looks like a real default value
    // not just an example (e.g., "e.g., /path/to/file" should not be default)
    const placeholder = questionData.placeholder || ''
    return !placeholder.startsWith('e.g.') && !placeholder.includes('example')
}
```

### Special Handling for Different Input Types

```typescript
private async presentInputQuestion(questionData: QuestionEventData): Promise<string> {
    const inputType = this.detectInputType(questionData)

    switch (inputType) {
        case 'multiline':
            return await this.presentMultilineInput(questionData)
        case 'email':
            return await this.presentEmailInput(questionData)
        case 'url':
            return await this.presentUrlInput(questionData)
        default:
            return await this.presentStandardInput(questionData)
    }
}

private detectInputType(questionData: QuestionEventData): string {
    const question = questionData.question.toLowerCase()

    if (question.includes('description') || question.includes('comment') || question.includes('message')) {
        return 'multiline'
    }
    if (question.includes('email')) {
        return 'email'
    }
    if (question.includes('url') || question.includes('link')) {
        return 'url'
    }

    return 'standard'
}

private async presentMultilineInput(questionData: QuestionEventData): Promise<string> {
    console.log('') // Add spacing
    console.log(`💬 ${questionData.question}`)
    console.log('   (Press Enter twice or Ctrl+D when finished)')

    const { answer } = await inquirer.prompt([{
        type: 'editor',
        name: 'answer',
        message: 'Enter your text:',
        default: questionData.placeholder || '',
    }])

    return answer.trim()
}

private async presentEmailInput(questionData: QuestionEventData): Promise<string> {
    const { answer } = await inquirer.prompt([{
        type: 'input',
        name: 'answer',
        message: questionData.question,
        validate: (input: string) => {
            const trimmed = input.trim()
            if (!trimmed) return 'Email is required'

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(trimmed)) {
                return 'Please enter a valid email address'
            }

            return true
        },
        filter: (input: string) => input.trim().toLowerCase(),
    }])

    return answer
}
```

## Testing

### Unit Tests

- [ ] Test standard text input
- [ ] Test input with placeholder text
- [ ] Test input validation (required, length limits)
- [ ] Test file path validation
- [ ] Test email validation
- [ ] Test empty input handling
- [ ] Test input trimming
- [ ] Test user cancellation

### Integration Tests

- [ ] Test full flow: SSE event → input question → answer submission
- [ ] Test with various input types from SSEPromptManager
- [ ] Test multiline input handling

### Manual Testing Scenarios

```typescript
// Test data examples for manual testing
const testInputQuestion = {
	type: "question",
	questionId: "test_input_123",
	questionType: "input",
	question: "What is your name?",
	placeholder: "Enter your full name",
	timestamp: new Date().toISOString(),
}

const testFilePathQuestion = {
	type: "question",
	questionId: "test_path_456",
	questionType: "input",
	question: "Enter the file path:",
	placeholder: "/path/to/your/file.txt",
	timestamp: new Date().toISOString(),
}

const testDescriptionQuestion = {
	type: "question",
	questionId: "test_desc_789",
	questionType: "input",
	question: "Provide a description of the issue:",
	placeholder: "Describe the problem in detail...",
	timestamp: new Date().toISOString(),
}
```

## Definition of Done

- [ ] Input questions display as text input prompts
- [ ] Placeholder text shown as hints when available
- [ ] Input validation prevents invalid submissions
- [ ] Special handling for file paths, emails, multiline text
- [ ] Error messages are clear and helpful
- [ ] User cancellation handled gracefully
- [ ] Consistent styling with other question types
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing scenarios verified

## Dependencies

- **Depends on:** AC-002 (Question Event Handler Infrastructure)
- **Required by:** AC-008 (End-to-End Testing)
- **Parallels:** AC-003 (Select Questions), AC-005 (Confirmation Questions)

## Estimated Effort

**2 Story Points** - Standard implementation with some complexity for validation and special input types
