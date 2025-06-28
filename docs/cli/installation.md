# Installation Guide

This guide covers the installation and setup of Roo CLI on different platforms.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (comes with Node.js)
- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+, CentOS 7+)

## Installation Methods

### Method 1: NPM Global Installation (Recommended)

```bash
# Install globally via npm
npm install -g roo-cli

# Verify installation
roo-cli --version
```

### Method 2: NPX (No Installation Required)

```bash
# Run directly with npx
npx roo-cli

# Run with specific task
npx roo-cli --batch "Create a todo app"
```

### Method 3: Local Project Installation

```bash
# Install as project dependency
npm install roo-cli --save-dev

# Run via npm scripts
npx roo-cli

# Or add to package.json scripts
{
  "scripts": {
    "roo": "roo-cli"
  }
}
```

### Method 4: From Source

```bash
# Clone the repository
git clone https://github.com/roo-dev/roo.git
cd roo

# Install dependencies
npm install

# Build the CLI
npm run build:cli

# Link for global use
npm link
```

## Platform-Specific Setup

### Windows

```powershell
# Using PowerShell
npm install -g roo-cli

# Verify installation
roo-cli --version

# Set up environment variables (optional)
$env:ROO_API_KEY = "your-api-key"
$env:ROO_CONFIG_PATH = "$env:USERPROFILE\.roo-cli\config.json"
```

### macOS

```bash
# Using Homebrew (if available via brew)
# brew install roo-cli  # Future release

# Using npm
npm install -g roo-cli

# Verify installation
roo-cli --version

# Set up environment variables
export ROO_API_KEY="your-api-key"
export ROO_CONFIG_PATH="$HOME/.roo-cli/config.json"

# Add to shell profile (.bashrc, .zshrc, etc.)
echo 'export ROO_API_KEY="your-api-key"' >> $HOME/.zshrc
```

### Linux (Ubuntu/Debian)

```bash
# Update package manager
sudo apt update

# Install Node.js if not already installed
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Roo CLI
npm install -g roo-cli

# Verify installation
roo-cli --version

# Set up environment variables
export ROO_API_KEY="your-api-key"
export ROO_CONFIG_PATH="$HOME/.roo-cli/config.json"

# Add to shell profile
echo 'export ROO_API_KEY="your-api-key"' >> $HOME/.bashrc
source $HOME/.bashrc
```

### Linux (CentOS/RHEL)

```bash
# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Roo CLI
npm install -g roo-cli

# Verify installation
roo-cli --version
```

## Configuration Setup

### Generate Default Configuration

```bash
# Generate config in user directory
roo-cli --generate-config $HOME/.roo-cli/config.json

# Generate config in project directory
roo-cli --generate-config ./.roo-cli.json

# Generate config with custom path
roo-cli --generate-config ./my-roo-config.json
```

### Minimal Configuration

Create a basic configuration file:

```json
{
	"apiKey": "your-anthropic-api-key",
	"model": "claude-3-5-sonnet-20241022",
	"mode": "code",
	"outputFormat": "plain"
}
```

### Environment Variables

```bash
# Required
export ROO_API_KEY="your-anthropic-api-key"

# Optional
export ROO_CONFIG_PATH="path/to/config.json"
export ROO_OUTPUT_FORMAT="json"
export ROO_MODE="code"
export ROO_MODEL="claude-3-5-sonnet-20241022"
```

## Verification

### Test Basic Functionality

```bash
# Show version
roo-cli --version

# Show help
roo-cli --help

# Test configuration
roo-cli config --show

# Test with simple task
roo-cli --batch "echo hello world"
```

### Test Interactive Mode

```bash
# Start interactive mode
roo-cli

# In the REPL, try:
> help
> version
> config
> exit
```

## Auto-completion Setup

### Bash

```bash
# Generate completion script
roo-cli completion bash > $HOME/.roo-cli-completion.bash

# Add to .bashrc
echo 'source $HOME/.roo-cli-completion.bash' >> $HOME/.bashrc
source $HOME/.bashrc
```

### Zsh

```bash
# Generate completion script
roo-cli completion zsh > $HOME/.roo-cli-completion.zsh

# Add to .zshrc
echo 'source $HOME/.roo-cli-completion.zsh' >> $HOME/.zshrc
source $HOME/.zshrc
```

### Fish

```bash
# Generate completion script
roo-cli completion fish > $HOME/.config/fish/completions/roo-cli.fish
```

## Troubleshooting Installation

### Common Issues

#### Permission Errors (npm)

```bash
# Use npm prefix to avoid global permission issues
npm config set prefix $HOME/.npm-global
export PATH=$HOME/.npm-global/bin:$PATH

# Or use npx instead of global installation
npx roo-cli
```

#### Node.js Version Issues

```bash
# Check Node.js version
node --version

# Update Node.js using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

#### Windows PATH Issues

```powershell
# Check if npm global bin is in PATH
npm config get prefix

# Add to PATH in System Environment Variables
# %APPDATA%\npm
```

### Verification Commands

```bash
# Check installation
which roo-cli
roo-cli --version

# Check Node.js
node --version
npm --version

# Check configuration
roo-cli config --show

# Test basic functionality
roo-cli --help
```

## Next Steps

After successful installation:

1. [Generate a configuration file](./configuration/overview.md)
2. [Set up your API key](./configuration/environment-variables.md)
3. [Follow the getting started guide](./getting-started.md)
4. [Explore available commands](./commands/overview.md)

## Uninstallation

### Global NPM Installation

```bash
npm uninstall -g roo-cli
```

### Local Installation

```bash
npm uninstall roo-cli
```

### Clean Up Configuration

```bash
# Remove user configuration
rm -rf $HOME/.roo-cli

# Remove project configuration
rm -f ./.roo-cli.json ./.roo-cli.yaml ./.roo-cli.yml
```

For additional help, see our [troubleshooting guide](./troubleshooting/common-issues.md) or [contact support](../README.md#support).
