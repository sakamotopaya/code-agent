# Story 001: Provider Mode Setting in API

## Objective

Ensure the API sets the provider mode correctly when a mode parameter is provided, following the same pattern as the VSCode extension.

## Background

The API currently creates a Task with the correct mode but never updates the provider's mode state. This causes the TaskApiHandler to read the default "code" mode from the provider state, resulting in incorrect metadata and environment details.

## Acceptance Criteria

- [ ] API calls provider mode setting when mode parameter is provided
- [ ] Provider state reflects the correct mode after setting
- [ ] TaskApiHandler reads correct mode from provider state
- [ ] Environment details show correct mode in LLM responses
- [ ] API without mode parameter continues to default to "code" mode
- [ ] No regression in extension mode switching functionality

## Technical Implementation

### 1. Identify Mode Setting Location

**File**: `src/api/server/FastifyServer.ts` (or equivalent task creation logic)
**Action**: Find where Task is created and provider is available

### 2. Add Provider Mode Setting

**Pattern**: Follow extension's approach in `ClineProvider.handleModeSwitch()`
**Implementation**:

```typescript
// Before starting task execution:
if (mode && mode !== "code" && provider) {
	await provider.handleModeSwitch(mode)
}
```

### 3. Error Handling

**Requirements**:

- Handle invalid mode parameters gracefully
- Fall back to default behavior if provider unavailable
- Log mode setting attempts for debugging

### 4. Validation Points

**Check**:

- Provider state contains correct mode after setting
- TaskApiHandler metadata shows correct mode
- Environment details reflect actual mode
- LLM responses indicate correct mode

## Testing Strategy

### Unit Tests

- Test mode setting with valid mode parameter
- Test fallback behavior with invalid mode
- Test default behavior without mode parameter

### Integration Tests

- Test full API flow with mode parameter
- Verify LLM response contains correct mode information
- Test extension mode switching still works

### Manual Testing

```bash
# Test with mode parameter
./api-client.js --stream --mode ticket-oracle "what is your current mode"

# Test without mode parameter
./api-client.js --stream "what is your current mode"

# Verify responses show correct mode
```

## Dependencies

- Understanding of provider mode management system
- Access to API server task creation logic
- Provider instance availability in API context

## Definition of Done

- [ ] Code implemented and reviewed
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing confirms correct mode reporting
- [ ] No regression in extension functionality
- [ ] Documentation updated

## Notes

- This follows the established extension pattern for mode management
- Maintains consistency between API and extension code paths
- Low risk change as it uses existing provider functionality
