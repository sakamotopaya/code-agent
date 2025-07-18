# SSE Output Adapter Interface Fix

## Problem

The `SSEOutputAdapter` class currently only implements `IUserInterface`, but it's being used as an `IOutputAdapter` in the API server. This causes runtime errors when `TaskMessaging` tries to call methods like `outputPartialContent()` that exist on `IOutputAdapter` but not on `IUserInterface`.

## Root Cause

In `src/api/server/FastifyServer.ts`, line 383:

```typescript
outputAdapter: sseAdapter as any, // Pass SSE adapter for unified question manager (cast for compatibility)
```

The `as any` cast hides the type mismatch, but at runtime the missing methods cause errors.

## Solution Plan

### 1. Interface Analysis

`IOutputAdapter` requires these methods that `SSEOutputAdapter` currently lacks:

- `outputPartialContent(partialMessage: ClineMessage): Promise<void>`
- `sendPartialUpdate(partialMessage: any): Promise<void>`
- `syncState(state: any): Promise<void>`
- `notifyStateChange(changeType: string, data?: any): Promise<void>`
- `updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]>`
- `updatePersistentData(key: string, data: any): Promise<void>`
- `getPersistentData<T>(key: string): T | undefined`
- `reset(): void`
- `dispose?(): Promise<void>`

### 2. Implementation Strategy

Make `SSEOutputAdapter` implement both `IUserInterface` and `IOutputAdapter`:

```typescript
export class SSEOutputAdapter implements IUserInterface, IOutputAdapter {
	// ... existing implementation

	// Add missing IOutputAdapter methods
	async outputPartialContent(partialMessage: ClineMessage): Promise<void>
	async sendPartialUpdate(partialMessage: any): Promise<void>
	async syncState(state: any): Promise<void>
	async notifyStateChange(changeType: string, data?: any): Promise<void>
	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]>
	async updatePersistentData(key: string, data: any): Promise<void>
	getPersistentData<T>(key: string): T | undefined
	reset(): void
	dispose?(): Promise<void>
}
```

### 3. Method Implementations

- `outputPartialContent`: Map to existing streaming functionality
- `sendPartialUpdate`: Use SSE events for partial updates
- `syncState`: Emit state sync events via SSE
- `notifyStateChange`: Emit state change events via SSE
- `updateTaskHistory`: Store and emit history updates
- `updatePersistentData`/`getPersistentData`: Use in-memory storage or delegate to external service
- `reset`: Reset internal state and message buffer
- `dispose`: Clean up resources and close streams

### 4. Key Challenges

- Need to maintain backward compatibility with existing `IUserInterface` methods
- Ensure SSE streaming works correctly with new `IOutputAdapter` methods
- Handle state persistence appropriately for API context
- Maintain proper error handling and logging

### 5. Testing Requirements

- Test that `TaskMessaging.updateClineMessage` works without errors
- Verify SSE streaming continues to work for all event types
- Test state synchronization and persistence
- Ensure question/answer flow still works correctly

## Implementation Steps

1. Update `SSEOutputAdapter` class declaration to implement both interfaces
2. Add missing method implementations
3. Update `FastifyServer.ts` to remove the `as any` cast
4. Test the fix with the API server
5. Update tests to cover new functionality

## Files to Modify

- `src/api/streaming/SSEOutputAdapter.ts` (main implementation)
- `src/api/server/FastifyServer.ts` (remove cast)
- `src/api/streaming/__tests__/SSEOutputAdapter.test.ts` (add tests)
