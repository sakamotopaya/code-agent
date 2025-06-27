# Docker Production Build Fix - Standard Approach

## Problem Analysis

The production Docker build is failing because the runtime stage tries to install dependencies without the workspace context that's needed for the pnpm workspace setup.

## Solution: Copy Built Artifacts + Dependencies

Following standard Docker production practices, we'll copy the built application and its dependencies from the builder stage instead of trying to reinstall them.

## Changes Required

### Current Broken Approach:

```dockerfile
# Runtime stage tries to reinstall dependencies
COPY --from=builder --chown=apiuser:apiuser /app/src/dist ./src/dist
COPY --from=builder --chown=apiuser:apiuser /app/src/package.json ./src/package.json

# This fails because workspace packages aren't available
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
```

### Fixed Standard Approach:

```dockerfile
# Copy built application and dependencies from builder
COPY --from=builder --chown=apiuser:apiuser /app/src/dist ./src/dist
COPY --from=builder --chown=apiuser:apiuser /app/src/package.json ./src/package.json
COPY --from=builder --chown=apiuser:apiuser /app/src/node_modules ./src/node_modules

# Remove problematic pnpm install command
# Dependencies are already installed from builder stage
```

## Why This Works

1. **Builder stage** has full workspace context and successfully installs all dependencies
2. **Runtime stage** copies the pre-built artifacts and pre-installed dependencies
3. **No reinstallation** needed in runtime stage
4. **Standard Docker pattern** for production deployments
5. **Smaller runtime image** with only necessary files

## Benefits

- ✅ Follows Docker best practices
- ✅ Avoids workspace dependency issues
- ✅ Faster builds (no reinstallation)
- ✅ More reliable (dependencies tested in builder)
- ✅ Smaller attack surface (no build tools in runtime)

## Implementation Steps

1. Remove the `pnpm install` command from runtime stage
2. Add `COPY --from=builder /app/src/node_modules ./src/node_modules`
3. Keep the working directory structure consistent
4. Test the build process

This approach aligns with how most production Node.js Docker images are built and avoids the workspace complexity in the runtime stage.
