# Unified Question System - API Client Question Blocking

## Story Overview

**Title**: Create Unified Question System Across All Runtime Modes

**Priority**: High

**Story Points**: 13

**Epic**: Architecture Unification

## Problem Statement

Currently, the three runtime modes (VSCode Extension, API, CLI) use different question handling systems, leading to:

- API mode `ask_followup_question` not blocking properly
- Inconsistent behavior across modes
- Duplicated question handling logic
- Difficult maintenance and testing

## User Story

**As a** user of the AI agent in any mode (VSCode, API, or CLI)
**I want** questions to behave consistently and block execution properly
**So that** I have a predictable, reliable interactive experience regardless of how I access the AI

## Vision

Create a unified question system where all three runtime modes use identical core logic, with only the presentation, answer collection, and storage mechanisms abstracted behind interfaces.

## Architecture Goals

1. **Consistency**: All modes use identical question handling logic
2. **Preservation**: All existing functionality remains unchanged
3. **Extensibility**: Easy to add new runtime modes
4. **Maintainability**: Changes to question logic only need to be made once
5. **Testability**: Each component can be tested independently

## Acceptance Criteria

### Must Have

- [ ] Unified question system with core interfaces (IQuestionPresenter, IAnswerCollector, IQuestionStore)
- [ ] VSCode extension behavior remains completely unchanged
- [ ] API mode `ask_followup_question` blocks execution properly
- [ ] All question types work consistently across modes (askQuestion, askConfirmation, askInput)
- [ ] Zero breaking changes to existing APIs
- [ ] Comprehensive test coverage for all modes

### Should Have

- [ ] CLI mode question handling (if CLI mode exists)
- [ ] Error handling consistency across modes
- [ ] Timeout handling works correctly in all modes
- [ ] Question cancellation works in all modes
- [ ] Performance maintained or improved

### Could Have

- [ ] Question analytics and metrics
- [ ] Advanced question formatting options
- [ ] Question history tracking
- [ ] Concurrent question handling optimization

## Technical Architecture

### Core Components

#### 1. Unified Question Manager

```typescript
class UnifiedQuestionManager {
  constructor(
    private presenter: IQuestionPresenter,
    private collector: IAnswerCollector,
    private store: IQuestionStore
  )
}
```

#### 2. Runtime-Specific Implementations

- **VSCode Mode**: Adapters that wrap existing TaskMessaging system
- **API Mode**: Adapters that wrap existing SSEOutputAdapter/ApiQuestionManager
- **CLI Mode**: New implementations for command-line interaction

#### 3. Interface Abstractions

- **IQuestionPresenter**: How questions are displayed to users
- **IAnswerCollector**: How answers are collected and blocking is handled
- **IQuestionStore**: How questions are stored during their lifecycle

### Migration Strategy

1. **Phase 1**: Create unified interfaces and core manager
2. **Phase 2**: Implement VSCode adapters (preserve existing behavior)
3. **Phase 3**: Implement API adapters (fix blocking issue)
4. **Phase 4**: Integrate with Task system
5. **Phase 5**: CLI implementation (if needed)

## Definition of Done

- [ ] All interfaces and core UnifiedQuestionManager implemented
- [ ] VSCode adapters implemented with zero behavior changes
- [ ] API adapters implemented with proper blocking
- [ ] Task system updated to use unified manager
- [ ] All existing tests continue to pass
- [ ] New tests for unified system achieve >90% coverage
- [ ] Integration tests for all modes pass
- [ ] API blocking verified through manual testing
- [ ] Performance benchmarks show no regression
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] Deployed to staging and production

## Risk Assessment

### Technical Risks

- **Medium**: Complexity of maintaining backward compatibility
- **Low**: Performance impact of additional abstraction layers
- **Low**: Integration complexity with existing systems

### Business Risks

- **High**: Any regression in VSCode extension functionality
- **Medium**: Increased development time due to architectural scope
- **Low**: Temporary instability during migration

### Mitigation Strategies

- Comprehensive adapter testing to ensure zero regression
- Phase-by-phase implementation with validation at each step
- Feature flags for gradual rollout
- Rollback plan for each phase
- Extensive manual testing of all modes

## Implementation Notes

### Preservation Strategy

- All existing code remains functional
- Adapters wrap existing systems without modification
- No changes to existing public APIs
- Existing tests continue to pass unchanged

### Testing Strategy

- Unit tests for each interface implementation
- Integration tests for unified manager
- Regression tests for existing functionality
- End-to-end tests for question blocking
- Performance tests for all modes

## Success Metrics

### Functional Metrics

- 100% of questions block properly in API mode
- 0% regression in VSCode extension functionality
- 0% regression in existing API functionality
- 100% test coverage for new unified system
- <100ms overhead for question processing

### Quality Metrics

- Code duplication reduced by >80% for question handling
- Bug reports related to question handling reduced by >90%
- Development velocity increased for question-related features
- Time to add new runtime modes reduced by >70%

## Dependencies

### Blocked By

- None (this is foundational architecture work)

### Blocks

- Future interactive features
- CLI mode enhancements
- Advanced question formatting
- Question analytics implementation

## Timeline

- **Phase 1** (Interfaces & Core): 3-4 days
- **Phase 2** (VSCode Adapters): 2-3 days
- **Phase 3** (API Adapters): 2-3 days
- **Phase 4** (Task Integration): 2-3 days
- **Phase 5** (CLI Implementation): 1-2 days
- **Testing & Validation**: 3-4 days
- **Documentation**: 1-2 days

**Total**: 14-21 days for complete implementation

## Related Work

- [Unified Question System Architecture](../technical/unified-question-system-architecture.md)
- [Original API Question Blocking Issue](../technical/api-question-blocking-issue.md)
- [SSE Data Flow Documentation](../technical/sse-data-flow.md)

## Communication Plan

### Stakeholders

- Weekly progress updates on unified system development
- Demo of working functionality in each mode
- Architecture review sessions for technical validation

### Development Team

- Daily standups during implementation
- Architecture reviews for each phase
- Comprehensive code reviews
- Pair programming for complex adapter implementations

This unified approach transforms the question blocking issue from a simple fix into a foundational architecture improvement that benefits all future development while solving the immediate problem.
