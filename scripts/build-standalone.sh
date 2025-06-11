#!/bin/bash
# Build standalone executables for all platforms
# Usage: ./scripts/build-standalone.sh [platform]
# Platforms: macos, windows, linux, all (default)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_ROOT/src"

echo -e "${BLUE}Building standalone CLI executables...${NC}"

# Navigate to src directory
cd "$SRC_DIR"

# Function to print step
print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if postject is installed
if ! npm list postject --depth=0 > /dev/null 2>&1; then
    print_step "Installing postject dependency..."
    npm install
fi

# Clean and build CLI first
print_step "Building CLI bundle..."
npm run build:cli

# Check if build was successful
if [ ! -f "dist/cli/index.js" ]; then
    print_error "CLI build failed - dist/cli/index.js not found"
    exit 1
fi

print_success "CLI bundle created"

# Determine which platform(s) to build
PLATFORM=${1:-all}
SIGN=${2:-false}

# Create apps directory if it doesn't exist
mkdir -p ../apps

case $PLATFORM in
    "macos")
        print_step "Building macOS executables..."
        if [ "$SIGN" = "true" ]; then
            npm run build:standalone:signed:macos
        else
            npm run build:standalone:macos
        fi
        print_success "macOS executables built"
        ;;
    "windows")
        print_step "Building Windows executable..."
        if [ "$SIGN" = "true" ]; then
            npm run build:standalone:signed:windows
        else
            npm run build:standalone:windows
        fi
        print_success "Windows executable built"
        ;;
    "linux")
        print_step "Building Linux executables..."
        if [ "$SIGN" = "true" ]; then
            npm run build:standalone:signed:linux
        else
            npm run build:standalone:linux
        fi
        print_success "Linux executables built"
        ;;
    "all"|*)
        print_step "Building all platform executables..."
        if [ "$SIGN" = "true" ]; then
            npm run build:standalone:signed
        else
            npm run build:standalone
        fi
        print_success "All platform executables built"
        ;;
esac

# List created executables
echo -e "\n${BLUE}Created executables:${NC}"
if [ -d "../apps" ]; then
    ls -la ../apps/ | grep -E 'roo-cline' || echo "No executables found"
else
    print_error "apps directory not found"
fi

print_success "Standalone build complete!"

echo -e "\n${YELLOW}Usage:${NC}"
echo "  macOS:   ./apps/roo-cline-macos --help"
echo "  Windows: ./apps/roo-cline-win.exe --help"
echo "  Linux:   ./apps/roo-cline-linux --help"

echo -e "\n${YELLOW}Build with code signing:${NC}"
echo "  ./scripts/build-standalone.sh macos true"
echo "  ./scripts/build-standalone.sh windows true"
echo "  ./scripts/build-standalone.sh linux true"

echo -e "\n${BLUE}Note: Built with Node.js SEA (Single Executable Applications)${NC}"
echo -e "Supports Node.js 20+ without external dependencies"

if [ "$SIGN" = "true" ]; then
    echo -e "\n${GREEN}Code signing enabled${NC}"
    echo -e "Set environment variables for certificate details:"
    echo -e "  macOS: APPLE_TEAM_ID, APPLE_CERTIFICATE_BASE64, APPLE_CERTIFICATE_PASSWORD"
    echo -e "  Windows: WINDOWS_CERTIFICATE_BASE64, WINDOWS_CERTIFICATE_PASSWORD"
fi