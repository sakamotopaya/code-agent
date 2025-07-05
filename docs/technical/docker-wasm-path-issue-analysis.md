# Docker WASM Path Issue Analysis

## Problem Summary

The Docker build is failing with the error:

```
[2025-07-04T23:55:19.809Z] [ERROR] failed to asynchronously prepare wasm: Error: ENOENT: no such file or directory, open '/app/src/dist/api/tree-sitter.wasm'
```

The system is looking for WASM files in `/app/src/dist/api/` but they're actually located in `/app/src/dist/`.

## Root Cause Analysis

### Build Structure

The esbuild configuration creates three different entry points:

- **Extension**: `dist/extension.js` (VSCode extension)
- **CLI**: `dist/cli/index.js` (CLI utility)
- **API**: `dist/api/api-entry.js` (API server)

### WASM File Location

All WASM files are copied to `dist/` root directory by the `copyWasms` function in `packages/build/src/esbuild.ts`:

- `tree-sitter.wasm` → `dist/tree-sitter.wasm`
- Language-specific WASM files → `dist/tree-sitter-{language}.wasm`

### Hardcoded Context Detection Logic

The `src/services/tree-sitter/languageParser.ts` contains brittle logic:

```typescript
const isCliContext = __dirname.endsWith("/cli") || __dirname.endsWith("\\cli")
const wasmDir = isCliContext
	? path.join(__dirname, "..") // CLI: go up one level from dist/cli/ to dist/
	: __dirname // VSCode extension: use dist/ directly
```

### The Missing Case

When running the API in Docker:

- `__dirname` = `/app/src/dist/api`
- The code assumes it's in VSCode extension context (not CLI)
- So it looks for WASM files in `/app/src/dist/api/` instead of `/app/src/dist/`

## Why This Logic Exists (But Shouldn't)

This hardcoded logic was created because:

- VSCode extension runs from `dist/` where WASM files are located
- CLI runs from `dist/cli/` but needs WASM files from `dist/`
- **But it never accounted for API running from `dist/api/`**

This is a classic example of hardcoded assumptions that break when new execution contexts are added.

## Impact

- Docker API deployment fails to start
- Tree-sitter functionality (code parsing, syntax highlighting) is broken in API context
- Affects all language parsing features in the API

## Proposed Solutions

### Option 1: Environment Variable Override (Recommended)

Add `TREE_SITTER_WASM_DIR` environment variable support:

```typescript
function getWasmDirectory(): string {
	// Allow explicit override via environment variable
	if (process.env.TREE_SITTER_WASM_DIR) {
		return process.env.TREE_SITTER_WASM_DIR
	}

	// Improved context detection logic...
}
```

**Pros:**

- Quick fix for Docker deployment
- Explicit configuration
- Backward compatible
- Follows 12-factor app principles

**Cons:**

- Still requires some hardcoded logic as fallback

### Option 2: Intelligent Directory Traversal

Replace hardcoded logic with directory traversal:

```typescript
function findWasmDirectory(): string {
	let currentDir = __dirname

	while (currentDir !== path.dirname(currentDir)) {
		const wasmPath = path.join(currentDir, "tree-sitter.wasm")
		if (fs.existsSync(wasmPath)) {
			return currentDir
		}
		currentDir = path.dirname(currentDir)
	}

	throw new Error("Could not find tree-sitter.wasm in any parent directory")
}
```

**Pros:**

- No hardcoded assumptions
- Works for any directory structure
- Self-discovering

**Cons:**

- File system operations at runtime
- Potential performance impact

### Option 3: Copy WASM Files to All Subdirectories

Modify build process to copy WASM files to both `dist/api/` and `dist/cli/`:

**Pros:**

- No code changes needed
- Simple build fix

**Cons:**

- Duplicates files
- Increases bundle size
- Doesn't address the root architectural issue

## Recommended Implementation Plan

### Phase 1: Quick Fix (Environment Variable)

1. Add environment variable support to `languageParser.ts`
2. Update Docker configuration to set `TREE_SITTER_WASM_DIR=/app/src/dist`
3. Test Docker deployment

### Phase 2: Architectural Improvement

1. Replace hardcoded context detection with intelligent directory traversal
2. Add comprehensive tests for all execution contexts
3. Update documentation

### Phase 3: Build Process Review

1. Evaluate whether WASM files should be centralized or distributed
2. Consider webpack/esbuild asset handling improvements
3. Standardize asset path resolution across the codebase

## Files to Modify

1. `src/services/tree-sitter/languageParser.ts` - Add environment variable support
2. `docker/development/Dockerfile` - Add TREE_SITTER_WASM_DIR environment variable
3. `docker/production/Dockerfile` - Add TREE_SITTER_WASM_DIR environment variable
4. Documentation updates

## Testing Strategy

1. **Unit Tests**: Test WASM directory resolution logic
2. **Integration Tests**: Test tree-sitter functionality in all contexts
3. **Docker Tests**: Verify API starts successfully in container
4. **E2E Tests**: Test code parsing functionality through API endpoints

## Related Issues

This issue highlights a broader architectural concern: the codebase has context-specific assumptions baked into shared modules. Consider:

- Standardizing asset path resolution
- Using dependency injection for context-specific configurations
- Implementing a proper configuration management system
