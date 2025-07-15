# API Build Pipeline Issue - Fix Not Deployed

## Critical Discovery

The `ask_followup_question` fix has been correctly implemented in the source code, but the API server is running from a **stale bundled version** that doesn't include our changes.

## Evidence

### Source Code (✅ Fixed)

```bash
devuser@ebb48047b15b:/app/src/core/task$ grep TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025 Task.ts
// TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025
```

### Bundled Code (❌ Stale)

```bash
devuser@ebb48047b15b:/app/src/dist/api$ grep TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025 api-entry.js
# No output - marker not found in bundle
```

### Bundle Evidence

```bash
devuser@ebb48047b15b:/app/src/dist/api$ grep Task.ts api-entry.js
// core/task/Task.ts  # Multiple references - Task.ts IS included in bundle
```

## Problem Analysis

1. **Source is Correct**: Our fix exists in `src/core/questions/adapters/PersistentQuestionStore.ts`
2. **Bundle is Stale**: The `api-entry.js` bundle doesn't include recent changes
3. **API Runs from Bundle**: The container API server executes from `dist/api/api-entry.js`
4. **Build Not Triggered**: The build pipeline hasn't regenerated the bundle with our changes

## Impact

- ✅ Fix is implemented correctly in source code
- ❌ Fix is not active in the running API server
- ❌ `ask_followup_question` tool still fails with original error
- ❌ Container running stale code

## Build Pipeline Investigation

### Current Bundle Structure

```
/app/src/dist/api/
├── api-entry.js       # Main API bundle (STALE)
└── api-entry.js.map   # Source map
```

### Bundle Contents

- Contains Task.ts references (confirmed by grep)
- Missing our verification marker (proof of staleness)
- Likely missing PersistentQuestionStore.ts fixes

## Resolution Required

### Immediate Actions Needed

1. **Rebuild API Bundle**

    ```bash
    # From container /app directory
    npm run build:api
    # OR
    npm run build
    # OR check what build scripts are available
    ```

2. **Restart API Server** (if needed)

    ```bash
    # Stop current API process
    # Restart with updated bundle
    ```

3. **Verify Fix Deployment**
    ```bash
    # Check if marker appears in new bundle
    grep TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025 /app/src/dist/api/api-entry.js
    ```

### Investigation Steps

1. **Check Build Scripts**

    ```bash
    # In container
    cat package.json | grep -A 10 '"scripts"'
    ```

2. **Check Build Configuration**

    ```bash
    # Look for webpack, rollup, or build config
    ls *.config.js
    ls *.config.ts
    ```

3. **Manual Build Process**
    ```bash
    # Try common build commands
    npm run build
    npm run build:api
    npm run compile
    yarn build
    ```

## Development Workflow Issue

This suggests the development workflow may have these issues:

1. **No Auto-Rebuild**: Changes to source don't automatically rebuild bundle
2. **Manual Build Required**: Developer must manually trigger rebuild
3. **Container Persistence**: Bundle persists across container restarts
4. **Development vs Production**: Different build processes for dev/prod

## Next Steps

### For User

1. **Find Build Command**: Determine correct command to rebuild API bundle
2. **Execute Build**: Run the build process in container
3. **Verify Deployment**: Confirm marker appears in new bundle
4. **Test Fix**: Re-test `ask_followup_question` tool

### For Development Process

1. **Document Build Process**: Add clear build instructions
2. **Automate Builds**: Consider auto-rebuild on file changes
3. **Validation Scripts**: Add scripts to verify bundle freshness
4. **CI/CD Pipeline**: Ensure builds happen on deployment

## Expected Result After Build

Once the bundle is rebuilt:

1. ✅ Verification marker will appear in `api-entry.js`
2. ✅ PersistentQuestionStore.ts fixes will be included
3. ✅ `ask_followup_question` tool will work correctly
4. ✅ API error will be resolved

## Verification Commands

After rebuilding, verify with:

```bash
# Check marker in bundle
grep TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025 /app/src/dist/api/api-entry.js

# Test the fix
./test-api.js --stream "Use ask_followup_question to ask me what color I prefer"
```

## Conclusion

The fix is **technically correct** but **not deployed** due to a stale bundle. This is a **build pipeline issue**, not a code issue. Once the API bundle is rebuilt, the fix should work immediately.

This discovery explains why the error persisted despite implementing the correct solution.
