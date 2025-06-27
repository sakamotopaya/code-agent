# Docker Production Configuration Updates - Summary

## Overview

Updated production Docker configuration to match the working development setup while maintaining production-appropriate security and performance characteristics.

## Files Updated

### 1. `docker/production/Dockerfile`

#### **Critical Changes Made:**

**Build Stage Improvements:**

- ✅ Added missing workspace files: `README.md`, `CHANGELOG.md`, `LICENSE`
- ✅ Added missing directories: `scripts/`, `webview-ui/`
- ✅ Fixed build process to match development structure
- ✅ Added proper workspace package building sequence
- ✅ Corrected working directory structure

**Runtime Stage Improvements:**

- ✅ Added **Puppeteer dependencies**: `chromium`, `nss`, `freetype`, `harfbuzz`, `ca-certificates`, `ttf-freefont`
- ✅ Added **Git support** for version control operations
- ✅ Added **Python3** for MCP server compatibility
- ✅ Added **ripgrep** for search functionality
- ✅ Added **Puppeteer environment variables**:
    - `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
    - `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`
- ✅ Created **storage directories**: `/app/.roo-storage`, `/app/.roo-storage/puppeteer`, `/app/.roo-cli`
- ✅ Fixed **working directory structure** to `/app/src` for proper module resolution
- ✅ Increased **memory allocation** from 512MB to 1GB (`NODE_OPTIONS="--max-old-space-size=1024"`)
- ✅ Fixed **health check script path** to match new directory structure

### 2. `docker/production/docker-compose.yml`

#### **Critical Changes Made:**

**Storage Configuration (CRITICAL):**

- ✅ Added **Global storage mounting**: `${ROO_STORAGE_PATH:-./storage}:/app/.roo-storage:rw`
- ✅ Added **CLI storage mounting**: `${ROO_CLI_STORAGE_PATH:-./cli-storage}:/app/.roo-cli:rw`
- ✅ Changed **configuration mounting** from read-only to read-write for MCP server configs
- ✅ Added **storage environment variables**:
    - `ROO_GLOBAL_STORAGE_PATH=/app/.roo-storage`
    - `ROO_CLI_STORAGE_PATH=/app/.roo-cli`
    - `API_STORAGE_ROOT=/app/.roo-storage`

**External Integration Support:**

- ✅ Added **API key environment variables**:
    - `ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}`
    - `OPENAI_API_KEY=${OPENAI_API_KEY}`
    - `GITHUB_TOKEN=${GITHUB_TOKEN}`
    - `DATABASE_URL=${DATABASE_URL}`
    - `MSSQL_CONNECTION_STRING=${MSSQL_CONNECTION_STRING}`

**Performance Improvements:**

- ✅ Increased **memory limits**: 512M → 1G
- ✅ Increased **CPU limits**: 1.0 → 2.0
- ✅ Increased **memory reservations**: 256M → 512M
- ✅ Increased **CPU reservations**: 0.5 → 1.0
- ✅ Fixed **health check script path** to match container structure

### 3. `docker/scripts/prod-up.sh` (New)

#### **Features Added:**

- ✅ **Automated deployment script** for production Docker setup
- ✅ **Prerequisites checking**: Docker, Docker Compose availability
- ✅ **Directory creation**: Automatic creation of required directories
- ✅ **Environment validation**: Checks for required API keys
- ✅ **Health checking**: Automated API health verification
- ✅ **Service status monitoring**: Easy status checking and log viewing
- ✅ **Usage documentation**: Built-in help and examples

## Key Features Now Available in Production

### 1. **Puppeteer Support** 🎯

- Full browser automation capabilities
- Chromium browser included in container
- Proper GPU acceleration disabled for headless operation
- Font support for rendering

### 2. **MCP Server Integration** 🔗

- Persistent storage for MCP server state
- Configuration file support
- API key integration for external services
- Proper timeout and retry configuration

### 3. **CLI Functionality** 💻

- CLI storage for session history
- REPL state persistence
- Configuration file support

### 4. **External API Integration** 🌐

- Anthropic API support
- OpenAI API support
- GitHub integration
- Database connectivity
- MSSQL server support

### 5. **Production Performance** 🚀

- Increased memory allocation (1GB)
- Better CPU allocation (2 cores)
- Optimized for production workloads
- Proper resource limits

## Directory Structure Created

```
docker/production/
├── workspace/          # User workspace files
├── config/            # Configuration files (agent-config.json, mcp-config.json)
├── storage/           # Global storage (Puppeteer cache, MCP state, tasks)
├── cli-storage/       # CLI session history and REPL state
└── logs/             # Application logs
```

## Testing Instructions

### 1. **Build and Deploy**

```bash
# Using the new deployment script
./docker/scripts/prod-up.sh

# Or manually
cd docker/production
docker-compose build --no-cache
docker-compose up -d
```

### 2. **Verify Core Functionality**

```bash
# Check health endpoint
curl http://localhost:3000/health

# Check status endpoint
curl http://localhost:3000/status

# View logs
docker-compose -f docker/production/docker-compose.yml logs -f
```

### 3. **Test Puppeteer Support**

```bash
# Test browser automation endpoint
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"message": "Launch a browser and navigate to google.com"}'
```

### 4. **Test MCP Server Integration**

```bash
# Test MCP server connectivity (if configured)
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"message": "List available MCP servers"}'
```

### 5. **Verify Storage Persistence**

```bash
# Check storage directories are created
docker exec roo-api ls -la /app/.roo-storage
docker exec roo-api ls -la /app/.roo-cli

# Restart container and verify state persists
docker-compose -f docker/production/docker-compose.yml restart
```

## Environment Variables Setup

Create a `.env` file in the `docker/production/` directory:

```bash
# Required for full functionality
ANTHROPIC_API_KEY=your_anthropic_key_here

# Optional but recommended
OPENAI_API_KEY=your_openai_key_here
GITHUB_TOKEN=your_github_token_here

# Optional database connections
DATABASE_URL=your_database_url_here
MSSQL_CONNECTION_STRING=your_mssql_connection_here

# Optional port configuration
API_PORT=3000

# Optional storage paths (will use defaults if not set)
WORKSPACE_PATH=./workspace
CONFIG_PATH=./config
ROO_STORAGE_PATH=./storage
ROO_CLI_STORAGE_PATH=./cli-storage
```

## Troubleshooting

### Common Issues:

1. **Health check failures**

    - Verify API is accessible: `curl http://localhost:3000/health`
    - Check container logs: `docker-compose logs roo-api`
    - Ensure proper port exposure

2. **Puppeteer issues**

    - Verify Chromium installation in container: `docker exec roo-api chromium-browser --version`
    - Check storage directory permissions
    - Verify font packages are installed

3. **MCP server connection issues**

    - Verify configuration files are properly mounted
    - Check API key environment variables
    - Review MCP server logs

4. **Storage persistence issues**
    - Verify volume mounts are correct
    - Check directory permissions
    - Ensure host directories exist

## Performance Monitoring

The production setup includes:

- **Resource limits**: 1GB memory, 2 CPU cores
- **Health checks**: 30-second intervals
- **Log rotation**: 10MB max size, 3 files
- **File descriptor limits**: 65536 (for SSE connections)

Monitor with:

```bash
# Resource usage
docker stats

# Service status
./docker/scripts/prod-up.sh --status

# Health check
./docker/scripts/prod-up.sh --check
```

## Success Criteria

✅ **Production deployment is successful when:**

1. Health check endpoints return 200 OK
2. Puppeteer can launch browsers successfully
3. MCP servers can connect and respond
4. Storage persists across container restarts
5. API handles requests within timeout limits
6. Resource usage stays within defined limits

The production Docker configuration now has full feature parity with the development setup while maintaining production security and performance characteristics.
