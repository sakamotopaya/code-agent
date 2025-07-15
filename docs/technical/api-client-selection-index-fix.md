# API Client Selection Index Fix

## Problem Statement

The API client's `QuestionEventHandler` is returning the actual selected choice text instead of the zero-based index for selection questions. This breaks the expected API contract where selection answers should be numeric indices.

## Current Behavior

In `src/tools/QuestionEventHandler.ts`, the `presentSelectQuestion` method:

- Returns the actual selected choice text (e.g., "purple")
- This happens at line 215: `return selectedChoice`

**Example:**

- Choices: ["blue", "red", "green", "purple"]
- User selects: "purple"
- Current return: "purple"
- Expected return: "3"

## Root Cause Analysis

The issue is in the `presentSelectQuestion` method where after the user makes a selection using inquirer.js, the method directly returns the selected choice text without converting it to the corresponding index.

```typescript
// Current problematic code (line 215):
return selectedChoice
```

## Solution Design

### 1. Core Fix

Modify the `presentSelectQuestion` method to:

- Find the index of the selected choice in the original `questionData.choices` array
- Return the index as a string instead of the choice text
- Handle edge cases and errors appropriately

### 2. Implementation Details

```typescript
// Replace line 215 with:
const choiceIndex = questionData.choices.indexOf(selectedChoice)
if (choiceIndex === -1) {
	throw new Error(`Selected choice "${selectedChoice}" not found in choices array`)
}
return choiceIndex.toString()
```

### 3. Custom Option Handling

- Current code handles custom options (lines 177-213)
- For custom options, continue returning the actual text since it's user-provided
- Only return index for pre-defined choices from the choices array

### 4. Error Handling

- Validate that the selected choice exists in the choices array
- Provide meaningful error messages for debugging
- Handle edge cases like empty choices arrays

## Testing Requirements

### Test Scenarios

1. **Basic Selection**: choices = ["A", "B", "C"] → select "B" → return "1"
2. **First Choice**: choices = ["X", "Y", "Z"] → select "X" → return "0"
3. **Last Choice**: choices = ["1", "2", "3"] → select "3" → return "2"
4. **Custom Option**: User selects custom option → return actual custom text
5. **Single Choice**: choices = ["Only"] → select "Only" → return "0"

### Edge Cases

- Empty choices array
- Duplicate choices in array
- Invalid selection (not in choices)
- Missing choices array

## Backward Compatibility

This is a **breaking change** in the API contract. All consumers of the API client that process selection question responses must be updated to expect numeric indices instead of text values.

## Files to Modify

1. `src/tools/QuestionEventHandler.ts` - Main fix in `presentSelectQuestion` method
2. Tests in `src/tools/__tests__/` - Update test expectations
3. Documentation - Update API documentation to reflect index-based responses

## Implementation Steps

1. Fix the `presentSelectQuestion` method
2. Add proper error handling and validation
3. Update or add unit tests
4. Test with various selection scenarios
5. Update API documentation

## Risk Assessment

- **Low Risk**: The fix is localized to one method
- **Breaking Change**: API consumers must be updated
- **Testing**: Comprehensive testing required for all selection scenarios
