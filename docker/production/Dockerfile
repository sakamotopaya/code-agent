# Roo Code Agent API - Production Dockerfile
# Multi-stage build optimized for production deployment

# Stage 1: Build Environment
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Install pnpm
RUN npm install -g pnpm@9

# Copy workspace configuration files first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml README.md CHANGELOG.md LICENSE ./

# Copy workspace packages that are referenced
COPY packages/ ./packages/

# Copy scripts directory (needed for preinstall)
COPY scripts/ ./scripts/

# Copy webview-ui directory (needed for build process)
COPY webview-ui/ ./webview-ui/

# Copy src directory structure
COPY src/ ./src/

# Install all dependencies using pnpm (including dev dependencies for build)
# This installs at the workspace root level, just like on the host
RUN pnpm install --frozen-lockfile || pnpm install

# Also install dependencies in src directory for proper module resolution
WORKDIR /app/src
RUN pnpm install --frozen-lockfile || pnpm install

# Build workspace packages first (required for main project build)
WORKDIR /app/packages/build
RUN pnpm build

# Build main project using the build-first approach
WORKDIR /app/src
RUN pnpm bundle

# Stage 2: Production Runtime
FROM node:20-alpine AS runtime

# Install runtime dependencies and security updates (including Puppeteer dependencies)
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
    ripgrep \
    jq \
    netcat-openbsd \
    tini \
    && rm -rf /var/cache/apk/*

# Install pnpm in runtime stage
RUN npm install -g pnpm@9

# Create non-root user for security
RUN addgroup -g 1001 -S apiuser && \
    adduser -S apiuser -u 1001 -G apiuser

# Set working directory
WORKDIR /app

# Copy built application from builder stage (from correct location)
COPY --from=builder --chown=apiuser:apiuser /app/src/dist ./src/dist
COPY --from=builder --chown=apiuser:apiuser /app/src/package.json ./src/package.json
COPY --from=builder --chown=apiuser:apiuser /app/src/node_modules ./src/node_modules

# Set working directory to src for proper module resolution
WORKDIR /app/src

# Dependencies already installed in builder stage - no need to reinstall

# Copy health check script
COPY --chown=apiuser:apiuser docker/scripts/health-check.sh ../health-check.sh
RUN chmod +x ../health-check.sh

# Create necessary directories with proper permissions (including storage)
RUN mkdir -p \
    /app/config \
    /app/workspace \
    /app/logs \
    /app/tmp \
    /app/.roo-storage \
    /app/.roo-storage/puppeteer \
    /app/.roo-cli && \
    chown -R apiuser:apiuser /app

# File descriptor limits are set via docker-compose.yml ulimits section

# Switch to non-root user
USER apiuser

# Environment variables (including Puppeteer configuration)
ENV NODE_ENV=production \
    API_PORT=3000 \
    API_HOST=0.0.0.0 \
    API_WORKSPACE_ROOT=/app/workspace \
    API_VERBOSE=false \
    API_DEBUG=false \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_OPTIONS="--max-old-space-size=1024" \
    UV_THREADPOOL_SIZE=128

# Expose API port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ../health-check.sh

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application (from correct working directory)
CMD ["node", "dist/api/api-entry.js"]