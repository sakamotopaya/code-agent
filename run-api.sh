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

# Default environment variables (can be overridden by existing env vars)
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

# Parse command line arguments
MODE="development"
BUILD_ONLY=false
INSTALL_DEPS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--production)
            MODE="production"
            export NODE_ENV="production"
            export API_VERBOSE="false"
            export API_DEBUG="false"
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
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  API_PORT             Server port (default: 3000)"
            echo "  API_HOST             Server host (default: localhost)"
            echo "  API_WORKSPACE_ROOT   Working directory (default: current directory)"
            echo "  API_VERBOSE          Enable verbose logging (default: true)"
            echo "  API_DEBUG            Enable debug mode (default: true)"
            echo ""
            echo "Examples:"
            echo "  $0                   # Run in development mode"
            echo "  $0 --production      # Run in production mode"
            echo "  $0 --port 8080       # Run on port 8080"
            echo "  $0 --install         # Install deps and run"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

print_info "🚀 Roo Code Agent API Server Launcher"
print_info "Mode: $MODE"
print_info "Port: $API_PORT"
print_info "Host: $API_HOST"
print_info "Workspace: $API_WORKSPACE_ROOT"

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

cd src

# Choose the appropriate command based on mode
if [ "$MODE" = "production" ]; then
    # Production mode - run compiled JavaScript
    if [ -f "dist/api/api-entry.js" ]; then
        node dist/api/api-entry.js
    else
        print_error "Production build not found. Run with --build-only first."
        exit 1
    fi
else
    # Development mode - prefer compiled JS for reliability
    if [ -f "dist/api/api-entry.js" ]; then
        print_info "Running compiled JavaScript version..."
        node dist/api/api-entry.js
    elif command -v npx >/dev/null 2>&1; then
        print_info "Compiled version not found, trying ts-node..."
        # Try different ts-node approaches
        if [ -f "tsconfig.json" ]; then
            print_info "Using ts-node with project tsconfig..."
            npx ts-node --project tsconfig.json api/api-entry.ts 2>/dev/null || {
                print_warning "ts-node failed, falling back to compiled version..."
                if [ -f "dist/api/api-entry.js" ]; then
                    node dist/api/api-entry.js
                else
                    print_error "Both ts-node and compiled version failed"
                    exit 1
                fi
            }
        else
            print_warning "No tsconfig.json found, using compiled version..."
            if [ -f "dist/api/api-entry.js" ]; then
                node dist/api/api-entry.js
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