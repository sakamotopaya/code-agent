# Container File Logging for API Server

## Overview

Implement file-based logging for the API server when running in development and production containers, ensuring logs are written to mapped host directories for persistence and debugging.

## Problem Statement

Currently, the API server only outputs logs to console/stdout when running in containers. This creates challenges for:

- **Development debugging**: Logs are lost when containers restart
- **Production monitoring**: No persistent log files for analysis
- **Log aggregation**: Difficult to collect and analyze application logs
- **Troubleshooting**: No way to review historical application events

## Current State Analysis

### Existing Infrastructure

- **Production container**: Has `api-logs:/app/logs:rw` volume mapping but application doesn't write to files
- **Development container**: Missing logs volume mapping entirely
- **Application logging**: Uses Fastify's built-in logger (Pino) outputting to console only
- **Docker logging**: Configured for container stdout/stderr but not application-specific files

### Current Fastify Logger Configuration

```typescript
this.app = fastify({
	logger: {
		level: config.getConfiguration().debug ? "debug" : "info",
	},
})
```

## Proposed Solution

### Approach: Enhanced Pino Configuration

Leverage Fastify's built-in Pino logger with enhanced configuration for file output. This approach provides:

- ✅ Production-ready logging with rotation
- ✅ Minimal code changes (Fastify already uses Pino)
- ✅ Structured JSON logs for better parsing
- ✅ Both console and file output
- ✅ Log rotation and compression

## Technical Implementation

### 1. Docker Configuration Updates

#### Development Environment (`docker/development/docker-compose.yml`)

```yaml
services:
    roo-api-dev:
        environment:
            # Add logging configuration
            - LOGS_PATH=/app/logs
            - LOG_LEVEL=${LOG_LEVEL:-debug}
            - LOG_FILE_ENABLED=${LOG_FILE_ENABLED:-true}
            - LOG_ROTATION_ENABLED=${LOG_ROTATION_ENABLED:-false}
            - LOG_MAX_SIZE=${LOG_MAX_SIZE:-10MB}
            - LOG_MAX_FILES=${LOG_MAX_FILES:-3}

        volumes:
            # Add logs volume mapping
            - ${LOGS_PATH:-./logs}:/app/logs:rw
            # ... existing volumes ...
```

#### Production Environment (`docker/production/docker-compose.yml`)

```yaml
services:
    roo-api:
        environment:
            # Add logging configuration
            - LOGS_PATH=/app/logs
            - LOG_LEVEL=${LOG_LEVEL:-info}
            - LOG_FILE_ENABLED=${LOG_FILE_ENABLED:-true}
            - LOG_ROTATION_ENABLED=${LOG_ROTATION_ENABLED:-true}
            - LOG_MAX_SIZE=${LOG_MAX_SIZE:-50MB}
            - LOG_MAX_FILES=${LOG_MAX_FILES:-7}

        volumes:
            # Replace named volume with host path mapping
            - ${LOGS_PATH:-./logs}:/app/logs:rw
            # Remove: - api-logs:/app/logs:rw
```

### 2. Enhanced Logger Configuration

#### New LoggerConfigManager (`src/api/config/LoggerConfigManager.ts`)

```typescript
import { FastifyLoggerOptions } from "fastify"
import { ApiConfigManager } from "./ApiConfigManager"
import path from "path"
import fs from "fs"

export class LoggerConfigManager {
	static createLoggerConfig(config: ApiConfigManager): FastifyLoggerOptions {
		const serverConfig = config.getConfiguration()
		const logsDir = process.env.LOGS_PATH || "/app/logs"
		const isContainer = process.env.NODE_ENV !== "test" && fs.existsSync("/app")
		const fileLoggingEnabled = process.env.LOG_FILE_ENABLED === "true"
		const rotationEnabled = process.env.LOG_ROTATION_ENABLED === "true"

		// Ensure logs directory exists
		if (fileLoggingEnabled && isContainer) {
			try {
				fs.mkdirSync(logsDir, { recursive: true })
			} catch (error) {
				console.warn(`Failed to create logs directory: ${error}`)
			}
		}

		const targets: any[] = [
			// Console output (always enabled)
			{
				target: "pino-pretty",
				level: serverConfig.debug ? "debug" : "info",
				options: {
					colorize: !isContainer, // No colors in container logs
					translateTime: "SYS:standard",
					ignore: "pid,hostname",
					messageFormat: "{time} [{level}] {msg}",
				},
			},
		]

		// Add file output for containers
		if (fileLoggingEnabled && isContainer) {
			// Main application log
			targets.push({
				target: "pino/file",
				level: "debug",
				options: {
					destination: path.join(logsDir, "api.log"),
					mkdir: true,
					append: true,
				},
			})

			// Error-only log
			targets.push({
				target: "pino/file",
				level: "error",
				options: {
					destination: path.join(logsDir, "api-error.log"),
					mkdir: true,
					append: true,
				},
			})

			// Add rotation if enabled (production)
			if (rotationEnabled) {
				targets.push({
					target: "pino-roll",
					level: "info",
					options: {
						file: path.join(logsDir, "api-rotate.log"),
						frequency: "daily",
						size: process.env.LOG_MAX_SIZE || "50MB",
						max: parseInt(process.env.LOG_MAX_FILES || "7"),
						compress: "gzip",
					},
				})
			}
		}

		return {
			level: serverConfig.debug ? "debug" : "info",
			transport: {
				targets,
			},
			formatters: {
				time: (timestamp) => `,"time":"${new Date(timestamp).toISOString()}"`,
				level: (label) => ({ level: label }),
			},
			serializers: {
				req: (req) => ({
					method: req.method,
					url: req.url,
					headers: req.headers,
					remoteAddress: req.ip,
					remotePort: req.socket?.remotePort,
				}),
				res: (res) => ({
					statusCode: res.statusCode,
					headers: res.headers,
				}),
			},
		}
	}
}
```

### 3. Update FastifyServer Implementation

#### Modify `src/api/server/FastifyServer.ts`

```typescript
import { LoggerConfigManager } from "../config/LoggerConfigManager"

export class FastifyServer {
	constructor(config: ApiConfigManager, adapters: CoreInterfaces) {
		this.config = config
		this.adapters = adapters
		this.jobManager = new JobManager()
		this.streamManager = new StreamManager()
		this.questionManager = new ApiQuestionManager()
		this.taskExecutionOrchestrator = new TaskExecutionOrchestrator()

		// Enhanced logger configuration
		this.app = fastify({
			logger: LoggerConfigManager.createLoggerConfig(config),
		})
	}
}
```

### 4. Directory Structure

Ensure the following directories exist:

```
docker/
├── development/
│   └── logs/          # New - for development logs
└── production/
    └── logs/          # New - for production logs
```

### 5. Log Format and Structure

#### Development Logs (Human-readable)

```
2024-01-15 10:30:45 [INFO] API Server started at http://0.0.0.0:3000
2024-01-15 10:30:46 [DEBUG] [+15ms] Task options prepared for job abc123
2024-01-15 10:30:47 [INFO] Task execution completed for job abc123: success
```

#### Production Logs (Structured JSON)

```json
{"time":"2024-01-15T15:30:45.123Z","level":"info","msg":"API Server started","host":"0.0.0.0","port":3000}
{"time":"2024-01-15T15:30:46.140Z","level":"debug","msg":"Task options prepared","jobId":"abc123","component":"api"}
{"time":"2024-01-15T15:30:47.250Z","level":"info","msg":"Task execution completed","jobId":"abc123","result":"success","duration":1110}
```

### 6. Log Files Organization

#### Development Environment

- `docker/development/logs/api.log` - All application logs
- `docker/development/logs/api-error.log` - Error-only logs

#### Production Environment

- `docker/production/logs/api.log` - All application logs
- `docker/production/logs/api-error.log` - Error-only logs
- `docker/production/logs/api-rotate.log.*` - Rotated daily logs
- `docker/production/logs/api-rotate.log.1.gz` - Compressed historical logs

## Implementation Steps

### Phase 1: Basic File Logging

1. Create `LoggerConfigManager.ts`
2. Update Docker compose files with logs volume mappings
3. Create logs directories
4. Update FastifyServer to use enhanced logger
5. Test basic file output

### Phase 2: Enhanced Features

1. Add structured logging format
2. Implement log rotation for production
3. Add error-specific log files
4. Configure log cleanup policies
5. Add performance logging

### Phase 3: Monitoring Integration

1. Add log aggregation compatibility
2. Implement log analysis tools
3. Configure alerts for error patterns
4. Add log archival strategies

## Benefits

### Development

- **Persistent debugging**: Logs survive container restarts
- **Better troubleshooting**: Historical log analysis
- **Performance monitoring**: Request timing and metrics
- **Error tracking**: Centralized error logging

### Production

- **Operational visibility**: Comprehensive application monitoring
- **Log aggregation**: Compatible with ELK, Splunk, etc.
- **Compliance**: Audit trail for security and compliance
- **Automated analysis**: Structured logs for automated processing

## Testing Strategy

### Manual Testing

1. Start development container and verify logs appear in `docker/development/logs/`
2. Start production container and verify logs appear in `docker/production/logs/`
3. Test log rotation by generating large log volumes
4. Verify error logs are properly separated

### Automated Testing

1. Unit tests for LoggerConfigManager configuration
2. Integration tests for file output
3. Container tests for volume mounting
4. Performance tests for logging overhead

## Dependencies

### New NPM Packages

```json
{
	"dependencies": {
		"pino-roll": "^1.0.0",
		"pino-pretty": "^10.0.0"
	}
}
```

### Existing Dependencies

- `fastify` (already installed - includes Pino)
- `pino` (transitive dependency of Fastify)

## Configuration Reference

### Environment Variables

| Variable               | Development Default | Production Default | Description               |
| ---------------------- | ------------------- | ------------------ | ------------------------- |
| `LOGS_PATH`            | `/app/logs`         | `/app/logs`        | Container logs directory  |
| `LOG_LEVEL`            | `debug`             | `info`             | Minimum log level         |
| `LOG_FILE_ENABLED`     | `true`              | `true`             | Enable file logging       |
| `LOG_ROTATION_ENABLED` | `false`             | `true`             | Enable log rotation       |
| `LOG_MAX_SIZE`         | `10MB`              | `50MB`             | Max log file size         |
| `LOG_MAX_FILES`        | `3`                 | `7`                | Max rotated files to keep |

### Host Volume Mapping

```bash
# Development
export LOGS_PATH="./docker/development/logs"
docker-compose -f docker/development/docker-compose.yml up

# Production
export LOGS_PATH="./docker/production/logs"
docker-compose -f docker/production/docker-compose.yml up
```

## Acceptance Criteria

- [ ] Development container writes logs to `docker/development/logs/`
- [ ] Production container writes logs to `docker/production/logs/`
- [ ] Logs persist across container restarts
- [ ] Error logs are separated into dedicated files
- [ ] Production logs are rotated daily with compression
- [ ] Log format is appropriate for each environment (pretty vs JSON)
- [ ] No performance degradation from logging
- [ ] Existing console logging continues to work
- [ ] Configuration is flexible via environment variables

## Future Enhancements

### Log Aggregation

- Integration with ELK Stack (Elasticsearch, Logstash, Kibana)
- Fluentd/Fluent Bit for log forwarding
- CloudWatch/Splunk integration

### Advanced Features

- Log sampling for high-volume scenarios
- Correlation IDs for request tracing
- Metrics extraction from logs
- Real-time log streaming API

### Monitoring & Alerting

- Log-based alerting for error patterns
- Performance monitoring from log analysis
- Automated log analysis and reporting
- Integration with monitoring dashboards
