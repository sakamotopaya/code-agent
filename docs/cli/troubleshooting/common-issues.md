# Common Issues and Solutions

This guide covers frequently encountered problems and their solutions when using Roo CLI.

## Installation Issues

### npm install fails

**Problem**: Installation fails with permission errors or network issues.

**Solutions**:

```bash
# Use a different npm registry
npm install -g roo-cli --registry https://registry.npmjs.org/

# Fix npm permissions (macOS/Linux)
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}

# Use node version manager
nvm use node
npm install -g roo-cli

# Alternative: Use npx without global install
npx roo-cli --help
```

### Command not found after installation

**Problem**: `roo-cli: command not found` after global installation.

**Solutions**:

```bash
# Check if npm global bin is in PATH
echo $PATH | grep $(npm config get prefix)/bin

# Add npm global bin to PATH
echo 'export PATH=$(npm config get prefix)/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# On macOS with Homebrew node
echo 'export PATH=/usr/local/bin:$PATH' >> ~/.zshrc
source ~/.zshrc

# Check installation location
npm list -g roo-cli
which roo-cli
```

### Version mismatch or outdated version

**Problem**: Running an old version of Roo CLI.

**Solutions**:

```bash
# Update to latest version
npm update -g roo-cli

# Force reinstall
npm uninstall -g roo-cli
npm install -g roo-cli

# Check current version
roo-cli --version

# Clear npm cache if needed
npm cache clean --force
```

## Configuration Issues

### API key not recognized

**Problem**: "Invalid API key" or "Authentication failed" errors.

**Solutions**:

```bash
# Verify API key format
echo $ROO_API_KEY | wc -c  # Should be around 100 characters

# Check environment variable
env | grep ROO_API_KEY

# Test API key directly
curl -H "Authorization: Bearer $ROO_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.anthropic.com/v1/messages

# Set API key in config file
roo-cli config --generate ~/.roo-cli/config.json
# Edit file and add: "apiKey": "your-key-here"

# Verify configuration
roo-cli config --show --verbose
```

### Configuration file not found

**Problem**: CLI can't find or load configuration file.

**Solutions**:

```bash
# Check configuration file locations
ls -la ~/.roo-cli/config.json
ls -la ./.roo-cli.json
ls -la ./.roo-cli.yaml

# Generate default configuration
roo-cli config --generate ~/.roo-cli/config.json

# Specify config file explicitly
roo-cli --config ./my-config.json --help

# Validate existing configuration
roo-cli config --validate --verbose

# Check file permissions
chmod 600 ~/.roo-cli/config.json
```

### Invalid configuration format

**Problem**: Configuration file has syntax errors or invalid values.

**Solutions**:

```bash
# Validate JSON syntax
cat ~/.roo-cli/config.json | jq .

# Validate configuration
roo-cli config --validate ~/.roo-cli/config.json

# Fix common JSON errors
# - Remove trailing commas
# - Ensure proper quotes around strings
# - Check bracket/brace matching

# Reset to default configuration
mv ~/.roo-cli/config.json ~/.roo-cli/config.json.backup
roo-cli config --generate ~/.roo-cli/config.json
```

## Runtime Issues

### Command execution timeouts

**Problem**: Commands timeout or hang indefinitely.

**Solutions**:

```bash
# Increase timeout
roo-cli --timeout 120000 --batch "long running task"

# Use verbose mode to see progress
roo-cli --verbose --batch "analyze large codebase"

# Break down large tasks
roo-cli --batch "analyze src/ directory structure"
roo-cli --batch "analyze individual files in src/"

# Check system resources
top
ps aux | grep roo-cli
```

### Memory errors or out of memory

**Problem**: CLI crashes with memory errors on large files or datasets.

**Solutions**:

```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 $(which roo-cli) --batch "large task"

# Process files in smaller chunks
roo-cli --batch "analyze files in src/ one by one"

# Use file streaming for large files
roo-cli tools execute read_file --params '{"path": "large.txt", "line_range": [1, 1000]}'

# Monitor memory usage
roo-cli --batch "task" --verbose | grep -i memory
```

### Permission denied errors

**Problem**: CLI can't access files or directories.

**Solutions**:

```bash
# Check file permissions
ls -la /path/to/file

# Fix permissions
chmod 644 /path/to/file  # For files
chmod 755 /path/to/dir   # For directories

# Run with appropriate user
sudo roo-cli --batch "system task"  # Use carefully

# Check working directory
pwd
cd /correct/directory
roo-cli --batch "task"

# Use --cwd option
roo-cli --cwd /path/to/project --batch "analyze code"
```

## Network and API Issues

### Connection timeouts

**Problem**: API requests timeout or fail to connect.

**Solutions**:

```bash
# Check internet connectivity
ping api.anthropic.com
curl -I https://api.anthropic.com

# Test with increased timeout
roo-cli --api-timeout 60000 --batch "task"

# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY

# Configure proxy in config file
{
  "proxy": "http://proxy.company.com:8080",
  "timeout": 60000
}

# Use different network/VPN
```

### Rate limiting errors

**Problem**: "Rate limit exceeded" or "Too many requests" errors.

**Solutions**:

```bash
# Wait and retry
sleep 60
roo-cli --batch "retry task"

# Use smaller batch sizes
roo-cli --batch "analyze single file"

# Check API usage
# Visit console.anthropic.com to see usage

# Implement retry logic
roo-cli --retry 3 --batch "task"

# Use different API key if available
export ROO_API_KEY="different-key"
```

### SSL/TLS certificate errors

**Problem**: Certificate verification errors.

**Solutions**:

```bash
# Update certificates
# macOS
brew install ca-certificates

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install ca-certificates

# Skip SSL verification (not recommended for production)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Configure custom CA
roo-cli config set ssl.ca /path/to/ca-certificate.pem
```

## Browser Automation Issues

### Browser not found

**Problem**: "Browser executable not found" errors.

**Solutions**:

```bash
# Install Chrome/Chromium
# macOS
brew install --cask google-chrome

# Ubuntu/Debian
sudo apt-get install chromium-browser

# Specify browser path in config
{
  "browser": {
    "executable": "/usr/bin/chromium-browser"
  }
}

# Use different browser
{
  "browser": {
    "executable": "/Applications/Firefox.app/Contents/MacOS/firefox"
  }
}
```

### Headless browser issues

**Problem**: Browser automation fails in headless mode.

**Solutions**:

```bash
# Run in headed mode for debugging
roo-cli --no-headless --batch "web automation task"

# Add browser arguments
{
  "browser": {
    "args": ["--no-sandbox", "--disable-dev-shm-usage"]
  }
}

# Use different viewport size
{
  "browser": {
    "viewport": "1280x720"
  }
}

# Check for missing dependencies (Linux)
sudo apt-get install -y libgtk-3-0 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 libnss3 libatspi2.0-0 libdrm2 libxcomposite1
```

## Session Management Issues

### Session files corrupted

**Problem**: Can't load saved sessions or corruption errors.

**Solutions**:

```bash
# List session files
ls -la ~/.roo-cli/sessions/

# Check session file integrity
roo-cli session info session-id --verbose

# Restore from backup
cp ~/.roo-cli/sessions/backup/session-id.json ~/.roo-cli/sessions/

# Clean up corrupted sessions
roo-cli session cleanup --force

# Export working sessions as backup
roo-cli session export session-id --output backup.json
```

### Session storage full

**Problem**: Disk full or session storage limit reached.

**Solutions**:

```bash
# Check disk space
df -h ~/.roo-cli/sessions

# Clean old sessions
roo-cli session cleanup --max-age 30

# Change session storage location
roo-cli config set session.saveLocation /path/to/larger/disk

# Compress sessions
roo-cli config set session.compression true

# Archive old sessions
tar -czf old-sessions.tar.gz ~/.roo-cli/sessions/*.json
rm ~/.roo-cli/sessions/old-*.json
```

## MCP Server Issues

### MCP server connection failed

**Problem**: Can't connect to MCP servers.

**Solutions**:

```bash
# Check server configuration
roo-cli mcp config --list

# Test server connectivity
roo-cli mcp connect server-name --timeout 30000

# Check server logs
roo-cli mcp logs server-name --tail 50

# Restart server
roo-cli mcp disconnect server-name
roo-cli mcp connect server-name

# Validate server configuration
roo-cli mcp config --validate
```

### MCP server tools not available

**Problem**: MCP server tools not showing up or not working.

**Solutions**:

```bash
# List available tools
roo-cli mcp tools

# Check server status
roo-cli mcp status server-name

# Refresh server connection
roo-cli mcp disconnect server-name
roo-cli mcp connect server-name --force

# Check server capabilities
roo-cli mcp tools server-name --detailed
```

## Performance Issues

### Slow response times

**Problem**: CLI operations are slow.

**Solutions**:

```bash
# Enable performance monitoring
roo-cli --verbose --batch "task" | grep -i time

# Use faster model for simple tasks
roo-cli --model claude-3-haiku-20240307 --batch "simple task"

# Optimize prompts
roo-cli --batch "specific, focused task description"

# Check system resources
top
htop
```

### High memory usage

**Problem**: CLI uses too much memory.

**Solutions**:

```bash
# Monitor memory usage
ps aux | grep roo-cli
roo-cli --batch "task" --verbose | grep memory

# Process files individually
roo-cli --batch "analyze file1.js"
roo-cli --batch "analyze file2.js"

# Increase swap space if needed
sudo swapon --show
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Platform-Specific Issues

### Windows Issues

**Problem**: Windows-specific errors.

**Solutions**:

```cmd
REM Use PowerShell instead of Command Prompt
powershell -Command "roo-cli --help"

REM Fix path issues
set PATH=%PATH%;%APPDATA%\npm

REM Use Windows Subsystem for Linux
wsl
sudo apt update
sudo apt install nodejs npm
npm install -g roo-cli

REM Handle file path separators
roo-cli --cwd "C:\Project\src" --batch "analyze code"
```

### macOS Issues

**Problem**: macOS-specific errors.

**Solutions**:

```bash
# Fix Gatekeeper issues
sudo spctl --master-disable

# Update Xcode command line tools
xcode-select --install

# Use Homebrew node
brew install node
brew link node

# Fix permission issues
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### Linux Issues

**Problem**: Linux-specific errors.

**Solutions**:

```bash
# Install missing dependencies
sudo apt-get update
sudo apt-get install build-essential

# Fix locale issues
export LC_ALL=C.UTF-8
export LANG=C.UTF-8

# Use Node Version Manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
nvm use node

# Fix libnode issues
sudo ldconfig
```

## Debugging Tools

### Enable debug mode

```bash
# Global debug mode
export DEBUG=roo-cli:*
roo-cli --batch "task"

# Specific debug categories
export DEBUG=roo-cli:api,roo-cli:config
roo-cli --verbose --batch "task"

# Debug with Node.js inspector
node --inspect $(which roo-cli) --batch "task"
```

### Collect diagnostic information

```bash
# System information
roo-cli --version --verbose
node --version
npm --version
uname -a

# Configuration dump
roo-cli config --show --verbose

# Test connectivity
ping api.anthropic.com
curl -I https://api.anthropic.com

# Environment variables
env | grep ROO_

# File permissions
ls -la ~/.roo-cli/
```

### Generate support bundle

```bash
#!/bin/bash
# Create support bundle
mkdir roo-cli-support
cd roo-cli-support

# System info
roo-cli --version --verbose > version.txt
node --version > node-version.txt
npm list -g > npm-global.txt
env | grep ROO_ > environment.txt

# Configuration (sanitized)
roo-cli config --show > config.txt

# Logs
cp ~/.roo-cli/logs/* . 2>/dev/null || echo "No logs found"

# Create archive
cd ..
tar -czf roo-cli-support-$(date +%Y%m%d).tar.gz roo-cli-support/
echo "Support bundle created: roo-cli-support-$(date +%Y%m%d).tar.gz"
```

## Getting Additional Help

### Community Resources

- **GitHub Issues**: [https://github.com/roo-dev/roo/issues](https://github.com/roo-dev/roo/issues)
- **Discussions**: [https://github.com/roo-dev/roo/discussions](https://github.com/roo-dev/roo/discussions)
- **Discord**: [https://discord.gg/roo](https://discord.gg/roo)
- **Documentation**: [https://docs.roocode.com/cli](https://docs.roocode.com/cli)

### Reporting Issues

When reporting issues, include:

1. **Version information**: `roo-cli --version --verbose`
2. **Operating system**: `uname -a` (Linux/macOS) or `systeminfo` (Windows)
3. **Error messages**: Full error output with `--verbose`
4. **Configuration**: Sanitized config with `roo-cli config --show`
5. **Steps to reproduce**: Exact commands and expected vs actual behavior
6. **Environment**: Node.js version, npm version, relevant environment variables

### Emergency Recovery

If Roo CLI is completely broken:

```bash
# Reset all configuration
rm -rf ~/.roo-cli/
rm -rf ~/.config/roo-cli/
rm -rf ~/.local/share/roo-cli/

# Reinstall from scratch
npm uninstall -g roo-cli
npm cache clean --force
npm install -g roo-cli

# Verify installation
roo-cli --version
roo-cli --help
```

For immediate help with critical issues, check the [troubleshooting guide](https://docs.roocode.com/cli/troubleshooting) or reach out to the community on Discord.
