#!/bin/bash
# Roo Code Agent API - Production Build Script
# Automated production build with validation and optimization

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
PRODUCTION_DIR="$DOCKER_DIR/production"

# Default values
VALIDATE=false
PUSH=false
TAG_LATEST=true
REGISTRY=""
IMAGE_NAME="roo-api"
BUILD_ARGS=""

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
🚀 Roo Code Agent API - Production Build Script

Usage: $0 [OPTIONS]

Options:
  -v, --validate       Run validation tests after build
  -p, --push           Push image to registry after build
  -r, --registry       Docker registry URL (e.g., docker.io/username)
  -n, --name           Image name (default: roo-api)
  -t, --tag            Additional tag for the image
  --no-latest          Don't tag as 'latest'
  --build-arg          Pass build argument (can be used multiple times)
  -h, --help           Show this help message

Examples:
  $0                                    # Basic production build
  $0 --validate                         # Build and validate
  $0 --push --registry docker.io/myorg  # Build and push to registry
  $0 --tag v1.2.3 --validate           # Build with specific tag and validate
  $0 --build-arg NODE_ENV=production    # Build with custom build argument

Environment Variables:
  DOCKER_REGISTRY      Default registry for pushing images
  DOCKER_IMAGE_NAME    Default image name
  BUILD_CACHE          Enable/disable build cache (default: true)

EOF
}

# Function to generate image tags
generate_tags() {
    local base_name="$1"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local git_hash=""
    
    # Try to get git hash if available
    if command -v git >/dev/null 2>&1 && [ -d "$PROJECT_ROOT/.git" ]; then
        git_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "")
    fi
    
    # Generate tags
    local tags=()
    
    if [ "$TAG_LATEST" = true ]; then
        tags+=("$base_name:latest")
    fi
    
    tags+=("$base_name:$timestamp")
    
    if [ -n "$git_hash" ]; then
        tags+=("$base_name:git-$git_hash")
    fi
    
    if [ -n "$CUSTOM_TAG" ]; then
        tags+=("$base_name:$CUSTOM_TAG")
    fi
    
    printf '%s\n' "${tags[@]}"
}

# Function to build Docker image
build_image() {
    local image_name="$1"
    
    log_info "Building production Docker image..."
    log_info "Project root: $PROJECT_ROOT"
    log_info "Dockerfile: $PRODUCTION_DIR/Dockerfile"
    
    # Change to project root for build context
    cd "$PROJECT_ROOT"
    
    # Prepare build command
    local build_cmd="docker build"
    build_cmd="$build_cmd -f $PRODUCTION_DIR/Dockerfile"
    
    # Add build arguments
    if [ -n "$BUILD_ARGS" ]; then
        build_cmd="$build_cmd $BUILD_ARGS"
    fi
    
    # Add default build arguments
    build_cmd="$build_cmd --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    build_cmd="$build_cmd --build-arg VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
    
    # Generate and add tags
    local tags
    tags=($(generate_tags "$image_name"))
    
    for tag in "${tags[@]}"; do
        build_cmd="$build_cmd -t $tag"
        log_info "Will tag as: $tag"
    done
    
    # Add build context
    build_cmd="$build_cmd ."
    
    log_info "Build command: $build_cmd"
    log_info "Starting build..."
    
    # Execute build
    if eval "$build_cmd"; then
        log_success "Docker image built successfully"
        
        # Display image information
        log_info "Image details:"
        docker images "$image_name" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
        
        return 0
    else
        log_error "Docker build failed"
        return 1
    fi
}

# Function to validate built image
validate_image() {
    local image_name="$1"
    local container_name="roo-api-validation-$$"
    
    log_info "🔍 Validating built image..."
    
    # Start container for validation
    log_info "Starting validation container..."
    if ! docker run -d --name "$container_name" \
        -p 3001:3000 \
        -e API_DEBUG=true \
        -e API_VERBOSE=true \
        "$image_name:latest" >/dev/null; then
        log_error "Failed to start validation container"
        return 1
    fi
    
    # Wait for container to be ready
    log_info "Waiting for container to be ready..."
    local max_wait=60
    local wait_time=0
    
    while [ $wait_time -lt $max_wait ]; do
        if docker exec "$container_name" ./health-check.sh >/dev/null 2>&1; then
            log_success "Container is healthy"
            break
        fi
        
        sleep 2
        wait_time=$((wait_time + 2))
        
        if [ $wait_time -ge $max_wait ]; then
            log_error "Container failed to become healthy within ${max_wait}s"
            docker logs "$container_name"
            docker stop "$container_name" >/dev/null 2>&1
            docker rm "$container_name" >/dev/null 2>&1
            return 1
        fi
    done
    
    # Run health checks
    log_info "Running health checks..."
    if docker exec "$container_name" ./health-check.sh --verbose; then
        log_success "Health checks passed"
    else
        log_error "Health checks failed"
        docker logs "$container_name"
        docker stop "$container_name" >/dev/null 2>&1
        docker rm "$container_name" >/dev/null 2>&1
        return 1
    fi
    
    # Test API endpoints
    log_info "Testing API endpoints..."
    local api_tests=(
        "http://localhost:3001/health"
        "http://localhost:3001/status"
    )
    
    for endpoint in "${api_tests[@]}"; do
        log_info "Testing $endpoint..."
        if curl -f -s "$endpoint" >/dev/null; then
            log_success "✓ $endpoint"
        else
            log_error "✗ $endpoint failed"
            docker stop "$container_name" >/dev/null 2>&1
            docker rm "$container_name" >/dev/null 2>&1
            return 1
        fi
    done
    
    # Cleanup
    log_info "Cleaning up validation container..."
    docker stop "$container_name" >/dev/null 2>&1
    docker rm "$container_name" >/dev/null 2>&1
    
    log_success "✅ Image validation completed successfully"
    return 0
}

# Function to push image to registry
push_image() {
    local image_name="$1"
    
    if [ -z "$REGISTRY" ]; then
        log_error "No registry specified for push operation"
        return 1
    fi
    
    log_info "🚀 Pushing image to registry: $REGISTRY"
    
    # Get all tags for the image
    local tags
    tags=($(docker images "$image_name" --format "{{.Repository}}:{{.Tag}}" | grep -v "<none>"))
    
    for tag in "${tags[@]}"; do
        local registry_tag="$REGISTRY/$tag"
        
        log_info "Tagging for registry: $registry_tag"
        if ! docker tag "$tag" "$registry_tag"; then
            log_error "Failed to tag image for registry"
            return 1
        fi
        
        log_info "Pushing: $registry_tag"
        if ! docker push "$registry_tag"; then
            log_error "Failed to push $registry_tag"
            return 1
        fi
        
        log_success "✓ Pushed $registry_tag"
    done
    
    log_success "✅ All images pushed successfully"
    return 0
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed or not in PATH"
        return 1
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        return 1
    fi
    
    # Check project structure
    if [ ! -f "$PRODUCTION_DIR/Dockerfile" ]; then
        log_error "Production Dockerfile not found: $PRODUCTION_DIR/Dockerfile"
        return 1
    fi
    
    if [ ! -f "$PROJECT_ROOT/src/package.json" ]; then
        log_error "Source package.json not found: $PROJECT_ROOT/src/package.json"
        return 1
    fi
    
    log_success "Prerequisites check passed"
    return 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--validate)
            VALIDATE=true
            shift
            ;;
        -p|--push)
            PUSH=true
            shift
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -n|--name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -t|--tag)
            CUSTOM_TAG="$2"
            shift 2
            ;;
        --no-latest)
            TAG_LATEST=false
            shift
            ;;
        --build-arg)
            BUILD_ARGS="$BUILD_ARGS --build-arg $2"
            shift 2
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

# Set defaults from environment if not specified
REGISTRY=${REGISTRY:-$DOCKER_REGISTRY}
IMAGE_NAME=${IMAGE_NAME:-${DOCKER_IMAGE_NAME:-roo-api}}

# Main execution
main() {
    log_info "🚀 Roo Code Agent API - Production Build"
    log_info "Image name: $IMAGE_NAME"
    if [ -n "$REGISTRY" ]; then
        log_info "Registry: $REGISTRY"
    fi
    log_info "Validation: $VALIDATE"
    log_info "Push: $PUSH"
    echo ""
    
    # Check prerequisites
    if ! check_prerequisites; then
        exit 1
    fi
    
    # Build image
    if ! build_image "$IMAGE_NAME"; then
        exit 1
    fi
    
    # Validate if requested
    if [ "$VALIDATE" = true ]; then
        if ! validate_image "$IMAGE_NAME"; then
            exit 1
        fi
    fi
    
    # Push if requested
    if [ "$PUSH" = true ]; then
        if ! push_image "$IMAGE_NAME"; then
            exit 1
        fi
    fi
    
    log_success "🎉 Production build completed successfully!"
    
    # Show final summary
    echo ""
    log_info "📋 Build Summary:"
    docker images "$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    if [ "$PUSH" = true ] && [ -n "$REGISTRY" ]; then
        echo ""
        log_info "🌐 Pushed to registry:"
        docker images "$REGISTRY/$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" 2>/dev/null || true
    fi
}

# Run main function
main