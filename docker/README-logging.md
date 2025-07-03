# Container File Logging Setup

This document explains how to set up and use the enhanced file logging system for the API server when running in Docker containers.

## Overview

The API server now supports writing logs to files when running in Docker containers, in addition to console output. This provides persistent logging for debugging, monitoring, and analysis.

## Quick Start

### Development Environment

1. Navigate to the development directory:

    ```bash
    cd docker/development
    ```

2. Copy the example environment file:

    ```bash
    cp .env.example .env
    ```

3. Start the container:

    ```bash
    docker-compose up -d
    ```

4. View logs in real-time:

    ```bash
    # Console logs
    docker-compose logs -f roo-api-dev

    # File logs
    tail -f logs/api.log
    ```

### Production Environment

1. Navigate to the production directory:

    ```bash
    cd docker/production
    ```

2. Copy the example environment file:

    ```bash
    cp .env.example .env
    ```

3. Configure your API keys in the `.env` file

4. Start the container:

    ```bash
    docker-compose up -d
    ```

5. Monitor logs:

    ```bash
    # Console logs
    docker-compose logs -f roo-api

    # File logs
    tail -f logs/api.log
    tail -f logs/api-error.log
    ```

## Log Files Structure

### Development Environment

```
docker/development/logs/
├── api.log              # All application logs
└── api-error.log        # Error-only logs
```

### Production Environment

```
docker/production/logs/
├── api.log              # All application logs
├── api-error.log        # Error-only logs
└── api-2024-01-15.log   # Daily rotated logs (when rotation enabled)
```

## Configuration Options

### Environment Variables

| Variable               | Development Default | Production Default | Description                   |
| ---------------------- | ------------------- | ------------------ | ----------------------------- |
| `LOGS_PATH`            | `./logs`            | `./logs`           | Host directory for log files  |
| `LOG_LEVEL`            | `debug`             | `info`             | Minimum log level             |
| `LOG_FILE_ENABLED`     | `true`              | `true`             | Enable file logging           |
| `LOG_ROTATION_ENABLED` | `false`             | `true`             | Enable daily log rotation     |
| `LOG_MAX_SIZE`         | `10MB`              | `50MB`             | Maximum log file size         |
| `LOG_MAX_FILES`        | `3`                 | `7`                | Maximum rotated files to keep |

### Customizing Log Directory

To change where logs are stored on the host:

```bash
# In your .env file
LOGS_PATH=/path/to/your/logs

# Or set when running docker-compose
LOGS_PATH=/var/log/roo-api docker-compose up -d
```

## Log Formats

### Development (Human-readable)

```
2024-01-15 10:30:45 [INFO] 🚀 API Server started at http://0.0.0.0:3000
2024-01-15 10:30:46 [DEBUG] [+15ms] Task options prepared for job abc123
2024-01-15 10:30:47 [INFO] Task execution completed for job abc123: success
```

### Production (Structured JSON)

```json
{"time":"2024-01-15T15:30:45.123Z","level":"info","msg":"🚀 API Server started","host":"0.0.0.0","port":3000}
{"time":"2024-01-15T15:30:46.140Z","level":"debug","msg":"Task options prepared","jobId":"abc123","component":"api"}
{"time":"2024-01-15T15:30:47.250Z","level":"info","msg":"Task execution completed","jobId":"abc123","result":"success","duration":1110}
```

## Monitoring and Analysis

### Real-time Monitoring

```bash
# Watch all logs
tail -f logs/api.log

# Watch errors only
tail -f logs/api-error.log

# Filter by log level
grep '"level":"error"' logs/api.log

# Follow logs with search
tail -f logs/api.log | grep "jobId"
```

### Log Analysis

```bash
# Count error occurrences
grep -c '"level":"error"' logs/api.log

# Find slow requests (>5 seconds)
grep '"duration":[5-9][0-9][0-9][0-9]' logs/api.log

# Extract job execution times
grep '"msg":"Task execution completed"' logs/api.log | jq '.duration'
```

## Troubleshooting

### Issue: No log files are created

1. **Check file logging is enabled:**

    ```bash
    docker-compose exec roo-api-dev env | grep LOG_FILE_ENABLED
    ```

2. **Verify logs directory permissions:**

    ```bash
    ls -la logs/
    # Should be writable by the container user
    ```

3. **Check container logs for errors:**
    ```bash
    docker-compose logs roo-api-dev | grep -i "log"
    ```

### Issue: Permission denied errors

1. **Fix directory permissions:**

    ```bash
    sudo chown -R 1000:1000 logs/
    # or
    chmod 777 logs/
    ```

2. **Recreate the logs directory:**
    ```bash
    rm -rf logs/
    mkdir -p logs/
    docker-compose restart
    ```

### Issue: Log rotation not working

1. **Verify rotation is enabled:**

    ```bash
    docker-compose exec roo-api env | grep LOG_ROTATION_ENABLED
    ```

2. **Check available disk space:**

    ```bash
    df -h logs/
    ```

3. **Review container logs:**
    ```bash
    docker-compose logs roo-api | grep -i "rotation"
    ```

## Integration with Log Management

### ELK Stack (Elasticsearch, Logstash, Kibana)

Configure Filebeat to collect logs:

```yaml
# filebeat.yml
filebeat.inputs:
    - type: log
      enabled: true
      paths:
          - /path/to/docker/*/logs/api.log
      fields:
          service: roo-api
      fields_under_root: true
```

### Fluentd

```conf
<source>
  @type tail
  path /path/to/docker/*/logs/api.log
  pos_file /var/log/fluentd/roo-api.log.pos
  tag roo.api
  format json
</source>
```

### Splunk

```conf
[monitor:///path/to/docker/*/logs/api.log]
disabled = false
index = roo-api
sourcetype = json
```

## Performance Considerations

### Log File Size Management

- **Development**: Small files (10MB max) with limited retention (3 files)
- **Production**: Larger files (50MB max) with longer retention (7 days)
- **High-volume environments**: Consider reducing log level or increasing rotation frequency

### Storage Requirements

Estimate storage needs based on request volume:

```
Daily log size ≈ (requests/day × avg_log_entry_size × log_entries_per_request)

Example:
- 10,000 requests/day
- 200 bytes average log entry
- 3 log entries per request
= ~6MB/day
```

### Container Performance

File logging adds minimal overhead:

- **CPU**: <1% additional usage
- **Memory**: ~10MB for log buffers
- **I/O**: Asynchronous writes, minimal impact

## Security Considerations

### Log Content

The logging system automatically redacts sensitive information:

- Authorization headers → `[REDACTED]`
- API keys in URLs → `[REDACTED]`
- Password fields → `[REDACTED]`

### File Permissions

Ensure log files have appropriate permissions:

```bash
# Recommended permissions
chmod 640 logs/api.log        # Owner read/write, group read
chmod 750 logs/               # Owner full, group read/execute
```

### Log Rotation Security

- Compressed old logs are automatically secured
- Consider encrypting archived logs for compliance
- Regular cleanup of old log files

## API Integration

The logging configuration can be queried via API:

```bash
# Get current logging status
curl http://localhost:3000/status

# Health check includes logging status
curl http://localhost:3000/health
```

Example response:

```json
{
	"status": "healthy",
	"logging": {
		"fileEnabled": true,
		"rotationEnabled": true,
		"logsDirectory": "/app/logs",
		"level": "info"
	}
}
```
