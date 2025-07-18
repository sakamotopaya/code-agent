# API Completion Message Fix - Product Requirements Document

## Overview

**Problem**: The API task execution handler is sending hardcoded status messages ("Task has been completed successfully") to clients instead of the actual LLM-generated task results. This causes clients to receive generic status messages rather than the meaningful task completion content they expect.

**Solution**: Fix the data flow to pass the actual LLM result through the completion chain and remove the hardcoded status message from the client output.

## User Stories

### As an API client

- I want to receive the actual LLM-generated task result when a task completes
- I don't want to see generic status messages mixed with the actual result content
- I want consistent behavior across all task completion scenarios

### As a developer

- I want the completion event to carry the actual result data
- I want clean separation between status information and result content
- I want the same completion behavior across CLI, API, and extension contexts

## Success Criteria

1. **API clients receive only the LLM result** - No hardcoded status messages in completion output
2. **Consistent behavior** - Same completion handling for small and large results
3. **Backward compatibility** - No breaking changes to existing functionality
4. **All contexts work** - CLI, API, and extension all handle completion correctly

## Technical Requirements

### Core Changes Required

1. **Event Emission Fix** (`attemptCompletionTool.ts`)

    - Include the actual LLM result in the `taskCompleted` event
    - Maintain token usage and tool usage data

2. **Orchestrator Update** (`TaskExecutionOrchestrator.ts`)

    - Accept the result parameter in the event handler
    - Pass the actual result to the completion handler instead of hardcoded messages

3. **Handler Correction** (`ApiTaskExecutionHandler.ts`)
    - Use the result parameter correctly in `emitCompletion` calls
    - Remove hardcoded status messages from client output
    - Fix both normal and streaming completion paths

## Implementation Plan

### Phase 1: Update Event Emission

- **File**: `src/core/tools/attemptCompletionTool.ts`
- **Change**: Add result parameter to `taskCompleted` event emission
- **Impact**: Low risk - adds parameter to existing event

### Phase 2: Update Orchestrator

- **File**: `src/core/task/execution/TaskExecutionOrchestrator.ts`
- **Change**: Update event handler to receive and pass result parameter
- **Impact**: Medium risk - changes event handling logic

### Phase 3: Fix API Handler

- **File**: `src/core/task/execution/ApiTaskExecutionHandler.ts`
- **Change**: Remove hardcoded status messages and use actual result
- **Impact**: High impact - directly affects API client experience

### Phase 4: Testing & Validation

- **Scope**: All execution contexts (CLI, API, Extension)
- **Focus**: Verify result content is correct and status messages are removed
- **Test Cases**: Small results, large results, error cases

## Risk Assessment

**Low Risk Changes**:

- Adding result parameter to event emission
- Updating parameter passing in orchestrator

**Medium Risk Changes**:

- Modifying event handler signatures
- Ensuring all listeners handle new parameters

**High Impact Changes**:

- Removing hardcoded status messages from API output
- Changing client-facing behavior

## Definition of Done

- [ ] LLM result is included in `taskCompleted` event
- [ ] Orchestrator passes actual result to handlers
- [ ] API handler sends only LLM result to clients
- [ ] No hardcoded status messages in completion output
- [ ] All execution contexts (CLI, API, Extension) work correctly
- [ ] Existing tests pass
- [ ] New tests added for result handling
- [ ] Documentation updated

## Dependencies

- Understanding of event emission system
- Access to test both API and CLI contexts
- Knowledge of SSE streaming implementation

## Success Metrics

- API clients receive meaningful LLM results instead of generic status messages
- No regression in CLI or extension completion behavior
- Consistent completion handling across all execution contexts
- Clean separation of result content from status information

## Implementation Stories

1. **Story 1**: Fix LLM Result Event Emission
2. **Story 2**: Update Task Orchestrator Result Handling
3. **Story 3**: Remove Hardcoded Status Messages from API Handler
4. **Story 4**: Test and Validate All Execution Contexts

Each story should be implemented and tested individually to ensure no regressions are introduced.
