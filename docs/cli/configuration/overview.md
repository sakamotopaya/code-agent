# Configuration Overview

Roo CLI provides a flexible configuration system that allows you to customize behavior through configuration files, environment variables, and command-line arguments.

## Configuration Priority

Configuration is applied in the following order (higher priority overrides lower):

1. **Command-line arguments** (highest priority)
2. **Environment variables**
3. **Project configuration file** (`.roo-cli.json`, `.roo-cli.yaml`, `.roo-cli.yml`)
4. **User configuration file** (`~/.roo-cli/config.json`)
5. **Default values** (lowest priority)

## Configuration Locations

### Project-Level Configuration

Project-specific settings are loaded from these files in your project directory:

```
.roo-cli.json          # JSON format (recommended)
.roo-cli.yaml          # YAML format
.roo-cli.yml           # YAML format (alternative)
```

### User-Level Configuration

User-wide settings are stored in:

```
~/.roo-cli/config.json    # User configuration directory
```

### Custom Configuration Path

Override the configuration file location:

```bash
roo-cli --config /path/to/custom-config.json
```

## Configuration File Formats

### JSON Format

```json
{
	"apiKey": "your-anthropic-api-key",
	"model": "claude-3-5-sonnet-20241022",
	"mode": "code",
	"outputFormat": "plain",
	"verbose": false,
	"browser": {
		"headless": true,
		"viewport": "1920x1080",
		"timeout": 30000,
		"userAgent": "Roo-CLI/1.0.0"
	},
	"session": {
		"autoSave": true,
		"maxHistory": 100,
		"compression": true
	},
	"mcp": {
		"autoConnect": true,
		"timeout": 5000,
		"retries": 3,
		"servers": [
			{
				"id": "github-server",
				"type": "stdio",
				"command": "npx",
				"args": ["@modelcontextprotocol/server-github"],
				"env": {
					"GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
				}
			}
		]
	},
	"tools": {
		"fileOperations": {
			"maxFileSize": "10MB",
			"excludePatterns": [".git", "node_modules", "*.log"]
		},
		"terminal": {
			"shell": "auto",
			"timeout": 30000
		}
	},
	"ui": {
		"color": true,
		"colorScheme": "default",
		"progressIndicator": true,
		"bannerDisabled": false
	}
}
```

### YAML Format

```yaml
apiKey: your-anthropic-api-key
model: claude-3-5-sonnet-20241022
mode: code
outputFormat: plain
verbose: false

browser:
    headless: true
    viewport: "1920x1080"
    timeout: 30000
    userAgent: "Roo-CLI/1.0.0"

session:
    autoSave: true
    maxHistory: 100
    compression: true

mcp:
    autoConnect: true
    timeout: 5000
    retries: 3
    servers:
        - id: github-server
          type: stdio
          command: npx
          args: ["@modelcontextprotocol/server-github"]
          env:
              GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}"

tools:
    fileOperations:
        maxFileSize: "10MB"
        excludePatterns: [".git", "node_modules", "*.log"]
    terminal:
        shell: auto
        timeout: 30000

ui:
    color: true
    colorScheme: default
    progressIndicator: true
    bannerDisabled: false
```

## Core Configuration Options

### API Configuration

| Option    | Type   | Default                      | Description                  |
| --------- | ------ | ---------------------------- | ---------------------------- |
| `apiKey`  | string | -                            | Anthropic API key (required) |
| `model`   | string | `claude-3-5-sonnet-20241022` | AI model to use              |
| `baseUrl` | string | -                            | Custom API base URL          |

### Agent Configuration

| Option        | Type   | Default | Description                               |
| ------------- | ------ | ------- | ----------------------------------------- |
| `mode`        | string | `code`  | Agent mode (code, debug, architect, etc.) |
| `temperature` | number | 0.1     | Model temperature (0.0-1.0)               |
| `maxTokens`   | number | 4096    | Maximum response tokens                   |

### Output Configuration

| Option         | Type    | Default | Description                   |
| -------------- | ------- | ------- | ----------------------------- |
| `outputFormat` | string  | `plain` | Default output format         |
| `verbose`      | boolean | false   | Enable verbose logging        |
| `quiet`        | boolean | false   | Suppress non-essential output |
| `color`        | boolean | true    | Enable colored output         |

## Environment Variables

All configuration options can be set via environment variables using the `ROO_` prefix:

### Core Variables

```bash
# API Configuration
export ROO_API_KEY="your-anthropic-api-key"
export ROO_MODEL="claude-3-5-sonnet-20241022"
export ROO_BASE_URL="https://api.anthropic.com"

# Agent Configuration
export ROO_MODE="code"
export ROO_TEMPERATURE="0.1"
export ROO_MAX_TOKENS="4096"

# Output Configuration
export ROO_OUTPUT_FORMAT="json"
export ROO_VERBOSE="true"
export ROO_QUIET="false"
export ROO_COLOR="true"
export ROO_COLOR_SCHEME="dark"

# Paths
export ROO_CONFIG_PATH="/path/to/config.json"
export ROO_SESSION_DIR="/path/to/sessions"

# Browser Configuration
export ROO_BROWSER_HEADLESS="true"
export ROO_BROWSER_VIEWPORT="1920x1080"
export ROO_BROWSER_TIMEOUT="30000"

# MCP Configuration
export ROO_MCP_AUTO_CONNECT="true"
export ROO_MCP_TIMEOUT="5000"
export ROO_MCP_LOG_LEVEL="info"
```

### Variable Naming Convention

Environment variables follow this pattern:

- Prefix: `ROO_`
- Nested objects: Use underscore separation (`ROO_BROWSER_HEADLESS`)
- Arrays: Not supported via environment variables
- Boolean values: `"true"` or `"false"` (strings)

## Command-Line Overrides

Any configuration option can be overridden via command-line arguments:

```bash
# Override API configuration
roo-cli --model claude-3-haiku-20240307 --temperature 0.5

# Override output configuration
roo-cli --format json --verbose --no-color

# Override browser configuration
roo-cli --no-headless --browser-viewport 1280x720

# Override working directory
roo-cli --cwd /path/to/project

# Use custom config
roo-cli --config ./custom-config.json
```

## Configuration Validation

### Automatic Validation

Roo CLI automatically validates configuration on startup:

```bash
# Show current configuration
roo-cli config --show

# Validate specific config file
roo-cli config --validate /path/to/config.json

# Generate and validate default config
roo-cli --generate-config ./config.json
roo-cli config --validate ./config.json
```

### Common Validation Errors

- **Invalid API Key**: Check format and permissions
- **Unknown Model**: Verify model name and availability
- **Invalid Mode**: Must be one of the supported modes
- **Invalid Format**: Must be a supported output format
- **Path Issues**: Ensure paths exist and are accessible

## Configuration Generation

### Generate Default Configuration

```bash
# Generate in user directory
roo-cli --generate-config ~/.roo-cli/config.json

# Generate in project directory
roo-cli --generate-config ./.roo-cli.json

# Generate with custom path
roo-cli --generate-config ./my-config.json
```

### Interactive Configuration

```bash
# Start interactive config setup
roo-cli config init

# Follow prompts to configure:
# - API key
# - Default model
# - Agent mode
# - Output preferences
# - Browser settings
# - MCP servers
```

## Configuration Profiles

### Profile-Based Configuration

Create multiple configuration profiles for different environments:

```bash
# Development profile
roo-cli --config ./configs/dev.json

# Production profile
roo-cli --config ./configs/prod.json

# Testing profile
roo-cli --config ./configs/test.json
```

### Profile Examples

**Development Profile** (`configs/dev.json`):

```json
{
	"mode": "debug",
	"verbose": true,
	"outputFormat": "json",
	"browser": {
		"headless": false
	},
	"session": {
		"autoSave": true
	}
}
```

**Production Profile** (`configs/prod.json`):

```json
{
	"mode": "code",
	"quiet": true,
	"outputFormat": "plain",
	"browser": {
		"headless": true
	},
	"session": {
		"autoSave": false
	}
}
```

## Configuration Migration

### Upgrading Configuration

When upgrading Roo CLI, your configuration may need updates:

```bash
# Check for configuration issues
roo-cli config --validate

# Generate new default config to see new options
roo-cli --generate-config ./new-config.json

# Merge configurations manually or use migration tool
roo-cli config migrate --from old-config.json --to new-config.json
```

### Breaking Changes

Configuration changes are documented in the [migration guide](../migration/from-vscode.md).

## Security Considerations

### API Key Security

- Never commit API keys to version control
- Use environment variables for API keys
- Consider using `.env` files (add to `.gitignore`)
- Use different API keys for different environments

### Configuration File Permissions

```bash
# Secure user configuration
chmod 600 ~/.roo-cli/config.json

# Secure project configuration (if it contains secrets)
chmod 600 ./.roo-cli.json
```

### Environment File Example

```bash
# .env file (add to .gitignore)
ROO_API_KEY=your-anthropic-api-key
ROO_GITHUB_TOKEN=your-github-token
ROO_MCP_SERVER_TOKEN=your-mcp-token

# Load environment variables
source .env
roo-cli
```

## Troubleshooting Configuration

### Debug Configuration Loading

```bash
# Show configuration resolution
roo-cli --verbose config --show

# Show which config files were loaded
roo-cli --debug config --show

# Test configuration with dry run
roo-cli --dry-run --batch "test task"
```

### Common Issues

1. **Configuration not found**: Check file paths and permissions
2. **Invalid JSON/YAML**: Validate syntax with online tools
3. **Environment variables not loaded**: Check shell configuration
4. **Permission errors**: Check file and directory permissions
5. **API key issues**: Verify key format and validity

## Next Steps

- [File Format Reference](./file-format.md) - Detailed configuration schema
- [Environment Variables](./environment-variables.md) - Complete environment variable reference
- [Configuration Examples](./examples.md) - Real-world configuration examples
- [Troubleshooting](../troubleshooting/common-issues.md) - Configuration troubleshooting guide
