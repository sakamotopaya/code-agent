# Docker API Implementation Plan - Technical Architecture

## Overview

This document provides the detailed technical implementation plan for containerizing the Roo Code Agent API, supporting both production deployment and development workflows while maintaining the application's three-mode architecture (VSCode extension, CLI utility, API endpoint).

## Current Architecture Analysis

### Existing Implementation

The current API implementation consists of:

```typescript
// Entry Point: src/api/api-entry.ts
export async function startApiServer(options: ApiServerOptions): Promise<FastifyServer>

// Server: src/api/server/FastifyServer.ts
export class FastifyServer {
	// Fastify-based server with SSE streaming
	// Health checks, status endpoints
	// Question management API
}

// Configuration: src/api/config/ApiConfigManager.ts
export class ApiConfigManager {
	// Multi-source configuration (files, env vars, CLI config)
	// Environment variable mapping
	// Validation and merging
}
```

### Key Dependencies

- **Runtime**: Node.js 20.19.2
- **Framework**: Fastify 5.2.0 with CORS and Helmet
- **Configuration**: Multi-source (files, environment, CLI config)
- **MCP Integration**: GlobalCLIMcpService for server connectivity
- **Workspace**: File system operations requiring workspace mounting

## Technical Implementation

### 1. Production Docker Implementation

#### 1.1 Multi-Stage Production Dockerfile

```dockerfile
# docker/production/Dockerfile
# Stage 1: Build Environment
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files for dependency installation
COPY src/package.json src/package-lock.json ./
RUN npm ci --only=production --no-audit

# Copy source code and build
COPY src/ ./
RUN npm run bundle

# Stage 2: Production Runtime
FROM node:20-alpine AS runtime

# Security: Create non-root user
RUN addgroup -g 1001 -S apiuser && \
    adduser -S apiuser -u 1001 -G apiuser

# Install production dependencies only
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Health check script
COPY docker/scripts/health-check.sh ./health-check.sh
RUN chmod +x ./health-check.sh

# Configuration directories
RUN mkdir -p /app/config /app/workspace && \
    chown -R apiuser:apiuser /app

USER apiuser

# Default configuration
ENV NODE_ENV=production \
    API_PORT=3000 \
    API_HOST=0.0.0.0 \
    API_WORKSPACE_ROOT=/app/workspace \
    API_VERBOSE=false \
    API_DEBUG=false

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD ./health-check.sh

CMD ["node", "dist/api/api-entry.js"]
```

#### 1.2 Production Docker Compose

```yaml
# docker/production/docker-compose.yml
version: "3.8"

services:
    roo-api:
        build:
            context: ../../
            dockerfile: docker/production/Dockerfile
        ports:
            - "${API_PORT:-3000}:3000"
        environment:
            - NODE_ENV=production
            - API_PORT=${API_PORT:-3000}
            - API_HOST=0.0.0.0
            - API_WORKSPACE_ROOT=/app/workspace
            - API_CLI_CONFIG_PATH=/app/config/agent-config.json
            - API_VERBOSE=${API_VERBOSE:-false}
            - API_DEBUG=${API_DEBUG:-false}
            - API_CORS_ORIGIN=${API_CORS_ORIGIN:-*}
            - API_CORS_CREDENTIALS=${API_CORS_CREDENTIALS:-true}
            - API_ENABLE_HELMET=${API_ENABLE_HELMET:-true}
        volumes:
            - ${WORKSPACE_PATH:-./workspace}:/app/workspace:rw
            - ${CONFIG_PATH:-./config}:/app/config:ro
            - api-logs:/app/logs
        networks:
            - roo-api-network
        restart: unless-stopped
        deploy:
            resources:
                limits:
                    memory: 512M
                    cpus: "1.0"
                reservations:
                    memory: 256M
                    cpus: "0.5"
        healthcheck:
            test: ["CMD", "./health-check.sh"]
            interval: 30s
            timeout: 10s
            retries: 3
            start_period: 40s

    # Future: Nginx reverse proxy for TLS
    # roo-api-nginx:
    #   image: nginx:alpine
    #   ports:
    #     - "443:443"
    #     - "80:80"
    #   volumes:
    #     - ./nginx.conf:/etc/nginx/nginx.conf:ro
    #     - ./ssl:/etc/ssl:ro
    #   depends_on:
    #     - roo-api
    #   networks:
    #     - roo-api-network

volumes:
    api-logs:

networks:
    roo-api-network:
        driver: bridge
```

### 2. Development Docker Implementation

#### 2.1 Development Dockerfile

```dockerfile
# docker/development/Dockerfile
FROM node:20

# Install development tools
RUN npm install -g nodemon ts-node

# Create app user (optional for dev)
RUN useradd -m -s /bin/bash devuser

WORKDIR /app

# Copy package files
COPY src/package.json src/package-lock.json ./
RUN npm install

# Copy source code (will be overridden by volume mount)
COPY src/ ./

# Expose API and debug ports
EXPOSE 3000 9229

# Development environment variables
ENV NODE_ENV=development \
    API_PORT=3000 \
    API_HOST=0.0.0.0 \
    API_VERBOSE=true \
    API_DEBUG=true

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use nodemon for hot reload
CMD ["nodemon", "--inspect=0.0.0.0:9229", "--ext", "ts,js,json", "--exec", "ts-node", "api/api-entry.ts"]
```

#### 2.2 Development Docker Compose

```yaml
# docker/development/docker-compose.yml
version: "3.8"

services:
    roo-api-dev:
        build:
            context: ../../
            dockerfile: docker/development/Dockerfile
        ports:
            - "${API_PORT:-3000}:3000"
            - "${DEBUG_PORT:-9229}:9229"
        environment:
            - NODE_ENV=development
            - API_PORT=${API_PORT:-3000}
            - API_HOST=0.0.0.0
            - API_WORKSPACE_ROOT=/app/workspace
            - API_CLI_CONFIG_PATH=/app/config/agent-config.json
            - API_VERBOSE=${API_VERBOSE:-true}
            - API_DEBUG=${API_DEBUG:-true}
            - API_CORS_ORIGIN=${API_CORS_ORIGIN:-*}
            - API_CORS_CREDENTIALS=${API_CORS_CREDENTIALS:-true}
            - API_ENABLE_HELMET=${API_ENABLE_HELMET:-false}
        volumes:
            # Source code mounting for hot reload
            - ../../src:/app:rw
            # Workspace mounting
            - ${WORKSPACE_PATH:-./workspace}:/app/workspace:rw
            # Configuration mounting
            - ${CONFIG_PATH:-./config}:/app/config:ro
            # Node modules cache
            - node_modules:/app/node_modules
        networks:
            - roo-dev-network
        stdin_open: true
        tty: true
        restart: unless-stopped

    # Optional: Isolated testing environment
    roo-api-test:
        build:
            context: ../../
            dockerfile: docker/development/Dockerfile
        environment:
            - NODE_ENV=test
            - API_PORT=3001
            - API_HOST=0.0.0.0
            - API_WORKSPACE_ROOT=/app/test-workspace
            - API_VERBOSE=false
            - API_DEBUG=true
        volumes:
            - ../../src:/app:rw
            - ./test-workspace:/app/test-workspace:rw
            - ./test-config:/app/config:ro
            - node_modules_test:/app/node_modules
        networks:
            - roo-dev-network
        profiles:
            - testing

volumes:
    node_modules:
    node_modules_test:

networks:
    roo-dev-network:
        driver: bridge
```

### 3. Configuration Management

#### 3.1 Environment Configuration Files

```bash
# docker/production/.env.example
# Roo API Production Configuration

# Server Configuration
API_PORT=3000
API_HOST=0.0.0.0
API_VERBOSE=false
API_DEBUG=false

# Workspace Configuration
API_WORKSPACE_ROOT=/app/workspace
WORKSPACE_PATH=./workspace

# Configuration Paths
API_CLI_CONFIG_PATH=/app/config/agent-config.json
CONFIG_PATH=./config

# CORS Configuration
API_CORS_ORIGIN=https://yourdomain.com
API_CORS_CREDENTIALS=true

# Security Configuration
API_ENABLE_HELMET=true
API_RATE_LIMIT_MAX=100
API_RATE_LIMIT_WINDOW=15m

# Timeout Configuration
API_REQUEST_TIMEOUT=30000
API_KEEP_ALIVE_TIMEOUT=5000
API_TASK_TIMEOUT=600000

# MCP Configuration
MCP_CONFIG_PATH=/app/config/mcp-config.json
MCP_AUTO_CONNECT=true
MCP_TIMEOUT=30000
MCP_RETRIES=3
```

```bash
# docker/development/.env.example
# Roo API Development Configuration

# Server Configuration
API_PORT=3000
API_HOST=0.0.0.0
API_VERBOSE=true
API_DEBUG=true

# Debug Configuration
DEBUG_PORT=9229

# Workspace Configuration
API_WORKSPACE_ROOT=/app/workspace
WORKSPACE_PATH=../workspace

# Configuration Paths
API_CLI_CONFIG_PATH=/app/config/agent-config.json
CONFIG_PATH=./config

# CORS Configuration (permissive for development)
API_CORS_ORIGIN=*
API_CORS_CREDENTIALS=true

# Security Configuration (relaxed for development)
API_ENABLE_HELMET=false

# MCP Configuration
MCP_CONFIG_PATH=/app/config/mcp-config.json
MCP_AUTO_CONNECT=true
MCP_TIMEOUT=30000
MCP_RETRIES=3
```

#### 3.2 Configuration Templates

```json
// docker/config/api-config.json.example
{
	"port": 3000,
	"host": "0.0.0.0",
	"verbose": false,
	"debug": false,
	"workspaceRoot": "/app/workspace",
	"cors": {
		"origin": "*",
		"credentials": true,
		"methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
	},
	"security": {
		"enableHelmet": true,
		"rateLimit": {
			"max": 100,
			"timeWindow": "15m"
		}
	},
	"timeouts": {
		"request": 30000,
		"keepAlive": 5000,
		"task": 600000
	}
}
```

```json
// docker/config/mcp-config.json.example
{
	"mcpServers": {
		"github": {
			"command": "npx",
			"args": ["-y", "@modelcontextprotocol/server-github"],
			"env": {
				"GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
			}
		},
		"mssql-dpsp": {
			"command": "dotnet",
			"args": ["/app/mcp-servers/mssql/Core.Infrastructure.McpServer.dll"],
			"env": {
				"CONNECTION_STRING": "${MSSQL_CONNECTION_STRING}"
			}
		}
	}
}
```

### 4. Supporting Scripts

#### 4.1 Health Check Script

```bash
#!/bin/bash
# docker/scripts/health-check.sh

# Health check script for Roo API container
set -e

HOST=${API_HOST:-localhost}
PORT=${API_PORT:-3000}
TIMEOUT=${HEALTH_CHECK_TIMEOUT:-10}

# Function to check HTTP endpoint
check_endpoint() {
    local endpoint=$1
    local expected_status=${2:-200}

    response=$(curl -s -w "%{http_code}" -m $TIMEOUT "http://${HOST}:${PORT}${endpoint}" || echo "000")
    status_code=${response: -3}

    if [ "$status_code" != "$expected_status" ]; then
        echo "Health check failed for ${endpoint}: HTTP $status_code"
        return 1
    fi

    return 0
}

# Check health endpoint
echo "Checking API health..."
check_endpoint "/health" 200

# Check status endpoint
echo "Checking API status..."
check_endpoint "/status" 200

echo "Health check passed"
exit 0
```

#### 4.2 Production Build Script

```bash
#!/bin/bash
# docker/scripts/build-prod.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
DOCKER_DIR="$PROJECT_ROOT/docker"

echo "🚀 Building Roo API Production Container"
echo "Project root: $PROJECT_ROOT"

# Build production image
cd "$PROJECT_ROOT"
docker build \
    -f "$DOCKER_DIR/production/Dockerfile" \
    -t roo-api:latest \
    -t roo-api:$(date +%Y%m%d-%H%M%S) \
    .

echo "✅ Production build completed successfully"
echo "Tagged as: roo-api:latest"

# Optional: Run basic validation
if [ "$1" == "--validate" ]; then
    echo "🔍 Running validation..."

    # Test build can start
    container_id=$(docker run -d --rm -p 3001:3000 roo-api:latest)
    sleep 10

    # Test health endpoint
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ Health check passed"
    else
        echo "❌ Health check failed"
        docker stop "$container_id"
        exit 1
    fi

    docker stop "$container_id"
    echo "✅ Validation completed successfully"
fi
```

#### 4.3 Development Environment Script

```bash
#!/bin/bash
# docker/scripts/dev-up.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
DOCKER_DIR="$PROJECT_ROOT/docker/development"

echo "🚀 Starting Roo API Development Environment"

# Ensure configuration directories exist
mkdir -p "$DOCKER_DIR/workspace"
mkdir -p "$DOCKER_DIR/config"

# Copy example configurations if they don't exist
if [ ! -f "$DOCKER_DIR/.env" ] && [ -f "$DOCKER_DIR/.env.example" ]; then
    echo "📋 Creating .env from .env.example"
    cp "$DOCKER_DIR/.env.example" "$DOCKER_DIR/.env"
fi

# Start development environment
cd "$DOCKER_DIR"
docker-compose up -d

echo "✅ Development environment started"
echo "🌐 API available at: http://localhost:3000"
echo "🐛 Debug port available at: localhost:9229"
echo "📊 Health check: http://localhost:3000/health"
echo ""
echo "📋 Useful commands:"
echo "  View logs: docker-compose logs -f roo-api-dev"
echo "  Restart:   docker-compose restart roo-api-dev"
echo "  Stop:      docker-compose down"
echo "  Shell:     docker-compose exec roo-api-dev bash"
```

### 5. Enhanced Docker Ignore

```dockerignore
# Enhanced .dockerignore for Roo API

# Build artifacts and outputs
bin/
!bin/roo-code-latest.vsix
dist/
**/dist/
out/
**/out/
build/
**/build/

# Dependencies
node_modules/
**/node_modules/
.pnpm-store/
**/.pnpm-store/

# Development and testing
coverage/
**/.vscode-test/
**/__tests__/
**/*.test.ts
**/*.test.js
**/*.spec.ts
**/*.spec.js
jest.config.*
vitest.config.*

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs and temporary files
*.log
logs/
**/*.log
tmp/
temp/
*.tmp

# Environment and configuration
.env
.env.*
!.env.example
*.local

# Git and version control
.git/
.gitignore
.gitattributes

# Docker and CI/CD
.dockerignore
Dockerfile
docker-compose*.yml
.github/
.gitlab-ci.yml

# Documentation (exclude from production builds)
docs/
*.md
!README.md

# Development tools
.eslintrc*
.prettierrc*
.editorconfig
.husky/
knip.json

# Package manager files (keep only what's needed)
package-lock.json
yarn.lock
pnpm-lock.yaml
.npmrc

# Evaluation and examples (not needed in production)
evals/
examples/
test-prompts/
```

## Integration Points

### 1. MCP Server Integration

The Docker containers must support MCP server connectivity:

```typescript
// Integration with existing GlobalCLIMcpService
const globalMcpService = GlobalCLIMcpService.getInstance()
await globalMcpService.initialize({
	mcpConfigPath: process.env.MCP_CONFIG_PATH,
	mcpAutoConnect: process.env.MCP_AUTO_CONNECT !== "false",
	mcpTimeout: parseInt(process.env.MCP_TIMEOUT || "30000"),
	mcpRetries: parseInt(process.env.MCP_RETRIES || "3"),
	verbose: process.env.API_VERBOSE === "true",
})
```

### 2. Configuration Compatibility

Ensure CLI configuration compatibility:

```typescript
// Load CLI configuration from API_CLI_CONFIG_PATH
const { CliConfigManager } = await import("../../cli/config/CliConfigManager")
const cliConfigPath = process.env.API_CLI_CONFIG_PATH

if (cliConfigPath) {
	const configManager = new CliConfigManager({ configPath: cliConfigPath })
	const config = await configManager.loadConfiguration()
	// Map to API configuration
}
```

### 3. Workspace Management

Support workspace mounting and operations:

```typescript
// Workspace root configuration
const workspaceRoot = process.env.API_WORKSPACE_ROOT || process.cwd()

// File system operations within workspace
const taskOptions = {
	workspacePath: workspaceRoot,
	fileSystem: taskAdapters.fileSystem,
	// ... other options
}
```

## Performance Considerations

### 1. Image Optimization

- **Multi-stage builds**: Reduce production image size by ~70%
- **Layer caching**: Optimize Dockerfile for effective layer reuse
- **Alpine base**: Use minimal Alpine Linux for production

### 2. Runtime Performance

- **Resource limits**: Configure appropriate memory/CPU limits
- **Health checks**: Lightweight health check implementation
- **Graceful shutdown**: Proper signal handling for clean shutdown

### 3. Development Efficiency

- **Hot reload**: Sub-2-second response to source changes
- **Volume mounting**: Efficient source code mounting strategy
- **Debug integration**: Seamless IDE debugging experience

## Security Considerations

### 1. Container Security

- **Non-root execution**: All containers run as non-root user
- **Minimal attack surface**: Only necessary packages installed
- **Security scanning**: Base images regularly updated

### 2. Configuration Security

- **No secrets in images**: All secrets via environment variables
- **Read-only configurations**: Configuration volumes mounted read-only
- **Network isolation**: Proper Docker network configuration

### 3. Runtime Security

- **Resource limits**: Prevent resource exhaustion attacks
- **Health monitoring**: Continuous health check monitoring
- **Audit logging**: Comprehensive request/response logging

This technical implementation plan provides the foundation for creating robust, secure, and efficient Docker containerization of the Roo Code Agent API while maintaining compatibility with existing CLI and VSCode extension modes.
