# API Bundle Build Process Analysis

## Build Discovery

After investigating the actual build configuration, I found that the API bundle is built via **esbuild**, not turbo!

### Actual Build Process

1. **Build Script**: `src/package.json` line 359: `"bundle": "node esbuild.mjs"`
2. **esbuild Config**: `src/esbuild.mjs` lines 164-183: `apiConfig`
    - Entry point: `"api/api-entry.ts"`
    - Output: `"dist/api/api-entry.js"`
    - Uses esbuild bundling with aliases for vscode mocks
3. **Execution**: Line 230 calls `apiCtx.rebuild()` to generate the bundle

### Container Build Analysis

Looking at the Dockerfile:

- **Line 102**: `RUN pnpm bundle` - This SHOULD build the API bundle
- **Line 144**: `CMD ["node", "--inspect=0.0.0.0:9229", "dist/api/api-entry.js"]` - Runs the bundle

### Why the Container Build May Be Failing

The issue is NOT the turbo layer ordering, but potentially:

1. **Stale Dependencies**: The `pnpm install` steps may not properly resolve workspace dependencies
2. **Build Context**: The bundle command runs in `/app/src` but workspace dependencies are in `/app/packages/`
3. **Source Code Timing**: Source copied after some dependency installs, creating inconsistent state

### Verification Needed

To determine if the container is building or using stale bundles:

```bash
# Check if bundle was built in container
docker exec -it development_api_1 ls -la /app/src/dist/api/

# Check for our verification marker in the bundle
docker exec -it development_api_1 grep -r "TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025" /app/src/dist/

# Check bundle timestamp vs source timestamp
docker exec -it development_api_1 stat /app/src/dist/api/api-entry.js
docker exec -it development_api_1 stat /app/src/core/task/Task.ts
```

### Possible Solutions

1. **Pre-build Approach**: Build bundle on host, copy to container
2. **Fix Container Build**: Ensure proper dependency resolution in container
3. **Hybrid Approach**: Mount dist directory from host for development

### Root Cause Hypothesis

The container IS building the API bundle, but either:

- Build is using stale workspace dependencies
- Source code changes aren't being included properly
- The pnpm workspace resolution is failing in container context

This explains why our code fix exists in source but not in the running bundle.
