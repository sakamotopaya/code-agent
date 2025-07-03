# Development Prompt for Code Agent

**Project Overview:**

This is a VS Code extension that can also run as a CLI utility and API server. All code paths must support three use cases:

1. VS Code extension
2. CLI utility
3. API endpoint

When adding features or fixing issues, use interfaces and adapters to handle different contexts rather than reimplementing core functionality.

**Code Organization:**

- Refactor files that reach 300-500 lines into smaller units, adhering to SOLID principles.
- Use interfaces and dependency injection to support multiple execution contexts (extension, CLI, API)
- Core business logic should be context-agnostic
- Platform-specific implementations should use adapter patterns

**Project Structure:**

- `src/` - Main source code
    - `src/api/` - API server implementation
    - `src/cli/` - CLI utility implementation
    - `src/activate/` - VS Code extension activation
    - `src/shared/` - Shared utilities and interfaces
- `webview-ui/` - VS Code extension webview UI
- `packages/` - Shared packages
- `evals/` - Evaluation framework
- `docs/` - Documentation
- `examples/` - Usage examples

**Logging and Error Handling:**

- Ensure robust logging and error handling in all generated code
- Use structured logging with appropriate log levels
- Context-specific loggers:
    - Extension: Use VS Code output channels
    - CLI: Use console with appropriate formatting
    - API: Use structured JSON logging
- When you encounter `console.log/error/etc.`, replace with our logger patterns
- Logger implementations should be context-aware via interfaces

**API References:**

- MCP (Model Context Protocol) integration: `src/shared/mcp/`
- Tool system: `src/shared/tools/`
- Provider patterns: `src/api/providers/`

**Development:**

- Test both CLI and API during development:
    - CLI: `cd src && npm run start:cli --silent -- --config ~/.agentz/agent-config.json --batch "test command" --verbose`
    - API: `./run-api.sh` (from project root)
    - API testing: `./test-api.js --stream "test message"` (from project root)
- Always ensure all execution contexts work before declaring a task complete
- Run relevant tests for changed code paths

**UI Development (VS Code Extension):**

- Webview UI is located in `webview-ui/`
- Use Tailwind CSS classes instead of inline style objects for new markup
- VSCode CSS variables must be added to `webview-ui/src/index.css` before using them in Tailwind classes
- Example: `<div className="text-md text-vscode-descriptionForeground mb-2" />` instead of style objects
- Theme-aware styling is required for all UI components
- Use the VSCode webview messaging system for communication between extension and webview
- Follow VSCode extension UI guidelines and patterns

**CLI Development:**

- CLI implementation in `src/cli/`
- Support batch mode and interactive mode
- Configuration via JSON files
- Verbose logging options
- Progress indicators for long-running operations
- Error handling with appropriate exit codes

**API Development:**

- REST API implementation in `src/api/`
- Support for streaming responses (SSE)
- Structured logging with request IDs
- Health check endpoints
- Proper HTTP status codes and error responses
- Rate limiting and security considerations

**Context Abstraction:**

- When code needs different behavior per context:
    - Define interfaces for the behavior
    - Implement context-specific adapters
    - Inject appropriate implementation based on runtime context
- Examples:
    - UI interactions: Extension uses webview, CLI uses console, API uses HTTP responses
    - File operations: Extension uses VS Code APIs, CLI/API use Node.js fs
    - Configuration: Extension uses VS Code settings, CLI/API use config files

**Testing:**

- Generate or edit unit tests for new code where applicable
- Test Framework: Jest
- Test all execution contexts when relevant
- Integration tests for MCP server functionality
- E2E tests for CLI workflows
- API endpoint testing
- Extension activation and webview communication testing
- Mock external dependencies appropriately

**Documentation:**

- Write technical documentation for code changes and save in `docs/technical/`
- Update user documentation for any changes impacting users:
    - CLI: `docs/cli/`
    - API: Update API documentation
    - Extension: VS Code marketplace documentation
- Document configuration changes in `docs/configuration/`
- Update examples in `examples/` when adding new features

**Settings and Configuration:**

- Follow the pattern in `docs/settings.md` for adding new settings
- Support configuration in all three contexts:
    - Extension: VS Code settings
    - CLI: Configuration files (JSON)
    - API: Environment variables and config files
- Ensure settings are properly validated and have sensible defaults

**MCP Integration:**

- All MCP server functionality must work across all contexts
- Use the shared MCP client implementation
- Handle MCP server lifecycle properly in each context
- Ensure tool execution works in extension, CLI, and API modes

**Additional Guidelines:**

- you often run commands to change paths without checking the path you are in. It would be better to change paths using abaolute paths.
- Never remove application logic without explicit approval
- When fixing issues, repair the code rather than removing functionality
- Maintain backward compatibility where possible
- Use TypeScript strictly with proper type definitions
- Follow existing code patterns and conventions
- Ensure proper error boundaries and graceful degradation
