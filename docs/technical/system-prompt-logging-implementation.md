# System Prompt Logging Implementation Plan

## Goal

Add parameters to the API to:

1. Log the system prompt to a file (like `--log-system-prompt`)
2. Control whether raw LLM logs are created (like `--log-llm`)

## Implementation Plan

### 1. Add CLI Parameters to test-api.js

**File**: `test-api.js`

Add new command line options:

```javascript
// Add these options to the argument parser
.option('--log-system-prompt', 'Log the system prompt to a file')
.option('--log-llm', 'Enable raw LLM logging (default: true)')
.option('--no-log-llm', 'Disable raw LLM logging')
```

### 2. Modify API Request to Include Logging Flags

**File**: `test-api.js`

Update the API request payload:

```javascript
const requestBody = {
	task: message,
	mode: options.mode || "code",
	verbose: options.verbose || false,
	// ADD THESE:
	logSystemPrompt: options.logSystemPrompt || false,
	logLlm: options.logLlm !== false, // default true unless --no-log-llm
}
```

### 3. Update API Server to Handle Logging Flags

**File**: `src/api/server/FastifyServer.ts`

Add logging parameters to the request schema and handler:

```typescript
// In the request schema
const requestSchema = {
	type: "object",
	properties: {
		task: { type: "string" },
		mode: { type: "string" },
		verbose: { type: "boolean" },
		// ADD THESE:
		logSystemPrompt: { type: "boolean" },
		logLlm: { type: "boolean" },
	},
	required: ["task"],
}

// In the handler
const { task, mode, verbose, logSystemPrompt, logLlm } = request.body
```

### 4. Add System Prompt Logging to Task Creation

**File**: `src/core/prompts/system.ts` or wherever system prompt is generated

Add logging when system prompt is created:

```typescript
export async function SYSTEM_PROMPT(/* parameters */) {
    // ... existing system prompt generation ...

    const systemPrompt = `${roleDefinition}

${baseInstructions}

${toolDescriptions}

${/* other sections */}`

    // ADD SYSTEM PROMPT LOGGING:
    if (options?.logSystemPrompt) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `system-prompt-${timestamp}.txt`
        const logPath = path.join(process.cwd(), 'logs', filename)

        try {
            await fs.mkdir(path.dirname(logPath), { recursive: true })
            await fs.writeFile(logPath, systemPrompt, 'utf-8')
            console.log(`System prompt logged to: ${logPath}`)
        } catch (error) {
            console.error('Failed to log system prompt:', error)
        }
    }

    return systemPrompt
}
```

### 5. Update Task Creation to Pass Logging Options

**File**: `src/core/task/Task.ts` or wherever Task is created

Pass logging options through the chain:

```typescript
// When creating system prompt
const systemPrompt = await SYSTEM_PROMPT({
	// ... existing parameters ...
	logSystemPrompt: options.logSystemPrompt,
	logLlm: options.logLlm,
})
```

### 6. Control Raw LLM Logging

**File**: Wherever raw LLM logs are currently written

Add conditional logging based on the `logLlm` flag:

```typescript
// Only write raw LLM logs if enabled
if (options.logLlm) {
	// ... existing raw LLM logging code ...
}
```

## Usage Examples

After implementation, you could use:

```bash
# Log system prompt only
./test-api.js --stream "list your tools" --log-system-prompt

# Log system prompt and disable LLM logging
./test-api.js --stream "list your tools" --log-system-prompt --no-log-llm

# Just disable LLM logging
./test-api.js --stream "list your tools" --no-log-llm

# Log both (default behavior for LLM logging)
./test-api.js --stream "list your tools" --log-system-prompt --log-llm
```

## Expected Output

With `--log-system-prompt`, you'd get a file like:

```
logs/system-prompt-2025-01-05T14-30-45-123Z.txt
```

Containing the complete system prompt sent to the LLM, including the tools section where we can verify if `list_modes` appears.

## Implementation Priority

1. **High Priority**: Add `--log-system-prompt` flag and logging
2. **Medium Priority**: Add `--log-llm` / `--no-log-llm` control
3. **Low Priority**: Clean up log file naming and organization

This will give us direct visibility into what the LLM actually receives in its system prompt.
