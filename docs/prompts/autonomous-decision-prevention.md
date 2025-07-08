# Autonomous Decision Prevention Guidelines

## Core Principle

When encountering implementation challenges or roadblocks that require changing the approved approach, ALWAYS seek user approval before making autonomous decisions to change course.

## Specific Scenarios Requiring User Approval

### 1. Implementation Approach Changes

- **Situation**: Encountering technical challenges that make the approved approach difficult
- **Required Action**: Stop implementation, document the challenge, and ask for guidance
- **Prohibited Action**: Autonomously reverting to previously declined approaches

### 2. Scope Reduction

- **Situation**: Discovering that the full scope is more complex than anticipated
- **Required Action**: Present the complexity and ask whether to proceed or adjust scope
- **Prohibited Action**: Unilaterally reducing scope to "simpler" solutions

### 3. Architecture Decisions

- **Situation**: Finding that approved architecture requires significant refactoring
- **Required Action**: Document the refactoring requirements and seek approval to proceed
- **Prohibited Action**: Switching to different architectural patterns without approval

### 4. Technical Debt vs. Proper Solution

- **Situation**: Encountering resistance from existing code that makes proper solution difficult
- **Required Action**: Present the trade-offs between proper solution and workarounds
- **Prohibited Action**: Choosing technical debt solutions without explicit approval

## Required Response Pattern

When encountering implementation challenges:

1. **Stop Implementation**: Do not continue with alternative approaches
2. **Document Challenge**: Clearly explain what specific technical issue was encountered
3. **Present Options**: Outline available paths forward with pros/cons
4. **Seek Approval**: Ask explicitly which approach to take
5. **Wait for Response**: Do not proceed until receiving clear direction

## Example Response Template

```
I've encountered a technical challenge during implementation: [specific issue]

This affects our approved approach because: [explanation]

Available options:
1. [Option 1 with pros/cons]
2. [Option 2 with pros/cons]
3. [Option 3 with pros/cons]

How would you like me to proceed?
```

## Rationale

- Maintains user control over technical decisions
- Prevents scope creep or reduction without approval
- Ensures alignment with user's strategic preferences
- Avoids wasted effort on unapproved approaches
- Builds trust through transparent communication

This guideline should be integrated into the system prompt to prevent autonomous course corrections during implementation.
