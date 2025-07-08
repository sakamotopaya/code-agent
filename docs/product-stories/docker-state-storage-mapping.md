# Docker State and Storage Volume Mapping Requirements

## Issue Analysis

The user identified that the Docker container may be missing critical volume mappings for state and history storage, which could explain why the `./api-client.js` test hangs - the application may be trying to access or create storage directories that aren't properly persisted or mapped.

## Critical Storage Directories Identified

Based on the codebase analysis, the Roo Code Agent uses several storage directories that need persistent volume mapping:

### 1. Global Storage Directory

**Path**: `/app/.roo-storage` (container) → Host directory  
**Usage**:

- Puppeteer Chromium downloads (`puppeteer/` subdirectory)
- Code index cache
- MCP server state and configuration
- Model cache for API providers
- Question storage for API tasks
- Task checkpoints and shadow git repositories

**Key Components Using This**:

- `BrowserSession.ts` - Downloads Chromium to `${globalStoragePath}/puppeteer`
- `UrlContentFetcher.ts` - Browser automation storage
- `ApiQuestionManager.ts` - Persistent question state
- `ShadowCheckpointService.ts` - Task checkpoints in `${globalStorageDir}/tasks/${taskId}/checkpoints`
- Model cache in `api/providers/fetchers/`

### 2. CLI Session Storage

**Path**: `/app/.roo-cli` (container) → Host directory  
**Usage**:

- CLI session management
- REPL history
- CLI-specific configuration and state

### 3. Task Workspace Storage

**Path**: Already mapped as `/app/workspace`  
**Status**: ✅ Already properly mapped

### 4. Configuration Storage

**Path**: Already mapped as `/app/config`  
**Status**: ✅ Already properly mapped

## Current Docker Compose State

The current `docker-compose.yml` has these volume mappings:

```yaml
volumes:
    # Source code mounting for hot reload
    - ../../src:/app/src:cached

    # Workspace mounting (✅ Good)
    - ${WORKSPACE_PATH:-./workspace}:/app/workspace:rw

    # Configuration mounting (✅ Good)
    - ${CONFIG_PATH:-./config}:/app/config:rw

    # Node modules cache
    - node_modules_dev:/app/node_modules
    - src_node_modules_dev:/app/src/node_modules

    # Development cache
    - dev_cache:/app/.cache
```

## Missing Volume Mappings

### Required Additions

1. **Global Storage Volume**:

    ```yaml
    - ${ROO_STORAGE_PATH:-./storage}:/app/.roo-storage:rw
    ```

2. **CLI Storage Volume**:

    ```yaml
    - ${ROO_CLI_STORAGE_PATH:-./cli-storage}:/app/.roo-cli:rw
    ```

3. **Puppeteer Downloads** (subset of global storage but may need separate mapping):
    ```yaml
    - puppeteer_downloads:/app/.roo-storage/puppeteer
    ```

## Environment Variables to Add

```yaml
environment:
    # Global storage configuration
    - ROO_GLOBAL_STORAGE_PATH=/app/.roo-storage
    - ROO_CLI_STORAGE_PATH=/app/.roo-cli

    # Ensure storage directories are properly configured
    - API_STORAGE_ROOT=/app/.roo-storage
```

## Implementation Plan

### Phase 1: Add Missing Volume Mappings

1. Add global storage volume mapping
2. Add CLI storage volume mapping
3. Add environment variables for storage paths
4. Create named volumes for Puppeteer downloads

### Phase 2: Validate Storage Initialization

1. Ensure container creates storage directories on startup
2. Verify proper permissions on mounted volumes
3. Test that all storage-dependent features work correctly

### Phase 3: Testing

1. Rebuild container with new mappings
2. Test browser automation (Puppeteer downloads)
3. Test CLI session persistence
4. Test API question storage
5. Test task checkpoint functionality

## Root Cause Analysis

The hanging `./api-client.js` issue is likely caused by:

1. **Missing Global Storage**: Application trying to access `globalStoragePath` that doesn't exist or isn't writable
2. **Browser Dependencies**: Puppeteer trying to download Chromium to unmapped storage
3. **Question Storage**: API question manager failing to initialize storage directory
4. **Checkpoint Storage**: Task execution failing due to inability to create checkpoint directories

## Next Steps

1. **Switch to Code Mode** to implement the volume mapping changes
2. **Update docker-compose.yml** with the required volume mappings
3. **Update Dockerfile** if needed to ensure proper directory creation
4. **Test the complete Docker setup** with persistent storage

## Files to Modify

1. `docker/development/docker-compose.yml` - Add volume mappings and environment variables
2. `docker/development/Dockerfile` - Ensure storage directories are created with proper permissions
3. Potentially update API configuration to use explicit storage paths

This storage mapping issue is likely the final piece needed to make the Docker development environment fully functional.
