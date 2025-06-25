# VSCode Output Adapter Restoration Plan

## Current State Analysis

### What We Have ✅

1. **IOutputAdapter Interface** - The unified output interface in `src/core/interfaces/IOutputAdapter.ts`
2. **CLIOutputAdapter** - Working implementation for CLI mode in `src/core/adapters/cli/CLIOutputAdapters.ts`
3. **SSEOutputAdapter** - Working implementation for API mode in `src/api/streaming/SSEOutputAdapter.ts`
4. **Original VSCode Functionality** - Still intact as fallback in `TaskMessaging.ts:161`:
    ```typescript
    await provider?.postMessageToWebview({ type: "partialMessage", partialMessage })
    ```

### What's Missing ❌

1. **VSCodeOutputAdapter** - Implementation of `IOutputAdapter` for VSCode extension mode
2. **Integration** - Task.ts currently falls back to legacy methods instead of using VSCodeOutputAdapter

### Root Cause Analysis

The code in `src/core/task/Task.ts` lines 530-537 shows:

```typescript
// VSCode Extension mode - will implement VSCode adapter later
this.logDebug("[Task] VSCode mode detected - using legacy provider methods for now")
taskOutputAdapter = undefined // Will fall back to legacy provider methods
```

This means VSCode mode bypasses the `IOutputAdapter` system entirely and uses the fallback path.

## Original VSCode Output Logic (Still Present)

From `TaskMessaging.ts` lines 158-162:

```typescript
} else {
    // Fallback to legacy provider method
    const provider = this.providerRef?.deref()
    await provider?.postMessageToWebview({ type: "partialMessage", partialMessage })
}
```

The webview messaging system expects:

- **Message Type**: `"partialMessage"` (from `ExtensionMessage.ts`)
- **Payload**: `partialMessage: ClineMessage`
- **Delivery**: Via `ClineProvider.postMessageToWebview()`

## Implementation Plan

### Phase 1: Create VSCodeOutputAdapter

Create `src/core/adapters/vscode/VSCodeOutputAdapter.ts` that:

1. **Implements IOutputAdapter interface**
2. **Bridges to existing webview system** via `ClineProvider.postMessageToWebview()`
3. **Handles all IOutputAdapter methods**:
    - `outputFormattedContent()` - Send completed messages to webview
    - `outputPartialContent()` - Send partial updates to webview
    - `sendPartialUpdate()` - Update existing partial messages
    - `streamChunk()` - Handle real-time streaming (if supported)
    - `clearContent()` - Clear webview content
    - `reset()` - Reset webview state

### Phase 2: Map IOutputAdapter Methods to VSCode Messages

| IOutputAdapter Method      | VSCode Webview Message                                     |
| -------------------------- | ---------------------------------------------------------- |
| `outputFormattedContent()` | `{ type: "partialMessage", partialMessage: ClineMessage }` |
| `outputPartialContent()`   | `{ type: "partialMessage", partialMessage: ClineMessage }` |
| `sendPartialUpdate()`      | `{ type: "partialMessage", partialMessage: ClineMessage }` |
| `streamChunk()`            | Real-time streaming (investigate if supported)             |
| `clearContent()`           | Clear webview messages                                     |
| `reset()`                  | Reset webview state                                        |

### Phase 3: Integration Points

1. **Constructor**: Accept `ClineProvider` reference for `postMessageToWebview()`
2. **Message Building**: Convert IOutputAdapter calls to proper ClineMessage format
3. **Error Handling**: Graceful fallback if webview unavailable
4. **Lifecycle**: Properly handle webview disposal

### Phase 4: Update Task.ts

Modify `src/core/task/Task.ts` lines 530-542 to:

```typescript
if (providerRef?.deref()) {
    // VSCode Extension mode - use VSCode output adapter
    this.logDebug("[Task] VSCode mode detected - creating VSCode output adapter")
    const { VSCodeOutputAdapter } = require("../adapters/vscode/VSCodeOutputAdapter")
    const provider = providerRef.deref()
    taskOutputAdapter = new VSCodeOutputAdapter(provider)
} else if (userInterface) {
    // API mode - existing SSE adapter logic
    // ... existing code
```

## Detailed Architecture

### VSCodeOutputAdapter Class Structure

```typescript
export class VSCodeOutputAdapter implements IOutputAdapter {
	private readonly provider: ClineProvider
	private readonly logger?: ILogger

	constructor(provider: ClineProvider, logger?: ILogger) {
		this.provider = provider
		this.logger = logger
	}

	// Bridge IOutputAdapter methods to webview messaging
	async outputFormattedContent(content: ProcessedContent[]): Promise<void>
	async outputPartialContent(partialMessage: ClineMessage): Promise<void>
	async sendPartialUpdate(partialMessage: ClineMessage): Promise<void>
	async streamChunk(chunk: string): Promise<void>
	async clearContent(): Promise<void>
	async reset(): Promise<void>
}
```

### Message Flow Restoration

Before (Broken):

```
Task → outputAdapter (undefined) → fallback → provider.postMessageToWebview()
```

After (Fixed):

```
Task → VSCodeOutputAdapter → provider.postMessageToWebview()
```

## Testing Strategy

1. **Unit Tests**: Test VSCodeOutputAdapter methods
2. **Integration Tests**: Test Task → VSCodeOutputAdapter → webview flow
3. **Regression Tests**: Ensure existing VSCode functionality unchanged
4. **Comparison Tests**: Verify parity with CLI/API adapters

## Risk Mitigation

1. **Preserve Fallback**: Keep existing fallback code as safety net
2. **Gradual Migration**: Can be feature-flagged if needed
3. **Backward Compatibility**: Ensure no breaking changes to webview messages
4. **Error Handling**: Graceful degradation if adapter fails

## Success Criteria

- [ ] VSCodeOutputAdapter implements all IOutputAdapter methods
- [ ] VSCode extension output matches existing behavior
- [ ] Task.ts uses VSCodeOutputAdapter instead of fallback
- [ ] All three modes (CLI, API, VSCode) use unified IOutputAdapter pattern
- [ ] No regression in existing VSCode extension functionality
- [ ] Clean separation of concerns between core logic and output adapters

## Files to Modify

1. **NEW**: `src/core/adapters/vscode/VSCodeOutputAdapter.ts`
2. **MODIFY**: `src/core/task/Task.ts` (lines 530-542)
3. **MODIFY**: `src/core/adapters/vscode/index.ts` (export VSCodeOutputAdapter)
4. **NEW**: `src/core/adapters/vscode/__tests__/VSCodeOutputAdapter.test.ts`

This plan restores the proper architecture without losing any existing functionality.
