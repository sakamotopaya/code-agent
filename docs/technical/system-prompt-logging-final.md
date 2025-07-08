# System Prompt Logging Implementation (Final)

## CLI Parameters

**File**: `api-client.js`

Add these command line options:

```javascript
.option('--log-system-prompt', 'Log the system prompt to a file')
.option('--log-llm', 'Enable raw LLM logging (disabled by default)')
```

## Logic

- **LLM Logging**: Disabled by default, enabled with `--log-llm`
- **System Prompt Logging**: Disabled by default, enabled with `--log-system-prompt`

## Usage Examples

```bash
# Default: Both logging disabled
./api-client.js --stream "list your tools"

# Enable system prompt logging only
./api-client.js --stream "list your tools" --log-system-prompt

# Enable LLM logging only
./api-client.js --stream "list your tools" --log-llm

# Enable both
./api-client.js --stream "list your tools" --log-system-prompt --log-llm
```

## Implementation

```javascript
// In api-client.js
const requestBody = {
	task: message,
	mode: options.mode || "code",
	verbose: options.verbose || false,
	logSystemPrompt: options.logSystemPrompt || false,
	logLlm: options.logLlm || false, // false unless --log-llm is specified
}
```

This makes both logging features opt-in rather than opt-out, which is cleaner for debugging purposes.
