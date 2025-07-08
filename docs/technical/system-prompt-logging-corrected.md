# System Prompt Logging Implementation (Corrected)

## CLI Parameters

**File**: `api-client.js`

Add these command line options:

```javascript
.option('--log-system-prompt', 'Log the system prompt to a file')
.option('--no-log-llm', 'Disable raw LLM logging (enabled by default)')
```

## Logic

- **LLM Logging**: Enabled by default, can be disabled with `--no-log-llm`
- **System Prompt Logging**: Disabled by default, enabled with `--log-system-prompt`

## Usage Examples

```bash
# Default: LLM logging enabled, system prompt logging disabled
./api-client.js --stream "list your tools"

# Enable system prompt logging, keep LLM logging
./api-client.js --stream "list your tools" --log-system-prompt

# Enable system prompt logging, disable LLM logging
./api-client.js --stream "list your tools" --log-system-prompt --no-log-llm

# Just disable LLM logging
./api-client.js --stream "list your tools" --no-log-llm
```

## Implementation

```javascript
// In api-client.js
const requestBody = {
	task: message,
	mode: options.mode || "code",
	verbose: options.verbose || false,
	logSystemPrompt: options.logSystemPrompt || false,
	logLlm: !options.noLogLlm, // true unless --no-log-llm is specified
}
```

This is much cleaner - one flag for each feature, with sensible defaults.
