# run-api.sh Environment Variable Enhancement

## Summary

Enhanced the `run-api.sh` script to support loading environment variables from a project root `.env` file that's configured to use docker/development directories, ensuring true consistency between local and containerized development environments.

## Changes Made

### 1. Added .env File Loading Function

```bash
load_env_file() {
    # Parses .env files and loads variables
    # Skips comments and empty lines
    # Preserves existing environment variables
    # Handles quoted values properly
}
```

### 2. Added .env File Creation Function

```bash
create_default_env_file() {
    # Creates .env file from template
    # Adds helpful documentation headers
    # Includes additional configuration options
    # Provides guidance for customization
}
```

### 3. Enhanced Command-Line Interface

- **New option**: `--env-file PATH` - specify custom .env file location
- **Enhanced help**: Comprehensive documentation of environment variables
- **Interactive prompts**: Offers to create .env file when missing

### 4. Environment Variable Precedence

The script now follows a clear precedence order:

1. **Command-line arguments** (highest priority)
2. **Existing environment variables**
3. **`.env` file variables**
4. **Script defaults** (lowest priority)

### 5. Default .env Location

- **Primary**: `.env` (project root)
- **Configuration**: Pre-configured to use docker/development directories
- **Auto-creation**: Interactive creation with comprehensive configuration

## Features

### Automatic .env Loading

```bash
# Uses default .env file
./run-api.sh

# Uses custom .env file
./run-api.sh --env-file .env.production
```

### Interactive Setup

When no `.env` file exists, the script offers to create one:

```
[INFO] No .env file found at: docker/development/.env
[INFO] Would you like to create a default .env file? (y/N)
```

### Security Features

- **API key masking**: Shows only first 8 characters in logs
- **Existing variable preservation**: Won't override already-set variables
- **Safe parsing**: Handles quoted values and special characters

### Comprehensive Environment Support

The script now supports all environment variables used by:

- API server configuration
- Docker development setup
- MCP server integration
- External API services

## Environment Variables Supported

### Core API Configuration

- `API_PORT`, `API_HOST`, `API_VERBOSE`, `API_DEBUG`
- `API_WORKSPACE_ROOT`, `API_CLI_CONFIG_PATH`

### External API Keys

- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`
- `DATABASE_URL`, `MSSQL_CONNECTION_STRING`

### Logging Configuration

- `LOG_LEVEL`, `LOG_FILE_ENABLED`, `LOG_ROTATION_ENABLED`
- `LOG_MAX_SIZE`, `LOG_MAX_FILES`

### MCP Configuration

- `MCP_CONFIG_PATH`, `MCP_AUTO_CONNECT`
- `MCP_TIMEOUT`, `MCP_RETRIES`

### Security & Performance

- `API_CORS_ORIGIN`, `API_CORS_CREDENTIALS`
- `API_ENABLE_HELMET`, `API_RATE_LIMIT_MAX`
- `API_REQUEST_TIMEOUT`, `API_TASK_TIMEOUT`

## Testing Results

### ✅ Basic Functionality

- Default .env loading from project root works correctly
- Custom .env file loading via `--env-file`
- Command-line argument precedence
- Environment variable masking for security
- Interactive .env file creation

### ✅ Docker Development Consistency

- Local development now uses docker/development directories
- Shared workspace, storage, logs, and configuration
- Same data persistence between local and containerized development
- Consistent file paths and directory structure

### ✅ Backward Compatibility

- Existing workflows continue to work
- No breaking changes to command-line interface
- Graceful fallback when .env files don't exist

## Usage Examples

### Development with Default .env

```bash
./run-api.sh
```

### Production Mode

```bash
./run-api.sh --production --env-file .env.production
```

### Custom Configuration

```bash
./run-api.sh --port 8080 --env-file .env.local
```

### Override Specific Values

```bash
API_DEBUG=false ./run-api.sh --env-file .env.staging
```

## Benefits

1. **True Consistency**: Local and Docker development use identical directories and data
2. **Shared State**: Same workspace, storage, logs, and configuration between environments
3. **Security**: Centralized API key management with masked display
4. **Developer Experience**: Interactive setup, auto-creation, and comprehensive documentation
5. **Data Persistence**: Logs and storage persist between local and Docker runs
6. **Simplified Setup**: Single .env file at project root with intelligent defaults

## Documentation

- **Technical Guide**: `docs/technical/api-env-configuration.md`
- **Enhanced Help**: `./run-api.sh --help`
- **Template File**: `docker/development/.env.example`

## Future Enhancements

- Support for multiple .env file locations
- Environment-specific .env file detection
- Integration with CI/CD pipelines
- Advanced validation and error handling
