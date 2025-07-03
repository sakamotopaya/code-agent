#!/bin/bash
# Roo Code Agent API - Production Deployment Script
# Quick deployment script for production Docker setup

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/docker/production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    log "Prerequisites check passed ✓"
}

# Function to create required directories
create_directories() {
    log "Creating required directories..."
    
    local base_dir="$PROJECT_ROOT/docker/production"
    
    # Create directories if they don't exist
    mkdir -p "$base_dir/workspace"
    mkdir -p "$base_dir/config"
    mkdir -p "$base_dir/storage"
    mkdir -p "$base_dir/cli-storage"
    mkdir -p "$base_dir/logs"
    
    log "Directories created ✓"
}

# Function to check environment variables
check_environment() {
    log "Checking environment configuration..."
    
    local missing_vars=()
    
    # Check for required API keys
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
        missing_vars+=("ANTHROPIC_API_KEY")
    fi
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        warn "Missing environment variables: ${missing_vars[*]}"
        warn "Some functionality may not work without proper API keys"
        warn "Set these variables in your shell or create a .env file"
    else
        log "Environment configuration check passed ✓"
    fi
}

# Function to build and start production services
start_production() {
    log "Starting production services..."
    
    cd "$DOCKER_DIR"
    
    # Build and start services
    if command -v docker-compose &> /dev/null; then
        docker-compose build --no-cache
        docker-compose up -d
    else
        docker compose build --no-cache
        docker compose up -d
    fi
    
    log "Production services started ✓"
}

# Function to show service status
show_status() {
    log "Checking service status..."
    
    cd "$DOCKER_DIR"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose ps
    else
        docker compose ps
    fi
    
    echo ""
    log "Service logs (last 20 lines):"
    if command -v docker-compose &> /dev/null; then
        docker-compose logs --tail=20
    else
        docker compose logs --tail=20
    fi
}

# Function to run health check
health_check() {
    log "Running health check..."
    
    # Wait a moment for services to start
    sleep 5
    
    # Check API health endpoint
    local max_attempts=12
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
            log "Health check passed ✓"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts..."
        sleep 5
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
    return 1
}

# Function to display usage information
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help        Show this help message"
    echo "  -s, --status      Show service status only"
    echo "  -c, --check       Run health check only"
    echo "  --no-health       Skip health check after startup"
    echo ""
    echo "Environment variables:"
    echo "  ANTHROPIC_API_KEY      Anthropic API key (recommended)"
    echo "  OPENAI_API_KEY         OpenAI API key (optional)"
    echo "  GITHUB_TOKEN           GitHub token (optional)"
    echo "  DATABASE_URL           Database connection string (optional)"
    echo "  API_PORT               API port (default: 3000)"
    echo ""
    echo "Examples:"
    echo "  $0                     Full production deployment"
    echo "  $0 --status            Check service status"
    echo "  $0 --check             Run health check"
}

# Main execution
main() {
    local skip_health=false
    local status_only=false
    local check_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -s|--status)
                status_only=true
                shift
                ;;
            -c|--check)
                check_only=true
                shift
                ;;
            --no-health)
                skip_health=true
                shift
                ;;
            *)
                error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    log "🚀 Roo Code Agent API - Production Deployment"
    log "============================================"
    
    # Handle specific modes
    if [ "$status_only" = true ]; then
        show_status
        exit 0
    fi
    
    if [ "$check_only" = true ]; then
        health_check
        exit $?
    fi
    
    # Full deployment process
    check_prerequisites
    create_directories
    check_environment
    start_production
    
    if [ "$skip_health" = false ]; then
        health_check
    fi
    
    show_status
    
    echo ""
    log "🎉 Production deployment completed!"
    log "API should be available at: http://localhost:${API_PORT:-3000}"
    log ""
    log "Useful commands:"
    log "  - View logs: docker-compose -f $DOCKER_DIR/docker-compose.yml logs -f"
    log "  - Stop services: docker-compose -f $DOCKER_DIR/docker-compose.yml down"
    log "  - Restart: docker-compose -f $DOCKER_DIR/docker-compose.yml restart"
}

# Run main function with all arguments
main "$@"