# Story 15: Integrate MCP Server Support

**Phase**: 4 - Advanced Features  
**Labels**: `cli-utility`, `phase-4`, `mcp`, `integration`  
**Story Points**: 10  
**Priority**: Medium  

## User Story
As a developer using the CLI utility, I want to use MCP servers, so that I can extend the agent's capabilities with external tools and resources.

## Acceptance Criteria

### MCP Server Discovery
- [ ] Automatic discovery of local MCP servers
- [ ] Configuration-based server registration
- [ ] Support for both stdio and SSE-based servers
- [ ] Server capability detection and validation
- [ ] Health checking and monitoring

### Server Connection Management
- [ ] Establish and maintain connections to MCP servers
- [ ] Handle connection failures and reconnection
- [ ] Manage server lifecycle (start/stop/restart)
- [ ] Connection pooling for multiple servers
- [ ] Graceful shutdown and cleanup

### Tool and Resource Access
- [ ] Enumerate available tools from connected servers
- [ ] Execute tools with proper parameter validation
- [ ] Access resources provided by servers
- [ ] Handle tool execution results and errors
- [ ] Cache tool and resource metadata

### Configuration Management
- [ ] Server configuration via CLI arguments
- [ ] Configuration file support for server definitions
- [ ] Environment variable configuration
- [ ] Runtime server management commands
- [ ] Configuration validation and error reporting

### Error Handling
- [ ] Comprehensive error handling for MCP operations
- [ ] Fallback mechanisms for server failures
- [ ] Detailed error reporting and debugging
- [ ] Timeout handling for server operations
- [ ] Recovery strategies for connection issues

## Technical Details

### CLI MCP Service Implementation
```typescript
// src/cli/services/CLIMcpService.ts
interface ICLIMcpService {
  // Server management
  discoverServers(): Promise<McpServerInfo[]>
  connectToServer(config: McpServerConfig): Promise<McpConnection>
  disconnectFromServer(serverId: string): Promise<void>
  getConnectedServers(): McpConnection[]
  
  // Tool operations
  listAvailableTools(): Promise<McpToolInfo[]>
  executeTool(serverId: string, toolName: string, args: any): Promise<any>
  validateToolParameters(serverId: string, toolName: string, args: any): boolean
  
  // Resource operations
  listAvailableResources(): Promise<McpResourceInfo[]>
  accessResource(serverId: string, uri: string): Promise<any>
  
  // Configuration
  loadServerConfigs(configPath: string): Promise<McpServerConfig[]>
  validateServerConfig(config: McpServerConfig): ValidationResult
}
```

### MCP Server Configuration
```typescript
interface McpServerConfig {
  id: string
  name: string
  description?: string
  type: 'stdio' | 'sse'
  enabled: boolean
  
  // Stdio configuration
  command?: string
  args?: string[]
  env?: Record<string, string>
  
  // SSE configuration
  url?: string
  headers?: Record<string, string>
  
  // Connection settings
  timeout: number
  retryAttempts: number
  retryDelay: number
  healthCheckInterval: number
}

interface McpServerInfo {
  id: string
  name: string
  version: string
  capabilities: McpCapabilities
  status: ServerStatus
  tools: McpToolInfo[]
  resources: McpResourceInfo[]
}

interface McpCapabilities {
  tools: boolean
  resources: boolean
  prompts: boolean
  logging: boolean
}
```

### CLI Integration
```typescript
// MCP-related CLI commands
interface McpCommands {
  // roo mcp list
  listServers(): Promise<void>
  
  // roo mcp connect <server-id>
  connectServer(serverId: string): Promise<void>
  
  // roo mcp disconnect <server-id>
  disconnectServer(serverId: string): Promise<void>
  
  // roo mcp tools [server-id]
  listTools(serverId?: string): Promise<void>
  
  // roo mcp resources [server-id]
  listResources(serverId?: string): Promise<void>
  
  // roo mcp execute <server-id> <tool-name> [args...]
  executeTool(serverId: string, toolName: string, args: string[]): Promise<void>
  
  // roo mcp config validate [config-file]
  validateConfig(configFile?: string): Promise<void>
}

// CLI options for MCP
interface McpCliOptions {
  mcpConfig?: string // path to MCP configuration file
  mcpServer?: string[] // server IDs to connect to
  mcpTimeout?: number // timeout for MCP operations
  mcpRetries?: number // retry attempts for failed operations
}
```

### Configuration File Format
```typescript
// ~/.roo/mcp-config.json
interface McpConfigFile {
  version: string
  servers: McpServerConfig[]
  defaults: McpDefaults
}

interface McpDefaults {
  timeout: number
  retryAttempts: number
  retryDelay: number
  healthCheckInterval: number
  autoConnect: boolean
  enableLogging: boolean
}

// Example configuration
const exampleConfig: McpConfigFile = {
  version: "1.0.0",
  servers: [
    {
      id: "github-server",
      name: "GitHub MCP Server",
      type: "stdio",
      enabled: true,
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      },
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      healthCheckInterval: 60000
    },
    {
      id: "custom-api-server",
      name: "Custom API Server",
      type: "sse",
      enabled: true,
      url: "https://api.example.com/mcp",
      headers: {
        "Authorization": "Bearer ${API_TOKEN}"
      },
      timeout: 15000,
      retryAttempts: 2,
      retryDelay: 2000,
      healthCheckInterval: 30000
    }
  ],
  defaults: {
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    healthCheckInterval: 60000,
    autoConnect: true,
    enableLogging: true
  }
}
```

### Connection Management
```typescript
class McpConnectionManager {
  private connections = new Map<string, McpConnection>()
  private healthCheckers = new Map<string, NodeJS.Timeout>()
  
  async connectToServer(config: McpServerConfig): Promise<McpConnection> {
    try {
      const connection = await this.createConnection(config)
      await this.validateConnection(connection)
      
      this.connections.set(config.id, connection)
      this.startHealthCheck(config.id, config.healthCheckInterval)
      
      return connection
    } catch (error) {
      throw new McpConnectionError(`Failed to connect to ${config.name}: ${error.message}`)
    }
  }
  
  private async createConnection(config: McpServerConfig): Promise<McpConnection> {
    if (config.type === 'stdio') {
      return new StdioMcpConnection(config)
    } else {
      return new SseMcpConnection(config)
    }
  }
  
  private startHealthCheck(serverId: string, interval: number): void {
    const checker = setInterval(async () => {
      const connection = this.connections.get(serverId)
      if (connection && !await connection.isHealthy()) {
        await this.handleUnhealthyConnection(serverId)
      }
    }, interval)
    
    this.healthCheckers.set(serverId, checker)
  }
}
```

### Tool Execution Integration
```typescript
// Integration with existing tool system
class McpToolAdapter implements ITool {
  constructor(
    private mcpService: ICLIMcpService,
    private serverId: string,
    private toolInfo: McpToolInfo
  ) {}
  
  async execute(args: any): Promise<any> {
    try {
      // Validate parameters against MCP tool schema
      if (!this.mcpService.validateToolParameters(this.serverId, this.toolInfo.name, args)) {
        throw new Error('Invalid tool parameters')
      }
      
      // Execute the tool via MCP
      const result = await this.mcpService.executeTool(this.serverId, this.toolInfo.name, args)
      
      return this.formatResult(result)
    } catch (error) {
      throw new McpToolExecutionError(`MCP tool execution failed: ${error.message}`)
    }
  }
}
```

### File Structure
```
src/cli/services/
├── CLIMcpService.ts
├── McpConnectionManager.ts
├── McpToolAdapter.ts
└── McpConfigManager.ts

src/cli/types/
├── mcp-types.ts
└── mcp-config-types.ts

src/cli/commands/
└── mcp-commands.ts

src/cli/connections/
├── StdioMcpConnection.ts
└── SseMcpConnection.ts

~/.roo/
├── mcp-config.json
└── mcp-logs/
```

## Dependencies
- Story 13: Implement Session Persistence
- Story 14: Add Non-Interactive Mode Support
- Existing MCP infrastructure from VS Code extension
- `@modelcontextprotocol/sdk` package

## Definition of Done
- [ ] CLIMcpService implemented with full MCP support
- [ ] Server discovery and connection management working
- [ ] Tool and resource access functional
- [ ] Configuration management system in place
- [ ] CLI commands for MCP operations implemented
- [ ] Error handling and recovery mechanisms working
- [ ] Integration with existing tool system completed
- [ ] Unit tests for all MCP functionality
- [ ] Integration tests with real MCP servers
- [ ] Documentation for MCP usage in CLI
- [ ] Performance benchmarks for MCP operations

## Implementation Notes
- Reuse existing MCP infrastructure from VS Code extension where possible
- Ensure proper cleanup of MCP connections on CLI exit
- Implement connection pooling for better performance
- Add support for MCP server auto-discovery mechanisms
- Consider security implications of external server connections

## Security Considerations
- Validate MCP server configurations before connection
- Implement secure credential storage for server authentication
- Add sandboxing for MCP tool execution
- Audit MCP server communications
- Implement access controls for sensitive MCP operations

## GitHub Issue Template
```markdown
## Summary
Integrate MCP server support to extend CLI capabilities with external tools and resources.

## Tasks
- [ ] Implement CLIMcpService
- [ ] Create MCP connection management
- [ ] Add tool and resource access capabilities
- [ ] Implement configuration management
- [ ] Create CLI commands for MCP operations
- [ ] Add comprehensive error handling
- [ ] Write tests for MCP functionality
- [ ] Update documentation

## Acceptance Criteria
[Copy from story document]

Labels: cli-utility, phase-4, mcp, integration