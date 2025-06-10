# MCP Server Installation and Debugging Guide

## Current Status

✅ **Connection Success**: Both MCP servers connect successfully
❌ **Method Calls Fail**: `listTools()` and `listResources()` return "Method not found" (-32601)

## Diagnosis Plan

### 1. GitHub MCP Server Installation

The configuration shows:

```json
"command": "npx",
"args": ["-y", "@modelcontextprotocol/server-github"]
```

**Installation Steps:**

```bash
# Install GitHub MCP server globally
npm install -g @modelcontextprotocol/server-github

# Or verify it can be run with npx
npx @modelcontextprotocol/server-github --help
```

### 2. Verify MCP Server Capabilities

The issue might be that servers don't implement the expected methods. Let's test direct communication:

```bash
# Test GitHub server directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | npx @modelcontextprotocol/server-github

# Check what methods are available
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}' | npx @modelcontextprotocol/server-github
```

### 3. Protocol Version Issues

The MCP protocol might have different method names:

- `listTools()` might be `tools/list`
- `listResources()` might be `resources/list`

### 4. Immediate Fixes Needed

**A. Add Protocol Version Detection**

```typescript
async connect(): Promise<void> {
  // ... existing connection code ...

  // After connection, detect protocol version
  try {
    const initResponse = await this.client.initialize({
      capabilities: {},
      clientInfo: { name: "Roo CLI", version: "1.0.0" }
    });
    console.log(`Server capabilities:`, initResponse.capabilities);
  } catch (error) {
    console.warn(`Failed to get server capabilities:`, error.message);
  }
}
```

**B. Add Method Fallbacks**

```typescript
async listTools(): Promise<McpTool[]> {
  try {
    // Try standard method first
    return await this.client.listTools();
  } catch (error) {
    if (error.code === -32601) {
      // Try alternative method names
      try {
        return await this.client.request('tools/list', {});
      } catch (fallbackError) {
        console.warn(`Server does not support tool listing`);
        return [];
      }
    }
    throw error;
  }
}
```

**C. Improve Error Handling**

```typescript
if (connection?.client && connection.status === "connected") {
	try {
		// Check if server supports the method before calling
		const serverInfo = (await connection.client.getServerInfo?.()) || {}

		if (serverInfo.capabilities?.tools) {
			const toolsResult = await connection.client.listTools()
			// ... process tools
		}

		if (serverInfo.capabilities?.resources) {
			const resourcesResult = await connection.client.listResources()
			// ... process resources
		}
	} catch (error) {
		// Better error logging
		console.error(`MCP Server ${config.name} error:`, {
			method: error.method || "unknown",
			code: error.code,
			message: error.message,
			serverCapabilities: serverInfo?.capabilities,
		})
	}
}
```

## Required Actions

### Step 1: Install GitHub MCP Server

```bash
npm install -g @modelcontextprotocol/server-github
```

### Step 2: Verify Installation

```bash
npx @modelcontextprotocol/server-github --version
```

### Step 3: Test Server Manually

```bash
# Test if server responds to initialize
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | npx @modelcontextprotocol/server-github
```

### Step 4: Update CLI to Handle Protocol Differences

The CLI needs to:

1. Add proper MCP protocol initialization handshake
2. Check server capabilities before calling methods
3. Use correct method names for the MCP protocol version
4. Provide better error messages for unsupported methods

## Expected Results

After fixes:

- ✅ Servers connect and complete handshake
- ✅ CLI can query server capabilities
- ✅ CLI only calls methods the server supports
- ✅ Better error messages for missing capabilities
- ✅ Successful listing of tools and resources

## Root Cause Analysis

The current issue is likely:

1. **Missing GitHub server installation** - `npx -y` downloads but may not persist
2. **Incomplete MCP handshake** - we're not doing proper protocol initialization
3. **Wrong method names** - MCP protocol may use different method names than our SDK
4. **Missing capability negotiation** - we should check what the server supports first

## Next Steps

1. Switch to code mode to implement the protocol fixes
2. Add proper MCP initialization handshake
3. Add method name fallbacks for different protocol versions
4. Improve error handling and capability detection
5. Test with both servers to ensure compatibility
