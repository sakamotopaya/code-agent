#!/bin/bash
# Bash completion script for roo-cli

_roo_completion() {
    local cur prev opts commands subcommands
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    
    # Main commands
    commands="config session mcp tools help version"
    
    # Global options
    opts="--help --version --config --cwd --model --mode --format --output --verbose --quiet --no-color --color-scheme --batch --interactive --stdin --yes --no --timeout --parallel --continue-on-error --dry-run --generate-config --headless --no-headless --browser-viewport --browser-timeout --screenshot-output --user-agent --mcp-config --mcp-server --mcp-timeout --mcp-retries --mcp-auto-connect --no-mcp-auto-connect --mcp-log-level"
    
    # Agent modes
    modes="code debug architect ask test design-engineer release-engineer translate product-owner orchestrator"
    
    # Output formats
    formats="json yaml plain csv markdown"
    
    # Color schemes
    color_schemes="default dark light high-contrast minimal"
    
    # MCP log levels
    mcp_log_levels="error warn info debug"
    
    case "${prev}" in
        roo-cli)
            COMPREPLY=( $(compgen -W "${commands} ${opts}" -- ${cur}) )
            return 0
            ;;
        config)
            COMPREPLY=( $(compgen -W "--show --validate --generate init" -- ${cur}) )
            return 0
            ;;
        session)
            COMPREPLY=( $(compgen -W "list save load delete export import cleanup" -- ${cur}) )
            return 0
            ;;
        mcp)
            COMPREPLY=( $(compgen -W "list connect disconnect tools resources execute config" -- ${cur}) )
            return 0
            ;;
        help)
            COMPREPLY=( $(compgen -W "${commands} tools config search" -- ${cur}) )
            return 0
            ;;
        --mode)
            COMPREPLY=( $(compgen -W "${modes}" -- ${cur}) )
            return 0
            ;;
        --format|-f)
            COMPREPLY=( $(compgen -W "${formats}" -- ${cur}) )
            return 0
            ;;
        --color-scheme)
            COMPREPLY=( $(compgen -W "${color_schemes}" -- ${cur}) )
            return 0
            ;;
        --mcp-log-level)
            COMPREPLY=( $(compgen -W "${mcp_log_levels}" -- ${cur}) )
            return 0
            ;;
        --config|--generate-config|--output|--screenshot-output|--mcp-config)
            # File completion
            COMPREPLY=( $(compgen -f -- ${cur}) )
            return 0
            ;;
        --cwd)
            # Directory completion
            COMPREPLY=( $(compgen -d -- ${cur}) )
            return 0
            ;;
        --validate|--generate)
            # File completion for config subcommands
            COMPREPLY=( $(compgen -f -- ${cur}) )
            return 0
            ;;
        save)
            # Session name completion - no completion for new names
            return 0
            ;;
        load|delete|export)
            # Session ID completion - would need to call roo-cli session list
            # For now, provide no completion
            return 0
            ;;
        connect|disconnect|tools|resources)
            # MCP server ID completion - would need to call roo-cli mcp list
            # For now, provide no completion
            return 0
            ;;
        execute)
            # MCP tool execution - complex completion
            return 0
            ;;
        *)
            # Check if we're completing a long option value
            case "${COMP_WORDS[COMP_CWORD-2]}" in
                --model|-m)
                    # Model completion - could be dynamic
                    COMPREPLY=( $(compgen -W "claude-3-5-sonnet-20241022 claude-3-haiku-20240307 claude-3-opus-20240229" -- ${cur}) )
                    return 0
                    ;;
                --browser-viewport)
                    # Common viewport sizes
                    COMPREPLY=( $(compgen -W "1920x1080 1366x768 1280x720 1024x768 800x600" -- ${cur}) )
                    return 0
                    ;;
                --timeout|--browser-timeout|--mcp-timeout)
                    # Timeout values in milliseconds
                    COMPREPLY=( $(compgen -W "5000 10000 30000 60000 120000" -- ${cur}) )
                    return 0
                    ;;
                --mcp-retries)
                    # Retry count
                    COMPREPLY=( $(compgen -W "1 2 3 5 10" -- ${cur}) )
                    return 0
                    ;;
            esac
            
            # Default completion with available options
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
    esac
}

# Register the completion function
complete -F _roo_completion roo-cli

# Also register for common aliases
complete -F _roo_completion roo