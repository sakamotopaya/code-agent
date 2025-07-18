# Critical Dockerfile Issue Discovery

## Problem Identified

The Docker build is failing due to incorrect layer ordering in `docker/development/Dockerfile`. The turbo bundle command is executed before the packages directory is copied into the container.

## Current Problematic Sequence

```dockerfile
# Line 71: Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml README.md CHANGELOG.md LICENSE turbo.json ./

# Line 73: RUN TURBO BUNDLE - BUT PACKAGES DON'T EXIST YET!
RUN npx turbo@latest bundle --log-order grouped --output-logs new-only

# Line 76: Copy packages - TOO LATE!
COPY packages/ ./packages/
```

## Root Cause Analysis

1. **Turbo Command Failure**: The `turbo bundle` command on line 73 fails because it tries to process packages that don't exist in the container yet
2. **Layer Ordering**: Docker builds in sequence - packages must be copied BEFORE any build commands that depend on them
3. **Silent Failure**: The build may continue with stale/incomplete bundles, causing runtime errors
4. **Architecture Mismatch**: Secondary issue - if packages contain compiled binaries from ARM host, they may not work in x86_64 container

## Impact

- All subsequent build steps operate on incomplete/missing package data
- API bundle compilation fails or produces stale artifacts
- Runtime errors like the `ask_followup_question` tool failure occur due to missing/outdated code
- Container may run with completely outdated bundles from previous builds

## Solution Required

Fix the Dockerfile layer ordering to copy packages BEFORE running any build commands that depend on them.

## Technical Details

- **File**: `docker/development/Dockerfile`
- **Lines**: 73-76 need reordering
- **Command**: `turbo bundle` requires workspace packages to exist
- **Dependencies**: All subsequent builds depend on this initial bundle step

## Priority

**CRITICAL** - This issue affects all API functionality and explains the persistent deployment problems we've been troubleshooting.
