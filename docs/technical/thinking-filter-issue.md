# Thinking Content Filter Issue

## Problem

Thinking content is showing up even when `--show-thinking` is NOT passed, which means `showThinking: false`.

## Root Cause

The server is likely sending thinking content with a `contentType` that is NOT exactly `'thinking'`.

In `ClientContentFilter.shouldShowContent()`:

```typescript
switch (contentType) {
	case "thinking":
		return this.options.showThinking // Only matches exact 'thinking'
	// ... other cases
	default:
		return true // ← BUG: Everything else shows by default!
}
```

## Evidence

User ran: `./api-client.js --stream --mode architect --repl` (NO --show-thinking flag)
Default: `showThinking: false`
Result: Thinking content still shows up

## Possible Server Issues

1. Server sends thinking with `contentType: 'thought'` instead of `'thinking'`
2. Server sends thinking with `contentType: null/undefined`
3. Server sends thinking with no `contentType` field at all
4. Server sends thinking as part of regular content without proper contentType

## The Fix

Need to either:

1. **Fix server**: Ensure thinking content has `contentType: 'thinking'`
2. **Fix client**: Change default behavior to be more restrictive
3. **Debug**: Add logging to see what contentType thinking content actually has

## Impact

This affects all content type filtering:

- `--show-thinking` doesn't work properly
- `--show-mcp-use` probably has same issue
- `--show-tools` probably has same issue
- All content shows by default instead of respecting filter flags
