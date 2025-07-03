# Docker Health Check Inconsistency Issue

## Problem Identified

There's an inconsistency between the health check configurations in development and production Docker Compose files.

## Current State

### Development Health Check

```yaml
# docker/development/docker-compose.yml
healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 20s
```

### Production Health Check

```yaml
# docker/production/docker-compose.yml
healthcheck:
    test: ["CMD", "../health-check.sh"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

## Issues

1. **Different Test Commands**:

    - Development: Simple `curl` command
    - Production: Comprehensive health check script

2. **Different Start Periods**:

    - Development: 20 seconds
    - Production: 40 seconds

3. **Different Validation Levels**:
    - Development: Only tests HTTP 200 response
    - Production: Tests multiple endpoints, validates JSON, checks system resources

## Impact

- **Inconsistent Behavior**: Different environments have different health check sensitivity
- **Development Blind Spots**: Simple curl won't catch issues that the comprehensive script would
- **Production Timing**: Longer start period may be appropriate for production but unnecessary for development
- **Maintenance Burden**: Two different health check approaches to maintain

## Recommended Solution

**Standardize on the comprehensive health check script for both environments:**

### Option 1: Use Script in Both (Recommended)

```yaml
# Both development and production
healthcheck:
    test: ["CMD", "../health-check.sh"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s # Compromise between 20s and 40s
```

**Benefits:**

- ✅ Consistent validation across environments
- ✅ Better error detection in development
- ✅ Same health check logic everywhere
- ✅ Comprehensive endpoint testing

### Option 2: Use Simple Curl in Both

```yaml
# Both development and production
healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 20s
```

**Benefits:**

- ✅ Simpler, faster health checks
- ✅ No dependency on health-check.sh script

## Recommendation

**Use Option 1** (comprehensive script for both) because:

1. **Better Validation**: The health-check.sh script validates:

    - Multiple endpoints (/health, /status)
    - JSON response structure
    - System resource usage
    - Process health

2. **Consistent Behavior**: Same health check logic in all environments

3. **Better Debugging**: Comprehensive script provides detailed error messages

4. **Production Ready**: Development testing with production-level validation

## Implementation

### Development Dockerfile Update Needed

The development Dockerfile needs to copy the health-check.sh script:

```dockerfile
# Add to development Dockerfile
COPY --chown=devuser:devuser docker/scripts/health-check.sh ../health-check.sh
RUN chmod +x ../health-check.sh
```

### Standardized Health Check Configuration

```yaml
healthcheck:
    test: ["CMD", "../health-check.sh"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s
```

## Alternative: Environment-Specific Script Behavior

If different validation levels are desired, the health-check.sh script could be modified to check the NODE_ENV environment variable:

```bash
# In health-check.sh
if [ "$NODE_ENV" = "development" ]; then
    # Simpler checks for development
    check_endpoint "/health" 200 "Health endpoint"
else
    # Comprehensive checks for production
    check_endpoint "/health" 200 "Health endpoint"
    check_endpoint "/status" 200 "Status endpoint"
    validate_json_response "/health" "status" "Health endpoint JSON"
    # ... more checks
fi
```

This allows one script with environment-appropriate behavior while maintaining consistency.
