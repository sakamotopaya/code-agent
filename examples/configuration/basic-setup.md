# Basic Configuration Setup

Essential configuration examples to get started with the CLI utility.

## Initial Setup

### First-Time Configuration

```bash
# Initialize configuration interactively
roo config init

# Initialize with default values
roo config init --defaults

# Initialize for specific use case
roo config init --preset development
```

**Description:** Set up the CLI for first use with guided configuration.

**Expected Output:** Configuration file created at `~/.roo-cli/config.json`

**Difficulty:** Beginner  
**Estimated Time:** 2 minutes  
**Tags:** #config #setup #initialization

---

### API Provider Setup

```bash
# Set API provider to Anthropic
roo config set api.provider anthropic
roo config set api.key "your-api-key"

# Set API provider to OpenAI
roo config set api.provider openai
roo config set api.key "your-openai-key"

# Configure local models
roo config set api.provider local
roo config set api.endpoint "http://localhost:11434"
```

**Description:** Configure different AI providers and API credentials.

**Prerequisites:**

- Valid API keys for chosen provider
- Local model server (if using local provider)

**Difficulty:** Beginner  
**Estimated Time:** 3 minutes  
**Tags:** #api #providers #credentials

---

### Output Preferences

```bash
# Set default output format
roo config set output.format json

# Enable colored output
roo config set output.color true

# Set verbose mode
roo config set output.verbose true

# Configure output file location
roo config set output.directory "./roo-output"
```

**Description:** Customize output formatting and display preferences.

**Difficulty:** Beginner  
**Estimated Time:** 1 minute  
**Tags:** #output #formatting #preferences

---

### Mode Configuration

```bash
# Set default mode
roo config set mode code

# Configure mode-specific settings
roo config set modes.code.autoSave true
roo config set modes.debug.verboseLogging true
roo config set modes.architect.templatePath "./templates"
```

**Description:** Configure default mode and mode-specific behaviors.

**Difficulty:** Intermediate  
**Estimated Time:** 2 minutes  
**Tags:** #modes #behavior #defaults

---

## Configuration Management

### View Configuration

```bash
# Show all configuration
roo config list

# Show specific section
roo config get api

# Show single value
roo config get api.provider

# Export configuration
roo config export > my-config.json
```

**Description:** View and export current configuration settings.

**Difficulty:** Beginner  
**Estimated Time:** 1 minute  
**Tags:** #config #viewing #export

---

### Validation and Testing

```bash
# Validate current configuration
roo config validate

# Test API connection
roo config test-connection

# Verify all settings
roo config verify

# Show configuration path
roo config path
```

**Description:** Validate and test configuration settings.

**Difficulty:** Beginner  
**Estimated Time:** 2 minutes  
**Tags:** #validation #testing #verification

---

### Environment Variables

```bash
# Set API key via environment
export ROO_API_KEY="your-api-key"

# Set provider via environment
export ROO_API_PROVIDER="anthropic"

# Set output format
export ROO_OUTPUT_FORMAT="json"

# Set default mode
export ROO_MODE="code"

# Disable colors
export ROO_NO_COLOR="true"
```

**Description:** Configure CLI using environment variables.

**Difficulty:** Beginner  
**Estimated Time:** 1 minute  
**Tags:** #environment #variables #configuration

---

### Multiple Configurations

```bash
# Use specific config file
roo --config ./project-config.json "your command"

# Switch between configurations
roo config use development
roo config use production

# Create named configuration
roo config create --name "my-project"

# List available configurations
roo config list-profiles
```

**Description:** Manage multiple configuration profiles.

**Difficulty:** Intermediate  
**Estimated Time:** 3 minutes  
**Tags:** #profiles #multiple #switching

---

## Configuration File Examples

### Basic Configuration

```json
{
	"api": {
		"provider": "anthropic",
		"timeout": 30000,
		"retries": 3
	},
	"output": {
		"format": "plain",
		"color": true,
		"verbose": false
	},
	"mode": "code",
	"autoSave": true
}
```

**Description:** Simple configuration file example.

**Difficulty:** Beginner  
**Tags:** #json #basic #example

---

### Advanced Configuration

```json
{
	"api": {
		"provider": "anthropic",
		"model": "claude-3-sonnet-20240229",
		"timeout": 60000,
		"retries": 5,
		"backoff": "exponential"
	},
	"output": {
		"format": "json",
		"directory": "./output",
		"template": "detailed",
		"color": true,
		"verboseMode": true
	},
	"modes": {
		"code": {
			"autoSave": true,
			"lintOnSave": true,
			"formatOnSave": true
		},
		"debug": {
			"verboseLogging": true,
			"saveDebugLogs": true
		}
	},
	"sessions": {
		"autoSave": true,
		"autoSaveInterval": 300,
		"maxHistory": 1000
	},
	"tools": {
		"browser": {
			"headless": true,
			"timeout": 30000
		},
		"fileOperations": {
			"createBackups": true,
			"confirmOverwrite": true
		}
	}
}
```

**Description:** Comprehensive configuration with all options.

**Difficulty:** Advanced  
**Tags:** #json #advanced #comprehensive

---

## Troubleshooting Configuration

### Common Issues

```bash
# Fix invalid configuration
roo config reset

# Repair corrupted config
roo config repair

# Clear configuration cache
roo config clear-cache

# Recreate default config
rm ~/.roo-cli/config.json
roo config init
```

**Description:** Fix common configuration problems.

**Difficulty:** Intermediate  
**Estimated Time:** 2 minutes  
**Tags:** #troubleshooting #repair #reset
