# Story 5: test-api.js Script Enhancement

## Overview

**As a** developer testing the API  
**I want** to specify modes in the test script  
**So that** I can easily test different mode behaviors

## Acceptance Criteria

- [ ] `--mode` parameter added to test script
- [ ] Mode parameter included in API request payload
- [ ] Help documentation updated with mode examples
- [ ] Default to "code" mode if not specified
- [ ] Error handling for invalid modes
- [ ] Examples in help text show custom mode usage

## Technical Implementation

### Current test-api.js Usage

```bash
./test-api.js --stream "Test task"
./test-api.js --verbose --stream "List MCP servers"
```

### Enhanced test-api.js Usage

```bash
# Built-in modes
./test-api.js --stream --mode code "Fix this bug"
./test-api.js --stream --mode architect "Plan this feature"

# Custom modes
./test-api.js --stream --mode product-owner "Create a PRD for user auth"
./test-api.js --stream --mode ticket-oracle "What's the status of ticket 12345?"

# Default mode (code)
./test-api.js --stream "Test task" # Uses code mode by default
```

### Code Changes

#### Argument Parsing

```javascript
// Add mode variable
let mode = "code" // Default mode

// In argument parsing loop
for (let i = 0; i < args.length; i++) {
	const arg = args[i]

	if (arg === "--stream") {
		useStream = true
	} else if (arg === "--mode") {
		mode = args[++i] || "code"
	} else if (arg === "--host") {
		host = args[++i] || host
	}
	// ... existing argument parsing
}
```

#### Help Text Updates

```javascript
if (showHelp) {
	console.log(`
🧪 Roo Code Agent API Test Client

Usage: node test-api.js [options] "Your task here"

Options:
  --mode           Agent mode (default: code)
                   Built-in: code, debug, architect, ask, test, design-engineer, 
                            release-engineer, translate, product-owner, orchestrator
                   Custom modes loaded from server storage
  --stream         Test SSE streaming endpoint (default: false)
  --verbose        Show full JSON payload (default: false)
  --show-thinking  Show thinking sections in LLM output (default: false)
  --show-tools     Show tool call content (default: false)
  --show-system    Show system content (default: false)
  --host           API host (default: localhost)
  --port           API port (default: 3000)
  --help           Show this help

Examples:
  # Built-in modes
  node test-api.js --stream --mode code "Fix this bug"
  node test-api.js --stream --mode architect "Plan this feature"
  
  # Custom modes (if configured on server)
  node test-api.js --stream --mode product-owner "Create a PRD for user auth"
  node test-api.js --stream --mode ticket-oracle "Check ticket status"
  
  # Default mode
  node test-api.js --stream "Test task" # Uses code mode
  
  # Other examples
  node test-api.js --verbose --stream --mode debug "Debug this issue"
  node test-api.js --host api.example.com --port 8080 --mode ask "Explain this"
`)
	process.exit(0)
}
```

#### Request Payload Updates

```javascript
// Update verbose logging
if (verbose) {
  console.log(`🚀 Testing Roo Code Agent API at ${baseUrl}`)
  console.log(`📝 Task: "${task}"`)
  console.log(`🎭 Mode: ${mode}`)
  console.log(`🌊 Streaming: ${useStream ? "enabled" : "disabled"}`)
  // ... existing verbose output
}

// Update regular execute endpoint
async function testExecuteEndpoint() {
  try {
    const payload = JSON.stringify({
      task,
      mode // Add mode to payload
    })

    // ... rest of function unchanged
  }
}

// Update streaming endpoint
function testStreamingEndpoint() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      task,
      mode, // Add mode to payload
      verbose
    })

    // ... rest of function unchanged
  })
}
```

#### Error Handling for Invalid Modes

```javascript
// In streaming endpoint response handling
if (data.type === "error" && data.error === "Invalid mode") {
	console.log(`❌ Invalid mode '${mode}': ${data.message}`)
	console.log(`💡 Tip: Check available modes on the server or use a built-in mode`)
	res.destroy()
	return
}
```

## Usage Examples

### Testing Built-in Modes

```bash
# Test all built-in modes
./test-api.js --stream --mode code "Write a hello world function"
./test-api.js --stream --mode debug "Help me debug this error"
./test-api.js --stream --mode architect "Design a user authentication system"
./test-api.js --stream --mode ask "What is dependency injection?"
./test-api.js --stream --mode test "Write tests for this function"
```

### Testing Custom Modes

```bash
# Test custom modes (assuming they exist on server)
./test-api.js --stream --mode product-owner "Create a PRD for mobile app"
./test-api.js --stream --mode ticket-oracle "What's the status of ticket 12345?"
./test-api.js --stream --mode design-engineer "Create a component library"
```

### Error Scenarios

```bash
# Invalid mode
./test-api.js --stream --mode invalid-mode "test task"
# Output: ❌ Invalid mode 'invalid-mode': Invalid mode: invalid-mode. Available modes: code, debug, architect, ask, test, design-engineer, release-engineer, translate, product-owner, orchestrator

# Server not running
./test-api.js --stream --mode code "test task"
# Output: ❌ Failed: connect ECONNREFUSED 127.0.0.1:3000
```

## Testing Strategy

### Manual Testing Scenarios

- [ ] Test with built-in modes
- [ ] Test with custom modes (if available)
- [ ] Test with invalid modes
- [ ] Test default mode behavior (no --mode specified)
- [ ] Test help text display
- [ ] Test verbose output includes mode
- [ ] Test both streaming and non-streaming endpoints

### Test Cases

```bash
# Basic functionality
./test-api.js --mode code "test task"
./test-api.js --stream --mode architect "test task"

# Default behavior
./test-api.js "test task" # Should use code mode

# Error handling
./test-api.js --mode invalid "test task"

# Help text
./test-api.js --help

# Verbose output
./test-api.js --verbose --mode debug "test task"
```

## Technical Tasks

- [ ] Add mode parameter to argument parsing
- [ ] Update help text with mode examples
- [ ] Add mode to request payloads
- [ ] Update verbose logging to show mode
- [ ] Add error handling for invalid modes
- [ ] Test with various mode configurations
- [ ] Verify backward compatibility (no --mode specified)
- [ ] Update script documentation

## Backward Compatibility

The script maintains full backward compatibility:

- Existing commands work unchanged
- Mode parameter is optional
- Default mode is "code" (existing behavior)
- All existing parameters and functionality preserved

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Mode parameter working in both streaming and non-streaming
- [ ] Help text updated with clear examples
- [ ] Error handling for invalid modes
- [ ] Backward compatibility verified
- [ ] Manual testing completed
- [ ] Documentation updated

## Effort Estimate

**0.5 days**

## Priority

**Medium** - Developer tooling enhancement

## Dependencies

- Story 4: API Custom Modes Support (API must accept mode parameter first)

## Risks

- **Low Risk**: Simple script enhancement with clear requirements
- **Mitigation**: Thorough testing and maintaining backward compatibility
