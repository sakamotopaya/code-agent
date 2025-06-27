# Docker Production Configuration Update Plan

## Overview

The production Docker setup is missing critical functionality that exists in the working development configuration. This plan outlines the required updates to bring production Docker files to feature parity with development while maintaining production-appropriate security and performance settings.

## Critical Issues Identified

### 1. Storage Configuration Missing

- **Problem**: Production has no persistent storage for Puppeteer, MCP state, tasks, or CLI history
- **Impact**: API will fail when using browser automation or MCP servers
- **Solution**: Add comprehensive storage volume configuration

### 2. Build Process Issues

- **Problem**: Production Dockerfile uses incorrect build commands and structure
- **Impact**: Build failures and incorrect runtime environment
- **Solution**: Align build process with working development configuration

### 3. Missing System Dependencies

- **Problem**: Production missing Chromium, Python3, Git, ripgrep
- **Impact**: Puppeteer, MCP servers, and search functionality will fail
- **Solution**: Add all required system dependencies

### 4. Environment Variables Missing

- **Problem**: Production compose missing API keys and MCP configuration
- **Impact**: External integrations and MCP servers won't work
- **Solution**: Add all required environment variables

## Detailed Changes Required

### Production Dockerfile Updates

#### Stage 1: Builder Stage Changes

```dockerfile
# Change working directory approach to match development
WORKDIR /app

# Copy workspace configuration files (add missing files)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml README.md CHANGELOG.md LICENSE ./

# Copy ALL required directories
COPY packages/ ./packages/
COPY scripts/ ./scripts/
COPY webview-ui/ ./webview-ui/
COPY src/ ./src/

# Fix build process
WORKDIR /app
RUN pnpm install --frozen-lockfile || pnpm install

# Build workspace packages FIRST
WORKDIR /app/packages/build
RUN pnpm build

# Then build main project from correct location
WORKDIR /app/src
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm bundle
```

#### Stage 2: Runtime Stage Changes

```dockerfile
# Add missing system dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    git \
    python3 \
    py3-pip \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    tini \
    && rm -rf /var/cache/apk/*

# Add Chromium environment for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy built application from correct location
COPY --from=builder --chown=apiuser:apiuser /app/src/dist ./dist
COPY --from=builder --chown=apiuser:apiuser /app/src/package.json ./package.json

# Create storage directories
RUN mkdir -p \
    /app/config \
    /app/workspace \
    /app/logs \
    /app/tmp \
    /app/.roo-storage \
    /app/.roo-storage/puppeteer \
    /app/.roo-cli

# Set working directory to src for proper module resolution
WORKDIR /app/src

# Update CMD to run from correct location
CMD ["node", "dist/api/api-entry.js"]
```

### Production Docker Compose Updates

#### Core Storage Configuration

```yaml
volumes:
    # Global storage mounting (CRITICAL: Puppeteer, checkpoints, cache, MCP state)
    - ${ROO_STORAGE_PATH:-./storage}:/app/.roo-storage:rw

    # CLI storage mounting (session history, REPL state)
    - ${ROO_CLI_STORAGE_PATH:-./cli-storage}:/app/.roo-cli:rw

    # Configuration mounting
    - ${CONFIG_PATH:-./config}:/app/config:rw

    # Workspace mounting
    - ${WORKSPACE_PATH:-./workspace}:/app/workspace:rw

    # Logs (already exists but ensure consistency)
    - api-logs:/app/logs:rw
```

#### Environment Variables

```yaml
# Storage Configuration (CRITICAL for state persistence)
- ROO_GLOBAL_STORAGE_PATH=/app/.roo-storage
- ROO_CLI_STORAGE_PATH=/app/.roo-cli
- API_STORAGE_ROOT=/app/.roo-storage

# External API Keys (from host environment)
- ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
- OPENAI_API_KEY=${OPENAI_API_KEY}
- GITHUB_TOKEN=${GITHUB_TOKEN}
- DATABASE_URL=${DATABASE_URL}
- MSSQL_CONNECTION_STRING=${MSSQL_CONNECTION_STRING}
```

#### Resource Adjustments

```yaml
# Increase memory limits for production workloads
deploy:
    resources:
        limits:
            memory: 1G
            cpus: "2.0"
        reservations:
            memory: 512M
            cpus: "1.0"
```

## Implementation Steps

1. **Update Production Dockerfile**

    - Fix builder stage to match development structure
    - Add missing system dependencies to runtime stage
    - Correct working directories and build commands
    - Add Puppeteer environment configuration

2. **Update Production Docker Compose**

    - Add comprehensive storage volume configuration
    - Add missing environment variables for API keys and MCP
    - Adjust resource limits for production workloads
    - Ensure proper volume mounting for all storage paths

3. **Verify Configuration**
    - Test build process works correctly
    - Verify all storage directories are created and mounted
    - Test API functionality including Puppeteer and MCP servers
    - Validate health checks pass

## Production vs Development Differences

### Maintained Production Characteristics

- Multi-stage build for smaller image size
- Non-root user for security
- Alpine base image for minimal attack surface
- Resource limits and proper restart policies
- Production-appropriate timeouts and rate limits
- Proper logging configuration

### Added from Development

- Complete storage configuration
- All required system dependencies
- Proper build process and structure
- External API key support
- MCP server configuration
- Comprehensive volume mounting

## Testing Plan

1. Build production Docker image
2. Start production compose stack
3. Test API endpoints (/health, /status)
4. Test Puppeteer functionality (browser automation)
5. Test MCP server connectivity
6. Verify storage persistence across container restarts
7. Validate performance under load

## Risk Assessment

- **Low Risk**: Storage and environment variable additions
- **Medium Risk**: Dockerfile structural changes
- **Mitigation**: Thorough testing before deployment
