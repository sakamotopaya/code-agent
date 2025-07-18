# Container Build Instructions

## Docker Build Process Runs `node esbuild.mjs`

The Docker build automatically runs `node esbuild.mjs` via these steps in the Dockerfile:

1. **Line 82**: `RUN npx turbo@latest bundle` (workspace level)
2. **Line 110**: `RUN pnpm bundle` (workspace level)
3. **Line 122**: `RUN pnpm bundle` (in /app/src directory)

Since package.json defines `"bundle": "node esbuild.mjs"`, the Docker build process runs `node esbuild.mjs` automatically.

## Manual Execution Options

### Option 1: Execute in Running Container

```bash
# If container is already running
docker exec -it development_api_1 bash
cd /app/src
node esbuild.mjs
```

### Option 2: Use pnpm bundle Command

```bash
# Since package.json has "bundle": "node esbuild.mjs"
docker exec -it development_api_1 bash
cd /app/src
pnpm bundle
```

### Option 3: Docker Compose Run

```bash
# Run container with build command directly
docker-compose -f docker/development/docker-compose.yml run --rm api bash -c "cd /app/src && node esbuild.mjs"
```

### Option 4: Standalone Docker Run

```bash
# Run container with build command directly
docker run --rm -v $(pwd):/app -w /app/src code-agent-api node esbuild.mjs
```

## Testing the Dependency Fix

After adding `@dotenvx/dotenvx` to package.json:

```bash
# Rebuild container with dependency fix
docker-compose -f docker/development/docker-compose.yml build --no-cache api

# Test the build
docker-compose -f docker/development/docker-compose.yml run --rm api bash -c "cd /app/src && pnpm bundle"
```

## Expected Success Output

With the dependency fix, you should see:

```
[extension] Cleaning dist directory: /app/src/dist
[esbuild-problem-matcher#onStart]
[copyPaths] Copied ../README.md to README.md
[copyPaths] Copied ../CHANGELOG.md to CHANGELOG.md
[copyPaths] Copied ../LICENSE to LICENSE
[copyPaths] Optional file not found: ../.env
[copyPaths] Copied 911 files from node_modules/vscode-material-icons/generated to assets/vscode-material-icons
[copyPaths] Copied 3 files from ../webview-ui/audio to webview-ui/audio
[copyWasms] Copied tiktoken WASMs to /app/src/dist
[copyWasms] Copied tiktoken WASMs to /app/src/dist/workers
[copyWasms] Copied tree-sitter.wasm to /app/src/dist
[copyWasms] Copied 35 tree-sitter language wasms to /app/src/dist
[copyLocales] Copied 34 locale files to /app/src/dist/i18n/locales
[esbuild-problem-matcher#onEnd]
```

**No more "@dotenvx/dotenvx" resolution errors!**

## Verify the Fix Deployed

After successful build, check for verification marker:

```bash
docker exec -it development_api_1 grep -r "TASK_SOURCE_VERIFICATION_ARCHITECT_MODE_2025" /app/src/dist/
```

## Start API with Fresh Bundle

```bash
# Stop current container
docker-compose -f docker/development/docker-compose.yml down

# Start with fresh build
docker-compose -f docker/development/docker-compose.yml up api
```

## Test ask_followup_question Tool

```bash
./test-api.js --stream "Use ask_followup_question to ask me what color I prefer"
```

The `pnpm bundle` command is recommended since it matches the container's normal build process defined in package.json.

## Docker Cleanup Commands

### Clean Out Old Images Before Rebuilding

```bash
# Remove all stopped containers
docker container prune -f

# Remove all unused images
docker image prune -a -f

# Remove all unused volumes
docker volume prune -f

# Remove all unused networks
docker network prune -f

# Complete cleanup (containers, images, volumes, networks)
docker system prune -a -f --volumes
```

### Clean Specific Project Images

```bash
# Remove specific images related to this project
docker rmi $(docker images | grep "code-agent" | awk '{print $3}')

# Remove development images
docker rmi $(docker images | grep "development" | awk '{print $3}')

# Remove dangling images (untagged)
docker image prune -f
```

### Recommended Cleanup Before Rebuild

```bash
# Stop and remove current containers
docker-compose -f docker/development/docker-compose.yml down

# Clean up old images and containers
docker system prune -a -f

# Now rebuild with clean state
docker-compose -f docker/development/docker-compose.yml build --no-cache api
```

This ensures you're building with a clean Docker environment and the latest dependency fixes.
