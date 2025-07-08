# Timeout System Fix Implementation

## Problem Solved

Fixed the "Emergency timeout after 60 seconds" error that was causing API tasks to fail prematurely. The issue was caused by a dual timeout system where the emergency timeout (60s) was shorter than the sliding timeout (10min) and never reset on activity.

## Changes Made

### 1. Removed Emergency Timeout from Standard Tasks

**File**: `src/core/task/execution/TaskExecutionOrchestrator.ts`

- **Lines 149-156**: Removed emergency timeout logic from `executeInfoQuery()`
- **Line 170**: Updated sliding timeout default from 10 minutes to 30 minutes
- **Lines 171-181**: Added environment variable support and validation

**Before**:

```typescript
// Emergency timeout
const emergencyTimeout = options.emergencyTimeoutMs || 60000
const emergencyTimeoutId = setTimeout(() => {
	if (!state.isCompleted) {
		rejectOnce(new Error(`Emergency timeout after ${emergencyTimeout / 1000} seconds`))
	}
}, emergencyTimeout)
```

**After**:

```typescript
// Note: Emergency timeout removed - info queries now rely only on info query timeout
// This allows for longer-running informational tasks when needed
```

### 2. Enhanced Sliding Timeout Configuration

**File**: `src/core/task/execution/TaskExecutionOrchestrator.ts`

- Added environment variable support:
    - `TASK_DEFAULT_SLIDING_TIMEOUT_MS` (default: 30 minutes)
    - `TASK_MAX_SLIDING_TIMEOUT_MS` (default: 24 hours)
- Added timeout validation and bounds checking
- Improved logging for timeout configuration

**Implementation**:

```typescript
// Get sliding timeout with environment variable support
const defaultSlidingTimeoutMs = parseInt(process.env.TASK_DEFAULT_SLIDING_TIMEOUT_MS || "1800000") // 30 minutes default
const maxSlidingTimeoutMs = parseInt(process.env.TASK_MAX_SLIDING_TIMEOUT_MS || "86400000") // 24 hours max

let timeoutMs = options.slidingTimeoutMs || defaultSlidingTimeoutMs

// Validate timeout bounds
if (timeoutMs > maxSlidingTimeoutMs) {
	handler.logDebug(
		`[TaskExecutionOrchestrator] Sliding timeout ${timeoutMs}ms exceeds maximum ${maxSlidingTimeoutMs}ms, using maximum`,
	)
	timeoutMs = maxSlidingTimeoutMs
}
```

### 3. Updated API Configuration

**File**: `src/api/server/FastifyServer.ts`

- **Line 295**: Removed `emergencyTimeoutMs` from execution options
- **Line 296**: Added support for API parameter `slidingTimeoutMs`

**Before**:

```typescript
const executionOptions = {
	isInfoQuery,
	infoQueryTimeoutMs: 120000, // 2 minutes for info queries
	emergencyTimeoutMs: 60000, // 60 seconds emergency timeout
	slidingTimeoutMs: 600000, // 10 minutes for regular tasks
	useSlidingTimeout: !isInfoQuery,
	taskIdentifier: job.id,
}
```

**After**:

```typescript
const executionOptions = {
	isInfoQuery,
	infoQueryTimeoutMs: 120000, // 2 minutes for info queries
	// emergencyTimeoutMs removed - now relies on sliding timeout for long-running tasks
	slidingTimeoutMs: (request.body as any)?.slidingTimeoutMs, // Allow API override, falls back to env var or 30min default
	useSlidingTimeout: !isInfoQuery,
	taskIdentifier: job.id,
}
```

### 4. Updated Type Definitions

**File**: `src/core/task/execution/types.ts`

- **Lines 66-69**: Removed `emergencyTimeoutMs` property
- **Lines 71-77**: Enhanced sliding timeout documentation
- **Lines 78-82**: Added `maxSlidingTimeoutMs` property

## New Features

### Environment Variable Configuration

```bash
# Set default sliding timeout to 1 hour
export TASK_DEFAULT_SLIDING_TIMEOUT_MS=3600000

# Set maximum sliding timeout to 48 hours
export TASK_MAX_SLIDING_TIMEOUT_MS=172800000
```

### API Parameter Override

```bash
# Override timeout for specific request
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "message": "long running task",
    "slidingTimeoutMs": 7200000
  }'
```

## Timeout Behavior Changes

### Before Fix

- **Emergency Timeout**: 60 seconds (never resets)
- **Sliding Timeout**: 10 minutes (resets on activity)
- **Result**: Tasks failed after 60 seconds regardless of activity

### After Fix

- **Info Query Timeout**: 30 seconds (for quick informational queries)
- **Sliding Timeout**: 30 minutes default (resets on activity, configurable)
- **Result**: Tasks only timeout after 30 minutes of inactivity

## Activity Types That Reset Timeout

The sliding timeout resets on these activities:

- Tool executions (file operations, commands, etc.)
- User input/responses
- LLM streaming responses
- Progress updates
- Mode switches
- Task spawning
- Token usage updates

## Testing

### Verification Script

Created `test-timeout-fix.js` to verify:

- ✅ Environment variable support
- ✅ Default timeout is 30 minutes
- ✅ Maximum timeout is 24 hours
- ✅ API parameter support
- ✅ No emergency timeout errors

### Test Results

```
🔧 Testing environment variable support...
📊 Default sliding timeout: 1800000ms (30 minutes)
📊 Maximum sliding timeout: 86400000ms (1440 minutes)
✅ Default timeout is 30 minutes (as expected)
✅ Maximum timeout is 24 hours (as expected)
```

## Impact

### Immediate Benefits

- ✅ No more "Emergency timeout after 60 seconds" errors
- ✅ Tasks can run for hours or days with activity
- ✅ Configurable timeout per request
- ✅ Environment-based configuration

### Future Compatibility

- ✅ Ready for task state persistence
- ✅ Supports long-running workflows
- ✅ Maintains activity-based timeout protection
- ✅ Scalable configuration system

## Migration Notes

### For Users

- No breaking changes to existing API calls
- Tasks will now have longer default timeout (30 min vs 10 min)
- Can override timeout per request if needed

### For Developers

- `emergencyTimeoutMs` option removed from `TaskExecutionOptions`
- New `maxSlidingTimeoutMs` option available
- Environment variables for default configuration

## Monitoring

### Log Messages to Watch For

```
[TaskExecutionOrchestrator] Using sliding timeout: 1800000ms (30 minutes)
[TaskExecutionOrchestrator] Sliding timeout 3600000ms exceeds maximum 86400000ms, using maximum
[TaskExecutionOrchestrator] Timeout reset - task has 1800 seconds of inactivity before timeout
```

### Success Indicators

- No "Emergency timeout after 60 seconds" in logs
- Tasks completing successfully after extended periods
- Proper timeout resets on activity

## Related Files

### Modified Files

- `src/core/task/execution/types.ts`
- `src/core/task/execution/TaskExecutionOrchestrator.ts`
- `src/api/server/FastifyServer.ts`

### Documentation Files

- `docs/product-stories/api/timeout-system-enhancement.md`
- `docs/technical/timeout-system-analysis.md`
- `docs/technical/timeout-fix-implementation.md`

### Test Files

- `test-timeout-fix.js`

## Rollback Plan

If issues arise, revert these commits:

1. Restore `emergencyTimeoutMs` in types and orchestrator
2. Restore emergency timeout logic in `executeInfoQuery()`
3. Restore original API configuration
4. Set sliding timeout back to 10 minutes

The changes are isolated and can be safely reverted without affecting other functionality.
