# Common Errors and Solutions

Frequently encountered issues and their step-by-step solutions.

## Installation and Setup Issues

### CLI Not Found

```bash
# Error: command not found: roo
# Solution: Check installation and PATH
which roo
echo $PATH

# Reinstall if necessary
npm install -g @roo/cli

# Or use npx
npx @roo/cli --help
```

**Description:** Resolving CLI installation and PATH issues.

**Difficulty:** Beginner  
**Estimated Time:** 2 minutes  
**Tags:** #installation #path #troubleshooting

---

### Permission Errors

```bash
# Error: EACCES permission denied
# Solution: Fix npm permissions or use different installation method

# Option 1: Use npx (recommended)
npx @roo/cli "your command here"

# Option 2: Fix npm permissions
npm config set prefix $HOME/.local
echo 'export PATH=$HOME/.local/bin:$PATH' >> $HOME/.bashrc
source $HOME/.bashrc

# Option 3: Use sudo (not recommended)
sudo npm install -g @roo/cli
```

**Description:** Fixing permission issues during installation.

**Difficulty:** Beginner  
**Estimated Time:** 3 minutes  
**Tags:** #permissions #npm #installation

---

## Configuration Issues

### Invalid Configuration

```bash
# Error: Configuration validation failed
# Solution: Validate and fix configuration

# Check current config
roo config list

# Validate configuration
roo config validate

# Reset to defaults if needed
roo config init --reset

# Fix specific issues
roo config set api.provider anthropic
roo config set api.timeout 30000
```

**Description:** Resolving configuration validation errors.

**Difficulty:** Beginner  
**Estimated Time:** 2 minutes  
**Tags:** #configuration #validation #reset

---

### MCP Server Connection Issues

```bash
# Error: Failed to connect to MCP server
# Solution: Debug MCP server connectivity

# List configured servers
roo mcp list

# Test server connection
roo mcp connect github

# Check server status
roo mcp status

# Validate server configuration
roo mcp validate-config

# Reset MCP configuration
roo config set mcp.servers '[]'
roo config init-mcp
```

**Description:** Debugging MCP server connection problems.

**Difficulty:** Intermediate  
**Estimated Time:** 5 minutes  
**Tags:** #mcp #servers #connectivity #debugging

---

## Runtime Errors

### API Rate Limits

```bash
# Error: API rate limit exceeded
# Solution: Handle rate limiting

# Check current API usage
roo config get api.usage

# Set longer timeout
roo config set api.timeout 60000

# Use different provider
roo config set api.provider openai

# Enable retry with backoff
roo config set api.retries 3
roo config set api.backoff exponential
```

**Description:** Handling API rate limiting and quota issues.

**Difficulty:** Intermediate  
**Estimated Time:** 3 minutes  
**Tags:** #api #rate-limits #retry #timeout

---

### Memory Issues

```bash
# Error: JavaScript heap out of memory
# Solution: Increase memory allocation

# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or run with increased memory
node --max-old-space-size=4096 $(which roo) "your command"

# For large files, use streaming
roo --stream "process large file: huge-data.json"

# Break down large tasks
roo "split this large task into smaller chunks"
```

**Description:** Resolving memory allocation issues with large files or tasks.

**Difficulty:** Intermediate  
**Estimated Time:** 4 minutes  
**Tags:** #memory #performance #large-files #streaming

---

### Network Issues

```bash
# Error: Network timeout or connection refused
# Solution: Debug network connectivity

# Check internet connection
ping google.com

# Test specific API endpoint
curl -I https://api.anthropic.com

# Use proxy if needed
roo config set network.proxy "http://proxy.company.com:8080"

# Set custom timeout
roo config set network.timeout 60000

# Retry with backoff
roo --retry 3 "your command"
```

**Description:** Resolving network connectivity and timeout issues.

**Difficulty:** Intermediate  
**Estimated Time:** 5 minutes  
**Tags:** #network #timeout #proxy #connectivity

---

## File and Path Issues

### File Not Found

```bash
# Error: ENOENT: no such file or directory
# Solution: Verify file paths and permissions

# Check if file exists
ls -la path/to/file

# Use absolute path
roo "analyze file: $(pwd)/relative/path/file.js"

# Check current directory
pwd
ls -la

# Use proper escaping for special characters
roo "analyze file: \"path with spaces/file.js\""
```

**Description:** Resolving file path and access issues.

**Difficulty:** Beginner  
**Estimated Time:** 2 minutes  
**Tags:** #files #paths #permissions #filesystem

---

### Binary File Issues

```bash
# Error: Cannot process binary file
# Solution: Handle binary files appropriately

# Check file type
file suspicious-file.ext

# For images, specify the context
roo "analyze this image file: screenshot.png"

# For archives, extract first
unzip archive.zip
roo "analyze contents of extracted archive"

# Skip binary files in batch operations
roo "analyze all text files in this directory, skip binary files"
```

**Description:** Handling binary files and unsupported formats.

**Difficulty:** Beginner  
**Estimated Time:** 3 minutes  
**Tags:** #binary-files #images #archives #file-types

---

## Performance Issues

### Slow Response Times

```bash
# Problem: Commands taking too long
# Solution: Optimize performance

# Use streaming for large outputs
roo --stream "analyze large codebase"

# Enable verbose mode to see progress
roo --verbose "long running task"

# Break down large tasks
roo "analyze this directory in batches of 10 files"

# Use local models if available
roo config set api.provider local

# Cache results
roo config set cache.enabled true
```

**Description:** Improving performance and response times.

**Difficulty:** Intermediate  
**Estimated Time:** 5 minutes  
**Tags:** #performance #streaming #caching #optimization

---

### High CPU/Memory Usage

```bash
# Problem: High resource usage
# Solution: Optimize resource consumption

# Monitor resource usage
top
htop

# Limit concurrent operations
roo config set execution.maxConcurrency 2

# Use smaller batch sizes
roo config set batch.size 5

# Enable garbage collection
node --expose-gc $(which roo) "memory intensive task"

# Use process isolation
roo --isolate "potentially problematic command"
```

**Description:** Managing CPU and memory consumption.

**Difficulty:** Advanced  
**Estimated Time:** 8 minutes  
**Tags:** #resources #cpu #memory #monitoring #optimization

---

## Recovery Strategies

### Recovering from Crashes

```bash
# If CLI crashes unexpectedly
# 1. Check crash logs
cat $HOME/.roo/logs/error.log

# 2. Restore last session
roo session restore-last

# 3. Check for corrupted cache
roo cache clear

# 4. Reset configuration if needed
roo config reset

# 5. Restart with safe mode
roo --safe-mode "test command"
```

**Description:** Recovering from unexpected crashes and errors.

**Difficulty:** Intermediate  
**Estimated Time:** 5 minutes  
**Tags:** #recovery #crashes #logs #session #safe-mode

---

### Data Recovery

```bash
# If work is lost due to errors
# 1. Check session backups
roo session list --include-backups

# 2. Restore from backup
roo session restore backup-20240101-120000

# 3. Check auto-save files
ls $HOME/.roo/autosave/

# 4. Recover from git if version controlled
git log --oneline
git checkout HEAD~1 -- lost-file.js
```

**Description:** Recovering lost work and data.

**Difficulty:** Intermediate  
**Estimated Time:** 6 minutes  
**Tags:** #data-recovery #backups #sessions #git #autosave

---

## Getting Help

### Debug Mode

```bash
# Enable debug mode for detailed logging
roo --debug "problematic command"

# Set debug level
roo --debug-level verbose "command"

# Save debug output
roo --debug "command" 2> debug.log

# Debug specific components
ROO_DEBUG="api,mcp" roo "command"
```

**Description:** Using debug mode to diagnose issues.

**Difficulty:** Intermediate  
**Estimated Time:** 3 minutes  
**Tags:** #debug #logging #troubleshooting #diagnostics

---

### Reporting Issues

```bash
# Collect diagnostic information
roo --diagnostic-report > diagnostic.txt

# Check version information
roo --version

# Export configuration (remove sensitive data)
roo config export --redact > config.json

# Create minimal reproduction case
roo "minimal command that reproduces the issue"
```

**Description:** Gathering information for issue reports.

**Difficulty:** Beginner  
**Estimated Time:** 3 minutes  
**Tags:** #reporting #diagnostics #debugging #support
