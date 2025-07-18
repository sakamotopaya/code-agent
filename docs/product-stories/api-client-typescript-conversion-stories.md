# API Client TypeScript Conversion - Product Stories

## Epic: Fix ReplHistoryService in API Client

**As a developer using the API client REPL mode, I want the history service to work properly so that I can access command history, search previous commands, and have a better interactive experience.**

### Background

The current `api-client.js` fails to load the ReplHistoryService due to TypeScript import issues, causing history features to be disabled in REPL mode. This conversion will fix the issue by properly integrating the tool into the TypeScript build system.

---

## Story 1: Convert API Client to TypeScript

**As a developer, I want the api-client converted to TypeScript so that it can properly import TypeScript modules and benefit from type safety.**

### Acceptance Criteria

- [ ] Create `src/tools/api-client.ts` with full TypeScript implementation
- [ ] Add comprehensive type definitions for all interfaces and options
- [ ] Import ReplHistoryService directly without ts-node workarounds
- [ ] Maintain all existing command-line options and functionality
- [ ] Add proper error handling with typed exceptions
- [ ] Include JSDoc comments for all public interfaces

### Technical Requirements

- Convert all JavaScript code to TypeScript
- Define interfaces for:
    - `ApiClientOptions`
    - `REPLSessionOptions`
    - `StreamProcessorOptions`
    - `ContentFilterOptions`
    - Command-line argument types
- Import ReplHistoryService using standard ES6 imports
- Use TypeScript strict mode compilation

### Definition of Done

- TypeScript compilation passes without errors or warnings
- All existing functionality works identically
- ReplHistoryService imports and initializes correctly
- Code follows project TypeScript conventions
- Unit tests pass (if applicable)

---

## Story 2: Create Type Definitions

**As a developer, I want comprehensive type definitions for the API client so that the code is self-documenting and type-safe.**

### Acceptance Criteria

- [ ] Create `src/tools/types/api-client-types.ts` with all necessary types
- [ ] Define interfaces for all major classes and their options
- [ ] Add union types for command-line flags and modes
- [ ] Include proper JSDoc documentation for all types
- [ ] Export types for potential reuse in other modules

### Technical Requirements

```typescript
// Example type definitions needed
interface ApiClientOptions {
	useStream: boolean
	host: string
	port: number
	mode: string
	task?: string
	restartTask: boolean
	replMode: boolean
	verbose: boolean
	showThinking: boolean
	showTools: boolean
	showSystem: boolean
	showResponse: boolean
	showCompletion: boolean
	showMcpUse: boolean
	showTokenUsage: boolean
	hideTokenUsage: boolean
	showTiming: boolean
	logSystemPrompt: boolean
	logLlm: boolean
}

interface REPLSessionOptions {
	historyService?: ReplHistoryService
	taskId?: string
	verbose: boolean
	host: string
	port: number
	mode: string
	useStream: boolean
}

type SupportedMode =
	| "code"
	| "debug"
	| "architect"
	| "ask"
	| "test"
	| "design-engineer"
	| "release-engineer"
	| "translate"
	| "product-owner"
	| "orchestrator"
```

### Definition of Done

- All types are properly defined and exported
- Types are used throughout the main implementation
- TypeScript compiler validates all type usage
- Documentation is clear and comprehensive

---

## Story 3: Integrate with Build System

**As a developer, I want the API client to be built using the existing esbuild system so that it's consistent with other project tools.**

### Acceptance Criteria

- [ ] Extend `src/esbuild.mjs` to include api-client build configuration
- [ ] Configure proper entry point and output location (`dist/tools/api-client.js`)
- [ ] Set up executable permissions and shebang for the built file
- [ ] Ensure all dependencies are properly bundled
- [ ] Add build scripts to `src/package.json`
- [ ] Test build process in both development and production modes

### Technical Requirements

- Add `apiClientConfig` to esbuild.mjs:
    ```javascript
    const apiClientConfig = {
    	...buildOptions,
    	entryPoints: ["tools/api-client.ts"],
    	outfile: "dist/tools/api-client.js",
    	banner: {
    		js: "#!/usr/bin/env node",
    	},
    	alias: {
    		vscode: path.resolve(__dirname, "cli/__mocks__/vscode.js"),
    		"@roo-code/telemetry": path.resolve(__dirname, "cli/__mocks__/@roo-code/telemetry.js"),
    	},
    	external: [
    		// Keep HTTP and other Node.js built-ins external
    	],
    	define: {
    		"process.env.VSCODE_CONTEXT": "false",
    	},
    	treeShaking: true,
    	keepNames: true,
    }
    ```
- Add to build contexts and watch/rebuild logic
- Set executable permissions on built file

### Definition of Done

- Build process completes without errors
- Built file is executable and has proper shebang
- All dependencies are correctly bundled
- Build works in both watch and production modes
- File size is reasonable (< 5MB)

---

## Story 4: Create Backward Compatible Wrapper

**As a user, I want to continue using `./api-client.js` from the root directory so that existing scripts and documentation don't break.**

### Acceptance Criteria

- [ ] Create wrapper script that maintains existing `api-client.js` interface
- [ ] Automatically detect and use built version when available
- [ ] Provide clear error messages if built version is missing
- [ ] Pass through all command-line arguments correctly
- [ ] Maintain exit codes and signal handling

### Technical Requirements

```javascript
#!/usr/bin/env node

const path = require("path")
const { spawn } = require("child_process")

// Check if built version exists
const builtClient = path.join(__dirname, "dist", "tools", "api-client.js")

try {
	require.resolve(builtClient)
	// Execute built version with all arguments
	const child = spawn("node", [builtClient, ...process.argv.slice(2)], {
		stdio: "inherit",
	})

	// Handle process signals
	process.on("SIGINT", () => child.kill("SIGINT"))
	process.on("SIGTERM", () => child.kill("SIGTERM"))

	child.on("exit", (code) => process.exit(code || 0))
} catch (error) {
	console.error("❌ Built api-client not found.")
	console.error("💡 Please run: cd src && npm run build")
	console.error("   Or: cd src && npm run build:api-client")
	process.exit(1)
}
```

### Definition of Done

- Wrapper script works identically to original
- All command-line options pass through correctly
- Error handling provides helpful guidance
- Exit codes are preserved
- Signal handling works properly

---

## Story 5: Comprehensive Testing

**As a developer, I want comprehensive tests to ensure the converted API client works correctly in all scenarios.**

### Acceptance Criteria

- [ ] Test all command-line options and combinations
- [ ] Verify REPL mode with working history service
- [ ] Test streaming and non-streaming API requests
- [ ] Validate task restart functionality
- [ ] Test error handling and edge cases
- [ ] Verify cross-platform compatibility (macOS, Linux, Windows)
- [ ] Performance testing to ensure no regression

### Test Scenarios

1. **Basic Functionality**

    - `./api-client.js --stream "test task"`
    - `./api-client.js --mode architect "plan feature"`
    - `./api-client.js --verbose --show-thinking "debug issue"`

2. **REPL Mode**

    - `./api-client.js --repl --stream`
    - History commands: `history`, `history search`, `history clear`
    - Task management: `newtask`, `exit`

3. **Task Restart**

    - `./api-client.js --stream "create app"` (get task ID)
    - `./api-client.js --stream --task <id> "add feature"`

4. **Error Handling**

    - Invalid host/port
    - Invalid mode
    - Network errors
    - Malformed responses

5. **History Service**
    - Commands are saved to history
    - History persists between sessions
    - Search functionality works
    - Statistics are accurate

### Definition of Done

- All test scenarios pass
- History service works correctly in REPL mode
- Performance is maintained or improved
- No regressions in existing functionality
- Cross-platform compatibility verified

---

## Story 6: Documentation and Migration

**As a user, I want updated documentation so that I understand any changes and can use the improved API client effectively.**

### Acceptance Criteria

- [ ] Update README with any new build requirements
- [ ] Update API client usage examples
- [ ] Document new TypeScript architecture
- [ ] Create migration guide for developers
- [ ] Update CI/CD documentation if needed
- [ ] Add troubleshooting section for common issues

### Documentation Updates

1. **README.md Updates**

    - Add build step requirement
    - Update usage examples
    - Add troubleshooting section

2. **Developer Documentation**

    - TypeScript conversion details
    - Build system integration
    - Type definitions reference

3. **User Documentation**
    - No changes to user-facing API
    - Enhanced history functionality
    - Performance improvements

### Definition of Done

- All documentation is accurate and up-to-date
- Examples work with new implementation
- Migration path is clear for developers
- Troubleshooting covers common issues

---

## Story 7: Performance Optimization and Validation

**As a user, I want the converted API client to perform as well or better than the original JavaScript version.**

### Acceptance Criteria

- [ ] Measure and compare startup time
- [ ] Validate memory usage is reasonable
- [ ] Ensure bundle size is optimized
- [ ] Test performance under load (multiple concurrent requests)
- [ ] Optimize build configuration for production use

### Performance Metrics

- **Startup Time**: < 500ms for simple commands
- **Memory Usage**: < 100MB for typical operations
- **Bundle Size**: < 5MB for built file
- **REPL Responsiveness**: < 100ms for history operations

### Optimization Techniques

- Tree shaking to remove unused code
- Proper external dependencies configuration
- Minification for production builds
- Lazy loading of heavy dependencies

### Definition of Done

- Performance meets or exceeds baseline
- Bundle size is optimized
- Memory usage is reasonable
- Load testing passes
- Production build is optimized

---

## Acceptance Criteria for Epic

### Functional Requirements

- [ ] ReplHistoryService works correctly in REPL mode
- [ ] All existing command-line options function identically
- [ ] Streaming and non-streaming modes work
- [ ] Task restart functionality is preserved
- [ ] Error handling is improved with better type safety

### Non-Functional Requirements

- [ ] Build process is integrated and reliable
- [ ] Performance is maintained or improved
- [ ] Bundle size is reasonable
- [ ] Cross-platform compatibility is maintained
- [ ] Backward compatibility is preserved

### Quality Requirements

- [ ] TypeScript compilation passes without errors
- [ ] All tests pass
- [ ] Code follows project conventions
- [ ] Documentation is complete and accurate
- [ ] No regressions in existing functionality

## Success Metrics

1. **User Experience**: History commands work in REPL mode
2. **Developer Experience**: TypeScript provides better IDE support
3. **Maintainability**: Code is more type-safe and self-documenting
4. **Performance**: No regression in startup time or memory usage
5. **Reliability**: Better error handling and type checking

## Dependencies

- Existing ReplHistoryService implementation
- esbuild configuration and build system
- TypeScript compiler and configuration
- Node.js runtime environment
- Existing API server for testing

## Risks and Mitigation

1. **Build Complexity**: Mitigated by using existing esbuild system
2. **Backward Compatibility**: Mitigated by wrapper script approach
3. **Performance Regression**: Mitigated by comprehensive testing
4. **Type Definition Complexity**: Mitigated by incremental approach

## Timeline Estimate

- **Story 1-2**: 2-3 days (TypeScript conversion and types)
- **Story 3**: 1-2 days (Build system integration)
- **Story 4**: 1 day (Wrapper script)
- **Story 5**: 2-3 days (Testing)
- **Story 6**: 1 day (Documentation)
- **Story 7**: 1-2 days (Performance optimization)

**Total**: 8-12 days for complete implementation and validation
