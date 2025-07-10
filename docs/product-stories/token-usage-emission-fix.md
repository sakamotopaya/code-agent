# Product Story: Fix Token Usage Emission in API

## User Story

**As an** API client developer  
**I want** to receive real-time token usage information via SSE  
**So that** I can display accurate token consumption metrics to users

## Background

The API server calculates token usage correctly but fails to emit this information to connected clients via Server-Sent Events (SSE). This prevents API clients from displaying token usage metrics, which is important for:

- Cost tracking and budgeting
- Usage monitoring and optimization
- Transparency for end users
- Debugging and performance analysis

## Acceptance Criteria

### ✅ Success Criteria

1. **Token usage events are emitted**: API clients receive `token_usage` events via SSE
2. **Data accuracy**: Token usage data matches server-side calculations
3. **Real-time delivery**: Token usage is emitted immediately upon task completion
4. **Client compatibility**: Existing API clients can display token usage without changes
5. **Backward compatibility**: Fix doesn't break existing functionality

### 🧪 Testing Scenarios

1. **Basic token usage emission**:

    - Run: `./api-client.js --stream --verbose "what is 3+3?" --mode code`
    - Expected: Client displays token usage information
    - Expected: Server logs show token usage emission debug messages

2. **Different task types**:

    - Test with various modes (code, ask, debug)
    - Expected: All task types emit token usage

3. **Error scenarios**:
    - Test with failed tasks
    - Expected: Token usage still emitted for partial completions

## Technical Implementation

### Root Cause

- Tasks complete through `executeInfoQuery` path in `TaskExecutionOrchestrator`
- This path doesn't pass token usage data to `onTaskCompleted` handler
- Without token usage data, the emission pipeline is never triggered

### Solution

- Retrieve token usage from task instance before disposal
- Pass token usage data to `onTaskCompleted` handler
- Ensure all completion paths include token usage information

### Files Modified

- `src/core/task/execution/TaskExecutionOrchestrator.ts` - Primary fix
- `docs/technical/token-usage-emission-fix.md` - Technical documentation

## Definition of Done

- [ ] Code changes implemented and tested
- [ ] Token usage events appear in API client output
- [ ] Server logs show successful token usage emission
- [ ] No regression in existing functionality
- [ ] Technical documentation updated
- [ ] Manual testing completed with API client

## Priority

**High** - This affects API client functionality and user experience for token usage monitoring.

## Effort Estimate

**Small** - Single file change with clear solution identified.

## Dependencies

None - This is a self-contained fix.

## Risks

**Low** - The fix is isolated to the completion path and doesn't affect core task execution logic.
