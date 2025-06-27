#!/bin/bash
# Roo Code Agent API - Health Check Script
# Comprehensive health validation for Docker containers

set -e

# Configuration
HOST=${HEALTH_CHECK_HOST:-localhost}
PORT=${HEALTH_CHECK_PORT:-3000}
TIMEOUT=${HEALTH_CHECK_TIMEOUT:-10}
VERBOSE=${HEALTH_CHECK_VERBOSE:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "$1"
    fi
}

# Error logging (always shown)
error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
}

# Success logging (always shown for final result)
success() {
    echo -e "${GREEN}$1${NC}"
}

# Warning logging
warn() {
    echo -e "${YELLOW}WARNING: $1${NC}" >&2
}

# Function to check HTTP endpoint
check_endpoint() {
    local endpoint=$1
    local expected_status=${2:-200}
    local description=${3:-"$endpoint"}
    
    log "Checking $description..."
    
    # Use curl with timeout and proper error handling
    local response
    response=$(curl -s -w "%{http_code}" -m "$TIMEOUT" \
        "http://${HOST}:${PORT}${endpoint}" 2>/dev/null || echo "000")
    
    local status_code=${response: -3}
    local body=${response%???}
    
    if [ "$status_code" != "$expected_status" ]; then
        error "$description failed: HTTP $status_code"
        log "Response body: $body"
        return 1
    fi
    
    log "$description: HTTP $status_code ✓"
    return 0
}

# Function to validate JSON response
validate_json_response() {
    local endpoint=$1
    local required_field=$2
    local description=${3:-"$endpoint"}
    
    log "Validating JSON response from $description..."
    
    local response
    response=$(curl -s -m "$TIMEOUT" "http://${HOST}:${PORT}${endpoint}" 2>/dev/null || echo "{}")
    
    # Check if response is valid JSON
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        error "$description returned invalid JSON"
        return 1
    fi
    
    # Check for required field if specified
    if [ -n "$required_field" ]; then
        if ! echo "$response" | jq -e ".$required_field" >/dev/null 2>&1; then
            error "$description missing required field: $required_field"
            return 1
        fi
    fi
    
    log "$description JSON validation: ✓"
    return 0
}

# Function to check if port is listening
check_port() {
    log "Checking if port $PORT is listening..."
    
    if command -v nc >/dev/null 2>&1; then
        # Use netcat if available
        if ! nc -z "$HOST" "$PORT" 2>/dev/null; then
            error "Port $PORT is not listening on $HOST"
            return 1
        fi
    elif command -v telnet >/dev/null 2>&1; then
        # Use telnet as fallback
        if ! timeout 5 telnet "$HOST" "$PORT" </dev/null >/dev/null 2>&1; then
            error "Port $PORT is not listening on $HOST"
            return 1
        fi
    else
        # Skip port check if no tools available
        warn "No port checking tools available (nc, telnet)"
        return 0
    fi
    
    log "Port $PORT is listening: ✓"
    return 0
}

# Function to check process health
check_process() {
    log "Checking Node.js process health..."
    
    # Check if Node.js process is running
    if ! pgrep -f "node.*api-entry" >/dev/null 2>&1; then
        error "Node.js API process not found"
        return 1
    fi
    
    log "Node.js process running: ✓"
    return 0
}

# Function to check memory usage
check_memory() {
    log "Checking memory usage..."
    
    # Get memory info if available
    if [ -f /proc/meminfo ]; then
        local mem_available
        mem_available=$(grep MemAvailable /proc/meminfo | awk '{print $2}' || echo "0")
        
        # Convert to MB
        mem_available_mb=$((mem_available / 1024))
        
        # Warn if less than 100MB available
        if [ "$mem_available_mb" -lt 100 ]; then
            warn "Low memory available: ${mem_available_mb}MB"
        else
            log "Memory available: ${mem_available_mb}MB ✓"
        fi
    else
        log "Memory check skipped (no /proc/meminfo)"
    fi
    
    return 0
}

# Function to check disk space
check_disk() {
    log "Checking disk space..."
    
    # Check workspace directory if it exists
    if [ -d "/app/workspace" ]; then
        local disk_usage
        disk_usage=$(df /app/workspace | tail -1 | awk '{print $5}' | sed 's/%//')
        
        if [ "$disk_usage" -gt 90 ]; then
            warn "High disk usage: ${disk_usage}%"
        else
            log "Disk usage: ${disk_usage}% ✓"
        fi
    else
        log "Disk check skipped (no workspace directory)"
    fi
    
    return 0
}

# Main health check sequence
main() {
    local exit_code=0
    
    log "${GREEN}Starting Roo Code Agent API health check...${NC}"
    log "Target: http://${HOST}:${PORT}"
    log "Timeout: ${TIMEOUT}s"
    log ""
    
    # Basic connectivity checks
    if ! check_port; then
        exit_code=1
    fi
    
    if ! check_process; then
        exit_code=1
    fi
    
    # API endpoint checks
    if ! check_endpoint "/health" 200 "Health endpoint"; then
        exit_code=1
    fi
    
    if ! check_endpoint "/status" 200 "Status endpoint"; then
        exit_code=1
    fi
    
    # Validate JSON responses
    if ! validate_json_response "/health" "status" "Health endpoint JSON"; then
        exit_code=1
    fi
    
    if ! validate_json_response "/status" "running" "Status endpoint JSON"; then
        exit_code=1
    fi
    
    # System resource checks (warnings only)
    check_memory
    check_disk
    
    # Final result
    if [ $exit_code -eq 0 ]; then
        success "✅ Health check passed - API is healthy"
    else
        error "❌ Health check failed - API is unhealthy"
    fi
    
    exit $exit_code
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose    Enable verbose logging"
            echo "  -h, --help       Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  API_HOST                 API host (default: localhost)"
            echo "  API_PORT                 API port (default: 3000)"
            echo "  HEALTH_CHECK_TIMEOUT     Timeout in seconds (default: 10)"
            echo "  HEALTH_CHECK_VERBOSE     Enable verbose output (default: false)"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Run main health check
main