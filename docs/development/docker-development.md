# Roo Code Agent API - Development Docker Setup

This guide provides comprehensive instructions for setting up and using the Roo Code Agent API in a development environment using Docker containers.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Workflow](#development-workflow)
- [Hot Reload](#hot-reload)
- [Debugging](#debugging)
- [Testing](#testing)
- [Configuration](#configuration)
- [MCP Server Development](#mcp-server-development)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Docker Engine**: 20.10 or later
- **Docker Compose**: 2.0 or later
- **IDE Support**: VS Code with Docker extension (recommended)
- **System Resources**:
    - Minimum: 2 CPU cores, 4GB RAM, 5GB disk space
    - Recommended: 4 CPU cores, 8GB RAM, 20GB disk space

### Development Tools

- **Node.js**: 20.19.2 (for local development outside Docker)
- **Git**: For source code management
- **curl**: For API testing
- **VS Code**: With Docker and Remote-Containers extensions

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/RooCodeInc/Roo-Code.git
cd Roo-Code

# Navigate to development setup
cd docker/development

# Create environment configuration
cp .env.example .env
```

### 2. Configure Development Environment

Edit `.env` file for development:

```bash
# Development Configuration
API_PORT=3000
API_HOST=0.0.0.0
API_VERBOSE=true
API_DEBUG=true
DEBUG_PORT=9229

# Workspace - Use your local project path
WORKSPACE_PATH=../../workspace
CONFIG_PATH=./config

# Development-friendly CORS (permissive)
API_CORS_ORIGIN=*
API_CORS_CREDENTIALS=true
API_ENABLE_HELMET=false
```

### 3. Create Development Configuration

```bash
# Create config directory
mkdir -p config

# Create development agent config
cat > config/agent-config.json << 'EOF'
{
  "apiProvider": "anthropic",
  "apiKey": "your-development-api-key",
  "apiModelId": "claude-3-5-sonnet-20241022",
  "mcpEnabled": true,
  "mcpAutoConnect": true,
  "verbose": true
}
EOF

# Create development MCP config
cat > config/mcp-config.json << 'EOF'
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-token"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/app/workspace"]
    }
  }
}
EOF

# Create workspace directory
mkdir -p workspace
```

### 4. Start Development Environment

```bash
# Start development containers
docker-compose up -d

# View logs
docker-compose logs -f roo-api-dev

# Verify the API is running
curl http://localhost:3000/health
```

### 5. Development Ready!

Your development environment is now ready:

- **API Endpoint**: http://localhost:3000
- **Debug Port**: localhost:9229 (for Node.js debugging)
- **Hot Reload**: Enabled for all source code changes
- **Logs**: Real-time via `docker-compose logs -f`

## Development Workflow

### Source Code Changes

The development container automatically reloads when you make changes:

```bash
# Make changes to source code in src/
# Changes are automatically detected and the server restarts

# Watch the reload in logs
docker-compose logs -f roo-api-dev
```

### API Development and Testing

```bash
# Test basic endpoints
curl http://localhost:3000/health
curl http://localhost:3000/status

# Test streaming endpoint
curl -X POST http://localhost:3000/execute/stream \
  -H "Content-Type: application/json" \
  -d '{"task": "Hello from development environment"}'

# Test with the test client
../../test-api.js --stream "list the files in the current directory"
```

### Database/Storage Development

```bash
# Access container filesystem
docker-compose exec roo-api-dev bash

# Check workspace contents
ls -la /app/workspace

# Check configuration
cat /app/config/agent-config.json
```

## Hot Reload

### How It Works

The development container uses `nodemon` with `ts-node` for hot reloading:

```dockerfile
# From development Dockerfile
CMD ["nodemon", "--inspect=0.0.0.0:9229", "--ext", "ts,js,json", "--exec", "ts-node", "api/api-entry.ts"]
```

### Watched File Types

- **TypeScript files**: `*.ts`
- **JavaScript files**: `*.js`
- **Configuration files**: `*.json`

### Reload Triggers

Changes to any of these files will trigger a reload:

```bash
# Code changes
src/api/server/FastifyServer.ts
src/api/config/ApiConfigManager.ts
src/core/adapters/api/

# Configuration changes
config/agent-config.json
config/mcp-config.json
config/api-config.json
```

### Performance Optimization

```bash
# Exclude files from watching (add to .dockerignore)
node_modules/
**/*.test.ts
**/*.spec.ts
logs/
tmp/
```

## Debugging

### VS Code Integration

#### Setup Remote Debugging

1. **Install VS Code Extensions**:

    - Docker
    - Remote - Containers
    - TypeScript and JavaScript Language Features

2. **Create Debug Configuration** (`.vscode/launch.json`):

```json
{
	"version": "0.2.0",
	"configurations": [
		{
			"name": "Attach to Docker API",
			"type": "node",
			"request": "attach",
			"port": 9229,
			"address": "localhost",
			"localRoot": "${workspaceFolder}/src",
			"remoteRoot": "/app",
			"protocol": "inspector",
			"restart": true,
			"sourceMaps": true,
			"outFiles": ["${workspaceFolder}/src/**/*.js"]
		}
	]
}
```

3. **Start Debugging**:
    - Start the development container
    - Open VS Code
    - Go to Run and Debug (Ctrl+Shift+D)
    - Select "Attach to Docker API"
    - Click Start Debugging

#### Debugging Workflow

```bash
# Set breakpoints in VS Code
# Start debugging session
# Make API requests to trigger breakpoints

# Example: Debug the health endpoint
curl http://localhost:3000/health
```

### Container Shell Access

```bash
# Access running container
docker-compose exec roo-api-dev bash

# Check processes
ps aux

# Check Node.js version
node --version

# Check environment variables
env | grep API_

# Check logs
tail -f /app/logs/api.log
```

### Network Debugging

```bash
# Check exposed ports
docker-compose port roo-api-dev 3000
docker-compose port roo-api-dev 9229

# Test internal connectivity
docker-compose exec roo-api-dev curl http://localhost:3000/health

# Check container networking
docker network ls
docker inspect $(docker-compose ps -q roo-api-dev)
```

## Testing

### Isolated Testing Environment

Use the dedicated testing profile:

```bash
# Start testing environment
docker-compose --profile testing up -d roo-api-test

# Run tests in isolated environment
docker-compose exec roo-api-test npm test

# Stop testing environment
docker-compose --profile testing down
```

### Integration Testing

```bash
# Test with different configurations
# Copy config/agent-config.json to config/test-config.json
# Modify test configuration as needed

# Start test instance with different config
docker-compose exec roo-api-test \
  sh -c 'API_CLI_CONFIG_PATH=/app/config/test-config.json node dist/api/api-entry.js'
```

### API Testing

```bash
# Use the test client for comprehensive testing
../../test-api.js --stream --verbose "test the API endpoints"

# Test specific functionality
../../test-api.js --stream "use the github mcp server to list repositories"

# Test error handling
../../test-api.js --stream "intentionally trigger an error"
```

## Configuration

### Development-Specific Configuration

#### Environment Variables for Development

```bash
# .env file for development
NODE_ENV=development
API_PORT=3000
API_HOST=0.0.0.0
API_VERBOSE=true
API_DEBUG=true
DEBUG_PORT=9229

# Development workspace
API_WORKSPACE_ROOT=/app/workspace
WORKSPACE_PATH=./workspace

# Development-friendly settings
API_CORS_ORIGIN=*
API_CORS_CREDENTIALS=true
API_ENABLE_HELMET=false  # Disabled for easier debugging

# MCP Development Settings
MCP_AUTO_CONNECT=true
MCP_TIMEOUT=60000  # Longer timeout for debugging
MCP_RETRIES=5
```

#### Docker Compose Override

Create `docker-compose.override.yml` for personal development preferences:

```yaml
# docker-compose.override.yml
version: "3.8"

services:
    roo-api-dev:
        environment:
            # Personal API keys
            - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
            - GITHUB_TOKEN=${GITHUB_TOKEN}
        volumes:
            # Mount additional directories
            - ../my-test-projects:/app/test-projects:rw
        ports:
            # Expose additional ports
            - "3001:3001" # Additional API port
```

### Configuration Hot Reloading

Configuration files are watched and will trigger restarts:

```bash
# Edit configuration
vim config/agent-config.json

# Container automatically restarts
# Check logs for restart confirmation
docker-compose logs -f roo-api-dev
```

## MCP Server Development

### Local MCP Server Development

```bash
# Mount local MCP server for development
# Add to docker-compose.override.yml
volumes:
  - ../my-mcp-server:/app/local-mcp:rw

# Update MCP configuration
{
  "mcpServers": {
    "local-dev": {
      "command": "node",
      "args": ["/app/local-mcp/dist/index.js"],
      "env": {
        "DEBUG": "true"
      }
    }
  }
}
```

### MCP Server Testing

```bash
# Test MCP server connectivity
docker-compose exec roo-api-dev \
  npx @modelcontextprotocol/inspector

# Debug MCP communication
# Add verbose logging to MCP configuration
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "token",
        "DEBUG": "*"
      }
    }
  }
}
```

### MCP Server Logs

```bash
# View MCP-specific logs
docker-compose logs roo-api-dev | grep -i mcp

# Enable MCP debug logging
# Set in agent-config.json:
{
  "mcpEnabled": true,
  "mcpAutoConnect": true,
  "mcpDebug": true,
  "verbose": true
}
```

## Troubleshooting

### Common Development Issues

#### 1. Hot Reload Not Working

```bash
# Check nodemon is running
docker-compose exec roo-api-dev ps aux | grep nodemon

# Check file permissions
ls -la src/api/

# Restart container
docker-compose restart roo-api-dev

# Check volume mounts
docker inspect $(docker-compose ps -q roo-api-dev) | grep -A 20 Mounts
```

#### 2. Debug Port Not Accessible

```bash
# Check port is exposed
docker-compose ps
# Should show: 0.0.0.0:9229->9229/tcp

# Test debug port connectivity
telnet localhost 9229

# Check process listening on debug port
docker-compose exec roo-api-dev netstat -tlnp | grep 9229
```

#### 3. Source Code Changes Not Reflected

```bash
# Verify volume mount
docker-compose exec roo-api-dev ls -la /app/

# Check for TypeScript compilation errors
docker-compose logs roo-api-dev | grep -i error

# Force restart
docker-compose restart roo-api-dev
```

#### 4. Container Won't Start

```bash
# Check for syntax errors
docker-compose config

# View detailed logs
docker-compose logs --details roo-api-dev

# Check resource constraints
docker stats
```

### Performance Issues

#### Container Performance

```bash
# Check resource usage
docker stats roo-api-dev

# Increase container resources
# Edit docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '2.0'
```

#### Volume Performance

```bash
# For better performance on macOS/Windows
# Use bind mounts instead of volumes for source code:
volumes:
  - ../../src:/app:cached  # cached mode for better performance
```

### Environment Reset

```bash
# Complete environment reset
docker-compose down -v  # Remove volumes
docker-compose build --no-cache  # Rebuild without cache
docker-compose up -d

# Reset configuration
rm -rf config/
rm .env
cp .env.example .env
# Reconfigure as needed
```

### Useful Development Commands

```bash
# Container management
docker-compose ps                    # List containers
docker-compose logs -f roo-api-dev  # Follow logs
docker-compose restart roo-api-dev  # Restart service
docker-compose exec roo-api-dev bash # Shell access

# Development workflow
npm run lint                         # Lint code (in container)
npm run test                         # Run tests (in container)
npm run build                        # Build project (in container)

# Debugging
docker-compose exec roo-api-dev env | grep API_  # Check env vars
docker-compose exec roo-api-dev cat /app/config/agent-config.json  # Check config
docker-compose exec roo-api-dev curl http://localhost:3000/health  # Test API
```

This development guide provides comprehensive instructions for setting up and using the Roo Code Agent API development environment with full hot reload, debugging, and testing capabilities.
