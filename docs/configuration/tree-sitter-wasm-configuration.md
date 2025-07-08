# Tree-sitter WASM Configuration

This document describes how to configure the tree-sitter WASM file location for different deployment scenarios.

## Overview

The tree-sitter functionality in this application uses WebAssembly (WASM) files for parsing various programming languages. The application needs to locate these WASM files at runtime, and the location varies depending on the execution context (VSCode extension, CLI, or API server).

## Environment Variable Configuration

### TREE_SITTER_WASM_DIR

**Type**: String (directory path)  
**Required**: No  
**Default**: Auto-detected based on execution context

Explicitly sets the directory containing tree-sitter WASM files. When set, this overrides the automatic context detection logic.

#### Example Values

```bash
# Docker deployment
TREE_SITTER_WASM_DIR=/app/src/dist

# Local development
TREE_SITTER_WASM_DIR=./dist

# Custom installation
TREE_SITTER_WASM_DIR=/opt/myapp/wasm
```

#### Required WASM Files

The specified directory must contain:

- `tree-sitter.wasm` (main tree-sitter runtime)
- Language-specific WASM files (e.g., `tree-sitter-javascript.wasm`, `tree-sitter-python.wasm`, etc.)

## Automatic Context Detection

When `TREE_SITTER_WASM_DIR` is not set, the application automatically detects the WASM directory based on the execution context:

### VSCode Extension Context

- **Detection**: `__dirname` ends with `/dist`
- **WASM Directory**: Uses `__dirname` directly
- **Example**: `/path/to/extension/dist/`

### CLI Context

- **Detection**: `__dirname` ends with `/cli`
- **WASM Directory**: Goes up one level from `__dirname`
- **Example**: `__dirname` = `/path/to/app/dist/cli/` → WASM dir = `/path/to/app/dist/`

### API Context

- **Detection**: `__dirname` ends with `/api`
- **WASM Directory**: Goes up one level from `__dirname`
- **Example**: `__dirname` = `/path/to/app/dist/api/` → WASM dir = `/path/to/app/dist/`

## Docker Configuration

### Development Environment

The development Docker configuration automatically sets the environment variable:

```dockerfile
ENV TREE_SITTER_WASM_DIR=/app/src/dist
```

### Production Environment

The production Docker configuration also sets the environment variable:

```dockerfile
ENV TREE_SITTER_WASM_DIR=/app/src/dist
```

### Docker Compose

Both development and production docker-compose files include the environment variable:

```yaml
environment:
    - TREE_SITTER_WASM_DIR=/app/src/dist
```

## Troubleshooting

### Common Issues

#### 1. WASM Files Not Found

**Error**: `ENOENT: no such file or directory, open '/path/to/tree-sitter.wasm'`

**Solutions**:

- Verify the `TREE_SITTER_WASM_DIR` path is correct
- Ensure WASM files were copied during the build process
- Check file permissions in Docker containers

#### 2. Invalid WASM Directory

**Error**: `TREE_SITTER_WASM_DIR points to invalid directory: /path. tree-sitter.wasm not found.`

**Solutions**:

- Verify the directory exists and contains `tree-sitter.wasm`
- Check that the build process completed successfully
- Ensure the path is accessible from the application's working directory

#### 3. Context Detection Issues

**Symptoms**: Application works in one context but not another

**Solutions**:

- Set `TREE_SITTER_WASM_DIR` explicitly to override context detection
- Check that `__dirname` values match expected patterns
- Review application logs for context detection messages

### Debugging

Enable debug logging to see WASM directory resolution:

```bash
# The application logs WASM directory resolution
[tree-sitter] Using WASM directory from environment: /app/src/dist
[tree-sitter] Using WASM directory from context detection: /app/src/dist
[tree-sitter] Loading language javascript from /app/src/dist/tree-sitter-javascript.wasm
```

### Validation

To verify WASM configuration is working:

1. **Check WASM files exist**:

    ```bash
    ls -la $TREE_SITTER_WASM_DIR/tree-sitter*.wasm
    ```

2. **Test language parsing**:

    - Use the API endpoint to parse a code snippet
    - Check application logs for successful WASM loading

3. **Verify in different contexts**:
    - Test VSCode extension functionality
    - Run CLI commands that use tree-sitter
    - Make API requests that trigger code parsing

## Migration Guide

### From Hardcoded Paths

If you previously relied on hardcoded WASM paths:

1. **Remove hardcoded paths** from your configuration
2. **Set TREE_SITTER_WASM_DIR** environment variable
3. **Test all execution contexts** (extension, CLI, API)
4. **Update deployment scripts** to include the environment variable

### Docker Deployment Updates

When updating existing Docker deployments:

1. **Add environment variable** to Dockerfile or docker-compose.yml
2. **Rebuild containers** to include the new configuration
3. **Verify WASM functionality** after deployment
4. **Monitor logs** for any WASM-related errors

## Best Practices

1. **Use absolute paths** in production environments
2. **Set environment variable explicitly** in Docker deployments
3. **Include WASM directory validation** in health checks
4. **Monitor WASM loading performance** in production
5. **Keep WASM files updated** with application updates

## Related Configuration

- [Docker Configuration](../deployment/docker-configuration.md)
- [Environment Variables](../configuration/environment-variables.md)
- [Build Process](../development/build-process.md)
