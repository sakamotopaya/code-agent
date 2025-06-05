# Session Commands

Session management allows you to save, load, and manage your CLI interactions for continuity across different work sessions.

## session list

List all saved sessions with details and metadata.

### Usage

```bash
roo-cli session list [options]
```

### Options

| Option               | Description                            |
| -------------------- | -------------------------------------- |
| `--format <format>`  | Output format (table, json, yaml, csv) |
| `--sort <field>`     | Sort by field (name, date, size)       |
| `--filter <pattern>` | Filter sessions by name pattern        |
| `--limit <number>`   | Limit number of results                |
| `--verbose`          | Show detailed information              |

### Examples

```bash
# List all sessions
roo-cli session list

# List with JSON format
roo-cli session list --format json

# List recent sessions
roo-cli session list --sort date --limit 10

# Filter by name pattern
roo-cli session list --filter "project-*"

# Detailed information
roo-cli session list --verbose
```

### Output Format

```bash
# Table format (default)
ID       NAME                    DATE                SIZE    ENTRIES
abc123   web-dev-project        2024-01-15 14:30    1.2MB   45
def456   api-refactoring        2024-01-14 09:15    890KB   32
ghi789   bug-investigation      2024-01-13 16:45    2.1MB   67

# JSON format
{
  "sessions": [
    {
      "id": "abc123",
      "name": "web-dev-project",
      "created": "2024-01-15T14:30:00Z",
      "modified": "2024-01-15T18:45:00Z",
      "size": 1234567,
      "entries": 45,
      "tags": ["web", "react"],
      "description": "React component development"
    }
  ]
}
```

---

## session save

Save the current session with a name and optional metadata.

### Usage

```bash
roo-cli session save <name> [options]
```

### Arguments

| Argument | Description             |
| -------- | ----------------------- |
| `name`   | Session name (required) |

### Options

| Option                 | Description                |
| ---------------------- | -------------------------- |
| `--description <text>` | Session description        |
| `--tags <tags>`        | Comma-separated tags       |
| `--compress`           | Compress session data      |
| `--encrypt`            | Encrypt session data       |
| `--overwrite`          | Overwrite existing session |

### Examples

```bash
# Save current session
roo-cli session save "web-development"

# Save with description and tags
roo-cli session save "api-project" --description "REST API development" --tags "api,backend,node"

# Save compressed session
roo-cli session save "large-project" --compress

# Overwrite existing session
roo-cli session save "my-project" --overwrite
```

### Interactive Save

In interactive mode:

```bash
roo-cli
roo> # Work on your project...
roo> session save "project-analysis"
✓ Session saved as 'project-analysis' (ID: abc123)

roo> session save "project-analysis" --description "Code analysis and refactoring"
✓ Session updated with description
```

---

## session load

Load a previously saved session to continue work.

### Usage

```bash
roo-cli session load <id|name> [options]
```

### Arguments

| Argument | Description |
| -------- | ----------- | ----------------------------- |
| `id      | name`       | Session ID or name (required) |

### Options

| Option          | Description                      |
| --------------- | -------------------------------- |
| `--interactive` | Load in interactive mode         |
| `--continue`    | Continue session from last point |
| `--read-only`   | Load in read-only mode           |
| `--merge`       | Merge with current session       |

### Examples

```bash
# Load session by ID
roo-cli session load abc123

# Load session by name
roo-cli session load "web-development"

# Load and continue in interactive mode
roo-cli session load "api-project" --interactive --continue

# Load in read-only mode
roo-cli session load "archived-project" --read-only

# Merge with current session
roo-cli session load "shared-context" --merge
```

### Session Context

When loading a session, the following is restored:

- **Conversation History**: Previous interactions and responses
- **Working Directory**: Original working directory
- **Configuration**: Session-specific configuration
- **File Context**: Referenced files and their states
- **Agent Mode**: The mode used in the session
- **Variables**: Session variables and environment

---

## session delete

Delete one or more sessions permanently.

### Usage

```bash
roo-cli session delete <id|name> [options]
```

### Arguments

| Argument | Description |
| -------- | ----------- | ----------------------------- |
| `id      | name`       | Session ID or name (required) |

### Options

| Option       | Description                   |
| ------------ | ----------------------------- |
| `--force`    | Skip confirmation prompt      |
| `--backup`   | Create backup before deletion |
| `--multiple` | Delete multiple sessions      |

### Examples

```bash
# Delete single session
roo-cli session delete abc123

# Delete with confirmation skip
roo-cli session delete "old-project" --force

# Delete with backup
roo-cli session delete "important-session" --backup

# Delete multiple sessions
roo-cli session delete "project-*" --multiple --force
```

### Safety Features

- **Confirmation Prompt**: Requires confirmation unless `--force` is used
- **Backup Option**: Creates backup before deletion with `--backup`
- **Pattern Matching**: Use wildcards for bulk operations
- **Recovery**: Deleted sessions can be recovered from backups

---

## session export

Export sessions to files for sharing or backup.

### Usage

```bash
roo-cli session export <id|name> [options]
```

### Arguments

| Argument | Description |
| -------- | ----------- | ----------------------------- |
| `id      | name`       | Session ID or name (required) |

### Options

| Option              | Description                     |
| ------------------- | ------------------------------- |
| `--output <path>`   | Output file path                |
| `--format <format>` | Export format (json, yaml, zip) |
| `--include-files`   | Include referenced files        |
| `--compress`        | Compress export                 |
| `--sanitize`        | Remove sensitive information    |

### Examples

```bash
# Export session to JSON
roo-cli session export "web-project" --output web-project.json

# Export with files included
roo-cli session export abc123 --include-files --format zip --output project-backup.zip

# Export sanitized version
roo-cli session export "shared-session" --sanitize --output shared.json

# Export multiple sessions
roo-cli session export "project-*" --format zip --output projects-backup.zip
```

### Export Formats

#### JSON Format

```json
{
	"session": {
		"id": "abc123",
		"name": "web-project",
		"created": "2024-01-15T14:30:00Z",
		"metadata": {
			"description": "Web development project",
			"tags": ["web", "react"]
		},
		"history": [
			{
				"timestamp": "2024-01-15T14:31:00Z",
				"type": "user",
				"content": "Create a React component"
			},
			{
				"timestamp": "2024-01-15T14:31:30Z",
				"type": "assistant",
				"content": "I'll create a React component for you..."
			}
		],
		"context": {
			"workingDirectory": "/path/to/project",
			"mode": "code",
			"configuration": {},
			"files": []
		}
	}
}
```

#### ZIP Format

```
session-export.zip
├── session.json          # Session metadata and history
├── context/              # Session context
│   ├── config.json       # Configuration
│   └── variables.json    # Session variables
└── files/                # Referenced files (if --include-files)
    ├── src/
    └── docs/
```

---

## session import

Import sessions from exported files.

### Usage

```bash
roo-cli session import <file> [options]
```

### Arguments

| Argument | Description                 |
| -------- | --------------------------- |
| `file`   | Import file path (required) |

### Options

| Option            | Description                 |
| ----------------- | --------------------------- |
| `--name <name>`   | Override session name       |
| `--merge`         | Merge with existing session |
| `--restore-files` | Restore referenced files    |
| `--validate`      | Validate before import      |

### Examples

```bash
# Import session from file
roo-cli session import web-project.json

# Import with custom name
roo-cli session import backup.json --name "restored-project"

# Import and restore files
roo-cli session import project-backup.zip --restore-files

# Validate before import
roo-cli session import untrusted.json --validate
```

### Import Validation

The import process validates:

- **File Format**: Correct JSON/YAML/ZIP structure
- **Schema Version**: Compatible session format
- **Dependencies**: Required tools and configurations
- **Security**: No malicious content
- **Conflicts**: Name conflicts with existing sessions

---

## session cleanup

Clean up old or unused sessions automatically.

### Usage

```bash
roo-cli session cleanup [options]
```

### Options

| Option                 | Description                       |
| ---------------------- | --------------------------------- |
| `--max-age <days>`     | Remove sessions older than days   |
| `--max-count <number>` | Keep only most recent N sessions  |
| `--min-size <size>`    | Remove sessions smaller than size |
| `--dry-run`            | Show what would be deleted        |
| `--force`              | Skip confirmation                 |
| `--backup`             | Backup before deletion            |

### Examples

```bash
# Remove sessions older than 30 days
roo-cli session cleanup --max-age 30

# Keep only 50 most recent sessions
roo-cli session cleanup --max-count 50

# Remove small sessions (less than 1KB)
roo-cli session cleanup --min-size 1024

# Preview cleanup without deleting
roo-cli session cleanup --max-age 7 --dry-run

# Cleanup with backup
roo-cli session cleanup --max-age 30 --backup
```

### Cleanup Policies

Configure automatic cleanup in your configuration:

```json
{
	"session": {
		"cleanup": {
			"enabled": true,
			"maxAge": 30,
			"maxCount": 100,
			"minSize": 1024,
			"autoBackup": true
		}
	}
}
```

---

## session info

Show detailed information about a specific session.

### Usage

```bash
roo-cli session info <id|name> [options]
```

### Arguments

| Argument | Description |
| -------- | ----------- | ----------------------------- |
| `id      | name`       | Session ID or name (required) |

### Options

| Option              | Description                       |
| ------------------- | --------------------------------- |
| `--format <format>` | Output format (table, json, yaml) |
| `--include-history` | Include conversation history      |
| `--include-files`   | Include file references           |
| `--stats`           | Show session statistics           |

### Examples

```bash
# Show session information
roo-cli session info "web-project"

# Show detailed information with history
roo-cli session info abc123 --include-history --include-files

# Show statistics
roo-cli session info "api-project" --stats

# JSON format
roo-cli session info "my-session" --format json
```

### Information Display

```bash
Session Information
===================
ID:           abc123
Name:         web-project
Created:      2024-01-15 14:30:00
Modified:     2024-01-15 18:45:00
Size:         1.2 MB
Entries:      45 interactions
Mode:         code
Directory:    /path/to/project

Description:  React component development
Tags:         web, react, frontend

Statistics:
- User messages:      23
- Assistant messages: 22
- Files created:      8
- Files modified:     15
- Tools used:         12
- Average response:   2.3s
```

---

## Session Management Best Practices

### Naming Conventions

Use descriptive, consistent naming:

```bash
# Good names
roo-cli session save "webapp-user-auth"
roo-cli session save "api-v2-migration"
roo-cli session save "bug-fix-payment-flow"

# Avoid generic names
roo-cli session save "work"
roo-cli session save "project"
roo-cli session save "session1"
```

### Organization

Use tags and descriptions for organization:

```bash
roo-cli session save "user-dashboard" \
  --description "Frontend dashboard development" \
  --tags "frontend,react,dashboard,ui"

roo-cli session save "api-authentication" \
  --description "JWT authentication implementation" \
  --tags "backend,auth,jwt,security"
```

### Backup Strategy

Regular backups of important sessions:

```bash
# Daily backup of active sessions
roo-cli session export "active-*" --format zip --output daily-backup.zip

# Weekly full backup
roo-cli session list --format json | \
  jq -r '.sessions[].id' | \
  xargs -I {} roo-cli session export {} --include-files
```

### Cleanup Strategy

Implement regular cleanup:

```bash
# Weekly cleanup
roo-cli session cleanup --max-age 7 --backup --dry-run
roo-cli session cleanup --max-age 7 --backup --force

# Monthly archive
roo-cli session export "old-*" --format zip --output archive-$(date +%Y%m).zip
roo-cli session delete "old-*" --force
```

## Session Storage

### Storage Locations

| Platform | Default Location                                  |
| -------- | ------------------------------------------------- |
| Linux    | `~/.local/share/roo-cli/sessions/`                |
| macOS    | `~/Library/Application Support/roo-cli/sessions/` |
| Windows  | `%APPDATA%\roo-cli\sessions\`                     |

### Storage Format

Sessions are stored as compressed JSON files:

```
sessions/
├── abc123.json.gz        # Session data
├── abc123.meta.json      # Session metadata
└── abc123.files/         # Referenced files (if saved)
    ├── src/
    └── docs/
```

### Configuration

Configure session storage:

```json
{
	"session": {
		"saveLocation": "~/.roo-cli/sessions",
		"compression": true,
		"encryption": false,
		"autoSave": true,
		"maxHistory": 100,
		"retentionDays": 30
	}
}
```

For more information, see:

- [Core Commands](./core-commands.md)
- [MCP Commands](./mcp-commands.md)
- [Configuration Guide](../configuration/overview.md)
- [Best Practices](../guides/best-practices.md)
