# API Client Selection Index Fix

## Epic

API Client Question Handling Improvements

## Story

**As a** developer consuming the API client for question handling  
**I want** selection questions to return zero-based indices instead of text values  
**So that** I can programmatically process user selections consistently and predictably

## Background

Currently, when a user answers a selection question through the API client, the system returns the actual selected choice text rather than the index of the selection. This creates inconsistency in the API contract and makes it difficult for consuming applications to process selections programmatically.

## Current State

- Selection questions return the actual choice text (e.g., "purple")
- This requires consumers to map text back to indices manually
- Inconsistent with expected API behavior for selection inputs

## Desired State

- Selection questions return zero-based indices as strings (e.g., "3")
- Custom/other options still return the actual text input
- Consistent, predictable API responses for selection processing

## Acceptance Criteria

### Core Functionality

- [ ] When a user selects a choice from a selection question, the API returns the zero-based index as a string
- [ ] The index corresponds to the position in the original choices array
- [ ] Custom options (detected by keywords like "custom", "other", or parentheses) still return the actual text
- [ ] Invalid selections throw appropriate errors

### Examples

- **Choices**: `["blue", "red", "green", "purple"]`
- **User selects**: "purple"
- **Expected response**: `"3"`

- **Choices**: `["Option A", "Option B", "Custom (specify)"]`
- **User selects**: "Custom (specify)" and enters "My custom option"
- **Expected response**: `"My custom option"`

### Edge Cases

- [ ] Single choice selection returns "0"
- [ ] Empty choices array handled gracefully
- [ ] Duplicate choices in array handled correctly
- [ ] Selection not found in choices array throws error

### Error Handling

- [ ] Clear error messages when selection is not found in choices
- [ ] Proper validation of choices array structure
- [ ] Graceful handling of malformed question data

## Technical Implementation

### Files to Modify

1. `src/tools/QuestionEventHandler.ts` - Main implementation
2. Related test files - Update test expectations
3. API documentation - Update to reflect new behavior

### Key Changes

- Modify `presentSelectQuestion` method to return index instead of text
- Add index lookup logic with error handling
- Preserve custom option handling for special cases

## Testing Requirements

### Unit Tests

- [ ] Test basic selection returns correct index
- [ ] Test first choice returns "0"
- [ ] Test last choice returns correct index
- [ ] Test custom options return actual text
- [ ] Test error cases (invalid selection, missing choices)

### Integration Tests

- [ ] Test with various question types
- [ ] Test with different choice array sizes
- [ ] Test custom option detection and handling

### Manual Testing

- [ ] Verify selection questions work in CLI mode
- [ ] Verify selection questions work in API mode
- [ ] Test user experience remains intuitive

## Definition of Done

- [ ] Code changes implemented and tested
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] Breaking change implications documented
- [ ] Code review completed

## Dependencies

- None

## Risks

- **Breaking Change**: This changes the API contract for selection questions
- **Consumer Impact**: Applications consuming the API must be updated
- **Testing Coverage**: Comprehensive testing needed for all selection scenarios

## Success Metrics

- Selection questions consistently return numeric indices
- Zero regressions in question handling functionality
- Clear error handling for edge cases
- Maintained user experience quality

## Notes

- This is a breaking change that requires coordination with API consumers
- Custom option handling preserves existing behavior for user-provided text
- Error messages should be clear and actionable for debugging
