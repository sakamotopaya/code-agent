# System Prompt Debugging for list_modes Tool

## Goal

Capture the actual system prompt sent to the LLM to verify if `list_modes` is included in the tools section.

## Method 1: Add Logging to System Prompt Generation

### File to Modify: `src/core/prompts/system.ts`

Add logging to see the generated system prompt:

```typescript
// Around line 74 where getToolDescriptionsForMode is called
const toolDescriptions = getToolDescriptionsForMode(
	mode,
	cwd,
	supportsComputerUse,
	codeIndexManager,
	diffStrategy,
	browserViewportSize,
	mcpHub,
	customModes,
	experiments,
	partialReadsEnabled,
	settings,
)

// ADD THIS LOGGING:
console.log("=== SYSTEM PROMPT TOOLS DEBUG ===")
console.log("Mode:", mode)
console.log("Tool descriptions length:", toolDescriptions.length)
console.log("Tools section:", toolDescriptions)
console.log("=== END TOOLS DEBUG ===")
```

### File to Modify: `src/core/prompts/tools/index.ts`

Add logging to the `getToolDescriptionsForMode` function:

```typescript
// Around line 76 where tools Set is created
const tools = new Set<string>()

// Add tools from mode's groups
config.groups.forEach((groupEntry) => {
	// existing code...
})

// Add always available tools
ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

// ADD THIS LOGGING:
console.log("=== TOOL GENERATION DEBUG ===")
console.log("Mode:", mode)
console.log("Mode config groups:", config.groups)
console.log("All tools in set:", Array.from(tools))
console.log("ALWAYS_AVAILABLE_TOOLS:", ALWAYS_AVAILABLE_TOOLS)
console.log("Tools set includes list_modes:", tools.has("list_modes"))
console.log("=== END TOOL GENERATION DEBUG ===")

// Map tool descriptions for allowed tools
const descriptions = Array.from(tools).map((toolName) => {
	const descriptionFn = toolDescriptionMap[toolName]
	if (!descriptionFn) {
		console.log("WARNING: No description function for tool:", toolName)
		return undefined
	}

	const description = descriptionFn({
		...args,
		toolOptions: undefined,
	})

	if (!description) {
		console.log("WARNING: Description function returned undefined for tool:", toolName)
	}

	return description
})

console.log("=== DESCRIPTION GENERATION DEBUG ===")
console.log("Descriptions generated:", descriptions.filter(Boolean).length)
console.log("Descriptions with undefined:", descriptions.filter((d) => !d).length)
console.log("=== END DESCRIPTION GENERATION DEBUG ===")
```

## Method 2: Container Commands to Check System Prompt

### 1. Check if getListModesDescription function exists and works:

```bash
# In container, test the description function
node -e "
try {
  const { getListModesDescription } = require('./src/core/prompts/tools/list-modes.ts');
  console.log('Function exists:', typeof getListModesDescription);
  console.log('Description:', getListModesDescription({}));
} catch (e) {
  console.log('Error:', e.message);
}
"
```

### 2. Check if the tool is in the toolDescriptionMap:

```bash
# Check the mapping in index.ts
cat src/core/prompts/tools/index.ts | grep -A 3 -B 3 "list_modes.*getListModesDescription"
```

### 3. Test the getToolDescriptionsForMode function:

```bash
# Create a test script to check tool generation
cat > test-tools.js << 'EOF'
const { getToolDescriptionsForMode } = require('./src/core/prompts/tools/index.ts');

try {
  const result = getToolDescriptionsForMode(
    'code', // mode
    '/app', // cwd
    false, // supportsComputerUse
    undefined, // codeIndexManager
    undefined, // diffStrategy
    undefined, // browserViewportSize
    undefined, // mcpHub
    undefined, // customModes
    {}, // experiments
    false, // partialReadsEnabled
    {} // settings
  );

  console.log('=== TOOL DESCRIPTIONS RESULT ===');
  console.log('Length:', result.length);
  console.log('Contains list_modes:', result.includes('list_modes'));
  console.log('Contains switch_mode:', result.includes('switch_mode'));
  console.log('Full result:');
  console.log(result);
} catch (e) {
  console.log('Error:', e.message);
  console.log('Stack:', e.stack);
}
EOF

node test-tools.js
```

## Method 3: API Request Logging

### Add logging to capture the actual API request:

In `src/api/server/FastifyServer.ts` or wherever the system prompt is sent to the LLM, add:

```typescript
// Before sending to LLM
console.log("=== FULL SYSTEM PROMPT ===")
console.log(systemPrompt)
console.log("=== END SYSTEM PROMPT ===")
```

## Expected Results

If `list_modes` is working correctly, you should see:

1. `list_modes` in the tools Set
2. A valid description generated for `list_modes`
3. `list_modes` appearing in the final system prompt tools section

## Quick Test Commands

Run these in the container to quickly check:

```bash
# 1. Check if description function works
node -e "console.log(require('./src/core/prompts/tools/list-modes.ts').getListModesDescription({}))"

# 2. Check if it's in the tool map
grep -n "list_modes.*getListModesDescription" src/core/prompts/tools/index.ts

# 3. Check ALWAYS_AVAILABLE_TOOLS again
grep -A 10 "ALWAYS_AVAILABLE_TOOLS" src/shared/tools.ts
```

The key is to trace the exact path from `ALWAYS_AVAILABLE_TOOLS` → tool set → description generation → final system prompt.
