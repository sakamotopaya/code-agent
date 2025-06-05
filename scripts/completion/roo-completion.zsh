#compdef roo-cli roo

# Zsh completion script for roo-cli

_roo_cli() {
    local context state state_descr line
    typeset -A opt_args

    local commands=(
        'config:Manage configuration settings'
        'session:Manage CLI sessions and history'
        'mcp:Manage Model Context Protocol servers'
        'help:Show help information'
        'version:Show version information'
    )

    local modes=(
        'code:General coding tasks (default)'
        'debug:Debugging and troubleshooting'
        'architect:Software design and architecture'
        'ask:Question answering and research'
        'test:Testing and quality assurance'
        'design-engineer:UI/UX and design tasks'
        'release-engineer:Release and deployment tasks'
        'translate:Localization and translation'
        'product-owner:Product management tasks'
        'orchestrator:Workflow coordination'
    )

    local formats=(
        'json:Structured JSON output'
        'yaml:YAML configuration format'
        'plain:Human-readable plain text (default)'
        'csv:Comma-separated values'
        'markdown:Markdown documentation format'
    )

    local color_schemes=(
        'default:Default color scheme'
        'dark:Dark color scheme'
        'light:Light color scheme'
        'high-contrast:High contrast color scheme'
        'minimal:Minimal color scheme'
    )

    local mcp_log_levels=(
        'error:Error level logging'
        'warn:Warning level logging'
        'info:Info level logging'
        'debug:Debug level logging'
    )

    _arguments -C \
        '(- *)'{-h,--help}'[Show help information]' \
        '(- *)'{-V,--version}'[Show version information]' \
        '(-c --cwd)'{-c,--cwd}'[Working directory]:directory:_directories' \
        '--config[Configuration file path]:file:_files' \
        '(-m --model)'{-m,--model}'[AI model to use]:model:' \
        '--mode[Agent mode]:mode:((${modes}))' \
        '(-f --format)'{-f,--format}'[Output format]:format:((${formats}))' \
        '(-o --output)'{-o,--output}'[Output file path]:file:_files' \
        '(-v --verbose)'{-v,--verbose}'[Enable verbose logging]' \
        '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]' \
        '--no-color[Disable colored output]' \
        '--color-scheme[Color scheme]:scheme:((${color_schemes}))' \
        '(-b --batch)'{-b,--batch}'[Run in batch mode]:task or file:_files' \
        '(-i --interactive)'{-i,--interactive}'[Run in interactive mode (default)]' \
        '--stdin[Read commands from stdin]' \
        '--yes[Assume yes for all prompts]' \
        '--no[Assume no for all prompts]' \
        '--timeout[Global timeout in milliseconds]:timeout:' \
        '--parallel[Execute commands in parallel]' \
        '--continue-on-error[Continue execution on errors]' \
        '--dry-run[Show what would be executed]' \
        '--generate-config[Generate default configuration]:file:_files' \
        '--headless[Run browser in headless mode]' \
        '--no-headless[Run browser in headed mode]' \
        '--browser-viewport[Browser viewport size]:size:_roo_viewport_sizes' \
        '--browser-timeout[Browser timeout in milliseconds]:timeout:' \
        '--screenshot-output[Screenshot output directory]:directory:_directories' \
        '--user-agent[Custom user agent string]:agent:' \
        '--mcp-config[MCP configuration file]:file:_files' \
        '--mcp-server[MCP server IDs to connect]:server:_roo_mcp_servers' \
        '--mcp-timeout[MCP timeout in milliseconds]:timeout:' \
        '--mcp-retries[MCP retry attempts]:count:' \
        '--mcp-auto-connect[Auto-connect to MCP servers]' \
        '--no-mcp-auto-connect[Do not auto-connect to MCP servers]' \
        '--mcp-log-level[MCP logging level]:level:((${mcp_log_levels}))' \
        '1: :_roo_commands' \
        '*:: :->args' && return 0

    case $state in
        args)
            case $words[1] in
                config)
                    _arguments \
                        '--show[Show current configuration]' \
                        '--validate[Validate configuration file]:file:_files' \
                        '--generate[Generate default configuration]:file:_files' \
                        'init[Interactive configuration setup]'
                    ;;
                session)
                    local session_commands=(
                        'list:List all saved sessions'
                        'save:Save current session'
                        'load:Load a saved session'
                        'delete:Delete a session'
                        'export:Export session to file'
                        'import:Import session from file'
                        'cleanup:Clean up old sessions'
                    )
                    _describe 'session commands' session_commands
                    ;;
                mcp)
                    local mcp_commands=(
                        'list:List configured MCP servers'
                        'connect:Connect to an MCP server'
                        'disconnect:Disconnect from an MCP server'
                        'tools:List available tools'
                        'resources:List available resources'
                        'execute:Execute an MCP tool'
                        'config:Manage MCP configuration'
                    )
                    _describe 'mcp commands' mcp_commands
                    ;;
                help)
                    local help_topics=(
                        'config:Configuration help'
                        'tools:Tools help'
                        'search:Search help topics'
                    )
                    _describe 'help topics' help_topics
                    ;;
            esac
            ;;
    esac
}

_roo_commands() {
    local commands=(
        'config:Manage configuration settings'
        'session:Manage CLI sessions and history'
        'mcp:Manage Model Context Protocol servers'
        'help:Show help information'
        'version:Show version information'
    )
    _describe 'commands' commands
}

_roo_viewport_sizes() {
    local sizes=(
        '1920x1080:Full HD'
        '1366x768:HD'
        '1280x720:HD'
        '1024x768:XGA'
        '800x600:SVGA'
    )
    _describe 'viewport sizes' sizes
}

_roo_mcp_servers() {
    # In a real implementation, this could call roo-cli mcp list
    # For now, provide common server examples
    local servers=(
        'github-server:GitHub MCP server'
        'filesystem-server:Filesystem MCP server'
        'web-server:Web scraping MCP server'
    )
    _describe 'mcp servers' servers
}

# Register the completion function
_roo_cli "$@"