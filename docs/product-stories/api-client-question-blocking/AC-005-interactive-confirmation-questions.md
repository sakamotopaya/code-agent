# AC-005: Interactive Confirmation Questions

## Story

**As an** API client user  
**I want** to be presented with yes/no confirmation prompts  
**So that** I can confirm or decline actions when the server asks for confirmation

## Background

When the server sends confirmation-type questions (like "Do you want to continue?" or "Delete this file?"), the client needs to present them as clear yes/no prompts with sensible defaults and clear visual indicators.

**Expected Experience:**

```
? Do you want to continue with the installation? (Y/n)
> Yes

? Are you sure you want to delete this file? (y/N)
> No
```

## Acceptance Criteria

### AC-005.1: Confirmation Question Detection

- [ ] Detect questionType === "confirmation" in question events
- [ ] Extract custom yesText and noText when provided
- [ ] Handle default choice indication (typically Yes for proceed, No for destructive actions)
- [ ] Support both boolean and text-based confirmation responses

### AC-005.2: Confirmation Prompt Presentation

- [ ] Use inquirer.js confirm prompt for boolean questions
- [ ] Display question message with clear Yes/No options
- [ ] Show default choice clearly in prompt
- [ ] Support keyboard shortcuts (Y/n, y/N)
- [ ] Provide visual feedback for selection

### AC-005.3: Response Handling

- [ ] Convert user selection to appropriate response format
- [ ] Handle both boolean (true/false) and text ("Yes"/"No") responses
- [ ] Support custom text for yes/no options when provided
- [ ] Return consistent answer format to server

### AC-005.4: Default Behavior & Safety

- [ ] Use safe defaults for destructive actions (default to No)
- [ ] Use proceed defaults for continuation prompts (default to Yes)
- [ ] Show default choice clearly in prompt text
- [ ] Handle empty input by using default
- [ ] Handle user cancellation gracefully

## Technical Implementation

### Implementation in QuestionEventHandler

```typescript
// Add to src/tools/QuestionEventHandler.ts

private async presentConfirmationQuestion(questionData: QuestionEventData): Promise<string> {
    const yesText = questionData.yesText || 'Yes'
    const noText = questionData.noText || 'No'
    const defaultChoice = this.determineDefaultChoice(questionData)

    console.log('') // Add spacing before question

    try {
        const { confirmed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirmed',
            message: questionData.question,
            default: defaultChoice,
        }])

        const answer = confirmed ? yesText : noText

        if (this.options.verbose) {
            console.log(`✅ Confirmation: ${answer}`)
        }

        return answer

    } catch (error) {
        if (error.name === 'ExitPromptError') {
            console.log('\n👋 Confirmation cancelled by user')
            throw new Error('Confirmation cancelled by user')
        }
        throw error
    }
}

private determineDefaultChoice(questionData: QuestionEventData): boolean {
    const question = questionData.question.toLowerCase()

    // Default to false (No) for destructive actions
    const destructiveKeywords = [
        'delete', 'remove', 'destroy', 'clear', 'reset', 'overwrite',
        'replace', 'erase', 'purge', 'drop', 'terminate', 'kill'
    ]

    if (destructiveKeywords.some(keyword => question.includes(keyword))) {
        return false // Default to No for safety
    }

    // Default to false (No) for irreversible actions
    const irreversibleKeywords = [
        'permanently', 'irreversible', 'cannot be undone', 'final'
    ]

    if (irreversibleKeywords.some(keyword => question.includes(keyword))) {
        return false // Default to No for safety
    }

    // Default to true (Yes) for continuation/proceed actions
    const proceedKeywords = [
        'continue', 'proceed', 'start', 'begin', 'install', 'update',
        'download', 'save', 'create', 'generate'
    ]

    if (proceedKeywords.some(keyword => question.includes(keyword))) {
        return true // Default to Yes for proceeding
    }

    // Default to true for general questions
    return true
}
```

### Enhanced Confirmation with Custom Options

```typescript
private async presentConfirmationQuestion(questionData: QuestionEventData): Promise<string> {
    const yesText = questionData.yesText || 'Yes'
    const noText = questionData.noText || 'No'
    const defaultChoice = this.determineDefaultChoice(questionData)

    // For better UX, use list prompt when custom yes/no text is provided
    if (questionData.yesText || questionData.noText) {
        return await this.presentCustomConfirmation(questionData, yesText, noText, defaultChoice)
    }

    // Use standard confirm prompt for simple yes/no
    return await this.presentStandardConfirmation(questionData, yesText, noText, defaultChoice)
}

private async presentStandardConfirmation(
    questionData: QuestionEventData,
    yesText: string,
    noText: string,
    defaultChoice: boolean
): Promise<string> {
    console.log('') // Add spacing
    console.log(`❓ ${questionData.question}`)

    const { confirmed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: `Confirm (${defaultChoice ? 'Y/n' : 'y/N'}):`,
        default: defaultChoice,
    }])

    return confirmed ? yesText : noText
}

private async presentCustomConfirmation(
    questionData: QuestionEventData,
    yesText: string,
    noText: string,
    defaultChoice: boolean
): Promise<string> {
    console.log('') // Add spacing
    console.log(`❓ ${questionData.question}`)

    const choices = [yesText, noText]
    const defaultAnswer = defaultChoice ? yesText : noText

    const { answer } = await inquirer.prompt([{
        type: 'list',
        name: 'answer',
        message: 'Please confirm:',
        choices: choices,
        default: defaultAnswer,
    }])

    return answer
}
```

### Safety Enhancements

```typescript
private async presentConfirmationQuestion(questionData: QuestionEventData): Promise<string> {
    const yesText = questionData.yesText || 'Yes'
    const noText = questionData.noText || 'No'
    const defaultChoice = this.determineDefaultChoice(questionData)
    const isDestructive = this.isDestructiveAction(questionData)

    // Extra safety for destructive actions
    if (isDestructive) {
        return await this.presentDestructiveConfirmation(questionData, yesText, noText)
    }

    return await this.presentStandardConfirmation(questionData, yesText, noText, defaultChoice)
}

private isDestructiveAction(questionData: QuestionEventData): boolean {
    const question = questionData.question.toLowerCase()
    const highRiskKeywords = [
        'delete all', 'remove all', 'drop database', 'format drive',
        'delete permanently', 'cannot be recovered'
    ]

    return highRiskKeywords.some(keyword => question.includes(keyword))
}

private async presentDestructiveConfirmation(
    questionData: QuestionEventData,
    yesText: string,
    noText: string
): Promise<string> {
    console.log('') // Add spacing
    console.log(`⚠️  ${questionData.question}`)
    console.log('   This action cannot be undone!')

    // Require explicit confirmation for destructive actions
    const { confirmed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmed',
        message: 'Are you absolutely sure?',
        default: false, // Always default to No for destructive actions
    }])

    if (confirmed) {
        // Double confirmation for highly destructive actions
        const { doubleConfirmed } = await inquirer.prompt([{
            type: 'input',
            name: 'doubleConfirmed',
            message: `Type "${yesText}" to confirm:`,
            validate: (input: string) => {
                if (input.trim() === yesText) {
                    return true
                }
                return `Please type exactly "${yesText}" to confirm`
            }
        }])

        return yesText
    }

    return noText
}
```

## Testing

### Unit Tests

- [ ] Test standard yes/no confirmation
- [ ] Test confirmation with custom yes/no text
- [ ] Test default choice determination for different question types
- [ ] Test destructive action detection and safety measures
- [ ] Test double confirmation for high-risk actions
- [ ] Test user cancellation handling
- [ ] Test response format conversion

### Integration Tests

- [ ] Test full flow: SSE event → confirmation question → answer submission
- [ ] Test with various confirmation types from SSEPromptManager
- [ ] Test safety measures with destructive confirmations

### Manual Testing Scenarios

```typescript
// Test data examples for manual testing
const testContinueQuestion = {
	type: "question",
	questionId: "test_continue_123",
	questionType: "confirmation",
	question: "Do you want to continue with the installation?",
	yesText: "Yes",
	noText: "No",
	timestamp: new Date().toISOString(),
}

const testDestructiveQuestion = {
	type: "question",
	questionId: "test_delete_456",
	questionType: "confirmation",
	question: "Are you sure you want to delete this file permanently?",
	yesText: "Delete",
	noText: "Cancel",
	timestamp: new Date().toISOString(),
}

const testCustomConfirmation = {
	type: "question",
	questionId: "test_custom_789",
	questionType: "confirmation",
	question: "Would you like to save your changes?",
	yesText: "Save",
	noText: "Discard",
	timestamp: new Date().toISOString(),
}
```

## Definition of Done

- [ ] Confirmation questions display as clear yes/no prompts
- [ ] Default choices determined intelligently based on question context
- [ ] Safety measures implemented for destructive actions
- [ ] Custom yes/no text supported when provided
- [ ] Double confirmation for high-risk destructive actions
- [ ] Error handling prevents crashes
- [ ] User cancellation handled gracefully
- [ ] Consistent styling with other question types
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing scenarios verified

## Dependencies

- **Depends on:** AC-002 (Question Event Handler Infrastructure)
- **Required by:** AC-008 (End-to-End Testing)
- **Parallels:** AC-003 (Select Questions), AC-004 (Input Questions)

## Estimated Effort

**2 Story Points** - Standard implementation with additional complexity for safety measures and destructive action handling
