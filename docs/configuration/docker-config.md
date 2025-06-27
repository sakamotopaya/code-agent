# Roo Code Agent API - Docker Configuration Reference

This comprehensive reference guide covers all configuration options for the Roo Code Agent API Docker deployment, including environment variables, configuration files, SSE streaming support, and best practices.

## Table of Contents

- [Configuration Overview](#configuration-overview)
- [Environment Variables](#environment-variables)
- [Configuration Files](#configuration-files)
- [SSE Streaming Configuration](#sse-streaming-configuration)
- [MCP Server Configuration](#mcp-server-configuration)
- [Network Configuration](#network-configuration)
- [Security Configuration](#security-configuration)
- [Volume Configuration](#volume-configuration)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Configuration Overview

The Roo Code Agent API supports multiple configuration sources with the following priority order (highest to lowest):

1. **Command-line overrides** (Docker environment variables)
2. **Environment variables** (`.env` file and system environment)
3. **Project configuration files** (`.roo-api.json`, `roo-api.config.json`)
4. **User configuration files** (`~/.roo-api/api.json`)
5. **CLI configuration files** (`~/.agentz/agent-config.json`)
6. **Default values**

### Configuration Architecture

```
Docker Container
├── Environment Variables (API_*)
├── Configuration Files (/app/config/)
│   ├── agent-config.json     # CLI/Agent configuration
│   ├── mcp-config.json       # MCP server configuration
│   └── api-config.json       # API-specific configuration (optional)
├── Workspace Mount (/app/workspace)
└── Default Configuration
```

## Environment Variables

### Core Server Configuration

| Variable      | Type      | Default       | Description                                    |
| ------------- | --------- | ------------- | ---------------------------------------------- |
| `API_PORT`    | `number`  | `3000`        | Server listening port                          |
| `API_HOST`    | `string`  | `localhost`   | Server binding host (use `0.0.0.0` for Docker) |
| `API_VERBOSE` | `boolean` | `false`       | Enable verbose logging                         |
| `API_DEBUG`   | `boolean` | `false`       | Enable debug mode                              |
| `NODE_ENV`    | `string`  | `development` | Node.js environment                            |

**Example:**

```bash
API_PORT=3000
API_HOST=0.0.0.0
API_VERBOSE=true
API_DEBUG=false
NODE_ENV=production
```

### Workspace Configuration

| Variable             | Type     | Default          | Description                              |
| -------------------- | -------- | ---------------- | ---------------------------------------- |
| `API_WORKSPACE_ROOT` | `string` | `/app/workspace` | Container workspace path                 |
| `WORKSPACE_PATH`     | `string` | `./workspace`    | Host workspace path (Docker Compose)     |
| `CONFIG_PATH`        | `string` | `./config`       | Host configuration path (Docker Compose) |

**Example:**

```bash
API_WORKSPACE_ROOT=/app/workspace
WORKSPACE_PATH=/path/to/your/project
CONFIG_PATH=/path/to/your/config
```

### CLI Integration Configuration

| Variable              | Type     | Default                         | Description                 |
| --------------------- | -------- | ------------------------------- | --------------------------- |
| `API_CLI_CONFIG_PATH` | `string` | `/app/config/agent-config.json` | CLI configuration file path |

**Example:**

```bash
API_CLI_CONFIG_PATH=/app/config/agent-config.json
```

### CORS Configuration

| Variable               | Type              | Default                       | Description            |
| ---------------------- | ----------------- | ----------------------------- | ---------------------- |
| `API_CORS_ORIGIN`      | `string\|boolean` | `*`                           | CORS allowed origins   |
| `API_CORS_CREDENTIALS` | `boolean`         | `true`                        | CORS allow credentials |
| `API_CORS_METHODS`     | `string`          | `GET,POST,PUT,DELETE,OPTIONS` | CORS allowed methods   |

**Examples:**

```bash
# Development (permissive)
API_CORS_ORIGIN=*
API_CORS_CREDENTIALS=true

# Production (restrictive)
API_CORS_ORIGIN=https://yourdomain.com,https://api.yourdomain.com
API_CORS_CREDENTIALS=true

# Multiple origins
API_CORS_ORIGIN=https://app1.com,https://app2.com
```

### Security Configuration

| Variable                | Type      | Default | Description                       |
| ----------------------- | --------- | ------- | --------------------------------- |
| `API_ENABLE_HELMET`     | `boolean` | `true`  | Enable Helmet.js security headers |
| `API_RATE_LIMIT_MAX`    | `number`  | `100`   | Maximum requests per window       |
| `API_RATE_LIMIT_WINDOW` | `string`  | `15m`   | Rate limiting time window         |

**Example:**

```bash
API_ENABLE_HELMET=true
API_RATE_LIMIT_MAX=100
API_RATE_LIMIT_WINDOW=15m
```

### Timeout Configuration

| Variable                 | Type     | Default  | Description                 |
| ------------------------ | -------- | -------- | --------------------------- |
| `API_REQUEST_TIMEOUT`    | `number` | `30000`  | HTTP request timeout (ms)   |
| `API_KEEP_ALIVE_TIMEOUT` | `number` | `5000`   | Keep-alive timeout (ms)     |
| `API_TASK_TIMEOUT`       | `number` | `600000` | Task execution timeout (ms) |

**Example:**

```bash
API_REQUEST_TIMEOUT=30000
API_KEEP_ALIVE_TIMEOUT=5000
API_TASK_TIMEOUT=600000
```

### HTTPS/TLS Configuration

| Variable         | Type     | Default | Description               |
| ---------------- | -------- | ------- | ------------------------- |
| `API_HTTPS_KEY`  | `string` | `null`  | Path to HTTPS private key |
| `API_HTTPS_CERT` | `string` | `null`  | Path to HTTPS certificate |

**Example:**

```bash
API_HTTPS_KEY=/app/ssl/private.key
API_HTTPS_CERT=/app/ssl/certificate.crt
```

### MCP Configuration

| Variable           | Type      | Default                       | Description                          |
| ------------------ | --------- | ----------------------------- | ------------------------------------ |
| `MCP_CONFIG_PATH`  | `string`  | `/app/config/mcp-config.json` | MCP configuration file path          |
| `MCP_AUTO_CONNECT` | `boolean` | `true`                        | Automatically connect to MCP servers |
| `MCP_TIMEOUT`      | `number`  | `30000`                       | MCP connection timeout (ms)          |
| `MCP_RETRIES`      | `number`  | `3`                           | MCP connection retry attempts        |

**Example:**

```bash
MCP_CONFIG_PATH=/app/config/mcp-config.json
MCP_AUTO_CONNECT=true
MCP_TIMEOUT=30000
MCP_RETRIES=3
```

## Configuration Files

### API Configuration (`api-config.json`)

Full API configuration file with all available options:

```json
{
	"port": 3000,
	"host": "0.0.0.0",
	"verbose": false,
	"debug": false,
	"workspaceRoot": "/app/workspace",

	"cors": {
		"origin": ["https://yourdomain.com", "https://api.yourdomain.com"],
		"credentials": true,
		"methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		"allowedHeaders": ["Content-Type", "Authorization", "X-Requested-With"],
		"exposedHeaders": ["X-Total-Count", "X-API-Version"]
	},

	"security": {
		"enableHelmet": true,
		"helmetOptions": {
			"contentSecurityPolicy": {
				"directives": {
					"defaultSrc": ["'self'"],
					"styleSrc": ["'self'", "'unsafe-inline'"],
					"scriptSrc": ["'self'"],
					"imgSrc": ["'self'", "data:", "https:"]
				}
			}
		},
		"rateLimit": {
			"max": 100,
			"timeWindow": "15m",
			"skipSuccessfulRequests": false,
			"skipFailedRequests": false
		}
	},

	"timeouts": {
		"request": 30000,
		"keepAlive": 5000,
		"task": 600000,
		"gracefulShutdown": 10000
	},

	"logging": {
		"level": "info",
		"format": "json",
		"file": "/app/logs/api.log",
		"maxFiles": 5,
		"maxSize": "10MB"
	},

	"monitoring": {
		"enableMetrics": true,
		"metricsPath": "/metrics",
		"healthCheckPath": "/health",
		"statusPath": "/status"
	}
}
```

### Agent Configuration (`agent-config.json`)

CLI agent configuration for API compatibility:

```json
{
	"apiProvider": "anthropic",
	"apiKey": "your-api-key",
	"apiModelId": "claude-3-5-sonnet-20241022",

	"openAiBaseUrl": "https://api.openai.com/v1",
	"openAiApiKey": "your-openai-key",
	"openAiModelId": "gpt-4",

	"anthropicBaseUrl": "https://api.anthropic.com",
	"anthropicApiKey": "your-anthropic-key",

	"openRouterApiKey": "your-openrouter-key",
	"openRouterModelId": "anthropic/claude-3.5-sonnet",

	"glamaApiKey": "your-glama-key",
	"glamaModelId": "claude-3-sonnet",

	"mcpEnabled": true,
	"mcpAutoConnect": true,
	"mcpConfigPath": "/app/config/mcp-config.json",
	"mcpTimeout": 30000,
	"mcpRetries": 3,

	"verbose": false,
	"debug": false,

	"features": {
		"codeIndex": true,
		"browser": true,
		"terminal": true,
		"mcp": true
	},

	"preferences": {
		"maxTokens": 8192,
		"temperature": 0.7,
		"topP": 1.0
	}
}
```

## MCP Server Configuration

### Basic MCP Configuration (`mcp-config.json`)

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
			"args": ["-y", "@modelcontextprotocol/server-filesystem", "/app/workspace"],
			"env": {}
		},

		"postgres": {
			"command": "npx",
			"args": ["-y", "@modelcontextprotocol/server-postgres"],
			"env": {
				"POSTGRES_CONNECTION_STRING": "${DATABASE_URL}"
			}
		}
	}
}
```

### Advanced MCP Configuration

```json
{
	"mcpServers": {
		"github": {
			"command": "npx",
			"args": ["-y", "@modelcontextprotocol/server-github"],
			"env": {
				"GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}",
				"DEBUG": "*"
			},
			"timeout": 30000,
			"retries": 3,
			"autoRestart": true,
			"healthCheck": {
				"enabled": true,
				"interval": 60000,
				"timeout": 5000
			}
		},

		"custom-mcp-server": {
			"command": "node",
			"args": ["/app/custom-mcp/index.js"],
			"cwd": "/app/custom-mcp",
			"env": {
				"CONFIG_PATH": "/app/config/custom-mcp.json",
				"LOG_LEVEL": "debug"
			},
			"stdio": ["pipe", "pipe", "pipe"],
			"timeout": 45000,
			"retries": 5
		},

		"mssql-dpsp": {
			"command": "dotnet",
			"args": ["/app/mcp-servers/mssql/Core.Infrastructure.McpServer.dll"],
			"env": {
				"CONNECTION_STRING": "${MSSQL_CONNECTION_STRING}",
				"ENVIRONMENT": "development"
			},
			"workingDirectory": "/app/mcp-servers/mssql"
		}
	},

	"global": {
		"timeout": 30000,
		"retries": 3,
		"autoRestart": true,
		"logLevel": "info",
		"enableMetrics": true
	}
}
```

### Environment Variable Substitution

MCP configuration supports environment variable substitution:

```json
{
	"mcpServers": {
		"database": {
			"command": "npx",
			"args": ["-y", "@modelcontextprotocol/server-postgres"],
			"env": {
				"POSTGRES_CONNECTION_STRING": "${DATABASE_URL}",
				"POSTGRES_SSL": "${DATABASE_SSL:-false}",
				"POSTGRES_POOL_SIZE": "${DATABASE_POOL_SIZE:-10}"
			}
		}
	}
}
```

Corresponding environment variables:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
DATABASE_SSL=true
DATABASE_POOL_SIZE=20
```

## Network Configuration

### Docker Compose Network Setup

```yaml
# docker-compose.yml network configuration
version: "3.8"

services:
    roo-api:
        # ... service configuration
        networks:
            - roo-api-network
            - external-network
        ports:
            - "${API_PORT:-3000}:3000"

networks:
    roo-api-network:
        driver: bridge
        ipam:
            config:
                - subnet: 172.20.0.0/16

    external-network:
        external: true
        name: shared-network
```

### Port Configuration

| Service    | Internal Port | External Port | Purpose                           |
| ---------- | ------------- | ------------- | --------------------------------- |
| API Server | 3000          | 3000          | HTTP API endpoints                |
| Debug Port | 9229          | 9229          | Node.js debugging (dev only)      |
| Metrics    | 3000          | 3000          | Prometheus metrics (via /metrics) |

### Reverse Proxy Configuration

#### Nginx Configuration

```nginx
# nginx.conf for reverse proxy
upstream roo-api {
    server roo-api:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/ssl/certs/api.yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/api.yourdomain.com.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # API endpoints
    location / {
        proxy_pass http://roo-api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support for streaming endpoints
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no auth required)
    location /health {
        proxy_pass http://roo-api/health;
        proxy_set_header Host $host;
    }
}
```

## Security Configuration

### Production Security Settings

```bash
# Production security environment variables
API_ENABLE_HELMET=true
API_RATE_LIMIT_MAX=100
API_RATE_LIMIT_WINDOW=15m
API_CORS_ORIGIN=https://yourdomain.com
API_CORS_CREDENTIALS=true
```

### Security Headers Configuration

```json
{
	"security": {
		"enableHelmet": true,
		"helmetOptions": {
			"contentSecurityPolicy": {
				"directives": {
					"defaultSrc": ["'self'"],
					"styleSrc": ["'self'", "'unsafe-inline'"],
					"scriptSrc": ["'self'"],
					"imgSrc": ["'self'", "data:", "https:"],
					"connectSrc": ["'self'", "wss:", "https:"],
					"fontSrc": ["'self'", "https:"],
					"objectSrc": ["'none'"],
					"mediaSrc": ["'self'"],
					"frameSrc": ["'none'"]
				}
			},
			"crossOriginEmbedderPolicy": { "policy": "require-corp" },
			"crossOriginOpenerPolicy": { "policy": "same-origin" },
			"crossOriginResourcePolicy": { "policy": "same-origin" },
			"dnsPrefetchControl": { "allow": false },
			"frameguard": { "action": "deny" },
			"hidePoweredBy": true,
			"hsts": {
				"maxAge": 31536000,
				"includeSubDomains": true,
				"preload": true
			},
			"ieNoOpen": true,
			"noSniff": true,
			"originAgentCluster": true,
			"permittedCrossDomainPolicies": false,
			"referrerPolicy": { "policy": "no-referrer" },
			"xssFilter": true
		}
	}
}
```

### Rate Limiting Configuration

```json
{
	"security": {
		"rateLimit": {
			"max": 100,
			"timeWindow": "15m",
			"message": "Too many requests, please try again later",
			"standardHeaders": true,
			"legacyHeaders": false,
			"skipSuccessfulRequests": false,
			"skipFailedRequests": false,
			"keyGenerator": "ip",
			"skip": ["127.0.0.1", "::1"],
			"onLimitReached": "log"
		}
	}
}
```

## Volume Configuration

### Production Volume Setup

```yaml
# docker-compose.yml volume configuration
version: "3.8"

services:
    roo-api:
        volumes:
            # Configuration (read-only)
            - ${CONFIG_PATH}:/app/config:ro

            # Workspace (read-write)
            - ${WORKSPACE_PATH}:/app/workspace:rw

            # Logs (persistent)
            - api-logs:/app/logs

            # SSL certificates (read-only)
            - ${SSL_CERT_PATH}:/app/ssl:ro

            # Temporary files (tmpfs for performance)
            - type: tmpfs
              target: /tmp
              tmpfs:
                  size: 100M

volumes:
    api-logs:
        driver: local
        driver_opts:
            type: none
            o: bind
            device: ${LOGS_PATH:-./logs}
```

### Development Volume Setup

```yaml
# Development volume configuration
services:
    roo-api-dev:
        volumes:
            # Source code (bind mount for hot reload)
            - ../../src:/app:cached

            # Configuration (bind mount)
            - ./config:/app/config:rw

            # Workspace (bind mount)
            - ./workspace:/app/workspace:rw

            # Node modules (named volume for performance)
            - node_modules:/app/node_modules

            # Cache directory
            - api-cache:/app/.cache

volumes:
    node_modules:
    api-cache:
```

## Examples

### Complete Production Configuration

#### `.env` file

```bash
# Production environment configuration
NODE_ENV=production

# Server
API_PORT=3000
API_HOST=0.0.0.0
API_VERBOSE=false
API_DEBUG=false

# Paths
WORKSPACE_PATH=/data/workspaces/production
CONFIG_PATH=/data/config/production
LOGS_PATH=/data/logs/roo-api

# CORS
API_CORS_ORIGIN=https://app.yourdomain.com,https://api.yourdomain.com
API_CORS_CREDENTIALS=true

# Security
API_ENABLE_HELMET=true
API_RATE_LIMIT_MAX=100
API_RATE_LIMIT_WINDOW=15m

# MCP
MCP_AUTO_CONNECT=true
MCP_TIMEOUT=30000
MCP_RETRIES=3

# SSL (future use)
# API_HTTPS_KEY=/app/ssl/private.key
# API_HTTPS_CERT=/app/ssl/certificate.crt
```

#### `docker-compose.yml`

```yaml
version: "3.8"

services:
    roo-api:
        build:
            context: ../../
            dockerfile: docker/production/Dockerfile
        restart: unless-stopped
        ports:
            - "127.0.0.1:${API_PORT}:3000"
        environment:
            - NODE_ENV=${NODE_ENV}
            - API_PORT=${API_PORT}
            - API_HOST=${API_HOST}
            - API_VERBOSE=${API_VERBOSE}
            - API_DEBUG=${API_DEBUG}
            - API_WORKSPACE_ROOT=/app/workspace
            - API_CLI_CONFIG_PATH=/app/config/agent-config.json
            - API_CORS_ORIGIN=${API_CORS_ORIGIN}
            - API_CORS_CREDENTIALS=${API_CORS_CREDENTIALS}
            - API_ENABLE_HELMET=${API_ENABLE_HELMET}
            - API_RATE_LIMIT_MAX=${API_RATE_LIMIT_MAX}
            - API_RATE_LIMIT_WINDOW=${API_RATE_LIMIT_WINDOW}
            - MCP_CONFIG_PATH=/app/config/mcp-config.json
            - MCP_AUTO_CONNECT=${MCP_AUTO_CONNECT}
            - MCP_TIMEOUT=${MCP_TIMEOUT}
            - MCP_RETRIES=${MCP_RETRIES}
        volumes:
            - ${WORKSPACE_PATH}:/app/workspace:rw
            - ${CONFIG_PATH}:/app/config:ro
            - ${LOGS_PATH}:/app/logs:rw
        networks:
            - roo-api-network
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

networks:
    roo-api-network:
        driver: bridge
```

### Complete Development Configuration

#### `.env` file

```bash
# Development environment configuration
NODE_ENV=development

# Server
API_PORT=3000
API_HOST=0.0.0.0
API_VERBOSE=true
API_DEBUG=true
DEBUG_PORT=9229

# Paths
WORKSPACE_PATH=./workspace
CONFIG_PATH=./config

# CORS (permissive for development)
API_CORS_ORIGIN=*
API_CORS_CREDENTIALS=true

# Security (relaxed for development)
API_ENABLE_HELMET=false

# MCP
MCP_AUTO_CONNECT=true
MCP_TIMEOUT=60000
MCP_RETRIES=5
```

## Best Practices

### Configuration Management

1. **Environment Separation**: Use different configuration files for different environments
2. **Secret Management**: Never commit secrets to version control
3. **Environment Variables**: Use environment variables for deployment-specific settings
4. **Configuration Validation**: Validate configuration on startup
5. **Documentation**: Document all configuration options

### Security Best Practices

1. **Principle of Least Privilege**: Grant minimal necessary permissions
2. **Network Isolation**: Use Docker networks for service isolation
3. **Regular Updates**: Keep base images and dependencies updated
4. **Secret Rotation**: Regularly rotate API keys and secrets
5. **Monitoring**: Monitor for security events and anomalies

### Performance Best Practices

1. **Resource Limits**: Set appropriate CPU and memory limits
2. **Volume Optimization**: Use appropriate volume types for different data
3. **Network Optimization**: Minimize network latency
4. **Caching**: Implement appropriate caching strategies
5. **Monitoring**: Monitor performance metrics and logs

### SSE Streaming Best Practices

1. **Connection Management**:

    - Set appropriate `ulimits` for file descriptors (65536+)
    - Monitor concurrent connection counts
    - Implement connection cleanup on client disconnect

2. **Proxy Configuration**:

    - Disable buffering completely (`proxy_buffering off`)
    - Use long timeouts for streaming endpoints (24h+)
    - Disable compression for SSE endpoints (`gzip off`)
    - Set `X-Accel-Buffering: no` header

3. **Container Optimization**:

    - Increase Node.js heap size for concurrent connections
    - Use `UV_THREADPOOL_SIZE=128` for better I/O performance
    - Set appropriate SSE heartbeat intervals (30s recommended)

4. **Load Balancing**:

    - Use session persistence (`ip_hash`) for SSE endpoints
    - Consider sticky sessions for multi-instance deployments
    - Monitor connection distribution across instances

5. **Error Handling**:

    - Implement proper SSE error events
    - Use exponential backoff for client reconnection
    - Log SSE connection errors for debugging

6. **Testing**:
    - Test SSE endpoints with `curl -N` for basic functionality
    - Load test with tools like `wrk` or `artillery` for concurrent connections
    - Monitor memory usage during long-running streams

### Operational Best Practices

1. **Health Checks**: Implement comprehensive health checks
2. **Logging**: Use structured logging with appropriate levels
3. **Monitoring**: Set up monitoring and alerting
4. **Backup**: Backup important configuration and data
5. **Documentation**: Maintain up-to-date documentation

### SSE Monitoring and Troubleshooting

#### Key Metrics to Monitor

- **Active SSE connections**: Current number of streaming connections
- **Connection duration**: Average and maximum connection lifetime
- **Event throughput**: Events per second across all connections
- **Memory usage**: Heap usage during streaming operations
- **Error rates**: Failed connections and dropped streams

#### Common Issues and Solutions

| Issue            | Symptoms                 | Solution                                       |
| ---------------- | ------------------------ | ---------------------------------------------- |
| Buffering delays | Events arrive in batches | Disable all proxy buffering                    |
| Connection drops | Frequent reconnections   | Increase proxy timeouts                        |
| Memory leaks     | Growing memory usage     | Implement proper cleanup on disconnect         |
| Slow startup     | Long time to first event | Optimize application startup                   |
| High CPU usage   | Performance degradation  | Tune heartbeat intervals and connection limits |

#### Debug Commands

```bash
# Monitor active connections
docker-compose exec roo-api netstat -an | grep :3000 | grep ESTABLISHED | wc -l

# Check SSE event logs
docker-compose logs roo-api | grep -E "(SSE|stream|event-stream)"

# Test SSE endpoint health
curl -N -m 30 -H "Accept: text/event-stream" http://localhost:3000/execute/stream

# Monitor container resource usage during streaming
docker stats roo-api --no-stream
```

This configuration reference provides comprehensive guidance for configuring the Roo Code Agent API Docker deployment with optimal SSE streaming support across all environments and use cases.
