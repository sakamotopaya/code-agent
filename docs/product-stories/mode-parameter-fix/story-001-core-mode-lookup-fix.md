# Story 1: Remove Informational Query Logic from API

## Story Description

**As a** developer using the API  
**I want** all tasks to execute normally regardless of how they're phrased  
**So that** I get consistent behavior and proper LLM responses

## Background

During the CLI/API refactoring, informational query detection logic was added that doesn't exist in the original VS Code extension. This causes tasks starting with question words to be terminated immediately instead of executing normally.

## Acceptance Criteria

### Primary Criteria

- [ ] Remove `isInformationalQuery()` call from API endpoint in `src/api/server/FastifyServer.ts`
- [ ] Set `isInfoQuery = false` for all API tasks to force standard execution
- [ ] Tasks starting with question words execute normally and provide LLM responses
- [ ] Mode parameter works correctly for all task types

### Testing Criteria

- [ ] Original failing command works: `./api-client.js --stream --mode ticket-oracle "what is your current mode"`
- [ ] Task executes and provides a proper response from the LLM
- [ ] No immediate termination with "Standard task completion"
- [ ] Streaming works correctly throughout task execution

### Quality Criteria

- [ ] No regressions in existing API functionality
- [ ] Performance is maintained or improved
- [ ] Error handling remains robust
- [ ] Logging provides clear debugging information

## Technical Implementation

### Files to Modify

1. **`src/api/server/FastifyServer.ts`**
    - Line 360: Comment out or remove `const isInfoQuery = this.isInformationalQuery(task)`
    - Line 364: Change to `isInfoQuery: false,` in executionOptions
    - Add logging to track the change

### Code Changes

```typescript
// Before (line 360):
const isInfoQuery = this.isInformationalQuery(task)

// After (line 360):
// FIXED: Remove informational query detection to match VS Code extension behavior
// const isInfoQuery = this.isInformationalQuery(task)
const isInfoQuery = false // All API tasks use standard execution

// Update executionOptions (line 364):
const executionOptions = {
	isInfoQuery: false, // Force standard execution for all API tasks
	infoQueryTimeoutMs: 120000,
	slidingTimeoutMs: (request.body as any)?.slidingTimeoutMs,
	useSlidingTimeout: true, // Always use sliding timeout since isInfoQuery is false
	taskIdentifier: job.id,
}
```

### Additional Logging

Add logging to track when this logic is bypassed:

```typescript
console.log(`[FastifyServer] Informational query detection bypassed - using standard execution`)
console.log(`[FastifyServer] Task will execute normally regardless of phrasing`)
```

## Definition of Done

- [ ] Code changes implemented and tested
- [ ] Original failing test case passes
- [ ] No regressions in existing functionality
- [ ] Documentation updated to reflect changes
- [ ] Logging provides clear debugging information

## Testing Plan

### Manual Testing

1. Run the original failing command:
    ```bash
    ./api-client.js --stream --mode ticket-oracle "what is your current mode"
    ```
2. Verify the task executes normally and provides an LLM response
3. Test with other question formats:
    - "how do I..."
    - "what should I..."
    - "where can I..."
4. Test with different modes to ensure mode parameter works

### Regression Testing

1. Test normal non-question tasks
2. Test streaming functionality
3. Test error handling
4. Test timeout behavior

## Risk Assessment

- **Low Risk**: This change removes problematic logic rather than adding new complexity
- **High Confidence**: Matches the proven behavior of the VS Code extension
- **Easy Rollback**: Simple to revert if issues arise

## Dependencies

None - this is a self-contained fix.

## Estimated Effort

1-2 hours including testing and verification.
