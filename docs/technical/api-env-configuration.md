# API Environment Configuration

## Overview

The `run-api.sh` script now supports loading environment variables from `.env` files, providing consistency between local development and containerized environments.

## .env File Loading

### Default Behavior

The script automatically looks for and loads environment variables from:

1. `.env` (project root, configured for docker/development directories)
2. Custom path specified with `--env-file` option

### Precedence Order

Environment variables are applied in the following order (highest to lowest priority):

1. **Command-line arguments** (e.g., `--port 8080`)
2. **Existing environment variables** (already set in shell)
3. **`.env` file variables** (loaded from file)
4. **Script defaults** (hardcoded fallbacks)

### Usage Examples

```bash
# Use default .env file (docker/development/.env)
./run-api.sh

# Use custom .env file
./run-api.sh --env-file .env.local

# Override specific values
API_PORT=8080 ./run-api.sh

# Combine approaches
./run-api.sh --env-file .env.production --port 9000
```

## Setting Up Your .env File

### Step 1: Create the .env File

The script will offer to create a default .env file when you first run it:

```bash
./run-api.sh
# Answer 'y' when prompted to create the .env file
```

Or create it manually with docker/development paths:

```bash
# The .env file is automatically configured to use docker/development directories
# ensuring consistency between local and containerized development
```

### Step 2: Configure API Keys

Edit the project root `.env` file and add your API keys:

```bash
# API Keys (uncomment and set your actual values)
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here
GITHUB_TOKEN=your_github_token_here
```

### Step 3: Customize Other Settings

The `.env` file is pre-configured with docker/development paths and supports all environment variables used by the API server:

```bash
# Directory Configuration (points to docker/development for consistency)
API_WORKSPACE_ROOT=docker/development/workspace
ROO_GLOBAL_STORAGE_PATH=docker/development/storage
ROO_CLI_STORAGE_PATH=docker/development/cli-storage
API_STORAGE_ROOT=docker/development/storage
LOGS_PATH=docker/development/logs
CONFIG_PATH=docker/development/config
API_CLI_CONFIG_PATH=docker/development/config/agent-config.json
MCP_CONFIG_PATH=docker/development/config/mcp-config.json

# API Configuration
API_PORT=3000
API_HOST=localhost
API_VERBOSE=true
API_DEBUG=true

# Logging Configuration
LOG_LEVEL=debug
LOG_FILE_ENABLED=true
LOG_ROTATION_ENABLED=false
LOG_MAX_SIZE=10MB
LOG_MAX_FILES=3

# MCP Configuration
MCP_AUTO_CONNECT=true
MCP_TIMEOUT=30000
MCP_RETRIES=3

# CORS Configuration
API_CORS_ORIGIN=*
API_CORS_CREDENTIALS=true

# Security Configuration
API_ENABLE_HELMET=false
API_RATE_LIMIT_MAX=1000
API_RATE_LIMIT_WINDOW=1m

# Timeout Configuration
API_REQUEST_TIMEOUT=60000
API_KEEP_ALIVE_TIMEOUT=10000
API_TASK_TIMEOUT=1800000

# SSE Configuration
API_SSE_HEARTBEAT_INTERVAL=10000
API_SSE_RETRY_TIMEOUT=1000
API_SSE_MAX_CONNECTIONS=50
API_STREAM_BUFFER_SIZE=512
```

## Environment Variables Reference

### Core API Settings

| Variable             | Description            | Default           |
| -------------------- | ---------------------- | ----------------- |
| `API_PORT`           | Server port            | `3000`            |
| `API_HOST`           | Server host            | `localhost`       |
| `API_VERBOSE`        | Enable verbose logging | `true`            |
| `API_DEBUG`          | Enable debug mode      | `true`            |
| `API_WORKSPACE_ROOT` | Working directory      | Current directory |

### API Keys

| Variable                  | Description                         |
| ------------------------- | ----------------------------------- |
| `ANTHROPIC_API_KEY`       | Anthropic API key for Claude models |
| `OPENAI_API_KEY`          | OpenAI API key                      |
| `GITHUB_TOKEN`            | GitHub token for repository access  |
| `DATABASE_URL`            | Database connection string          |
| `MSSQL_CONNECTION_STRING` | SQL Server connection string        |

### Logging Configuration

| Variable               | Description                              | Default |
| ---------------------- | ---------------------------------------- | ------- |
| `LOG_LEVEL`            | Logging level (debug, info, warn, error) | `info`  |
| `LOG_FILE_ENABLED`     | Enable file logging                      | `false` |
| `LOG_ROTATION_ENABLED` | Enable log rotation                      | `false` |
| `LOG_MAX_SIZE`         | Maximum log file size                    | `10MB`  |
| `LOG_MAX_FILES`        | Maximum number of log files              | `3`     |

### MCP Configuration

| Variable           | Description                    | Default |
| ------------------ | ------------------------------ | ------- |
| `MCP_CONFIG_PATH`  | Path to MCP configuration file |         |
| `MCP_AUTO_CONNECT` | Auto-connect to MCP servers    | `true`  |
| `MCP_TIMEOUT`      | MCP operation timeout (ms)     | `30000` |
| `MCP_RETRIES`      | Number of MCP retry attempts   | `3`     |

### Security & Performance

| Variable                | Description                       | Default |
| ----------------------- | --------------------------------- | ------- |
| `API_CORS_ORIGIN`       | CORS origin setting               | `true`  |
| `API_CORS_CREDENTIALS`  | CORS credentials setting          | `true`  |
| `API_ENABLE_HELMET`     | Enable Helmet security middleware | `true`  |
| `API_RATE_LIMIT_MAX`    | Rate limit maximum requests       | `1000`  |
| `API_RATE_LIMIT_WINDOW` | Rate limit time window            | `1m`    |

## Troubleshooting

### .env File Not Loading

1. **Check file location**: Ensure the file is at `docker/development/.env`
2. **Check file format**: Ensure variables are in `KEY=value` format
3. **Check permissions**: Ensure the file is readable
4. **Use verbose mode**: Run with `API_VERBOSE=true` to see loading messages

### Environment Variables Not Taking Effect

1. **Check precedence**: Existing env vars override .env file values
2. **Restart the script**: Changes to .env files require restarting the script
3. **Check syntax**: Ensure no spaces around the `=` sign in .env file

### API Keys Not Working

1. **Uncomment the lines**: Remove `#` from the beginning of API key lines
2. **Check key format**: Ensure keys are properly formatted
3. **Verify keys**: Test keys with the respective services

## Docker Compatibility

The `.env` file format is compatible with Docker Compose, ensuring consistency between:

- Local development (`./run-api.sh`)
- Containerized development (`docker-compose up`)

Both environments will use the same configuration when using `docker/development/.env`.
