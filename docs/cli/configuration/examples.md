# Configuration Examples

This page provides practical configuration examples for different use cases and environments.

## Basic Configurations

### Minimal Setup

The simplest configuration with just the essentials:

```json
{
	"apiKey": "your-anthropic-api-key",
	"mode": "code"
}
```

### Standard Setup

A typical configuration for everyday use:

```json
{
	"apiKey": "your-anthropic-api-key",
	"model": "claude-3-5-sonnet-20241022",
	"mode": "code",
	"outputFormat": "plain",
	"verbose": false,
	"browser": {
		"headless": true,
		"viewport": "1920x1080"
	},
	"session": {
		"autoSave": true,
		"maxHistory": 100
	}
}
```

## Environment-Specific Configurations

### Development Environment

Optimized for development work with enhanced debugging:

```json
{
	"apiKey": "${ANTHROPIC_API_KEY}",
	"model": "claude-3-haiku-20240307",
	"mode": "debug",
	"outputFormat": "json",
	"verbose": true,
	"browser": {
		"headless": false,
		"viewport": "1920x1080",
		"timeout": 60000
	},
	"session": {
		"autoSave": true,
		"maxHistory": 200,
		"saveLocation": "./dev-sessions"
	},
	"tools": {
		"enabledCategories": ["file", "browser", "terminal"],
		"customToolsPath": "./dev-tools"
	},
	"mcp": {
		"servers": {
			"dev-filesystem": {
				"command": "node",
				"args": ["./dev-tools/filesystem-server.js"],
				"env": {
					"DEBUG": "true"
				}
			}
		}
	}
}
```

### Production Environment

Streamlined for production use with minimal output:

```json
{
	"apiKey": "${ANTHROPIC_API_KEY}",
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
		"autoSave": false,
		"maxHistory": 50
	},
	"tools": {
		"enabledCategories": ["file", "terminal"],
		"maxConcurrent": 3
	}
}
```

### Testing Environment

Configuration for automated testing:

```json
{
	"apiKey": "${TEST_API_KEY}",
	"model": "claude-3-haiku-20240307",
	"mode": "test",
	"outputFormat": "json",
	"verbose": false,
	"browser": {
		"headless": true,
		"viewport": "1280x720",
		"timeout": 15000
	},
	"session": {
		"autoSave": false,
		"maxHistory": 10
	},
	"tools": {
		"enabledCategories": ["file"],
		"timeout": 30000
	}
}
```

## Use Case Specific Configurations

### Web Development

Optimized for web development tasks:

```json
{
	"apiKey": "your-anthropic-api-key",
	"mode": "code",
	"outputFormat": "markdown",
	"browser": {
		"headless": false,
		"viewport": "1920x1080",
		"userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
	},
	"tools": {
		"enabledCategories": ["file", "browser", "terminal"],
		"customToolsPath": "./web-tools"
	},
	"mcp": {
		"servers": {
			"web-dev": {
				"command": "npx",
				"args": ["@modelcontextprotocol/server-filesystem"],
				"env": {
					"ALLOWED_DIRS": "./src,./public,./tests"
				}
			},
			"browser-tools": {
				"command": "node",
				"args": ["./tools/browser-mcp-server.js"]
			}
		}
	}
}
```

### Data Analysis

Configuration for data science and analysis work:

```json
{
	"apiKey": "your-anthropic-api-key",
	"mode": "code",
	"outputFormat": "csv",
	"tools": {
		"enabledCategories": ["file", "terminal"],
		"customToolsPath": "./data-tools"
	},
	"mcp": {
		"servers": {
			"data-analysis": {
				"command": "python",
				"args": ["-m", "mcp_server_data"],
				"env": {
					"PANDAS_CONFIG": "./pandas.conf"
				}
			},
			"database": {
				"command": "node",
				"args": ["./tools/database-mcp-server.js"],
				"env": {
					"DB_CONNECTION": "${DATABASE_URL}"
				}
			}
		}
	}
}
```

### DevOps and Infrastructure

Configuration for infrastructure and deployment tasks:

```json
{
	"apiKey": "your-anthropic-api-key",
	"mode": "code",
	"outputFormat": "yaml",
	"tools": {
		"enabledCategories": ["file", "terminal"],
		"timeout": 300000
	},
	"mcp": {
		"servers": {
			"kubernetes": {
				"command": "kubectl",
				"args": ["mcp-server"],
				"env": {
					"KUBECONFIG": "${KUBECONFIG}"
				}
			},
			"terraform": {
				"command": "terraform",
				"args": ["mcp-server"],
				"env": {
					"TF_VAR_environment": "${ENVIRONMENT}"
				}
			},
			"aws": {
				"command": "aws",
				"args": ["mcp", "server"],
				"env": {
					"AWS_PROFILE": "${AWS_PROFILE}"
				}
			}
		}
	}
}
```

### Content Creation

Optimized for documentation and content creation:

```json
{
	"apiKey": "your-anthropic-api-key",
	"mode": "code",
	"outputFormat": "markdown",
	"tools": {
		"enabledCategories": ["file", "browser"],
		"customToolsPath": "./content-tools"
	},
	"session": {
		"autoSave": true,
		"maxHistory": 500,
		"saveLocation": "./content-sessions"
	},
	"mcp": {
		"servers": {
			"grammar-check": {
				"command": "node",
				"args": ["./tools/grammar-mcp-server.js"]
			},
			"research": {
				"command": "python",
				"args": ["-m", "research_mcp_server"]
			}
		}
	}
}
```

## Team and Project Configurations

### Team Development

Shared configuration for development teams:

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
		"customToolsPath": "./team-tools",
		"maxConcurrent": 3
	},
	"session": {
		"autoSave": true,
		"saveLocation": "./project-sessions",
		"maxHistory": 100
	},
	"mcp": {
		"servers": {
			"shared-filesystem": {
				"command": "npx",
				"args": ["@modelcontextprotocol/server-filesystem"],
				"env": {
					"ALLOWED_DIRS": "./src,./docs,./tests"
				}
			},
			"git-tools": {
				"command": "node",
				"args": ["./tools/git-mcp-server.js"]
			}
		}
	}
}
```

### Open Source Project

Configuration for open source development:

```json
{
	"mode": "code",
	"outputFormat": "markdown",
	"tools": {
		"enabledCategories": ["file", "terminal", "browser"],
		"customToolsPath": "./contrib-tools"
	},
	"session": {
		"autoSave": false,
		"saveLocation": "./contrib-sessions"
	},
	"mcp": {
		"servers": {
			"github": {
				"command": "npx",
				"args": ["@modelcontextprotocol/server-github"],
				"env": {
					"GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
				}
			},
			"documentation": {
				"command": "node",
				"args": ["./tools/docs-mcp-server.js"]
			}
		}
	}
}
```

## Platform-Specific Configurations

### Windows Configuration

```json
{
	"apiKey": "your-anthropic-api-key",
	"mode": "code",
	"outputFormat": "plain",
	"browser": {
		"headless": true,
		"executable": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
	},
	"tools": {
		"enabledCategories": ["file", "terminal"],
		"customToolsPath": ".\\windows-tools"
	},
	"session": {
		"saveLocation": "%USERPROFILE%\\.roo-cli\\sessions"
	},
	"mcp": {
		"servers": {
			"powershell": {
				"command": "powershell",
				"args": ["-File", ".\\tools\\powershell-mcp-server.ps1"]
			}
		}
	}
}
```

### macOS Configuration

```json
{
	"apiKey": "your-anthropic-api-key",
	"mode": "code",
	"outputFormat": "plain",
	"browser": {
		"headless": true,
		"executable": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
	},
	"tools": {
		"enabledCategories": ["file", "terminal", "browser"],
		"customToolsPath": "./macos-tools"
	},
	"session": {
		"saveLocation": "~/Library/Application Support/roo-cli/sessions"
	},
	"mcp": {
		"servers": {
			"macos-tools": {
				"command": "/usr/bin/swift",
				"args": ["./tools/macos-mcp-server.swift"]
			}
		}
	}
}
```

### Linux Configuration

```json
{
	"apiKey": "your-anthropic-api-key",
	"mode": "code",
	"outputFormat": "plain",
	"browser": {
		"headless": true,
		"args": ["--no-sandbox", "--disable-dev-shm-usage"]
	},
	"tools": {
		"enabledCategories": ["file", "terminal"],
		"customToolsPath": "./linux-tools"
	},
	"session": {
		"saveLocation": "~/.local/share/roo-cli/sessions"
	},
	"mcp": {
		"servers": {
			"systemd": {
				"command": "python3",
				"args": ["-m", "systemd_mcp_server"]
			},
			"docker": {
				"command": "docker",
				"args": ["run", "--rm", "roo/mcp-server"]
			}
		}
	}
}
```

## Advanced Configurations

### Multi-Model Setup

Using different models for different tasks:

```json
{
	"apiKey": "your-anthropic-api-key",
	"model": "claude-3-5-sonnet-20241022",
	"mode": "code",
	"profiles": {
		"fast": {
			"model": "claude-3-haiku-20240307",
			"mode": "code"
		},
		"analysis": {
			"model": "claude-3-5-sonnet-20241022",
			"mode": "architect"
		},
		"debug": {
			"model": "claude-3-5-sonnet-20241022",
			"mode": "debug",
			"verbose": true
		}
	}
}
```

### High-Performance Setup

Configuration for resource-intensive tasks:

```json
{
	"apiKey": "your-anthropic-api-key",
	"model": "claude-3-5-sonnet-20241022",
	"mode": "code",
	"performance": {
		"memoryLimit": "2GB",
		"cpuLimit": 4,
		"cacheSize": "500MB",
		"requestTimeout": 300000
	},
	"tools": {
		"maxConcurrent": 10,
		"timeout": 600000
	},
	"browser": {
		"instances": 3,
		"poolSize": 5
	}
}
```

### Enterprise Configuration

Configuration for enterprise environments:

```json
{
	"apiKey": "${ENTERPRISE_API_KEY}",
	"model": "claude-3-5-sonnet-20241022",
	"mode": "code",
	"enterprise": {
		"proxy": "${CORPORATE_PROXY}",
		"sslVerify": true,
		"auditLog": true,
		"compliance": "SOC2"
	},
	"security": {
		"encryptSessions": true,
		"encryptLogs": true,
		"sanitizeOutput": true
	},
	"mcp": {
		"allowedServers": ["filesystem", "database", "enterprise-tools"],
		"serverWhitelist": true
	}
}
```

## Configuration Templates

### Interactive Setup

Generate configurations interactively:

```bash
# Generate basic configuration
roo-cli --generate-config

# Generate with prompts
roo-cli config --setup

# Generate from template
roo-cli config --template web-dev --output .roo-cli.json
```

### YAML Templates

For teams preferring YAML:

```yaml
# .roo-cli.yaml
apiKey: ${ANTHROPIC_API_KEY}
model: claude-3-5-sonnet-20241022
mode: code
outputFormat: markdown

browser:
    headless: true
    viewport: "1920x1080"

session:
    autoSave: true
    maxHistory: 100

tools:
    enabledCategories:
        - file
        - browser
        - terminal

mcp:
    servers:
        filesystem:
            command: npx
            args:
                - "@modelcontextprotocol/server-filesystem"
```

### Environment-Based Templates

Use different configurations per environment:

```javascript
// roo-cli.config.js
const env = process.env.NODE_ENV || "development"

const configs = {
	development: {
		model: "claude-3-haiku-20240307",
		mode: "debug",
		verbose: true,
		browser: { headless: false },
	},
	production: {
		model: "claude-3-5-sonnet-20241022",
		mode: "code",
		verbose: false,
		browser: { headless: true },
	},
	test: {
		model: "claude-3-haiku-20240307",
		mode: "test",
		session: { autoSave: false },
	},
}

module.exports = {
	apiKey: process.env.ANTHROPIC_API_KEY,
	...configs[env],
}
```

## Best Practices

### Security

1. **Never commit API keys** to version control
2. **Use environment variables** for sensitive data
3. **Restrict file permissions** on config files
4. **Use different keys** for different environments

### Performance

1. **Choose appropriate models** for the task
2. **Limit concurrent operations** to avoid rate limits
3. **Use caching** for repeated operations
4. **Monitor resource usage** in production

### Maintenance

1. **Version your configurations** alongside code
2. **Document team conventions** in README
3. **Validate configurations** before deployment
4. **Monitor for deprecated options** in updates

For more examples and help, see the [getting started guide](../getting-started.md) or run `roo-cli config --examples`.
