# Story 4: API Custom Modes Support

## Overview

**As an** API user  
**I want** to specify custom modes in API requests  
**So that** I can use specialized modes programmatically

## Acceptance Criteria

- [ ] `/execute` and `/execute/stream` endpoints accept `mode` parameter
- [ ] API loads custom modes during server initialization
- [ ] Defaults to "code" mode when no mode specified
- [ ] File watching enabled for hot-reloading custom modes
- [ ] Clear error responses for invalid modes
- [ ] Backward compatibility with existing API requests
- [ ] Mode parameter documented in API schema

## Technical Implementation

### Files to Modify

- `src/api/server/FastifyServer.ts` - Add UnifiedCustomModesService and mode parameter support
- `src/api/config/ApiConfigManager.ts` - Add custom modes configuration

### Current API Request Format

```json
{
	"task": "Test task from API client",
	"verbose": false
}
```

### Enhanced API Request Format

```json
{
	"task": "Create a PRD for user authentication",
	"mode": "product-owner",
	"verbose": true
}
```

### API Server Initialization

```typescript
// In FastifyServer constructor
export class FastifyServer {
	private customModesService: UnifiedCustomModesService

	constructor(config: ApiConfigManager, adapters: CoreInterfaces) {
		// ... existing initialization

		// Initialize custom modes service with file watching
		const storagePath = process.env.ROO_GLOBAL_STORAGE_PATH || getStoragePath()
		this.customModesService = new UnifiedCustomModesService({
			storagePath,
			fileWatcher: new NodeFileWatcher(), // File watching enabled for API
			enableProjectModes: false, // API typically doesn't have workspace context
		})
	}

	async initialize(): Promise<void> {
		// ... existing initialization

		// Load custom modes
		await this.customModesService.loadCustomModes()
		this.app.log.info("Custom modes loaded for API server")
	}
}
```

### Endpoint Updates

#### /execute Endpoint

```typescript
this.app.post("/execute", async (request: FastifyRequest, reply: FastifyReply) => {
	try {
		const body = request.body as any
		const task = body.task || "No task specified"
		const mode = body.mode || "code" // Default to code mode

		// Validate mode
		const selectedMode = await this.validateMode(mode)

		// Use selectedMode in task execution...
		await this.adapters.userInterface.showInformation(`Received task: ${task} (mode: ${mode})`)

		return reply.send({
			success: true,
			message: "Task received",
			task,
			mode: selectedMode.slug,
			timestamp: new Date().toISOString(),
		})
	} catch (error) {
		// Handle mode validation errors
		if (error.message.includes("Invalid mode")) {
			return reply.status(400).send({
				success: false,
				error: "Invalid mode",
				message: error.message,
				timestamp: new Date().toISOString(),
			})
		}
		// ... existing error handling
	}
})
```

#### /execute/stream Endpoint

```typescript
this.app.post("/execute/stream", async (request: FastifyRequest, reply: FastifyReply) => {
	try {
		const body = request.body as any
		const task = body.task || "No task specified"
		const mode = body.mode || "code" // Default to code mode
		const verbose = body.verbose || false

		// Validate mode exists
		const selectedMode = await this.validateMode(mode)

		// Create job with mode information
		const job = this.jobManager.createJob(task, {
			mode: selectedMode.slug,
			clientInfo: {
				userAgent: request.headers["user-agent"],
				ip: request.ip,
			},
		})

		// ... rest of streaming implementation using selectedMode
	} catch (error) {
		// Handle mode validation errors
		if (error.message.includes("Invalid mode")) {
			reply.raw.write(
				`data: ${JSON.stringify({
					type: "error",
					error: "Invalid mode",
					message: error.message,
					timestamp: new Date().toISOString(),
				})}\n\n`,
			)
			reply.raw.end()
			return
		}
		// ... existing error handling
	}
})
```

### Mode Validation Helper

```typescript
private async validateMode(mode: string): Promise<ModeConfig> {
  const allModes = await this.customModesService.getAllModes()
  const selectedMode = allModes.find(m => m.slug === mode)

  if (!selectedMode) {
    const availableModes = allModes.map(m => m.slug).join(', ')
    throw new Error(`Invalid mode: ${mode}. Available modes: ${availableModes}`)
  }

  return selectedMode
}
```

## API Response Examples

### Successful Request

```json
// Request
{
  "task": "Create a PRD for user authentication",
  "mode": "product-owner"
}

// Response
{
  "success": true,
  "message": "Task received",
  "task": "Create a PRD for user authentication",
  "mode": "product-owner",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Invalid Mode Error

```json
// Request
{
  "task": "Test task",
  "mode": "invalid-mode"
}

// Response (400 Bad Request)
{
  "success": false,
  "error": "Invalid mode",
  "message": "Invalid mode: invalid-mode. Available modes: code, debug, architect, ask, test, design-engineer, release-engineer, translate, product-owner, orchestrator, ticket-oracle",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Streaming Error Response

```
data: {"type":"error","error":"Invalid mode","message":"Invalid mode: invalid-mode. Available modes: code, debug, architect, ask, test, design-engineer, release-engineer, translate, product-owner, orchestrator, ticket-oracle","timestamp":"2024-01-15T10:30:00.000Z"}
```

## File Watching Integration

The API server will use NodeFileWatcher to monitor custom modes files for changes:

```typescript
// Custom modes files are watched automatically
// When files change, the service cache is invalidated
// Next API request will load fresh custom modes

// Log example when modes are reloaded
this.app.log.info("Custom modes reloaded due to file change")
```

## Technical Tasks

- [ ] Add UnifiedCustomModesService to FastifyServer
- [ ] Implement NodeFileWatcher for API context
- [ ] Update /execute endpoint to accept mode parameter
- [ ] Update /execute/stream endpoint to accept mode parameter
- [ ] Add mode validation helper method
- [ ] Update error handling for mode validation
- [ ] Add mode information to job creation
- [ ] Update API response schemas
- [ ] Add integration tests for mode parameter
- [ ] Test file watching functionality in API context
- [ ] Update API documentation

## Error Handling Scenarios

### Invalid Mode in Regular Endpoint

- Return 400 Bad Request with clear error message
- Include list of available modes in error response

### Invalid Mode in Streaming Endpoint

- Send error event through SSE stream
- Close connection gracefully
- Log error for debugging

### Custom Modes File Error

- Log warning about custom modes loading failure
- Fall back to built-in modes only
- Continue API operation with reduced functionality

## Testing Strategy

### Unit Tests

- [ ] Mode parameter parsing
- [ ] Mode validation logic
- [ ] Error response formatting
- [ ] File watcher integration

### Integration Tests

- [ ] API requests with built-in modes
- [ ] API requests with custom modes
- [ ] API requests with invalid modes
- [ ] File watching and hot-reloading
- [ ] Streaming endpoint with modes
- [ ] Error scenarios

### API Testing Examples

```bash
# Test with built-in mode
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{"task": "test task", "mode": "code"}'

# Test with custom mode
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{"task": "create PRD", "mode": "product-owner"}'

# Test with invalid mode
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{"task": "test task", "mode": "invalid"}'
```

## Definition of Done

- [ ] All acceptance criteria implemented
- [ ] Mode parameter accepted in both endpoints
- [ ] File watching working for hot-reloading
- [ ] Error handling comprehensive and user-friendly
- [ ] Backward compatibility maintained
- [ ] Unit tests passing with >90% coverage
- [ ] Integration tests passing
- [ ] API documentation updated
- [ ] Manual testing completed across scenarios

## Effort Estimate

**2 days**

## Priority

**High** - Core API functionality

## Dependencies

- Story 1: Core Unified Service (must be completed first)
- Story 2: File Watcher Implementations (NodeFileWatcher needed)

## Risks

- **Medium Risk**: API endpoint changes require careful backward compatibility
- **Mitigation**: Thorough testing and gradual rollout, mode parameter is optional
