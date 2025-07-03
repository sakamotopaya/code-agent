# Environment Variables Reference

Roo CLI supports comprehensive configuration through environment variables, allowing you to customize behavior without modifying configuration files.

## Core Configuration

### Authentication and API

| Variable           | Type   | Default                      | Description                  |
| ------------------ | ------ | ---------------------------- | ---------------------------- |
| `ROO_API_KEY`      | string | -                            | Anthropic API key (required) |
| `ROO_MODEL`        | string | `claude-3-5-sonnet-20241022` | AI model to use              |
| `ROO_API_BASE_URL` | string | `https://api.anthropic.com`  | API base URL                 |
| `ROO_API_VERSION`  | string | `2023-06-01`                 | API version                  |
| `ROO_MAX_TOKENS`   | number | `4096`                       | Maximum tokens per request   |

### Operational Settings

| Variable            | Type    | Default         | Description                   |
| ------------------- | ------- | --------------- | ----------------------------- |
| `ROO_MODE`          | string  | `code`          | Default agent mode            |
| `ROO_OUTPUT_FORMAT` | string  | `plain`         | Default output format         |
| `ROO_CWD`           | string  | `process.cwd()` | Working directory             |
| `ROO_CONFIG_PATH`   | string  | -               | Custom config file path       |
| `ROO_VERBOSE`       | boolean | `false`         | Enable verbose logging        |
| `ROO_QUIET`         | boolean | `false`         | Suppress non-essential output |
| `ROO_NO_COLOR`      | boolean | `false`         | Disable colored output        |
| `ROO_DEBUG`         | boolean | `false`         | Enable debug mode             |

## Browser Configuration

| Variable                 | Type    | Default     | Description                                    |
| ------------------------ | ------- | ----------- | ---------------------------------------------- |
| `ROO_BROWSER_HEADLESS`   | boolean | `true`      | Run browser in headless mode                   |
| `ROO_BROWSER_VIEWPORT`   | string  | `1920x1080` | Browser viewport size                          |
| `ROO_BROWSER_TIMEOUT`    | number  | `30000`     | Page load timeout (ms)                         |
| `ROO_BROWSER_USER_AGENT` | string  | -           | Custom user agent                              |
| `ROO_BROWSER_PROXY`      | string  | -           | Proxy server URL                               |
| `ROO_BROWSER_EXECUTABLE` | string  | -           | Custom browser executable path                 |
| `ROO_BROWSER_ARGS`       | string  | -           | Additional browser arguments (comma-separated) |

## Session Management

| Variable                     | Type    | Default                   | Description                 |
| ---------------------------- | ------- | ------------------------- | --------------------------- |
| `ROO_SESSION_AUTO_SAVE`      | boolean | `true`                    | Automatically save sessions |
| `ROO_SESSION_MAX_HISTORY`    | number  | `100`                     | Maximum history entries     |
| `ROO_SESSION_SAVE_LOCATION`  | string  | `$HOME/.roo-cli/sessions` | Session storage directory   |
| `ROO_SESSION_COMPRESSION`    | boolean | `true`                    | Compress session files      |
| `ROO_SESSION_ENCRYPTION`     | boolean | `false`                   | Encrypt session files       |
| `ROO_SESSION_RETENTION_DAYS` | number  | `30`                      | Session retention period    |

## MCP (Model Context Protocol)

| Variable               | Type    | Default | Description                        |
| ---------------------- | ------- | ------- | ---------------------------------- |
| `ROO_MCP_TIMEOUT`      | number  | `10000` | Connection timeout (ms)            |
| `ROO_MCP_RETRIES`      | number  | `3`     | Connection retry attempts          |
| `ROO_MCP_AUTO_CONNECT` | boolean | `true`  | Auto-connect to configured servers |
| `ROO_MCP_LOG_LEVEL`    | string  | `info`  | MCP logging level                  |

## Tools Configuration

| Variable                       | Type   | Default                 | Description                               |
| ------------------------------ | ------ | ----------------------- | ----------------------------------------- |
| `ROO_TOOLS_ENABLED_CATEGORIES` | string | `file,browser,terminal` | Enabled tool categories (comma-separated) |
| `ROO_TOOLS_CUSTOM_PATH`        | string | -                       | Custom tools directory                    |
| `ROO_TOOLS_MAX_CONCURRENT`     | number | `5`                     | Maximum concurrent tool executions        |
| `ROO_TOOLS_TIMEOUT`            | number | `300000`                | Tool execution timeout (ms)               |

## File Operations

| Variable            | Type    | Default    | Description                        |
| ------------------- | ------- | ---------- | ---------------------------------- |
| `ROO_FILE_MAX_SIZE` | number  | `10485760` | Maximum file size (bytes)          |
| `ROO_FILE_ENCODING` | string  | `utf8`     | Default file encoding              |
| `ROO_FILE_BACKUP`   | boolean | `true`     | Create backups before modification |
| `ROO_FILE_WATCH`    | boolean | `false`    | Watch files for changes            |

## Output and Formatting

| Variable               | Type    | Default | Description                   |
| ---------------------- | ------- | ------- | ----------------------------- |
| `ROO_OUTPUT_FILE`      | string  | -       | Default output file           |
| `ROO_OUTPUT_APPEND`    | boolean | `false` | Append to output file         |
| `ROO_OUTPUT_TIMESTAMP` | boolean | `false` | Include timestamps in output  |
| `ROO_OUTPUT_PRETTY`    | boolean | `true`  | Pretty-print JSON/YAML output |

## Logging Configuration

| Variable            | Type   | Default    | Description                              |
| ------------------- | ------ | ---------- | ---------------------------------------- |
| `ROO_LOG_LEVEL`     | string | `info`     | Logging level (debug, info, warn, error) |
| `ROO_LOG_FILE`      | string | -          | Log file path                            |
| `ROO_LOG_MAX_SIZE`  | number | `10485760` | Maximum log file size (bytes)            |
| `ROO_LOG_MAX_FILES` | number | `5`        | Maximum number of log files              |
| `ROO_LOG_FORMAT`    | string | `text`     | Log format (text, json)                  |

## Performance and Limits

| Variable              | Type   | Default      | Description                        |
| --------------------- | ------ | ------------ | ---------------------------------- |
| `ROO_MEMORY_LIMIT`    | number | `1073741824` | Memory limit (bytes)               |
| `ROO_CPU_LIMIT`       | number | `2`          | CPU core limit                     |
| `ROO_CACHE_SIZE`      | number | `104857600`  | Cache size (bytes)                 |
| `ROO_CACHE_TTL`       | number | `3600`       | Cache TTL (seconds)                |
| `ROO_REQUEST_TIMEOUT` | number | `120000`     | Request timeout (ms)               |
| `ROO_RETRY_ATTEMPTS`  | number | `3`          | Retry attempts for failed requests |

## Platform-Specific Variables

### Windows

| Variable               | Type   | Default      | Description                     |
| ---------------------- | ------ | ------------ | ------------------------------- |
| `ROO_WINDOWS_SHELL`    | string | `powershell` | Default shell (cmd, powershell) |
| `ROO_WINDOWS_ENCODING` | string | `utf8`       | Text encoding                   |

### macOS/Linux

| Variable         | Type   | Default          | Description   |
| ---------------- | ------ | ---------------- | ------------- |
| `ROO_UNIX_SHELL` | string | `/bin/bash`      | Default shell |
| `ROO_UNIX_TERM`  | string | `xterm-256color` | Terminal type |

## Development and Testing

| Variable             | Type    | Default      | Description                                 |
| -------------------- | ------- | ------------ | ------------------------------------------- |
| `ROO_ENV`            | string  | `production` | Environment (development, production, test) |
| `ROO_MOCK_API`       | boolean | `false`      | Use mock API for testing                    |
| `ROO_MOCK_BROWSER`   | boolean | `false`      | Use mock browser for testing                |
| `ROO_TEST_DATA_PATH` | string  | -            | Test data directory                         |
| `ROO_COVERAGE`       | boolean | `false`      | Enable coverage reporting                   |

## Setting Environment Variables

### Linux/macOS

#### Temporary (current session)

```bash
export ROO_API_KEY="your-api-key"
export ROO_MODE="debug"
export ROO_VERBOSE="true"
```

#### Permanent (add to shell profile)

```bash
# Add to $HOME/.bashrc, $HOME/.zshrc, etc.
echo 'export ROO_API_KEY="your-api-key"' >> $HOME/.bashrc
echo 'export ROO_MODE="code"' >> $HOME/.bashrc
source $HOME/.bashrc
```

#### Using .env file

```bash
# Create .env file
cat > .env << 'EOF'
ROO_API_KEY=your-api-key
ROO_MODE=code
ROO_OUTPUT_FORMAT=json
ROO_VERBOSE=true
EOF

# Load .env file
set -a && source .env && set +a
```

### Windows

#### Command Prompt

```cmd
set ROO_API_KEY=your-api-key
set ROO_MODE=debug
set ROO_VERBOSE=true
```

#### PowerShell

```powershell
$env:ROO_API_KEY = "your-api-key"
$env:ROO_MODE = "debug"
$env:ROO_VERBOSE = "true"
```

#### Permanent (System Properties)

1. Open System Properties → Advanced → Environment Variables
2. Add new variables under User or System variables
3. Restart terminal/application

## Environment-Specific Configurations

### Development Environment

```bash
export ROO_ENV="development"
export ROO_API_KEY="dev-api-key"
export ROO_MODEL="claude-3-haiku-20240307"  # Faster model for dev
export ROO_MODE="debug"
export ROO_VERBOSE="true"
export ROO_BROWSER_HEADLESS="false"
export ROO_SESSION_AUTO_SAVE="true"
export ROO_LOG_LEVEL="debug"
export ROO_MOCK_API="false"
```

### Testing Environment

```bash
export ROO_ENV="test"
export ROO_API_KEY="test-api-key"
export ROO_MODE="test"
export ROO_VERBOSE="false"
export ROO_BROWSER_HEADLESS="true"
export ROO_SESSION_AUTO_SAVE="false"
export ROO_LOG_LEVEL="warn"
export ROO_MOCK_API="true"
export ROO_MOCK_BROWSER="true"
```

### Production Environment

```bash
export ROO_ENV="production"
export ROO_API_KEY="prod-api-key"
export ROO_MODEL="claude-3-5-sonnet-20241022"
export ROO_MODE="code"
export ROO_VERBOSE="false"
export ROO_QUIET="true"
export ROO_BROWSER_HEADLESS="true"
export ROO_SESSION_AUTO_SAVE="false"
export ROO_LOG_LEVEL="error"
export ROO_LOG_FILE="/var/log/roo-cli.log"
```

### CI/CD Environment

```bash
export ROO_ENV="ci"
export ROO_API_KEY="${ANTHROPIC_API_KEY}"
export ROO_MODE="code"
export ROO_OUTPUT_FORMAT="json"
export ROO_VERBOSE="false"
export ROO_QUIET="true"
export ROO_NO_COLOR="true"
export ROO_BROWSER_HEADLESS="true"
export ROO_SESSION_AUTO_SAVE="false"
export ROO_CACHE_SIZE="0"  # Disable caching
```

## Variable Validation

### Check Current Variables

```bash
# Show all ROO_* environment variables
env | grep ^ROO_

# Show specific variable
echo $ROO_API_KEY

# Validate current environment
roo-cli config --show-env
```

### Common Validation Issues

| Issue                   | Cause                       | Solution                             |
| ----------------------- | --------------------------- | ------------------------------------ |
| Variable not recognized | Typo in variable name       | Check spelling and prefix            |
| Boolean parsing error   | Invalid boolean value       | Use `true`/`false` (lowercase)       |
| Number parsing error    | Non-numeric value           | Use valid numbers                    |
| Path not found          | Invalid file/directory path | Verify path exists and is accessible |

## Variable Precedence

Environment variables take precedence over configuration files but are overridden by command-line arguments:

1. **Command-line arguments** (highest priority)
2. **Environment variables**
3. **Project config files**
4. **User config files**
5. **Default values** (lowest priority)

## Security Considerations

### Sensitive Variables

Store sensitive information securely:

```bash
# Use a secrets manager
export ROO_API_KEY="$(aws secretsmanager get-secret-value --secret-id roo-api-key --query SecretString --output text)"

# Use environment file with restricted permissions
chmod 600 .env
source .env

# Use encrypted environment files
gpg --decrypt secrets.env.gpg | source /dev/stdin
```

### Best Practices

1. **Never commit** API keys to version control
2. **Use different keys** for different environments
3. **Rotate keys** regularly
4. **Monitor usage** for unexpected activity
5. **Use least privilege** access for service accounts

## Troubleshooting

### Common Issues

1. **Variable not loaded**

    ```bash
    # Check if variable is set
    echo $ROO_API_KEY

    # Check shell exports
    export | grep ROO_
    ```

2. **Case sensitivity**

    ```bash
    # Variables are case-sensitive
    export ROO_API_KEY="key"      # ✓ Correct
    export roo_api_key="key"      # ✗ Wrong
    ```

3. **Space handling**
    ```bash
    # Avoid spaces around equals sign
    export ROO_MODE="code"        # ✓ Correct
    export ROO_MODE = "code"      # ✗ Wrong
    ```

### Debug Environment Loading

```bash
# Show environment resolution
roo-cli config --debug-env

# Test specific variable
roo-cli config --test-env ROO_API_KEY

# Show all configuration sources
roo-cli config --show-sources --verbose
```

For more help, see the [troubleshooting guide](../troubleshooting/common-issues.md).
