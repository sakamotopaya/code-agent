# Getting Started Examples

These examples will help you take your first steps with the CLI utility.

## Your First Command

### Hello World

```bash
# Get basic help
roo --help

# Check version
roo --version

# Simple task
roo "create a hello world script in Python"
```

**Expected Output:**
The CLI will create a simple Python script with a hello world function.

**Difficulty:** Beginner  
**Estimated Time:** 1 minute  
**Tags:** #basics #hello-world #python

---

### Basic File Operations

```bash
# Analyze a file
roo "analyze this file: app.js"

# Create multiple files
roo "create a React component with tests"

# Refactor code
roo "refactor this function to use async/await: utils.js"
```

**Description:** Basic file manipulation commands that demonstrate core functionality.

**Difficulty:** Beginner  
**Estimated Time:** 2-3 minutes  
**Tags:** #files #analysis #refactoring

---

### Getting Help

```bash
# General help
roo --help

# Help for specific commands
roo help config

# Help for tools
roo help tools

# Search help
roo help search "file operations"
```

**Description:** Learn how to find help and documentation within the CLI.

**Difficulty:** Beginner  
**Estimated Time:** 1 minute  
**Tags:** #help #documentation

---

### Basic Configuration

```bash
# Initialize configuration
roo config init

# View current configuration
roo config list

# Set a configuration value
roo config set api.provider anthropic

# Get a specific config value
roo config get api.provider
```

**Description:** Basic configuration management to get started.

**Prerequisites:**

- CLI installed and accessible in PATH

**Difficulty:** Beginner  
**Estimated Time:** 2 minutes  
**Tags:** #config #setup #basics

---

### Understanding Output

```bash
# Default output (plain text)
roo "explain this code: function add(a, b) { return a + b; }"

# JSON output for scripting
roo --format json "list all functions in this file: utils.js"

# Verbose output for debugging
roo --verbose "analyze project structure"
```

**Description:** Understanding different output formats and verbosity levels.

**Difficulty:** Beginner  
**Estimated Time:** 2 minutes  
**Tags:** #output #formats #debugging
