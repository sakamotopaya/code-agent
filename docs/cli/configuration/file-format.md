# Configuration File Format

Roo CLI supports multiple configuration file formats and locations to provide flexibility in how you configure the tool.

## File Formats

### JSON Format (.json)

The default and most common format:

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
		"timeout": 30000
	},
	"session": {
		"autoSave": true,
		"maxHistory": 100,
		"saveLocation": "~/.roo-cli/sessions"
	},
	"mcp": {
		"servers": {
			"filesystem": {
				"command": "node",
				"args": ["/path/to/filesystem-server.js"],
				"env": {}
			}
		}
	},
	"tools": {
		"enabledCategories": ["file", "browser", "terminal"],
		"customToolsPath": "./custom-tools"
	}
}
```

### YAML Format (.yaml, .yml)

For those who prefer YAML:

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

session:
    autoSave: true
    maxHistory: 100
    saveLocation: "~/.roo-cli/sessions"

mcp:
    servers:
        filesystem:
            command: node
            args:
                - "/path/to/filesystem-server.js"
            env: {}

tools:
    enabledCategories:
        - file
        - browser
        - terminal
    customToolsPath: "./custom-tools"
```

## Configuration Schema

### Root Configuration

| Property       | Type    | Default                      | Description                  |
| -------------- | ------- | ---------------------------- | ---------------------------- |
| `apiKey`       | string  | -                            | Anthropic API key (required) |
| `model`        | string  | `claude-3-5-sonnet-20241022` | AI model to use              |
| `mode`         | string  | `code`                       | Default agent mode           |
| `outputFormat` | string  | `plain`                      | Default output format        |
| `verbose`      | boolean | `false`                      | Enable verbose logging       |
| `cwd`          | string  | `process.cwd()`              | Default working directory    |
| `configPath`   | string  | -                            | Custom config file path      |

### Browser Configuration

| Property    | Type    | Default     | Description                  |
| ----------- | ------- | ----------- | ---------------------------- |
| `headless`  | boolean | `true`      | Run browser in headless mode |
| `viewport`  | string  | `1920x1080` | Browser viewport size        |
| `timeout`   | number  | `30000`     | Page load timeout in ms      |
| `userAgent` | string  | -           | Custom user agent            |
| `proxy`     | string  | -           | Proxy server URL             |

### Session Configuration

| Property       | Type    | Default               | Description                 |
| -------------- | ------- | --------------------- | --------------------------- |
| `autoSave`     | boolean | `true`                | Automatically save sessions |
| `maxHistory`   | number  | `100`                 | Maximum history entries     |
| `saveLocation` | string  | `~/.roo-cli/sessions` | Session storage directory   |
| `compression`  | boolean | `true`                | Compress session files      |

### MCP Configuration

| Property  | Type   | Default | Description               |
| --------- | ------ | ------- | ------------------------- |
| `servers` | object | `{}`    | MCP server configurations |
| `timeout` | number | `10000` | Connection timeout in ms  |
| `retries` | number | `3`     | Connection retry attempts |

### Tools Configuration

| Property            | Type   | Default                           | Description                        |
| ------------------- | ------ | --------------------------------- | ---------------------------------- |
| `enabledCategories` | array  | `["file", "browser", "terminal"]` | Enabled tool categories            |
| `customToolsPath`   | string | -                                 | Path to custom tools directory     |
| `maxConcurrent`     | number | `5`                               | Maximum concurrent tool executions |

## Configuration Locations

### Priority Order (highest to lowest)

1. **Command-line arguments** - Override any config setting
2. **Environment variables** - System-wide overrides
3. **Project config** - Project-specific settings
4. **User config** - User-specific settings
5. **Default values** - Built-in defaults

### File Locations

#### Project Configuration

- `.roo-cli.json`
- `.roo-cli.yaml`
- `.roo-cli.yml`
- `roo-cli.config.js` (JavaScript config)

#### User Configuration

- `~/.roo-cli/config.json`
- `~/.config/roo-cli/config.json` (Linux/macOS)
- `%APPDATA%\roo-cli\config.json` (Windows)

#### System Configuration

- `/etc/roo-cli/config.json` (Linux/macOS)
- `%PROGRAMDATA%\roo-cli\config.json` (Windows)

## Environment Variables

All configuration options can be overridden with environment variables using the `ROO_` prefix:

```bash
# Core settings
export ROO_API_KEY="your-api-key"
export ROO_MODEL="claude-3-5-sonnet-20241022"
export ROO_MODE="debug"
export ROO_OUTPUT_FORMAT="json"
export ROO_VERBOSE="true"

# Browser settings
export ROO_BROWSER_HEADLESS="false"
export ROO_BROWSER_VIEWPORT="1280x720"
export ROO_BROWSER_TIMEOUT="60000"

# Session settings
export ROO_SESSION_AUTO_SAVE="false"
export ROO_SESSION_MAX_HISTORY="50"
export ROO_SESSION_SAVE_LOCATION="/tmp/roo-sessions"

# Custom config path
export ROO_CONFIG_PATH="/path/to/custom/config.json"
```

## JavaScript Configuration

For advanced users, JavaScript configuration files provide dynamic configuration:

```javascript
// roo-cli.config.js
module.exports = {
	apiKey: process.env.ANTHROPIC_API_KEY,
	model: process.env.NODE_ENV === "development" ? "claude-3-haiku-20240307" : "claude-3-5-sonnet-20241022",
	mode: "code",
	outputFormat: "json",

	// Dynamic browser configuration
	browser: {
		headless: process.env.CI === "true",
		viewport: process.env.VIEWPORT || "1920x1080",
	},

	// Conditional MCP servers
	mcp: {
		servers:
			process.env.NODE_ENV === "development"
				? {
						"dev-tools": {
							command: "node",
							args: ["./dev-mcp-server.js"],
						},
					}
				: {},
	},
}
```

## Configuration Validation

### Built-in Validation

Roo CLI automatically validates configuration:

```bash
# Validate current configuration
roo-cli config --validate

# Validate specific file
roo-cli config --validate ./my-config.json

# Show validation errors with details
roo-cli config --validate --verbose
```

### Common Validation Errors

| Error                  | Cause                        | Solution                                |
| ---------------------- | ---------------------------- | --------------------------------------- |
| Invalid API key format | Malformed API key            | Check key format from Anthropic console |
| Unknown model          | Unsupported model name       | Use supported model names               |
| Invalid mode           | Typo in mode name            | Check available modes with `--help`     |
| Browser config error   | Invalid viewport format      | Use `WIDTHxHEIGHT` format               |
| MCP server error       | Invalid server configuration | Check server command and args           |

## Configuration Examples

### Development Setup

```json
{
	"apiKey": "${ANTHROPIC_API_KEY}",
	"model": "claude-3-haiku-20240307",
	"mode": "debug",
	"outputFormat": "json",
	"verbose": true,
	"browser": {
		"headless": false,
		"timeout": 60000
	},
	"session": {
		"autoSave": true,
		"maxHistory": 200
	}
}
```

### Production Setup

```json
{
	"apiKey": "${ANTHROPIC_API_KEY}",
	"model": "claude-3-5-sonnet-20241022",
	"mode": "code",
	"outputFormat": "plain",
	"verbose": false,
	"browser": {
		"headless": true,
		"timeout": 30000
	},
	"session": {
		"autoSave": false,
		"maxHistory": 50
	}
}
```

### Team Setup

```json
{
	"mode": "code",
	"outputFormat": "markdown",
	"browser": {
		"headless": true,
		"viewport": "1920x1080"
	},
	"tools": {
		"enabledCategories": ["file", "terminal"],
		"customToolsPath": "./team-tools"
	},
	"session": {
		"autoSave": true,
		"saveLocation": "./project-sessions"
	}
}
```

## Migration and Updates

### Configuration Migration

When updating Roo CLI, configuration files may need migration:

```bash
# Check if migration is needed
roo-cli config --check-migration

# Migrate configuration automatically
roo-cli config --migrate

# Migrate specific file
roo-cli config --migrate ./old-config.json --output ./new-config.json
```

### Backup and Restore

```bash
# Backup current configuration
roo-cli config --backup ./config-backup.json

# Restore from backup
roo-cli config --restore ./config-backup.json
```

## Troubleshooting

### Common Issues

1. **Configuration not loading**

    - Check file permissions
    - Verify JSON/YAML syntax
    - Use `--config` to specify path explicitly

2. **Environment variables not working**

    - Ensure proper `ROO_` prefix
    - Check variable export in shell
    - Verify no typos in variable names

3. **Invalid API key errors**
    - Verify key from Anthropic console
    - Check for extra spaces or newlines
    - Ensure key has proper permissions

### Debug Configuration Loading

```bash
# Show configuration resolution
roo-cli config --debug

# Show all configuration sources
roo-cli config --show-sources

# Test configuration loading
roo-cli config --test
```

For more help, see the [troubleshooting guide](../troubleshooting/common-issues.md) or run `roo-cli help config`.
