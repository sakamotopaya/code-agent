#!/bin/bash
# Roo Code Agent API - Development Environment Startup Script
# Easy development environment management with comprehensive setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
DOCKER_DIR="$PROJECT_ROOT/docker"
DEV_DIR="$DOCKER_DIR/development"

# Default values
REBUILD=false
DETACHED=true
PROFILE=""
FOLLOW_LOGS=false
SETUP_CONFIG=false

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
🛠️ Roo Code Agent API - Development Environment

Usage: $0 [OPTIONS]

Options:
  -r, --rebuild        Rebuild containers before starting
  -f, --foreground     Run in foreground (don't detach)
  -l, --logs           Follow logs after startup
  -s, --setup          Setup configuration files interactively
  -p, --profile        Use specific profile (e.g., testing)
  --clean              Clean up and rebuild everything
  -h, --help           Show this help message

Profiles:
  default              Start main development environment
  testing              Start with testing profile (includes test container)

Examples:
  $0                           # Start development environment
  $0 --rebuild --logs          # Rebuild and follow logs
  $0 --profile testing         # Start with testing environment
  $0 --setup                   # Interactive configuration setup
  $0 --clean                   # Clean rebuild everything

Environment Management:
  Start:     $0
  Stop:      docker-compose -f docker/development/docker-compose.yml down
  Restart:   docker-compose -f docker/development/docker-compose.yml restart
  Logs:      docker-compose -f docker/development/docker-compose.yml logs -f
  Shell:     docker-compose -f docker/development/docker-compose.yml exec roo-api-dev bash

EOF
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed or not in PATH"
        return 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "Docker Compose is not installed or not in PATH"
        return 1
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        return 1
    fi
    
    # Check development directory
    if [ ! -d "$DEV_DIR" ]; then
        log_error "Development directory not found: $DEV_DIR"
        return 1
    fi
    
    # Check docker-compose.yml
    if [ ! -f "$DEV_DIR/docker-compose.yml" ]; then
        log_error "Docker Compose file not found: $DEV_DIR/docker-compose.yml"
        return 1
    fi
    
    log_success "Prerequisites check passed"
    return 0
}

# Function to setup configuration files
setup_configuration() {
    log_info "🔧 Setting up configuration files..."
    
    cd "$DEV_DIR"
    
    # Setup .env file
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        log_info "Creating .env from .env.example"
        cp .env.example .env
        log_success "Created .env file"
    fi
    
    # Create necessary directories
    local dirs=("workspace" "config" "test-workspace" "test-config" "logs")
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            log_info "Creating directory: $dir"
            mkdir -p "$dir"
        fi
    done
    
    # Setup configuration files
    if [ ! -f "config/agent-config.json" ] && [ -f "../config/agent-config.json.example" ]; then
        log_info "Creating agent-config.json from example"
        cp ../config/agent-config.json.example config/agent-config.json
        log_warning "Please edit config/agent-config.json with your API keys"
    fi
    
    if [ ! -f "config/mcp-config.json" ] && [ -f "../config/mcp-config.json.example" ]; then
        log_info "Creating mcp-config.json from example"
        cp ../config/mcp-config.json.example config/mcp-config.json
        log_warning "Please edit config/mcp-config.json to enable desired MCP servers"
    fi
    
    # Interactive configuration setup
    if [ "$SETUP_CONFIG" = true ]; then
        setup_interactive_config
    fi
    
    log_success "Configuration setup completed"
}

# Function for interactive configuration setup
setup_interactive_config() {
    log_info "🎯 Interactive configuration setup"
    
    # API Keys setup
    echo ""
    log_info "API Keys Configuration:"
    echo "You'll need to set up API keys for the agent to work properly."
    echo "You can set these as environment variables or edit the config files."
    echo ""
    
    # Anthropic API Key
    if [ -z "$ANTHROPIC_API_KEY" ]; then
        echo -n "Enter your Anthropic API key (or press Enter to skip): "
        read -r anthropic_key
        if [ -n "$anthropic_key" ]; then
            echo "export ANTHROPIC_API_KEY='$anthropic_key'" >> ~/.bashrc
            export ANTHROPIC_API_KEY="$anthropic_key"
            log_success "Anthropic API key configured"
        fi
    else
        log_success "Anthropic API key already set"
    fi
    
    # GitHub Token
    if [ -z "$GITHUB_TOKEN" ]; then
        echo -n "Enter your GitHub Personal Access Token (or press Enter to skip): "
        read -r github_token
        if [ -n "$github_token" ]; then
            echo "export GITHUB_TOKEN='$github_token'" >> ~/.bashrc
            export GITHUB_TOKEN="$github_token"
            log_success "GitHub token configured"
        fi
    else
        log_success "GitHub token already set"
    fi
    
    echo ""
    log_info "Configuration files created. You can edit them manually:"
    log_info "- Agent config: $DEV_DIR/config/agent-config.json"
    log_info "- MCP config: $DEV_DIR/config/mcp-config.json"
    log_info "- Environment: $DEV_DIR/.env"
}

# Function to clean up everything
clean_environment() {
    log_info "🧹 Cleaning up development environment..."
    
    cd "$DEV_DIR"
    
    # Stop and remove containers
    if docker-compose ps -q >/dev/null 2>&1; then
        log_info "Stopping containers..."
        docker-compose down -v --remove-orphans
    fi
    
    # Remove images
    log_info "Removing development images..."
    docker-compose down --rmi all >/dev/null 2>&1 || true
    
    # Clean up Docker system
    log_info "Cleaning up Docker system..."
    docker system prune -f >/dev/null 2>&1 || true
    
    log_success "Environment cleaned up"
}

# Function to start development environment
start_environment() {
    log_info "🚀 Starting development environment..."
    
    cd "$DEV_DIR"
    
    # Build command
    local compose_cmd="docker-compose"
    
    # Add profile if specified
    if [ -n "$PROFILE" ]; then
        compose_cmd="$compose_cmd --profile $PROFILE"
        log_info "Using profile: $PROFILE"
    fi
    
    # Rebuild if requested
    if [ "$REBUILD" = true ]; then
        log_info "Rebuilding containers..."
        $compose_cmd build --no-cache
    fi
    
    # Start containers
    if [ "$DETACHED" = true ]; then
        log_info "Starting containers in detached mode..."
        $compose_cmd up -d
    else
        log_info "Starting containers in foreground mode..."
        $compose_cmd up
        return 0  # Exit here for foreground mode
    fi
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 5
    
    # Check service status
    local services
    services=$($compose_cmd ps --services)
    
    for service in $services; do
        if $compose_cmd ps "$service" | grep -q "Up"; then
            log_success "✓ $service is running"
        else
            log_warning "⚠ $service may not be ready"
        fi
    done
    
    # Display service information
    echo ""
    log_info "📋 Service Information:"
    $compose_cmd ps
    
    echo ""
    log_info "🌐 Access Points:"
    log_info "  - API: http://localhost:${API_PORT:-3000}"
    log_info "  - Health: http://localhost:${API_PORT:-3000}/health"
    log_info "  - Status: http://localhost:${API_PORT:-3000}/status"
    log_info "  - Debug Port: localhost:${DEBUG_PORT:-9229}"
    
    if [ "$PROFILE" = "testing" ]; then
        log_info "  - Test API: http://localhost:${TEST_API_PORT:-3001}"
        log_info "  - Test Debug: localhost:${TEST_DEBUG_PORT:-9230}"
    fi
    
    echo ""
    log_info "📝 Useful Commands:"
    log_info "  - View logs: docker-compose logs -f"
    log_info "  - Restart: docker-compose restart"
    log_info "  - Shell access: docker-compose exec roo-api-dev bash"
    log_info "  - Stop: docker-compose down"
    
    # Follow logs if requested
    if [ "$FOLLOW_LOGS" = true ]; then
        echo ""
        log_info "📊 Following logs (Ctrl+C to stop)..."
        sleep 2
        $compose_cmd logs -f
    fi
}

# Function to test the API
test_api() {
    log_info "🧪 Testing API endpoints..."
    
    local api_url="http://localhost:${API_PORT:-3000}"
    local max_wait=30
    local wait_time=0
    
    # Wait for API to be ready
    while [ $wait_time -lt $max_wait ]; do
        if curl -s "$api_url/health" >/dev/null 2>&1; then
            break
        fi
        sleep 2
        wait_time=$((wait_time + 2))
    done
    
    # Test endpoints
    local endpoints=("/health" "/status")
    for endpoint in "${endpoints[@]}"; do
        if curl -s "$api_url$endpoint" | jq . >/dev/null 2>&1; then
            log_success "✓ $endpoint endpoint working"
        else
            log_error "✗ $endpoint endpoint failed"
        fi
    done
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--rebuild)
            REBUILD=true
            shift
            ;;
        -f|--foreground)
            DETACHED=false
            shift
            ;;
        -l|--logs)
            FOLLOW_LOGS=true
            shift
            ;;
        -s|--setup)
            SETUP_CONFIG=true
            shift
            ;;
        -p|--profile)
            PROFILE="$2"
            shift 2
            ;;
        --clean)
            if check_prerequisites; then
                clean_environment
                REBUILD=true
            fi
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Main execution
main() {
    log_info "🛠️ Roo Code Agent API - Development Environment"
    echo ""
    
    # Check prerequisites
    if ! check_prerequisites; then
        exit 1
    fi
    
    # Setup configuration
    setup_configuration
    
    # Start environment
    start_environment
    
    # Test API if detached
    if [ "$DETACHED" = true ]; then
        test_api
        
        echo ""
        log_success "🎉 Development environment is ready!"
        log_info "Happy coding! 🚀"
    fi
}

# Run main function
main