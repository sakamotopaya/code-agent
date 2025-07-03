# Roo Code Agent API - Production Docker Deployment

This guide provides comprehensive instructions for deploying the Roo Code Agent API in production using Docker containers.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Scaling](#scaling)

## Prerequisites

### System Requirements

- **Docker Engine**: 20.10 or later
- **Docker Compose**: 2.0 or later
- **System Resources**:
    - Minimum: 1 CPU core, 512MB RAM, 2GB disk space
    - Recommended: 2 CPU cores, 2GB RAM, 10GB disk space
- **Network**: Outbound internet access for MCP server connectivity

### Required Files

Ensure you have the following configuration files:

```bash
# Required configuration files
config/
├── agent-config.json       # CLI agent configuration
├── mcp-config.json         # MCP server configuration
└── api-config.json         # API-specific configuration (optional)

# Required workspace directory
workspace/                  # Your project workspace
```

## Quick Start

### 1. Download Production Assets

```bash
# Create deployment directory
mkdir -p roo-api-production
cd roo-api-production

# Download production Docker assets
curl -o docker-compose.yml https://raw.githubusercontent.com/RooCodeInc/Roo-Code/main/docker/production/docker-compose.yml
curl -o .env.example https://raw.githubusercontent.com/RooCodeInc/Roo-Code/main/docker/production/.env.example

# Create configuration from example
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file with your specific configuration:

```bash
# Server Configuration
API_PORT=3000
API_HOST=0.0.0.0

# Workspace Configuration - IMPORTANT: Set to your project path
WORKSPACE_PATH=/path/to/your/project

# Configuration Path - IMPORTANT: Set to your config directory
CONFIG_PATH=/path/to/your/config

# CORS Configuration - IMPORTANT: Set to your domain
API_CORS_ORIGIN=https://yourdomain.com

# Security Configuration
API_ENABLE_HELMET=true
API_RATE_LIMIT_MAX=100
```

### 3. Prepare Configuration Files

Create the required configuration files:

```bash
# Create configuration directory
mkdir -p config

# Create agent configuration
cat > config/agent-config.json << 'EOF'
{
  "apiProvider": "anthropic",
  "apiKey": "your-anthropic-api-key",
  "apiModelId": "claude-3-5-sonnet-20241022",
  "mcpEnabled": true
}
EOF

# Create MCP configuration
cat > config/mcp-config.json << 'EOF'
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-token"
      }
    }
  }
}
EOF
```

### 4. Deploy

```bash
# Start the production deployment
docker-compose up -d

# Verify deployment
docker-compose ps
docker-compose logs roo-api

# Test the API
curl http://localhost:3000/health
```

## Configuration

### Environment Variables

| Variable                | Description                  | Default       | Required       |
| ----------------------- | ---------------------------- | ------------- | -------------- |
| `API_PORT`              | Server port                  | `3000`        | No             |
| `API_HOST`              | Server host                  | `0.0.0.0`     | No             |
| `API_VERBOSE`           | Enable verbose logging       | `false`       | No             |
| `API_DEBUG`             | Enable debug mode            | `false`       | No             |
| `WORKSPACE_PATH`        | Host workspace directory     | `./workspace` | **Yes**        |
| `CONFIG_PATH`           | Host configuration directory | `./config`    | **Yes**        |
| `API_CORS_ORIGIN`       | CORS allowed origins         | `*`           | **Yes** (Prod) |
| `API_CORS_CREDENTIALS`  | CORS allow credentials       | `true`        | No             |
| `API_ENABLE_HELMET`     | Enable security headers      | `true`        | No             |
| `API_RATE_LIMIT_MAX`    | Rate limit max requests      | `100`         | No             |
| `API_RATE_LIMIT_WINDOW` | Rate limit window            | `15m`         | No             |

### Configuration Files

#### Agent Configuration (`config/agent-config.json`)

```json
{
	"apiProvider": "anthropic",
	"apiKey": "your-api-key",
	"apiModelId": "claude-3-5-sonnet-20241022",
	"openAiBaseUrl": "https://api.openai.com/v1",
	"anthropicBaseUrl": "https://api.anthropic.com",
	"mcpEnabled": true,
	"mcpAutoConnect": true
}
```

#### MCP Configuration (`config/mcp-config.json`)

```json
{
	"mcpServers": {
		"github": {
			"command": "npx",
			"args": ["-y", "@modelcontextprotocol/server-github"],
			"env": {
				"GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
			}
		},
		"filesystem": {
			"command": "npx",
			"args": ["-y", "@modelcontextprotocol/server-filesystem", "/app/workspace"]
		}
	}
}
```

#### API Configuration (Optional - `config/api-config.json`)

```json
{
	"port": 3000,
	"host": "0.0.0.0",
	"verbose": false,
	"debug": false,
	"cors": {
		"origin": ["https://yourdomain.com"],
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

## Deployment

### Production Deployment Options

#### Option 1: Docker Compose (Recommended)

```bash
# Clone or download the repository
git clone https://github.com/RooCodeInc/Roo-Code.git
cd Roo-Code

# Navigate to production deployment
cd docker/production

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Deploy
docker-compose up -d

# Monitor
docker-compose logs -f roo-api
```

#### Option 2: Direct Docker Run

```bash
# Build the image
docker build -f docker/production/Dockerfile -t roo-api:latest .

# Run the container
docker run -d \
  --name roo-api \
  -p 3000:3000 \
  -v /path/to/workspace:/app/workspace:rw \
  -v /path/to/config:/app/config:ro \
  -e API_CORS_ORIGIN=https://yourdomain.com \
  -e API_CLI_CONFIG_PATH=/app/config/agent-config.json \
  --restart unless-stopped \
  roo-api:latest
```

#### Option 3: Pre-built Image

```bash
# Pull pre-built image (when available)
docker pull roocode/api:latest

# Run with docker-compose using pre-built image
# Edit docker-compose.yml to use: image: roocode/api:latest
# Comment out the build section
docker-compose up -d
```

### Health Checks and Monitoring

The container includes built-in health checks:

```bash
# Check container health
docker-compose ps  # Shows health status

# View health check logs
docker-compose logs roo-api | grep -i health

# Manual health check
curl http://localhost:3000/health
curl http://localhost:3000/status
```

Expected health response:

```json
{
	"status": "healthy",
	"timestamp": "2024-01-15T10:30:00.000Z",
	"uptime": 123.456,
	"version": "3.19.1",
	"checks": {
		"filesystem": "healthy",
		"memory": "healthy",
		"mcp": "healthy"
	}
}
```

## Security

### Container Security

The production container implements several security best practices:

- **Non-root execution**: Runs as user `apiuser` (UID 1001)
- **Minimal attack surface**: Alpine Linux base with minimal packages
- **Read-only root filesystem**: Application directories are read-only
- **Security headers**: Helmet.js enabled by default
- **Rate limiting**: Configurable request rate limits

### Network Security

```yaml
# Recommended production docker-compose.yml additions
services:
    roo-api:
        # ... existing configuration
        networks:
            - roo-api-internal
        # Only expose necessary ports
        ports:
            - "127.0.0.1:3000:3000" # Bind to localhost only

networks:
    roo-api-internal:
        driver: bridge
        internal: true # No external access
```

### Secrets Management

Never include secrets in container images or configuration files:

```bash
# Use environment variables for secrets
export ANTHROPIC_API_KEY="your-secret-key"
export GITHUB_TOKEN="your-github-token"

# Or use Docker secrets (Docker Swarm)
echo "your-secret-key" | docker secret create anthropic-api-key -
```

### HTTPS/TLS Configuration

For production deployments, use a reverse proxy with TLS termination:

```nginx
# nginx.conf example
upstream roo-api {
    server roo-api:3000;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.com.key;

    location / {
        proxy_pass http://roo-api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
    }
}
```

## Monitoring

### Log Management

```bash
# View real-time logs
docker-compose logs -f roo-api

# View logs with timestamps
docker-compose logs -t roo-api

# Export logs for analysis
docker-compose logs roo-api > roo-api.log

# Configure log rotation (add to docker-compose.yml)
services:
  roo-api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Metrics and Observability

The API provides several monitoring endpoints:

```bash
# Health status
curl http://localhost:3000/health

# Detailed status including metrics
curl http://localhost:3000/status

# Example status response
{
  "running": true,
  "uptime": 123.456,
  "stats": {
    "totalRequests": 42,
    "memoryUsage": {
      "heapUsed": 67108864,
      "heapTotal": 134217728,
      "external": 1048576
    },
    "cpuUsage": {
      "user": 1000,
      "system": 500
    }
  }
}
```

### Alerting

Set up monitoring alerts based on:

- Container health status
- Memory usage thresholds
- Response time degradation
- Error rate increases

```bash
# Example health check script for monitoring systems
#!/bin/bash
response=$(curl -s -w "%{http_code}" http://localhost:3000/health)
status_code=${response: -3}

if [ "$status_code" != "200" ]; then
    echo "CRITICAL: API health check failed"
    exit 2
fi

echo "OK: API is healthy"
exit 0
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check container logs
docker-compose logs roo-api

# Common causes:
# - Missing configuration files
# - Invalid API keys
# - Port conflicts
# - Insufficient permissions on mounted volumes
```

#### 2. API Not Responding

```bash
# Check if container is running
docker-compose ps

# Check port binding
docker-compose port roo-api 3000

# Test connectivity
curl -v http://localhost:3000/health

# Check firewall rules
sudo ufw status  # Ubuntu/Debian
sudo firewall-cmd --list-all  # RHEL/CentOS
```

#### 3. MCP Server Connection Issues

```bash
# Check MCP configuration
docker-compose exec roo-api cat /app/config/mcp-config.json

# Check environment variables
docker-compose exec roo-api env | grep MCP

# Test MCP connectivity
docker-compose exec roo-api npm list @modelcontextprotocol/sdk
```

#### 4. Workspace Access Issues

```bash
# Check volume mounts
docker-compose exec roo-api ls -la /app/workspace

# Check permissions
docker-compose exec roo-api id
ls -la /path/to/your/workspace

# Fix permissions if needed
sudo chown -R 1001:1001 /path/to/your/workspace
```

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Temporary debug mode
docker-compose exec roo-api \
  sh -c 'API_DEBUG=true API_VERBOSE=true node dist/api/api-entry.js'

# Persistent debug mode (edit .env)
API_DEBUG=true
API_VERBOSE=true

# Restart with debug
docker-compose restart roo-api
```

### Performance Issues

```bash
# Check resource usage
docker stats roo-api

# Check container limits
docker inspect roo-api | grep -A 10 Resources

# Increase memory limits (edit docker-compose.yml)
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '2.0'
```

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.yml for multiple instances
services:
    roo-api-1:
        build: .
        ports:
            - "3001:3000"
        # ... configuration

    roo-api-2:
        build: .
        ports:
            - "3002:3000"
        # ... configuration

    nginx-lb:
        image: nginx:alpine
        ports:
            - "3000:80"
        volumes:
            - ./nginx-lb.conf:/etc/nginx/nginx.conf
        depends_on:
            - roo-api-1
            - roo-api-2
```

### Load Balancer Configuration

```nginx
# nginx-lb.conf
upstream roo-api-backend {
    least_conn;
    server roo-api-1:3000;
    server roo-api-2:3000;
}

server {
    listen 80;

    location / {
        proxy_pass http://roo-api-backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Resource Optimization

```yaml
# Optimized production configuration
services:
    roo-api:
        # ... existing configuration
        deploy:
            resources:
                limits:
                    memory: 512M
                    cpus: "1.0"
                reservations:
                    memory: 256M
                    cpus: "0.5"
            restart_policy:
                condition: on-failure
                delay: 5s
                max_attempts: 3
                window: 120s
```

## Backup and Recovery

### Configuration Backup

```bash
# Create backup script
cat > backup-config.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)
tar -czf "roo-api-config-$DATE.tar.gz" config/ .env docker-compose.yml
echo "Backup created: roo-api-config-$DATE.tar.gz"
EOF

chmod +x backup-config.sh
```

### Data Backup

```bash
# Backup workspace data
tar -czf "workspace-backup-$(date +%Y%m%d).tar.gz" workspace/

# Automated backup with cron
echo "0 2 * * * cd /path/to/roo-api && ./backup-config.sh" | crontab -
```

This production deployment guide provides comprehensive instructions for deploying the Roo Code Agent API in production environments with proper security, monitoring, and scaling considerations.
