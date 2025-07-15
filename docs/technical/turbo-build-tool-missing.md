# Missing Turbo Build Tool - Container Issue

## Problem Identified

The container is missing the `turbo` build tool, which prevents rebuilding the API bundle with our fixes.

## Error Evidence

```bash
devuser@ebb48047b15b:/app$ pnpm build
> roo-code@ build /app
> turbo vsix --log-order grouped --output-logs new-only

sh: 1: turbo: not found
 ELIFECYCLE  Command failed.

devuser@ebb48047b15b:/app$ pnpm bundle
> roo-code@ bundle /app
> turbo bundle --log-order grouped --output-logs new-only

sh: 1: turbo: not found
 ELIFECYCLE  Command failed.
```

## Root Cause

The development container environment is missing the `turbo` build tool dependency, preventing:

- Bundle rebuilding with latest source code changes
- Deployment of our `ask_followup_question` fix
- Normal development workflow

## Solution Options

### Option 1: Install Turbo Globally (Immediate Fix)

```bash
# In container
npm install -g turbo
# OR
pnpm install -g turbo

# Then rebuild
pnpm build
```

### Option 2: Install Turbo Locally

```bash
# In container
pnpm install turbo --save-dev

# Then rebuild
pnpm build
```

### Option 3: Use npx (No Installation)

```bash
# In container
npx turbo bundle --log-order grouped --output-logs new-only
```

### Option 4: Manual Build Alternative

If turbo is not available, look for alternative build scripts:

```bash
# Check package.json for other scripts
cat package.json | grep -A 20 '"scripts"'

# Look for direct build commands
npm run compile
npm run build:api
npm run webpack
```

## Verification Steps

After installing turbo and rebuilding:

1. **Verify Turbo Installation**:

    ```bash
    turbo --version
    ```

2. **Rebuild Bundle**:

    ```bash
    pnpm build
    # OR
    pnpm bundle
    ```

3. **Verify Fix Deployment**:

    ```bash
    grep TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025 /app/src/dist/api/api-entry.js
    ```

4. **Test Fix**:
    ```bash
    ./test-api.js --stream "Use ask_followup_question to ask me what color I prefer"
    ```

## Container Environment Issue

This reveals a broader issue with the development environment:

- Container lacks essential build tools
- Development workflow broken
- Source changes can't be deployed
- Debugging made difficult by stale bundles

## Recommendations

### Immediate

1. Install turbo using one of the options above
2. Rebuild the bundle
3. Test the fix

### Long-term

1. **Fix Dockerfile**: Ensure turbo is installed in container build
2. **Development Environment**: Include all necessary build tools
3. **Documentation**: Clear setup instructions for development
4. **CI/CD**: Automated building and deployment
5. **Health Checks**: Verify bundle freshness

## Expected Outcome

Once turbo is installed and bundle rebuilt:

- ✅ Our fix will be included in `api-entry.js`
- ✅ Verification marker will appear in bundle
- ✅ `ask_followup_question` tool will work correctly
- ✅ Development workflow restored

## Commands to Run

```bash
# Install turbo
pnpm install -g turbo

# Rebuild bundle
pnpm build

# Verify deployment
grep TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025 /app/src/dist/api/api-entry.js

# Test fix
./test-api.js --stream "Use ask_followup_question to ask me what color I prefer"
```
