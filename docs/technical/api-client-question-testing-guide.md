# API Client Question Handling - Testing Guide

## Overview

This document provides comprehensive testing scenarios for the API client question handling system implementation (AC-001 through AC-008). The testing validates the complete flow from server question initiation through client interaction to server response processing.

## Test Environment Setup

### Prerequisites

```bash
# Ensure inquirer.js is installed
npm list inquirer

# Start the API server
./run-api.sh

# Prepare API client for testing
cd src && node tools/api-client.js --stream --mode code --repl
```

### Server Question Test Setup

Use these commands in the API client to trigger different question types:

```bash
# Select question test
roo-api > Use ask_followup_question to ask me what color I prefer

# Input question test
roo-api > Use ask_followup_question to ask for my name using input type

# Confirmation question test
roo-api > Use ask_followup_question to ask if I want to continue with a dangerous operation
```

## AC-008.1: Full Question Flow Testing

### Test Case 1: Select Question Flow

**Objective:** Validate complete select question handling

**Steps:**

1. Start API client with `./api-client.js --stream --mode code --repl`
2. Execute: `Use ask_followup_question to ask me what color I prefer`
3. Observe SSE stream shows "QUESTION_EVENT:" log message
4. Verify interactive prompt appears with arrow key navigation
5. Select an option using arrow keys + Enter
6. Verify answer submission via POST request
7. Confirm task execution continues

**Expected Results:**

- ✅ QUESTION_EVENT detected and parsed
- ✅ Interactive list prompt with choices displayed
- ✅ Arrow key navigation works
- ✅ Answer submitted successfully via HTTP POST
- ✅ Task execution resumes after answer

**Custom Answer Test:**

1. Repeat above but select "(Custom answer)" option
2. Verify text input prompt appears
3. Enter custom text and submit
4. Verify custom text is submitted as answer

### Test Case 2: Input Question Flow

**Objective:** Validate complete input question handling

**Steps:**

1. Execute: `Use ask_followup_question with type input to ask for my full name`
2. Observe QUESTION_EVENT detection
3. Verify text input prompt appears
4. Enter text with various lengths and characters
5. Test empty input validation
6. Submit valid input

**Expected Results:**

- ✅ Input prompt with proper formatting
- ✅ Validation prevents empty submission
- ✅ Text input accepted and trimmed
- ✅ Answer submitted correctly

### Test Case 3: Confirmation Question Flow

**Objective:** Validate complete confirmation question handling

**Steps:**

1. Execute: `Use ask_followup_question with type confirmation asking if I want to delete files`
2. Observe QUESTION_EVENT detection
3. Verify Y/n prompt appears with proper default
4. Test both Y and N responses
5. Test Enter key for default selection

**Expected Results:**

- ✅ Confirmation prompt with clear Y/n options
- ✅ Proper default selection (N for destructive actions)
- ✅ Keyboard shortcuts work (Y/n)
- ✅ "Yes"/"No" text responses submitted

## AC-008.2: Multiple Question Scenarios

### Test Case 4: Sequential Questions

**Objective:** Test multiple questions in sequence

**Steps:**

1. Execute task that triggers multiple questions:

```
Use ask_followup_question to ask my name, then ask my favorite color, then confirm if I want to proceed
```

2. Answer each question in sequence
3. Verify queue handling and ordering

**Expected Results:**

- ✅ Questions processed in correct order
- ✅ No interference between questions
- ✅ Each question waits for previous completion
- ✅ Stream processing resumes properly

### Test Case 5: Rapid Fire Questions (Stress Test)

**Objective:** Test question queue handling under load

**Steps:**

1. Trigger multiple rapid questions (if possible via server)
2. Observe queue management
3. Check for memory leaks
4. Verify all questions processed

**Expected Results:**

- ✅ Questions queued properly (max 10)
- ✅ Oldest questions dropped if queue full
- ✅ Memory usage remains stable
- ✅ No crashes under load

### Test Case 6: Mixed Question Types

**Objective:** Test various question types in one session

**Steps:**

1. Execute sequence with select, input, and confirmation questions
2. Verify different prompt styles work correctly
3. Check answer formatting consistency

**Expected Results:**

- ✅ Each question type displays correctly
- ✅ Consistent user experience across types
- ✅ Proper answer formatting for each type

## AC-008.3: Error Recovery Testing

### Test Case 7: Network Interruption

**Objective:** Test resilience to network failures

**Steps:**

1. Start question flow
2. Disconnect network during answer submission
3. Reconnect network
4. Observe retry behavior

**Expected Results:**

- ✅ Exponential backoff retry (3 attempts)
- ✅ Clear error messages
- ✅ Graceful failure after max retries
- ✅ System remains stable

### Test Case 8: Server Restart During Question

**Objective:** Test server unavailability handling

**Steps:**

1. Start question flow
2. Stop API server during question presentation
3. Answer question (will fail to submit)
4. Restart server
5. Observe client behavior

**Expected Results:**

- ✅ Clear error message about server unavailability
- ✅ Client doesn't crash
- ✅ Graceful failure handling

### Test Case 9: User Cancellation

**Objective:** Test Ctrl+C handling during questions

**Steps:**

1. Start question flow
2. Press Ctrl+C during question prompt
3. Observe cancellation handling
4. Verify system recovery

**Expected Results:**

- ✅ Graceful cancellation message
- ✅ System returns to normal state
- ✅ No memory leaks or hanging processes

### Test Case 10: Malformed Questions

**Objective:** Test invalid question data handling

**Setup:** Simulate malformed QUESTION_EVENT (requires server modification)

**Expected Results:**

- ✅ Clear validation error messages
- ✅ Stream processing continues
- ✅ No client crashes

## AC-008.4: User Experience Validation

### Test Case 11: Visual Formatting

**Objective:** Validate question display quality

**Manual Verification Points:**

- [ ] Question text is clearly readable
- [ ] Proper spacing and indentation
- [ ] Choice lists are well-formatted
- [ ] Long questions wrap appropriately
- [ ] Colors and styling work in different terminals

### Test Case 12: Navigation Experience

**Objective:** Test interactive navigation

**Steps:**

1. Use select question with 5+ choices
2. Test arrow key navigation (up/down)
3. Test Page Up/Down for long lists
4. Test mouse interaction (if supported)
5. Test Enter key selection

**Expected Results:**

- ✅ Smooth arrow key navigation
- ✅ Clear visual feedback for selection
- ✅ Enter key works consistently
- ✅ Long lists handle pagination

### Test Case 13: Input Validation Feedback

**Objective:** Test input validation UX

**Steps:**

1. Use input question
2. Try submitting empty input
3. Try very long input (>500 chars)
4. Observe validation messages

**Expected Results:**

- ✅ Clear validation error messages
- ✅ User can retry without restarting
- ✅ Helpful guidance for corrections

### Test Case 14: Stream Processing Continuity

**Objective:** Verify smooth stream resume after questions

**Steps:**

1. Start long-running task with questions
2. Answer questions promptly
3. Observe task execution continuation
4. Check for any stream processing delays

**Expected Results:**

- ✅ No delays in stream processing resume
- ✅ Task output appears immediately after answers
- ✅ No lost messages during question handling

## Regression Testing Checklist

After any changes to question handling code, run this quick regression test:

### Quick Smoke Test (5 minutes)

- [ ] Select question with 3 choices works
- [ ] Input question accepts text
- [ ] Confirmation question shows Y/n
- [ ] Answer submission succeeds
- [ ] Stream processing resumes

### Full Regression Test (20 minutes)

- [ ] All Test Cases 1-3 (basic flows)
- [ ] Test Case 4 (sequential questions)
- [ ] Test Case 7 (network interruption)
- [ ] Test Case 9 (user cancellation)
- [ ] Visual formatting check

## Performance Validation

### Memory Usage Test

```bash
# Monitor memory during question handling
top -p $(pgrep -f api-client)

# Expected: Stable memory usage, no leaks
```

### Response Time Test

- Question display: < 100ms after QUESTION_EVENT
- Answer submission: < 1s for successful POST
- Stream resume: < 50ms after answer submission

## Known Limitations

1. **Terminal Compatibility:** Some terminals may not support full arrow key navigation
2. **Custom Answers:** Custom answer validation is basic (length only)
3. **Question Queue:** Limited to 10 concurrent questions to prevent memory issues
4. **Network Timeouts:** 10-second timeout may be too short for slow networks

## Troubleshooting Common Issues

### Question Not Appearing

- Check for QUESTION_EVENT in SSE stream
- Verify JSON parsing isn't failing
- Check verbose mode for error messages

### Answer Submission Failing

- Verify server is running on correct port
- Check network connectivity
- Review HTTP response status codes

### Navigation Not Working

- Test in different terminal (iTerm, Terminal.app, etc.)
- Verify inquirer.js version compatibility
- Check for conflicting keyboard shortcuts

## Test Data Examples

### Valid Question Events

```json
{
	"type": "question",
	"questionId": "q_test_123",
	"questionType": "select",
	"question": "What is your favorite color?",
	"choices": ["Blue", "Red", "Green", "Purple", "(Custom answer)"],
	"timestamp": "2025-01-13T18:00:00.000Z"
}
```

```json
{
	"type": "question",
	"questionId": "q_test_124",
	"questionType": "input",
	"question": "What is your full name?",
	"placeholder": "(e.g., John Smith)",
	"timestamp": "2025-01-13T18:00:00.000Z"
}
```

```json
{
	"type": "question",
	"questionId": "q_test_125",
	"questionType": "confirmation",
	"question": "Do you want to delete all files?",
	"yesText": "Yes, delete them",
	"noText": "No, keep them",
	"timestamp": "2025-01-13T18:00:00.000Z"
}
```

## Success Criteria

The question handling system is considered fully functional when:

- ✅ All AC-008.1 basic flows work consistently
- ✅ Multiple questions can be handled in sequence
- ✅ Error scenarios are handled gracefully
- ✅ User experience meets quality standards
- ✅ No memory leaks or performance issues
- ✅ Compatible with common terminal environments

## Documentation and Handoff

Upon completion of testing:

1. **Document any bugs found** in GitHub issues
2. **Update user documentation** with question handling instructions
3. **Create video demo** of question handling for stakeholders
4. **Update API documentation** with question endpoint details
5. **Provide training materials** for support team

---

_This testing guide should be updated as the question handling system evolves. Each test case should be executed before releases to ensure quality._
