# Fix .agentz Path Resolution Issue

## Problem Description

The `~/.agentz` path is being incorrectly resolved to `/Users/eo/code/code-agent/~/.agentz` instead of the correct `/Users/eo/.agentz`. This occurs because tilde (`~`) expansion is not being properly handled in all contexts.

## Root Cause Analysis

### Incorrect Path Resolution

- **Expected**: `~/.agentz` → `/Users/eo/.agentz`
- **Actual**: `~/.agentz` → `/Users/eo/code/code-agent/~/.agentz`

### Files Affected

#### 1. Documentation Files (Immediate Fix Needed)

**Files**: [`docs/product-stories/add-sample-mcp-server.md`](docs/product-stories/add-sample-mcp-server.md), [`docs/product-stories/mcp-server-enhancement.md`](docs/product-stories/mcp-server-enhancement.md)

**Issues Found**:

- Line 4: `~/.agentz/mcp-config.json`
- Line 9: `~/.agentz/mcp-config.json`
- Line 39: `~/.agentz/mcp-config.json`
- Line 215: `~/.agentz/mcp-config.json`
- Line 72: `~/.agentz/mcp-config.json`
- Line 222: `~/.agentz/mcp-config.json`
- Line 290: `~/.agentz/mcp-config.json`

#### 2. Source Code Files (Review Needed)

**Correctly Using Path Resolution**:

- [`src/cli/services/CLIMcpService.ts:365`](src/cli/services/CLIMcpService.ts:365) ✅
    ```typescript
    return path.join(os.homedir(), ".agentz", MCP_CONFIG_FILENAME)
    ```
- [`src/cli/config/CliConfigManager.ts:117`](src/cli/config/CliConfigManager.ts:117) ✅
    ```typescript
    userConfigDir: path.join(os.homedir(), ".agentz")
    ```

**Potentially Problematic**:

- [`src/cli/types/storage-types.ts:47`](src/cli/types/storage-types.ts:47) ⚠️
    ```typescript
    sessionDirectory: "~/.agentz" // String literal, not resolved
    ```

## Correction Plan

### Phase 1: Fix Documentation (Immediate)

**Files to Update**:

1. `docs/product-stories/add-sample-mcp-server.md`
2. `docs/product-stories/mcp-server-enhancement.md`

**Changes**:
Replace all instances of `~/.agentz/mcp-config.json` with `/Users/eo/.agentz/mcp-config.json`

### Phase 2: Review Source Code Path Handling

#### File: `src/cli/types/storage-types.ts`

**Current**:

```typescript
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
	sessionDirectory: "~/.agentz",  // ⚠️ String literal
	compressionLevel: 6,
	...
}
```

**Recommended**:

```typescript
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
	sessionDirectory: path.join(os.homedir(), ".agentz"),  // ✅ Properly resolved
	compressionLevel: 6,
	...
}
```

#### Files Already Correctly Implemented ✅

- `src/cli/services/CLIMcpService.ts` - Uses `path.join(os.homedir(), ".agentz", ...)`
- `src/cli/config/CliConfigManager.ts` - Uses `path.join(os.homedir(), ".agentz")`
- `src/cli/commands/batch.ts` - Uses environment variable fallback correctly

### Phase 3: Verify Path Resolution in CLI Commands

**Test Commands**:

```bash
# Verify config path resolution
roo mcp config show
# Expected output should show: /Users/eo/.agentz/mcp-config.json

# Verify file creation
roo mcp config init
# Should create file at: /Users/eo/.agentz/mcp-config.json
```

## Specific File Corrections

### Documentation Corrections

#### `docs/product-stories/add-sample-mcp-server.md`

**Lines to Change**:

- Line 4: `~/.agentz/mcp-config.json` → `/Users/eo/.agentz/mcp-config.json`
- Line 9: `~/.agentz/mcp-config.json` → `/Users/eo/.agentz/mcp-config.json`
- Line 39: `~/.agentz/mcp-config.json` → `/Users/eo/.agentz/mcp-config.json`
- Line 215: `~/.agentz/mcp-config.json` → `/Users/eo/.agentz/mcp-config.json`

#### `docs/product-stories/mcp-server-enhancement.md`

**Lines to Change**:

- Line 72: `~/.agentz/mcp-config.json` → `/Users/eo/.agentz/mcp-config.json`
- Line 222: `~/.agentz/mcp-config.json` → `/Users/eo/.agentz/mcp-config.json`
- Line 290: `~/.agentz/mcp-config.json` → `/Users/eo/.agentz/mcp-config.json`

### Code Review Priorities

#### High Priority ⚠️

1. **`src/cli/types/storage-types.ts:47`** - Replace string literal with proper path resolution
2. **Verify CLI command path resolution** - Ensure all commands use resolved paths

#### Medium Priority

1. **Update any hardcoded paths in tests** that might be affected
2. **Review environment variable handling** for path expansion

#### Low Priority

1. **Add path validation** to ensure `.agentz` directory exists before operations
2. **Improve error messages** to show resolved paths for better debugging

## Testing Strategy

### Unit Tests

```typescript
// Test path resolution
expect(getConfigPath()).toBe("/Users/eo/.agentz/mcp-config.json")
expect(getConfigPath()).not.toContain("~")
```

### Integration Tests

```bash
# Test CLI path resolution
roo mcp config init --verbose  # Should show resolved paths
ls -la /Users/eo/.agentz/       # Verify file creation location
```

### Manual Verification

1. Delete any incorrectly created directories: `rm -rf "/Users/eo/code/code-agent/~"`
2. Run CLI commands and verify files are created in `/Users/eo/.agentz/`
3. Confirm VSCode shows correct file paths

## Root Cause Prevention

### Code Standards

1. **Always use `path.join(os.homedir(), ".agentz", ...)` for .agentz paths**
2. **Never use string literals like `"~/.agentz"`** in configuration defaults
3. **Add linting rules** to catch hardcoded tilde paths

### Documentation Standards

1. **Use resolved absolute paths** in documentation examples
2. **Avoid tilde notation** in file path references
3. **Include user-specific paths** where applicable (e.g., `/Users/eo/.agentz/`)

## Success Criteria

- [ ] All documentation shows correct paths: `/Users/eo/.agentz/mcp-config.json`
- [ ] CLI commands create files in `/Users/eo/.agentz/`
- [ ] No files created in `/Users/eo/code/code-agent/~/`
- [ ] All path resolution uses `os.homedir()` + `path.join()`
- [ ] Tests verify correct path resolution
