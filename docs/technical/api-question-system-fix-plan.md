# API Question System Fix Plan

## Problem Analysis Complete

### Root Cause Identified

The issue is a **fundamental architectural flaw** in runtime detection. Instead of explicit runtime identification, the system uses fragile heuristics that fail in API mode.

### Current Broken Flow

1. **Task Constructor** receives `outputAdapter` parameter (line 608 in Task.ts)
2. **initializeUnifiedQuestionManager()** ignores this and tries to detect context via `this.messaging?.getOutputAdapter()`
3. **API Mode Detection Fails** because `this.messaging` doesn't exist in API mode
4. **Defaults to CLI Mode** which isn't implemented (`QuestionSystemFactory.ts:57`)
5. **Unified Question Manager Fails** to initialize (logs show empty error object)
6. **Fallback System Works** - question events are sent via legacy system

### Evidence from Logs

```
[TASK-DEBUG] Analyzing context - providerRef: false, messaging.outputAdapter: false
[TASK-DEBUG] No specific context detected, defaulting to CLI mode
[TASK-DEBUG] Detected question system mode: cli
[ERROR] [TASK-DEBUG] Failed to initialize unified question manager: {}
```

But later:

```
QUESTION_EVENT: {"type":"question","questionId":"q_job_md1xocvs_9b582121_1752426825711_2",...}
```

## Comprehensive Fix Strategy

### 1. Add Explicit Runtime Mode to Task Constructor

**File:** `src/core/task/Task.ts`

```typescript
interface TaskOptions {
	// ... existing options
	runtimeMode: "vscode" | "api" | "cli" // NEW: Explicit runtime identification (required)
	outputAdapter?: IOutputAdapter // Already exists but ignored in question init
}
```

### 2. Fix Task.initializeUnifiedQuestionManager()

**Replace fragile detection heuristics with explicit parameters:**

```typescript
private initializeUnifiedQuestionManager(): void {
  try {
    console.log(`[TASK-DEBUG] Starting unified question manager initialization`)

    const questionsModule = require("../../core/questions")
    const { createQuestionManager } = questionsModule

    let context: any = undefined
    let detectedMode: string = 'cli'  // fallback

    // Use explicit runtime mode instead of fragile detection
    if (this.runtimeMode === 'api' && this.outputAdapter) {
      // API mode: use the outputAdapter directly
      const sseAdapter = this.outputAdapter

      // Ensure questionManager exists
      if (!sseAdapter.questionManager) {
        const { ApiQuestionManager } = require("../../api/questions/ApiQuestionManager")
        sseAdapter.questionManager = new ApiQuestionManager()
      }

      context = {
        sseAdapter: sseAdapter,
        questionManager: sseAdapter.questionManager
      }
      detectedMode = 'api'
      console.log(`[TASK-DEBUG] Using explicit API mode with outputAdapter`)

    } else if (this.runtimeMode === 'vscode' && this.messaging) {
      // VSCode mode: use TaskMessaging
      context = this.messaging
      detectedMode = 'vscode'
      console.log(`[TASK-DEBUG] Using explicit VSCode mode with TaskMessaging`)

    } else if (this.runtimeMode === 'cli') {
      // CLI mode: implement proper CLI handling or use fallback
      context = null
      detectedMode = 'cli'
      console.log(`[TASK-DEBUG] Using explicit CLI mode`)
    } else {
      console.log(`[TASK-DEBUG] No explicit runtime mode provided, using fallback detection`)
      // Fallback to old detection only if no explicit mode provided
      // ... existing detection logic as fallback
    }

    console.log(`[TASK-DEBUG] Detected question system mode: ${detectedMode}`)

    this.unifiedQuestionManager = createQuestionManager(context, {
      mode: detectedMode,
      enableLogging: this.verbose,
      enableTimeouts: true,
      defaultTimeout: 300000
    })

    console.log(`[TASK-DEBUG] Unified question manager initialized successfully for mode: ${detectedMode}`)
  } catch (error) {
    console.error(`[TASK-DEBUG] Failed to initialize unified question manager:`, error)
    // Continue without unified question manager - fall back to legacy methods
  }
}
```

### 3. Update Task Constructor

**Store runtime mode and outputAdapter as instance variables:**

```typescript
constructor({
  // ... existing parameters
  runtimeMode,
  outputAdapter,
}: TaskOptions) {
  // ... existing initialization

  this.runtimeMode = runtimeMode  // NEW
  this.outputAdapter = outputAdapter  // Store for question manager
}
```

### 4. Update FastifyServer to Pass Explicit Runtime Mode

**File:** `src/api/server/FastifyServer.ts` around line 380

```typescript
const taskOptions: TaskOptions = {
	// ... existing options
	runtimeMode: "api", // NEW: Explicit runtime identification
	outputAdapter: sseAdapter, // Already passed but not used properly in question init
	// ... rest of options
}
```

### 5. Update Other Entry Points

**VSCode Extension:**

```typescript
// In VSCode activation
const taskOptions: TaskOptions = {
	// ... existing options
	runtimeMode: "vscode",
	// ... rest
}
```

**CLI Utility:**

```typescript
// In CLI main
const taskOptions: TaskOptions = {
	// ... existing options
	runtimeMode: "cli",
	// ... rest
}
```

## Implementation Order

1. ✅ **Analysis Complete** - Root cause identified
2. **Add `runtimeMode` to TaskOptions interface**
3. **Update Task constructor** to store runtime parameters
4. **Fix `initializeUnifiedQuestionManager()`** method
5. **Update FastifyServer** to pass explicit mode
6. **Update VSCode extension** entry point
7. **Update CLI utility** entry point
8. **Test API question flow**
9. **Test VSCode question flow**
10. **Test CLI fallback behavior**

## Benefits

- ✅ **Rock solid runtime detection** - No more guessing games
- ✅ **Explicit context passing** - Uses constructor parameters directly
- ✅ **Maintainable** - Clear separation of concerns
- ✅ **Future-proof** - Easy to add new runtime modes
- ✅ **Backwards compatible** - Fallback to old detection if no explicit mode
- ✅ **Eliminates heuristics** - Uses explicit parameters instead

## Testing Plan

### API Mode Testing

```bash
# Start API server
./run-api.sh

# Test question flow
./test-api.js --stream "Use ask_followup_question to ask me what color I prefer"
```

### Expected Result

- Unified question manager initializes successfully with mode: 'api'
- Question events are sent via SSE
- Client can answer questions and continue execution
- No more "Failed to initialize unified question manager" errors

---

**Status:** Architecture plan complete - ready for implementation
