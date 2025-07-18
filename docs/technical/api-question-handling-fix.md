# API Question Handling Fix

## Problem Analysis

The API question handling is failing because the `UnifiedQuestionManager` and `ApiQuestionManager` are not properly integrated, despite the intent to unify them.

### Root Cause

The `PersistentQuestionStore.storeQuestion()` method (line 14-19) doesn't actually store questions in the `ApiQuestionManager`:

```typescript
storeQuestion(question: QuestionData): string {
  // The ApiQuestionManager handles storage internally
  // We just need to ensure our QuestionData is compatible
  // The actual storage happens when ApiQuestionManager.createQuestion() is called
  return question.id  // ❌ This doesn't actually store anything!
}
```

### The Flow That's Breaking

1. `UnifiedQuestionManager` creates a question with ID `q_${timestamp}_${random}`
2. `PersistentQuestionStore.storeQuestion()` returns the ID without storing it
3. `ApiAnswerCollector.waitForAnswer()` looks for the question in `ApiQuestionManager`
4. Question not found → Error: "Question not found in ApiQuestionManager"
5. Falls back to CLI handler → "Cannot read properties of undefined (reading 'answer')"

### Current Usage

Both systems are actively used:

- **ApiQuestionManager**: Used in FastifyServer, SSEOutputAdapter, tests
- **UnifiedQuestionManager**: Used in Task.ts for cross-platform consistency

## Solution: Proper Integration

Fix the `PersistentQuestionStore` to actually create questions in `ApiQuestionManager` and ensure proper ID mapping.

### Key Changes Needed

1. **Fix storeQuestion()**: Actually call `ApiQuestionManager.createQuestion()`
2. **ID Mapping**: Ensure UnifiedQuestionManager IDs work with ApiQuestionManager
3. **Data Conversion**: Convert between QuestionData and ApiQuestion formats
4. **Backward Compatibility**: Maintain all existing API endpoints and functionality

### Benefits

- ✅ Preserves existing API functionality
- ✅ Unifies question handling as intended
- ✅ Maintains persistent storage
- ✅ No breaking changes to existing code
- ✅ Fixes the immediate bug

This approach rolls ApiQuestionManager into UnifiedQuestionManager without breaking anything.
