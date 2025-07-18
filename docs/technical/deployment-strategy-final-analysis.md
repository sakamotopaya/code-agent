# Deployment Strategy Final Analysis

## Complete Build Process Discovery

### Two Parallel Deployment Paths

#### 1. Host Build & Run (`run-api.sh`)

- **Build**: Lines 418-424: `cd src && pnpm bundle`
- **Run**: Lines 456-466: `node src/dist/api/api-entry.js`
- **Result**: Fresh bundle with all current source code changes

#### 2. Container Build & Run (`docker/development/Dockerfile`)

- **Build**: Line 102: `RUN pnpm bundle`
- **Run**: Line 144: `CMD ["node", "--inspect=0.0.0.0:9229", "dist/api/api-entry.js"]`
- **Problem**: Container build may be using stale dependencies or failing silently

## Root Cause Analysis

The ask_followup_question error occurs because:

1. **Container is running stale bundle**: Our source code fix exists but isn't in the compiled bundle
2. **Build context issue**: Container build happens with incomplete workspace dependencies
3. **Layer timing**: Dependencies and source may be out of sync during container build

## Recommended Solution Strategy

### Option 1: Fix Container Build (RECOMMENDED)

Fix the Dockerfile dependency resolution:

```dockerfile
# Fix sequence - copy ALL source and dependencies BEFORE building
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml README.md CHANGELOG.md LICENSE turbo.json ./
COPY packages/ ./packages/
COPY scripts/ ./scripts/
COPY webview-ui/ ./webview-ui/
COPY src/ ./src/

# Install dependencies with proper workspace context
RUN pnpm install --no-frozen-lockfile

# Now build can access all workspace dependencies
WORKDIR /app/src
RUN pnpm bundle
```

### Option 2: Host Build + Container Run (ALTERNATIVE)

Build on host, mount bundle into container:

```bash
# Build on host
cd src && pnpm bundle

# Mount dist into container
docker run -v $(pwd)/src/dist:/app/src/dist code-agent-api
```

## Verification Steps

### Test Current Container Status

```bash
# Check if our verification marker exists in container bundle
docker exec -it development_api_1 grep -r "TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025" /app/src/dist/

# If NOT found: Container has stale bundle
# If found: Container build is working, issue is elsewhere
```

### Test Host Build (Immediate Fix)

```bash
# Build fresh bundle on host
cd src && pnpm bundle

# Check for verification marker in host bundle
grep -r "TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025" dist/

# Run API from host
./run-api.sh

# Test ask_followup_question tool
./test-api.js --stream "Use ask_followup_question to ask me what color I prefer"
```

## Implementation Priority

1. **Immediate**: Test host build to confirm our fix works outside container
2. **Short-term**: Fix container build with proper dependency sequencing
3. **Long-term**: Ensure consistency between host and container builds

## Expected Outcomes

- ✅ Host build will work immediately with our PersistentQuestionStore.ts fix
- ✅ Container build will work after Dockerfile dependency fix
- ✅ ask_followup_question tool will function correctly in both environments

## Files Ready for Implementation

- `src/core/questions/adapters/PersistentQuestionStore.ts` - Production-ready fix
- `docs/technical/dockerfile-corrected-version.md` - Container build fix
- `docs/technical/ask-followup-question-fix-implementation.md` - Code fix details

The architecture analysis is complete and ready for implementation.
