#!/bin/bash

# Roo Code Agent API Server Launcher
# This script sets environment variables and launches the API server

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to load environment variables from .env file
load_env_file() {
    local env_file="$1"
    
    if [ ! -f "$env_file" ]; then
        return 1
    fi
    
    print_info "Loading environment variables from: $env_file"
    
    # Read the .env file line by line
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip empty lines and comments
        if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        
        # Extract variable name and value
        if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            var_name="${BASH_REMATCH[1]}"
            var_value="${BASH_REMATCH[2]}"
            
            # Remove surrounding quotes if present
            if [[ "$var_value" =~ ^\"(.*)\"$ ]] || [[ "$var_value" =~ ^\'(.*)\'$ ]]; then
                var_value="${BASH_REMATCH[1]}"
            fi
            
            # Only set the variable if it's not already set (preserve existing env vars)
            if [ -z "${!var_name}" ]; then
                export "$var_name"="$var_value"
            fi
        fi
    done < "$env_file"
    
    return 0
}

# Function to create default .env file for local development
create_default_env_file() {
    local env_file="$1"
    
    print_info "Creating default .env file for local development..."
    
    # Create the .env file with docker/development paths
    cat > "$env_file" << 'EOF'
# Roo Code Agent API - Local Development Environment Configuration
# This file configures run-api.sh to use the same directories as docker/development
# ensuring consistency between local and containerized development.
#
# IMPORTANT: Add your actual API keys below and uncomment the lines
# For security, this file should not be committed to version control
# See docs/technical/api-env-configuration.md for full documentation

# =============================================================================
# DIRECTORY CONFIGURATION - Points to docker/development for consistency
# =============================================================================

# Workspace Configuration (shared with docker/development)
API_WORKSPACE_ROOT=docker/development/workspace

# Storage Configuration (shared with docker/development)
ROO_GLOBAL_STORAGE_PATH=docker/development/storage
ROO_CLI_STORAGE_PATH=docker/development/cli-storage
API_STORAGE_ROOT=docker/development/storage

# Logging Configuration (shared with docker/development)
LOGS_PATH=docker/development/logs
LOG_LEVEL=debug
LOG_FILE_ENABLED=true
LOG_ROTATION_ENABLED=false
LOG_MAX_SIZE=10MB
LOG_MAX_FILES=3

# Configuration Files (shared with docker/development)
CONFIG_PATH=docker/development/config
API_CLI_CONFIG_PATH=docker/development/config/agent-config.json
MCP_CONFIG_PATH=docker/development/config/mcp-config.json

# =============================================================================
# API SERVER CONFIGURATION
# =============================================================================

# Basic API Configuration
API_PORT=3000
API_HOST=localhost
API_VERBOSE=true
API_DEBUG=true

# CORS Configuration (development-friendly)
API_CORS_ORIGIN=*
API_CORS_CREDENTIALS=true

# Security Configuration (relaxed for development)
API_ENABLE_HELMET=false
API_RATE_LIMIT_MAX=1000
API_RATE_LIMIT_WINDOW=1m

# Timeout Configuration (generous for debugging)
API_REQUEST_TIMEOUT=60000
API_KEEP_ALIVE_TIMEOUT=10000
API_TASK_TIMEOUT=1800000

# =============================================================================
# MCP CONFIGURATION
# =============================================================================

# MCP Server Configuration
MCP_AUTO_CONNECT=true
MCP_TIMEOUT=30000
MCP_RETRIES=3

# =============================================================================
# SSE CONFIGURATION
# =============================================================================

# Server-Sent Events Configuration (development optimized)
API_SSE_HEARTBEAT_INTERVAL=10000
API_SSE_RETRY_TIMEOUT=1000
API_SSE_MAX_CONNECTIONS=50
API_STREAM_BUFFER_SIZE=512

# =============================================================================
# API KEYS - CUSTOMIZE THESE FOR YOUR DEVELOPMENT
# =============================================================================

# Anthropic API Key (for Claude models)
# ANTHROPIC_API_KEY=your_anthropic_key_here

# OpenAI API Key
# OPENAI_API_KEY=your_openai_key_here

# GitHub Token (for repository access)
# GITHUB_TOKEN=your_github_token_here

# Database Configuration (if needed)
# DATABASE_URL=your_database_url_here
# MSSQL_CONNECTION_STRING=your_mssql_connection_here

# =============================================================================
# DEVELOPMENT NOTES
# =============================================================================
#
# This configuration ensures that when you run ./run-api.sh locally,
# you're using the same workspace, storage, logs, and configuration
# as the docker/development environment.
#
# Benefits:
# - Shared state between local and Docker development
# - Consistent data and configuration
# - Persistent logs and storage
# - Same workspace files and structure
#
# To customize:
# 1. Uncomment and set your API keys above
# 2. Modify paths if you need different locations
# 3. Adjust API configuration as needed
#
# For more information, see:
# - docs/technical/api-env-configuration.md
# - docker/development/.env.example
#
EOF
    
    print_success "Created .env file: $env_file"
    print_info "This .env file configures local development to use docker/development directories"
    print_info "Please edit this file to add your API keys and customize settings"
    print_info "See docs/technical/api-env-configuration.md for detailed configuration guide"
    
    return 0
}

# Default .env file location (project root for local development)
DEFAULT_ENV_FILE=".env"
ENV_FILE=""

# Parse command line arguments
MODE="development"
BUILD_ONLY=false
INSTALL_DEPS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--production)
            MODE="production"
            shift
            ;;
        -b|--build-only)
            BUILD_ONLY=true
            shift
            ;;
        -i|--install)
            INSTALL_DEPS=true
            shift
            ;;
        --port)
            export API_PORT="$2"
            shift 2
            ;;
        --host)
            export API_HOST="$2"
            shift 2
            ;;
        --workspace)
            export API_WORKSPACE_ROOT="$2"
            shift 2
            ;;
        --env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -p, --production     Run in production mode"
            echo "  -b, --build-only     Only build, don't run"
            echo "  -i, --install        Install dependencies first"
            echo "  --port PORT          Set API port (default: 3000)"
            echo "  --host HOST          Set API host (default: localhost)"
            echo "  --workspace PATH     Set workspace root (default: current directory)"
            echo "  --env-file PATH      Load environment variables from specified .env file"
            echo "                       (default: .env in project root)"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  API_PORT             Server port (default: 3000)"
            echo "  API_HOST             Server host (default: localhost)"
            echo "  API_WORKSPACE_ROOT   Working directory (default: current directory)"
            echo "  API_VERBOSE          Enable verbose logging (default: true)"
            echo "  API_DEBUG            Enable debug mode (default: true)"
            echo "  API_CORS_ORIGIN      CORS origin setting (default: true)"
            echo "  API_CORS_CREDENTIALS CORS credentials setting (default: true)"
            echo "  API_ENABLE_HELMET    Enable Helmet security middleware (default: true)"
            echo "  API_CLI_CONFIG_PATH  Path to CLI configuration file"
            echo ""
            echo "Additional environment variables (loaded from .env file):"
            echo "  ANTHROPIC_API_KEY    Anthropic API key for Claude models"
            echo "  OPENAI_API_KEY       OpenAI API key"
            echo "  GITHUB_TOKEN         GitHub token for repository access"
            echo "  LOG_LEVEL            Logging level (debug, info, warn, error)"
            echo "  MCP_CONFIG_PATH      Path to MCP configuration file"
            echo "  And many more... see docker/development/.env.example for full list"
            echo ""
            echo ".env file loading:"
            echo "  The script automatically loads environment variables from .env files."
            echo "  Default location: .env (project root, configured for docker/development)"
            echo "  Precedence: CLI args > existing env vars > .env file > script defaults"
            echo ""
            echo "Examples:"
            echo "  $0                           # Run with default .env file"
            echo "  $0 --production              # Run in production mode"
            echo "  $0 --port 8080               # Run on port 8080"
            echo "  $0 --env-file .env.local     # Use custom .env file"
            echo "  $0 --install                 # Install deps and run"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Load environment variables from .env file
if [ -n "$ENV_FILE" ]; then
    # Use explicitly specified .env file
    if load_env_file "$ENV_FILE"; then
        print_success "Loaded environment variables from: $ENV_FILE"
    else
        print_error "Failed to load environment file: $ENV_FILE"
        exit 1
    fi
elif [ -f "$DEFAULT_ENV_FILE" ]; then
    # Use default .env file if it exists
    if load_env_file "$DEFAULT_ENV_FILE"; then
        print_success "Loaded environment variables from: $DEFAULT_ENV_FILE"
    else
        print_warning "Found but failed to load: $DEFAULT_ENV_FILE"
    fi
else
    print_info "No .env file found at: $DEFAULT_ENV_FILE"
    print_info "Would you like to create a default .env file configured for docker/development? (y/N)"
    
    if [ -t 0 ]; then  # Only prompt if running interactively
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            if create_default_env_file "$DEFAULT_ENV_FILE"; then
                # Try to load the newly created file
                if load_env_file "$DEFAULT_ENV_FILE"; then
                    print_success "Loaded environment variables from newly created: $DEFAULT_ENV_FILE"
                fi
            fi
        else
            print_info "Continuing without .env file (using defaults)"
            print_info "Note: Without .env file, local development won't use docker/development directories"
        fi
    else
        print_info "Running non-interactively - continuing without .env file"
        print_info "To create a .env file, run: ./run-api.sh (and answer 'y' when prompted)"
        print_info "Or manually create .env file with docker/development paths"
    fi
fi

# Set production mode environment variables after .env loading
if [ "$MODE" = "production" ]; then
    export NODE_ENV="production"
    export API_VERBOSE="false"
    export API_DEBUG="false"
fi

# Default environment variables (can be overridden by existing env vars or .env file)
export API_PORT=${API_PORT:-3000}
export API_HOST=${API_HOST:-localhost}
export API_WORKSPACE_ROOT=${API_WORKSPACE_ROOT:-$(pwd)}
export API_VERBOSE=${API_VERBOSE:-true}
export API_DEBUG=${API_DEBUG:-true}
export API_CORS_ORIGIN=${API_CORS_ORIGIN:-true}
export API_CORS_CREDENTIALS=${API_CORS_CREDENTIALS:-true}
export API_ENABLE_HELMET=${API_ENABLE_HELMET:-true}
export API_CLI_CONFIG_PATH=${API_CLI_CONFIG_PATH:-$HOME/.agentz/agent-config.json}
export NODE_ENV=${NODE_ENV:-development}

# Additional environment variables that may be loaded from .env file
# (These are set with defaults only if not already defined)
export LOG_LEVEL=${LOG_LEVEL:-info}
export LOG_FILE_ENABLED=${LOG_FILE_ENABLED:-false}
export MCP_AUTO_CONNECT=${MCP_AUTO_CONNECT:-true}
export MCP_TIMEOUT=${MCP_TIMEOUT:-30000}
export MCP_RETRIES=${MCP_RETRIES:-3}

print_info "🚀 Roo Code Agent API Server Launcher"
print_info "Mode: $MODE"
print_info "Port: $API_PORT"
print_info "Host: $API_HOST"
print_info "Workspace: $API_WORKSPACE_ROOT"
print_info "Verbose: $API_VERBOSE"
print_info "Debug: $API_DEBUG"

# Show loaded API keys (masked for security)
if [ -n "$ANTHROPIC_API_KEY" ]; then
    print_info "Anthropic API Key: ${ANTHROPIC_API_KEY:0:8}..."
fi
if [ -n "$OPENAI_API_KEY" ]; then
    print_info "OpenAI API Key: ${OPENAI_API_KEY:0:8}..."
fi
if [ -n "$GITHUB_TOKEN" ]; then
    print_info "GitHub Token: ${GITHUB_TOKEN:0:8}..."
fi

# Check if we're in the right directory
if [ ! -f "src/package.json" ]; then
    print_error "Please run this script from the project root directory"
    print_error "Expected to find src/package.json"
    exit 1
fi

# Install dependencies if requested
if [ "$INSTALL_DEPS" = true ]; then
    print_info "📦 Installing API dependencies..."
    cd src
    if npm install fastify @fastify/cors @fastify/helmet; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
    cd ..
fi

# Check if dependencies are installed
print_info "🔍 Checking dependencies..."
cd src
if ! npm list fastify @fastify/cors @fastify/helmet >/dev/null 2>&1; then
    print_warning "API dependencies not found. Installing..."
    if npm install fastify @fastify/cors @fastify/helmet; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
fi
cd ..

# Build the project
print_info "🔨 Building project..."
cd src
if pnpm bundle; then
    print_success "Build completed successfully"
else
    print_error "Build failed"
    exit 1
fi
cd ..

# Exit if build-only mode
if [ "$BUILD_ONLY" = true ]; then
    print_success "Build completed. Exiting (build-only mode)"
    exit 0
fi

# Start the server
print_info "🌟 Starting API server..."
print_info "Configuration:"
print_info "  - Mode: $MODE"
print_info "  - Address: http://$API_HOST:$API_PORT"
print_info "  - Workspace: $API_WORKSPACE_ROOT"
print_info "  - Verbose: $API_VERBOSE"
print_info "  - Debug: $API_DEBUG"
print_info ""
print_info "Available endpoints:"
print_info "  - GET  http://$API_HOST:$API_PORT/health"
print_info "  - GET  http://$API_HOST:$API_PORT/status"
print_info "  - POST http://$API_HOST:$API_PORT/execute"
print_info ""
print_success "Press Ctrl+C to stop the server"
print_info "Starting in 2 seconds..."
sleep 2

# Stay in project root - don't change to src directory

# Choose the appropriate command based on mode
if [ "$MODE" = "production" ]; then
    # Production mode - run compiled JavaScript from project root
    if [ -f "src/dist/api/api-entry.js" ]; then
        node src/dist/api/api-entry.js
    else
        print_error "Production build not found. Run with --build-only first."
        exit 1
    fi
else
    # Development mode - prefer compiled JS for reliability
    if [ -f "src/dist/api/api-entry.js" ]; then
        print_info "Running compiled JavaScript version from project root..."
        node src/dist/api/api-entry.js
    elif command -v npx >/dev/null 2>&1; then
        print_info "Compiled version not found, trying ts-node..."
        # Try different ts-node approaches from project root
        if [ -f "src/tsconfig.json" ]; then
            print_info "Using ts-node with project tsconfig..."
            npx ts-node --project src/tsconfig.json src/api/api-entry.ts 2>/dev/null || {
                print_warning "ts-node failed, falling back to compiled version..."
                if [ -f "src/dist/api/api-entry.js" ]; then
                    node src/dist/api/api-entry.js
                else
                    print_error "Both ts-node and compiled version failed"
                    exit 1
                fi
            }
        else
            print_warning "No src/tsconfig.json found, using compiled version..."
            if [ -f "src/dist/api/api-entry.js" ]; then
                node src/dist/api/api-entry.js
            else
                print_error "No compiled version available"
                exit 1
            fi
        fi
    else
        print_error "Neither npx nor compiled version available"
        exit 1
    fi
fi