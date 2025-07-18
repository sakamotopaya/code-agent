# SSE Output Adapter Interface Fix

## Story

As a developer using the API server, I want the SSE streaming to work correctly without runtime errors when Task messaging tries to call output adapter methods.

## Problem

The `SSEOutputAdapter` class currently only implements `IUserInterface`, but it's being used as an `IOutputAdapter` in the API server. This causes the error:

```
TypeError: this.outputAdapter.outputPartialContent is not a function
```

## Requirements

### Functional Requirements

- [ ] `SSEOutputAdapter` must implement both `IUserInterface` and `IOutputAdapter` interfaces
- [ ] All `IOutputAdapter` methods must be properly implemented to work with SSE streaming
- [ ] Existing SSE streaming functionality must continue to work unchanged
- [ ] Task messaging partial updates must work without errors

### Technical Requirements

- [ ] Add missing `IOutputAdapter` methods to `SSEOutputAdapter`
- [ ] Remove the `as any` cast in `FastifyServer.ts`
- [ ] Maintain backward compatibility with existing functionality
- [ ] Ensure proper error handling and logging

## Implementation Plan

### Phase 1: Interface Implementation

1. Update `SSEOutputAdapter` class declaration to implement both interfaces
2. Add missing method implementations:
    - `outputPartialContent(partialMessage: ClineMessage): Promise<void>`
    - `sendPartialUpdate(partialMessage: any): Promise<void>`
    - `syncState(state: any): Promise<void>`
    - `notifyStateChange(changeType: string, data?: any): Promise<void>`
    - `updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]>`
    - `updatePersistentData(key: string, data: any): Promise<void>`
    - `getPersistentData<T>(key: string): T | undefined`
    - `reset(): void`
    - `dispose?(): Promise<void>`

### Phase 2: Integration

3. Update `FastifyServer.ts` to remove the `as any` cast
4. Test the fix with the API server
5. Update tests to cover new functionality

## Method Implementation Details

### `outputPartialContent(partialMessage: ClineMessage)`

- Map to existing SSE streaming functionality
- Use existing message buffer processing if enabled
- Emit appropriate SSE events for partial content

### `sendPartialUpdate(partialMessage: any)`

- Convert to SSE event format
- Use existing `emitEvent` method for transmission
- Handle different message types appropriately

### `syncState(state: any)`

- Emit state synchronization events via SSE
- Store state information for retrieval if needed
- Handle state change notifications

### `notifyStateChange(changeType: string, data?: any)`

- Emit state change events via SSE
- Include change type and data in event payload

### `updateTaskHistory(item: HistoryItem)`

- Store history items in memory or delegate to external service
- Emit history update events via SSE
- Return updated history array

### `updatePersistentData(key: string, data: any)` / `getPersistentData<T>(key: string)`

- Use in-memory storage for API context
- Consider delegating to external persistence service if needed
- Handle serialization/deserialization appropriately

### `reset()`

- Reset internal state and message buffer
- Clear any stored data
- Reset question manager state

### `dispose()`

- Clean up resources and close streams
- Cancel pending questions
- Release any held references

## Acceptance Criteria

- [ ] Task messaging works without `outputPartialContent` errors
- [ ] SSE streaming continues to work for all event types
- [ ] State synchronization works correctly
- [ ] Question/answer flow still works
- [ ] All existing tests pass
- [ ] New functionality is covered by tests

## Files to Modify

- `src/api/streaming/SSEOutputAdapter.ts` (main implementation)
- `src/api/server/FastifyServer.ts` (remove cast)
- `src/api/streaming/__tests__/SSEOutputAdapter.test.ts` (add tests)

## Definition of Done

- [ ] All required methods are implemented
- [ ] Error no longer occurs when using the API
- [ ] SSE streaming works correctly
- [ ] Tests pass
- [ ] Code review completed
- [ ] Documentation updated
