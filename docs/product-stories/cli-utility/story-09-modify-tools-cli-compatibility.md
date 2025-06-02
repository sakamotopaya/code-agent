# Story 9: Modify Tools for CLI Compatibility

**Phase**: 3 - Tool Adaptation  
**Labels**: `cli-utility`, `phase-3`, `tools`  
**Story Points**: 21  
**Priority**: High  

## User Story
As a developer using the CLI utility, I want all existing tools to work correctly in the CLI environment, so that I have the same powerful capabilities as in the VS Code extension.

## Acceptance Criteria
- [ ] Modify all tools in `src/core/tools/` to use abstracted interfaces
- [ ] Replace VS Code UI calls with interface methods
- [ ] Ensure file operations work with CLI file system
- [ ] Update terminal operations for CLI environment
- [ ] Test all tools in CLI context

## Key Tools to Modify
- `readFileTool.ts` - Use IFileSystem interface
- `writeToFileTool.ts` - Use IFileSystem interface  
- `executeCommandTool.ts` - Use ITerminal interface
- `browserActionTool.ts` - Use IBrowser interface
- `askFollowupQuestionTool.ts` - Use IUserInterface interface
- All other tools for consistency

## Dependencies
- **Depends on**: Story 8 (Command Line Argument Parsing)

## GitHub Issue Template
```markdown
## Summary
Modify all tools to use abstracted interfaces for CLI compatibility.

Labels: cli-utility, phase-3, tools