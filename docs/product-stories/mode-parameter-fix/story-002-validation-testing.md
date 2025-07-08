# Story 002: Validation and Testing

## Objective

Ensure the mode parameter fix works correctly across all scenarios and doesn't introduce regressions in existing functionality.

## Background

After implementing provider mode setting in the API, we need comprehensive testing to validate the fix works correctly and maintains compatibility with existing extension functionality.

## Acceptance Criteria

- [ ] API with mode parameter correctly reports the specified mode
- [ ] API without mode parameter defaults to "code" mode
- [ ] Extension mode switching continues to work normally
- [ ] No performance regression in API or extension
- [ ] Error handling works for invalid mode parameters
- [ ] Automated tests cover all scenarios

## Test Scenarios

### API Mode Parameter Tests

#### Test 1: Valid Custom Mode

```bash
./test-api.js --stream --mode ticket-oracle "what is your current mode"
```

**Expected**: LLM responds with "ticket-oracle" mode information

#### Test 2: Valid Built-in Mode

```bash
./test-api.js --stream --mode architect "what is your current mode"
```

**Expected**: LLM responds with "architect" mode information

#### Test 3: No Mode Parameter

```bash
./test-api.js --stream "what is your current mode"
```

**Expected**: LLM responds with "code" mode information (default)

#### Test 4: Invalid Mode Parameter

```bash
./test-api.js --stream --mode invalid-mode "what is your current mode"
```

**Expected**: Graceful error handling or fallback to default mode

### Extension Compatibility Tests

#### Test 5: Extension Mode Switching

- Open VSCode extension
- Switch between different modes using UI dropdown
- Verify each mode switch works correctly
- Verify mode-specific tools and behavior

#### Test 6: Extension Task Creation

- Create tasks in extension with different modes
- Verify tasks execute with correct mode context
- Verify no regression in existing functionality

### Integration Tests

#### Test 7: Provider State Consistency

- Verify provider state matches Task mode after API mode setting
- Check metadata contains correct mode information
- Validate environment details reflect actual mode

#### Test 8: Custom Modes Service

- Test with custom modes from global and project configurations
- Verify custom mode definitions are properly loaded
- Test mode validation works correctly

## Performance Testing

### Baseline Measurements

- [ ] API response time without mode parameter
- [ ] API response time with mode parameter
- [ ] Extension mode switching time
- [ ] Task creation time in both contexts

### Performance Criteria

- Mode setting should add < 50ms to API response time
- No measurable impact on extension performance
- Memory usage remains stable

## Error Handling Validation

### Scenario 1: Provider Unavailable

- Test API behavior when provider is not available
- Verify graceful fallback to existing behavior
- Ensure no crashes or hanging requests

### Scenario 2: Invalid Mode

- Test with non-existent mode names
- Test with malformed mode parameters
- Verify appropriate error messages

### Scenario 3: Mode Setting Failure

- Simulate provider mode setting failure
- Verify fallback behavior
- Check error logging and reporting

## Automated Test Implementation

### Unit Tests

```typescript
describe("API Mode Parameter", () => {
	it("should set provider mode when mode parameter provided")
	it("should default to code mode when no parameter")
	it("should handle invalid mode gracefully")
	it("should maintain provider state consistency")
})
```

### Integration Tests

```typescript
describe("Mode Parameter Integration", () => {
	it("should report correct mode in LLM response")
	it("should maintain extension compatibility")
	it("should handle custom modes correctly")
})
```

## Manual Testing Checklist

### Pre-Implementation

- [ ] Document current API behavior
- [ ] Document current extension behavior
- [ ] Establish performance baselines

### Post-Implementation

- [ ] Verify all test scenarios pass
- [ ] Confirm no regression in extension
- [ ] Validate performance meets criteria
- [ ] Test error handling scenarios

### User Acceptance

- [ ] API users can specify modes correctly
- [ ] LLM responses show correct mode information
- [ ] Extension users see no changes in behavior
- [ ] Error messages are clear and helpful

## Success Metrics

### Functional

- 100% of mode parameter tests pass
- 0 regressions in extension functionality
- Correct mode reporting in 100% of API responses

### Performance

- Mode setting overhead < 50ms
- No memory leaks or performance degradation
- Response times within acceptable limits

### Quality

- All automated tests pass
- Code review approval
- Documentation updated and accurate

## Definition of Done

- [ ] All test scenarios implemented and passing
- [ ] Performance criteria met
- [ ] Error handling validated
- [ ] Extension compatibility confirmed
- [ ] Automated tests added to CI/CD
- [ ] Manual testing completed
- [ ] User acceptance criteria met
- [ ] Documentation updated

## Risk Mitigation

- Comprehensive testing before deployment
- Gradual rollout with monitoring
- Rollback plan if issues discovered
- Clear error messages for troubleshooting
