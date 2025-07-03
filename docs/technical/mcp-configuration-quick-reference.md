# MCP Configuration Quick Reference

## File Path Summary by Mode

| Mode                  | Scope       | File Path                         | Priority | Notes                     |
| --------------------- | ----------- | --------------------------------- | -------- | ------------------------- |
| **VS Code Extension** | Global      | `$HOME/.agentz/mcp_settings.json` | 1        | Auto-created if missing   |
| **VS Code Extension** | Project     | `[workspace]/.agentz/mcp.json`    | 2        | Only if workspace exists  |
| **CLI Utility**       | Explicit    | `--mcp-config <path>`             | 1        | Command line option       |
| **CLI Utility**       | Project     | `[cwd]/.agentz/mcp_settings.json` | 2        | Current working directory |
| **CLI Utility**       | Global      | `$HOME/.agentz/mcp_settings.json` | 3        | Shared with VS Code       |
| **CLI Utility**       | Global CLI  | `$HOME/.agentz/mcp-config.json`   | 4        | CLI-specific fallback     |
| **API Server**        | Same as CLI | _(inherits CLI behavior)_         | -        | Uses GlobalCLIMcpService  |

## Environment Variable Overrides

| Variable                  | Description                       | Affects   |
| ------------------------- | --------------------------------- | --------- |
| `ROO_GLOBAL_STORAGE_PATH` | Override global storage directory | All modes |
| `API_STORAGE_ROOT`        | API-specific storage override     | API only  |

## File Naming Conventions

| Context         | Filename            | Format          |
| --------------- | ------------------- | --------------- |
| VS Code Global  | `mcp_settings.json` | Standard config |
| VS Code Project | `mcp.json`          | Simplified name |
| CLI/API Shared  | `mcp_settings.json` | Standard config |
| CLI Fallback    | `mcp-config.json`   | CLI-specific    |

## Quick Commands

```bash
# CLI with explicit config
roo-cli --mcp-config $HOME/.agentz/my-servers.json

# Find your global config directory
echo $HOME/.agentz/

# Create project config directory
mkdir -p .agentz && touch .agentz/mcp_settings.json
```

## Configuration Discovery Flow

### VS Code Extension

1. Load `$HOME/.agentz/mcp_settings.json` (global)
2. Load `[workspace]/.agentz/mcp.json` (project)
3. Merge configurations (project overrides global)

### CLI/API

1. Use explicit path if `--mcp-config` provided
2. Try `[cwd]/.agentz/mcp_settings.json`
3. Try `$HOME/.agentz/mcp_settings.json`
4. Fall back to `$HOME/.agentz/mcp-config.json`
5. Use first found, create if none exist

## Common File Locations

| OS      | Global Directory | Example Path                                  |
| ------- | ---------------- | --------------------------------------------- |
| macOS   | `$HOME/.agentz/` | `/Users/username/.agentz/mcp_settings.json`   |
| Linux   | `$HOME/.agentz/` | `/home/username/.agentz/mcp_settings.json`    |
| Windows | `~\.agentz\`     | `C:\Users\username\.agentz\mcp_settings.json` |

## Project Structure Examples

```
# VS Code workspace
my-project/
├── .agentz/
│   └── mcp.json          ← Project MCP config
└── src/

# CLI project
my-cli-project/
├── .agentz/
│   └── mcp_settings.json ← Project MCP config
└── scripts/
```
