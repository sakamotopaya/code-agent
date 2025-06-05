# MCP Commands

Model Context Protocol (MCP) commands manage connections to MCP servers that provide additional tools and resources to extend Roo CLI capabilities.

## mcp list

List all configured and connected MCP servers with their status.

### Usage

```bash
roo-cli mcp list [options]
```

### Options

| Option              | Description                                     |
| ------------------- | ----------------------------------------------- |
| `--format <format>` | Output format (table, json, yaml)               |
| `--status <status>` | Filter by status (connected, disconnected, all) |
| `--verbose`         | Show detailed server information                |
| `--show-config`     | Include server configuration                    |

### Examples

```bash
# List all MCP servers
roo-cli mcp list

# List only connected servers
roo-cli mcp list --status connected

# Show detailed information
roo-cli mcp list --verbose

# JSON format with configuration
roo-cli mcp list --format json --show-config
```

### Output Format

```bash
# Table format (default)
NAME          STATUS       TYPE     TOOLS    RESOURCES    VERSION
filesystem    connected    stdio    5        2            1.0.0
github        connected    sse      12       8            2.1.0
database      disconnected stdio    3        1            1.2.0

# Verbose format
filesystem (connected)
  Type: stdio
  Command: npx @modelcontextprotocol/server-filesystem
  PID: 12345
  Tools: read_file, write_file, list_files, search_files, get_file_info
  Resources: file://, directory://
  Uptime: 2h 15m
  Last ping: 2s ago
```

---

## mcp connect

Connect to an MCP server manually or test connections.

### Usage

```bash
roo-cli mcp connect <server-name> [options]
```

### Arguments

| Argument      | Description                              |
| ------------- | ---------------------------------------- |
| `server-name` | Name of the server to connect (required) |

### Options

| Option            | Description                             |
| ----------------- | --------------------------------------- |
| `--force`         | Force reconnection if already connected |
| `--timeout <ms>`  | Connection timeout in milliseconds      |
| `--retry <count>` | Number of retry attempts                |
| `--wait`          | Wait for connection to establish        |

### Examples

```bash
# Connect to configured server
roo-cli mcp connect filesystem

# Force reconnection
roo-cli mcp connect github --force

# Connect with custom timeout
roo-cli mcp connect database --timeout 30000 --wait

# Connect with retries
roo-cli mcp connect api-server --retry 5
```

### Connection Process

1. **Validation**: Check server configuration
2. **Initialization**: Start server process or establish connection
3. **Handshake**: Exchange MCP protocol messages
4. **Discovery**: Enumerate available tools and resources
5. **Registration**: Register tools with CLI system

---

## mcp disconnect

Disconnect from an MCP server gracefully.

### Usage

```bash
roo-cli mcp disconnect <server-name> [options]
```

### Arguments

| Argument      | Description                                 |
| ------------- | ------------------------------------------- |
| `server-name` | Name of the server to disconnect (required) |

### Options

| Option      | Description                                   |
| ----------- | --------------------------------------------- |
| `--force`   | Force disconnection without graceful shutdown |
| `--cleanup` | Clean up server resources                     |
| `--all`     | Disconnect all servers                        |

### Examples

```bash
# Graceful disconnect
roo-cli mcp disconnect filesystem

# Force disconnect
roo-cli mcp disconnect unresponsive-server --force

# Disconnect all servers
roo-cli mcp disconnect --all

# Disconnect with cleanup
roo-cli mcp disconnect github --cleanup
```

---

## mcp tools

List available tools from MCP servers.

### Usage

```bash
roo-cli mcp tools [server-name] [options]
```

### Arguments

| Argument      | Description                     |
| ------------- | ------------------------------- |
| `server-name` | Specific server name (optional) |

### Options

| Option                  | Description                         |
| ----------------------- | ----------------------------------- |
| `--format <format>`     | Output format (table, json, yaml)   |
| `--category <category>` | Filter by tool category             |
| `--search <query>`      | Search tools by name or description |
| `--detailed`            | Show detailed tool information      |

### Examples

```bash
# List all tools from all servers
roo-cli mcp tools

# List tools from specific server
roo-cli mcp tools filesystem

# Search for file-related tools
roo-cli mcp tools --search "file"

# Show detailed tool information
roo-cli mcp tools github --detailed

# Filter by category
roo-cli mcp tools --category "file-operations"
```

### Tool Information

```bash
# Table format
SERVER      TOOL              CATEGORY         DESCRIPTION
filesystem  read_file         file-ops         Read file contents
filesystem  write_file        file-ops         Write content to file
github      create_pr         version-control  Create pull request
github      list_issues       version-control  List repository issues

# Detailed format
Tool: read_file (filesystem)
  Category: file-operations
  Description: Read the contents of a file
  Parameters:
    - path (string, required): File path to read
    - encoding (string, optional): File encoding (default: utf8)
  Examples:
    - Read a text file: {"path": "/path/to/file.txt"}
    - Read with specific encoding: {"path": "/path/to/file.txt", "encoding": "latin1"}
```

---

## mcp resources

List available resources from MCP servers.

### Usage

```bash
roo-cli mcp resources [server-name] [options]
```

### Arguments

| Argument      | Description                     |
| ------------- | ------------------------------- |
| `server-name` | Specific server name (optional) |

### Options

| Option              | Description                            |
| ------------------- | -------------------------------------- |
| `--format <format>` | Output format (table, json, yaml)      |
| `--type <type>`     | Filter by resource type                |
| `--search <query>`  | Search resources by URI or description |
| `--available`       | Show only available resources          |

### Examples

```bash
# List all resources
roo-cli mcp resources

# List resources from specific server
roo-cli mcp resources filesystem

# Filter by type
roo-cli mcp resources --type "file"

# Search resources
roo-cli mcp resources --search "config"

# Show only available resources
roo-cli mcp resources --available
```

### Resource Information

```bash
# Table format
SERVER      URI                     TYPE         DESCRIPTION
filesystem  file:///etc/config      file         System configuration
filesystem  directory:///home/user  directory    User home directory
github      repo://owner/name       repository   GitHub repository

# Detailed format
Resource: file:///etc/nginx/nginx.conf (filesystem)
  Type: file
  Description: Nginx configuration file
  MIME Type: text/plain
  Size: 2.5 KB
  Last Modified: 2024-01-15T10:30:00Z
  Permissions: read
```

---

## mcp execute

Execute a tool from an MCP server directly.

### Usage

```bash
roo-cli mcp execute <server> <tool> [options]
```

### Arguments

| Argument | Description            |
| -------- | ---------------------- |
| `server` | Server name (required) |
| `tool`   | Tool name (required)   |

### Options

| Option              | Description               |
| ------------------- | ------------------------- |
| `--params <json>`   | Tool parameters as JSON   |
| `--file <path>`     | Read parameters from file |
| `--output <path>`   | Save output to file       |
| `--format <format>` | Output format             |
| `--timeout <ms>`    | Execution timeout         |

### Examples

```bash
# Execute tool with inline parameters
roo-cli mcp execute filesystem read_file --params '{"path": "/etc/hosts"}'

# Execute with parameters from file
roo-cli mcp execute github create_issue --file issue-params.json

# Execute with output to file
roo-cli mcp execute filesystem list_files \
  --params '{"directory": "/src"}' \
  --output file-list.json

# Execute with timeout
roo-cli mcp execute database query \
  --params '{"sql": "SELECT * FROM users"}' \
  --timeout 30000
```

### Parameter File Format

```json
{
	"path": "/path/to/file.txt",
	"encoding": "utf8",
	"options": {
		"create": true,
		"overwrite": false
	}
}
```

---

## mcp status

Show detailed status and health information for MCP servers.

### Usage

```bash
roo-cli mcp status [server-name] [options]
```

### Arguments

| Argument      | Description                     |
| ------------- | ------------------------------- |
| `server-name` | Specific server name (optional) |

### Options

| Option              | Description                       |
| ------------------- | --------------------------------- |
| `--format <format>` | Output format (table, json, yaml) |
| `--watch`           | Continuously monitor status       |
| `--health-check`    | Perform health check              |
| `--detailed`        | Show detailed metrics             |

### Examples

```bash
# Show status of all servers
roo-cli mcp status

# Show status of specific server
roo-cli mcp status filesystem

# Continuous monitoring
roo-cli mcp status --watch

# Health check with details
roo-cli mcp status github --health-check --detailed
```

### Status Information

```bash
# Summary format
MCP Server Status Summary
========================
Total Servers: 3
Connected: 2
Disconnected: 1
Failed: 0

# Detailed format
filesystem (connected)
  Status: healthy
  Uptime: 2h 15m 30s
  Memory Usage: 45.2 MB
  CPU Usage: 0.5%
  Requests: 1,247 total, 12 errors (0.96%)
  Latency: avg 45ms, p95 120ms, p99 250ms
  Last Health Check: 30s ago (OK)

github (connected)
  Status: healthy
  Uptime: 1h 42m 15s
  Rate Limit: 4,500/5,000 remaining
  Requests: 89 total, 2 errors (2.25%)
  Latency: avg 180ms, p95 450ms, p99 800ms
  Last Health Check: 15s ago (OK)
```

---

## mcp config

Manage MCP server configurations.

### Usage

```bash
roo-cli mcp config [options]
```

### Options

| Option            | Description                  |
| ----------------- | ---------------------------- |
| `--list`          | List server configurations   |
| `--add <name>`    | Add new server configuration |
| `--remove <name>` | Remove server configuration  |
| `--edit <name>`   | Edit server configuration    |
| `--validate`      | Validate configurations      |
| `--export <path>` | Export configurations        |
| `--import <path>` | Import configurations        |

### Examples

```bash
# List configurations
roo-cli mcp config --list

# Add new server
roo-cli mcp config --add my-server

# Edit existing server
roo-cli mcp config --edit filesystem

# Validate all configurations
roo-cli mcp config --validate

# Export configurations
roo-cli mcp config --export mcp-servers.json
```

### Configuration Format

```json
{
	"mcp": {
		"servers": {
			"filesystem": {
				"command": "npx",
				"args": ["@modelcontextprotocol/server-filesystem"],
				"env": {
					"ALLOWED_DIRECTORIES": "/src,/docs"
				},
				"timeout": 10000,
				"retries": 3,
				"autoConnect": true
			},
			"github": {
				"type": "sse",
				"url": "https://mcp.github.com/v1",
				"headers": {
					"Authorization": "Bearer ${GITHUB_TOKEN}"
				},
				"timeout": 15000,
				"autoConnect": true
			},
			"custom-tools": {
				"command": "node",
				"args": ["./tools/custom-mcp-server.js"],
				"cwd": "./",
				"env": {
					"NODE_ENV": "production"
				},
				"autoConnect": false
			}
		}
	}
}
```

---

## mcp logs

View and manage MCP server logs.

### Usage

```bash
roo-cli mcp logs [server-name] [options]
```

### Arguments

| Argument      | Description                     |
| ------------- | ------------------------------- |
| `server-name` | Specific server name (optional) |

### Options

| Option              | Description             |
| ------------------- | ----------------------- |
| `--follow`          | Follow log output       |
| `--tail <lines>`    | Show last N lines       |
| `--level <level>`   | Filter by log level     |
| `--since <time>`    | Show logs since time    |
| `--output <path>`   | Save logs to file       |
| `--format <format>` | Log format (text, json) |

### Examples

```bash
# View all server logs
roo-cli mcp logs

# View specific server logs
roo-cli mcp logs filesystem

# Follow logs in real-time
roo-cli mcp logs github --follow

# Show last 100 lines
roo-cli mcp logs --tail 100

# Filter by log level
roo-cli mcp logs --level error

# Show logs since yesterday
roo-cli mcp logs --since "24h ago"
```

---

## MCP Server Types

### Stdio Servers

Local servers that communicate via standard input/output:

```json
{
	"filesystem": {
		"command": "npx",
		"args": ["@modelcontextprotocol/server-filesystem"],
		"env": {
			"ALLOWED_DIRECTORIES": "/src,/docs"
		}
	}
}
```

### SSE Servers

Remote servers using Server-Sent Events over HTTP:

```json
{
	"remote-api": {
		"type": "sse",
		"url": "https://api.example.com/mcp/v1",
		"headers": {
			"Authorization": "Bearer ${API_TOKEN}",
			"X-Client-Version": "1.0.0"
		}
	}
}
```

### WebSocket Servers

Real-time servers using WebSocket connections:

```json
{
	"realtime-data": {
		"type": "websocket",
		"url": "wss://data.example.com/mcp",
		"protocols": ["mcp-v1"],
		"headers": {
			"Authorization": "Bearer ${WS_TOKEN}"
		}
	}
}
```

---

## Common MCP Workflows

### Development Setup

```bash
# List available servers
roo-cli mcp list

# Connect to development servers
roo-cli mcp connect filesystem
roo-cli mcp connect local-database

# Test tools
roo-cli mcp tools filesystem
roo-cli mcp execute filesystem read_file --params '{"path": "./README.md"}'
```

### Production Deployment

```bash
# Validate configurations
roo-cli mcp config --validate

# Connect to production servers
roo-cli mcp connect --all

# Health check
roo-cli mcp status --health-check

# Monitor
roo-cli mcp status --watch
```

### Troubleshooting

```bash
# Check server status
roo-cli mcp status server-name

# View recent logs
roo-cli mcp logs server-name --tail 50 --level error

# Reconnect problematic server
roo-cli mcp disconnect server-name
roo-cli mcp connect server-name --force

# Validate configuration
roo-cli mcp config --validate
```

## Best Practices

### Configuration Management

1. **Environment Variables**: Use environment variables for sensitive data
2. **Validation**: Always validate configurations before deployment
3. **Backup**: Keep backup copies of working configurations
4. **Documentation**: Document custom server configurations

### Connection Management

1. **Auto-Connect**: Enable auto-connect for essential servers
2. **Timeouts**: Set appropriate timeouts for network conditions
3. **Retries**: Configure retry policies for unreliable connections
4. **Health Checks**: Regular health checks for production servers

### Security

1. **Authentication**: Use proper authentication for remote servers
2. **Permissions**: Limit server permissions to minimum required
3. **Encryption**: Use encrypted connections for sensitive data
4. **Monitoring**: Monitor server access and usage patterns

For more information, see:

- [Core Commands](./core-commands.md)
- [Configuration Guide](../configuration/overview.md)
- [Tools Documentation](../tools/overview.md)
- [Troubleshooting Guide](../troubleshooting/common-issues.md)
