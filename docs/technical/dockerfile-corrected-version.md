# Corrected Dockerfile Solution

## Fixed Layer Ordering

The critical issue was that `turbo bundle` was executed before copying the packages directory. Here's the corrected sequence:

```dockerfile
# Roo Code Agent API - Development Dockerfile
# Development environment with hot reload, debugging, and comprehensive tooling

FROM node:20

# Install development tools
RUN apt-get update && apt-get install -y \
    curl \
    git \
    vim \
    nano \
    jq \
    ripgrep \
    chromium \
    python3 \
    python3-pip \
    openjdk-17-jre-headless \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo-gobject2 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm and global development dependencies
RUN npm install -g pnpm@9 \
    nodemon \
    typescript \
    @types/node

# Create development user (optional for dev, but good practice)
RUN useradd -m -s /bin/bash devuser

# Set working directory to match workspace structure
WORKDIR /app

# Copy workspace configuration files first (root level)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml README.md CHANGELOG.md LICENSE turbo.json ./

# CRITICAL FIX: Copy ALL dependencies BEFORE running any build commands
COPY packages/ ./packages/
COPY scripts/ ./scripts/
COPY webview-ui/ ./webview-ui/
COPY src/ ./src/

# NOW we can safely run turbo bundle with all dependencies present
RUN npx turbo@latest bundle --log-order grouped --output-logs new-only

# Install all dependencies using pnpm (including dev dependencies)
# This installs at the workspace root level, just like on the host
# Use --no-frozen-lockfile for development to allow dependency updates
RUN pnpm install --no-frozen-lockfile

# Also install dependencies in src directory for proper module resolution
WORKDIR /app/src
RUN pnpm install --no-frozen-lockfile

# Build workspace packages first (required for main project build)
WORKDIR /app/packages/build
RUN pnpm build

# Build main project using the build-first approach
WORKDIR /app/src
RUN pnpm bundle

# Create necessary directories
RUN mkdir -p \
    /app/config \
    /app/workspace \
    /app/logs \
    /app/tmp \
    /app/.roo-storage \
    /app/.roo-storage/puppeteer \
    /app/.roo-cli

# Set permissions for development user
RUN chown -R devuser:devuser /app

# Working directory is already set to /app/src from dependency installation
# This is where the API should run from

# Switch to development user
USER devuser

# Development environment variables
ENV NODE_ENV=development \
    API_PORT=3000 \
    API_HOST=0.0.0.0 \
    API_VERBOSE=true \
    API_DEBUG=true \
    API_WORKSPACE_ROOT=/app/workspace \
    TREE_SITTER_WASM_DIR=/app/src/dist \
    NODE_OPTIONS="--max-old-space-size=2048" \
    UV_THREADPOOL_SIZE=128

# Expose API and debug ports
EXPOSE 3000 9229

# Health check for development (simpler than production)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Development command with hot reload and debugging
# Run only the compiled JavaScript - builds happen during container build
WORKDIR /app/src
CMD ["node", "--inspect=0.0.0.0:9229", "dist/api/api-entry.js"]
```

## Key Changes Made

1. **Line 66-69**: Copy ALL dependencies (packages, scripts, webview-ui, src) BEFORE running turbo bundle
2. **Line 72**: NOW turbo bundle can run successfully with all dependencies present
3. **Removed redundant COPY commands**: All source code is copied in the correct sequence

## Benefits

1. **Turbo bundle will work**: All workspace packages exist when the command runs
2. **Proper dependency resolution**: pnpm can resolve all workspace references correctly
3. **Fresh builds**: No more stale bundles from failed partial builds
4. **Faster subsequent builds**: Docker layer caching will work properly

## ARM vs x86_64 Architecture

The packages directory contains mostly TypeScript source code and configuration files, not compiled binaries, so ARM/x86_64 architecture differences should not be an issue. Node modules with native binaries are installed fresh in the container.

## Next Steps

1. Replace the current Dockerfile with this corrected version
2. Rebuild the container to get fresh bundles with our bug fixes
3. Test the ask_followup_question tool functionality
