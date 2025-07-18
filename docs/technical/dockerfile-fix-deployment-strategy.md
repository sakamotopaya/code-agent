# Dockerfile Fix Deployment Strategy

## Executive Summary

We have identified the root cause of all API build and runtime issues: **critical layer ordering problem in the Dockerfile**. The `turbo bundle` command runs before the packages directory is copied, causing all subsequent builds to fail or use stale artifacts.

## Root Cause Analysis Complete

### Original Problem Chain

1. **Dockerfile Layer Issue**: `turbo bundle` runs on line 73, but `packages/` copied on line 76
2. **Build Failure**: Turbo fails because workspace packages don't exist yet
3. **Stale Bundles**: Container runs with incomplete/outdated `dist/api/api-entry.js`
4. **Runtime Errors**: Missing code changes (like our `ask_followup_question` fix) cause runtime failures

### Evidence

- `docs/technical/dockerfile-critical-issue-discovery.md` - Root cause analysis
- `docs/technical/dockerfile-corrected-version.md` - Complete corrected Dockerfile
- Previous analysis shows our code fix in `PersistentQuestionStore.ts` is correct but not deployed

## Implementation Steps

### Step 1: Apply Dockerfile Fix

Replace lines 71-86 in `docker/development/Dockerfile` with this corrected sequence:

```dockerfile
# Copy workspace configuration files first (root level)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml README.md CHANGELOG.md LICENSE turbo.json ./

# CRITICAL FIX: Copy ALL dependencies BEFORE running any build commands
COPY packages/ ./packages/
COPY scripts/ ./scripts/
COPY webview-ui/ ./webview-ui/
COPY src/ ./src/

# NOW we can safely run turbo bundle with all dependencies present
RUN npx turbo@latest bundle --log-order grouped --output-logs new-only
```

### Step 2: Rebuild Container

```bash
# Force rebuild without cache to ensure fresh build
docker-compose -f docker/development/docker-compose.yml build --no-cache api

# Or if using docker directly:
docker build --no-cache -f docker/development/Dockerfile -t code-agent-api .
```

### Step 3: Verify Fix Deployment

```bash
# Start the API
docker-compose -f docker/development/docker-compose.yml up api

# In another terminal, test for our verification marker
docker exec -it development_api_1 grep -r "TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025" /app/src/dist/

# Expected output: Should find the marker in the compiled bundle
```

### Step 4: Test ask_followup_question Tool

```bash
# Test the specific functionality that was broken
./test-api.js --stream "Use ask_followup_question to ask me what color I prefer"

# Expected behavior:
# 1. Question should display with options
# 2. User can select answer
# 3. NO "Cannot read properties of undefined (reading 'answer')" error
# 4. Tool should complete successfully
```

## Expected Outcomes

### Immediate Results

- ✅ Turbo bundle command succeeds during Docker build
- ✅ Fresh compilation of all source code including our fixes
- ✅ Verification marker appears in compiled bundle
- ✅ `ask_followup_question` tool works without errors

### Long-term Benefits

- ✅ Proper Docker layer caching for faster subsequent builds
- ✅ Reliable deployment pipeline
- ✅ All future code changes deploy correctly to container

## Verification Checklist

- [ ] Dockerfile edited with corrected layer ordering
- [ ] Container rebuilt with `--no-cache` flag
- [ ] Verification marker found in compiled bundle
- [ ] `ask_followup_question` tool test passes
- [ ] No "Cannot read properties of undefined" errors in API logs
- [ ] API health check returns 200 OK

## Risk Assessment

**Risk Level**: LOW

- Changes are to build process only, not runtime logic
- Our code fix in `PersistentQuestionStore.ts` is already tested and safe
- Dockerfile changes follow Docker best practices
- Can rollback by reverting Dockerfile if needed

## Rollback Plan

If issues occur:

1. Revert Dockerfile to original state
2. Rebuild container
3. Container will be in previous (broken) state but stable

## Technical Files Reference

| File                                                         | Purpose                       | Status      |
| ------------------------------------------------------------ | ----------------------------- | ----------- |
| `docs/technical/ask-followup-question-fix-implementation.md` | Our production-ready code fix | ✅ Complete |
| `docs/technical/dockerfile-critical-issue-discovery.md`      | Root cause analysis           | ✅ Complete |
| `docs/technical/dockerfile-corrected-version.md`             | Complete fixed Dockerfile     | ✅ Complete |
| `src/core/questions/adapters/PersistentQuestionStore.ts`     | Fixed code (not yet deployed) | ✅ Ready    |

## Next Steps for Implementation

1. **Switch to Code Mode**: To actually apply the Dockerfile changes
2. **Execute Deployment**: Follow the steps above
3. **Validate Success**: Run verification tests
4. **Document Results**: Update this strategy with actual outcomes

This completes the architect phase analysis and planning. The solution is ready for implementation.
