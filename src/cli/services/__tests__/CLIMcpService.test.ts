import { CLIMcpService } from "../CLIMcpService"
import { McpServerConfig, McpConnectionError, McpConfigurationError } from "../../types/mcp-types"
import { DEFAULT_MCP_CONFIG } from "../../types/mcp-config-types"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

// Mock the filesystem
jest.mock("fs/promises")
const mockFs = fs as jest.Mocked<typeof fs>

// Mock the connection classes
jest.mock("../../connections/StdioMcpConnection")
jest.mock("../../connections/SseMcpConnection")

import { StdioMcpConnection } from "../../connections/StdioMcpConnection"
import { SseMcpConnection } from "../../connections/SseMcpConnection"

const MockStdioMcpConnection = StdioMcpConnection as jest.MockedClass<typeof StdioMcpConnection>
const MockSseMcpConnection = SseMcpConnection as jest.MockedClass<typeof SseMcpConnection>

describe("CLIMcpService", () => {
	let service: CLIMcpService
	let mockConnection: any

	beforeEach(() => {
		jest.clearAllMocks()
		service = new CLIMcpService()

		// Mock connection object
		mockConnection = {
			id: "test-server",
			config: { id: "test-server", name: "Test Server", type: "stdio" },
			status: "connected",
			lastActivity: Date.now(),
			errorCount: 0,
			client: {
				listTools: jest.fn(),
				listResources: jest.fn(),
				callTool: jest.fn(),
				readResource: jest.fn(),
			},
			connect: jest.fn(),
			disconnect: jest.fn(),
			isHealthy: jest.fn(),
		}
	})

	afterEach(async () => {
		await service.dispose()
	})

	describe("loadServerConfigs", () => {
		it("should load configuration from file", async () => {
			const mockConfig = {
				version: "1.0.0",
				servers: [
					{
						id: "test-server",
						name: "Test Server",
						type: "stdio" as const,
						enabled: true,
						command: "test-command",
						timeout: 30000,
						retryAttempts: 3,
						retryDelay: 1000,
						healthCheckInterval: 60000,
					},
				],
				defaults: DEFAULT_MCP_CONFIG,
			}

			mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig))

			const configs = await service.loadServerConfigs("/test/config.json")

			expect(configs).toHaveLength(1)
			expect(configs[0].id).toBe("test-server")
			expect(configs[0].name).toBe("Test Server")
			expect(configs[0].type).toBe("stdio")
		})

		it("should return empty array if config file does not exist", async () => {
			const error = new Error("File not found") as any
			error.code = "ENOENT"
			mockFs.readFile.mockRejectedValue(error)

			const configs = await service.loadServerConfigs("/nonexistent/config.json")

			expect(configs).toEqual([])
		})

		it("should throw McpConfigurationError for invalid JSON", async () => {
			mockFs.readFile.mockResolvedValue("invalid json")

			await expect(service.loadServerConfigs("/test/config.json")).rejects.toThrow(McpConfigurationError)
		})

		it("should resolve config path correctly", async () => {
			const mockConfig = {
				version: "1.0.0",
				servers: [],
				defaults: DEFAULT_MCP_CONFIG,
			}

			// Mock access to check for local config first
			mockFs.access.mockRejectedValueOnce(new Error("Not found"))
			mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig))

			await service.loadServerConfigs()

			// Should try home directory config
			expect(mockFs.readFile).toHaveBeenCalledWith(path.join(os.homedir(), ".roo", "mcp-config.json"), "utf-8")
		})
		it("should preserve zero values and not replace them with defaults", async () => {
			const mockConfig = {
				version: "1.0.0",
				servers: [
					{
						id: "test-server-zero-values",
						name: "Test Server with Zero Values",
						type: "stdio" as const,
						enabled: true,
						command: "test-command",
						timeout: 0, // Intentionally set to 0
						retryAttempts: 0, // Intentionally set to 0
						retryDelay: 0, // Intentionally set to 0
						healthCheckInterval: 0, // Intentionally set to 0
					},
					{
						id: "test-server-undefined-values",
						name: "Test Server with Undefined Values",
						type: "stdio" as const,
						enabled: true,
						command: "test-command",
						// No timeout, retryAttempts, retryDelay, healthCheckInterval - should use defaults
					},
				],
				defaults: DEFAULT_MCP_CONFIG,
			}

			mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig))

			const configs = await service.loadServerConfigs("/test/config.json")

			expect(configs).toHaveLength(2)

			// First server should preserve zero values
			const zeroValueServer = configs[0]
			expect(zeroValueServer.id).toBe("test-server-zero-values")
			expect(zeroValueServer.timeout).toBe(0)
			expect(zeroValueServer.retryAttempts).toBe(0)
			expect(zeroValueServer.retryDelay).toBe(0)
			expect(zeroValueServer.healthCheckInterval).toBe(0)

			// Second server should use defaults for undefined values
			const undefinedValueServer = configs[1]
			expect(undefinedValueServer.id).toBe("test-server-undefined-values")
			expect(undefinedValueServer.timeout).toBe(DEFAULT_MCP_CONFIG.timeout)
			expect(undefinedValueServer.retryAttempts).toBe(DEFAULT_MCP_CONFIG.retryAttempts)
			expect(undefinedValueServer.retryDelay).toBe(DEFAULT_MCP_CONFIG.retryDelay)
			expect(undefinedValueServer.healthCheckInterval).toBe(DEFAULT_MCP_CONFIG.healthCheckInterval)
		})
	})

	describe("validateServerConfig", () => {
		it("should validate stdio server config", () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "stdio",
				enabled: true,
				command: "test-command",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			const result = service.validateServerConfig(config)

			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it("should validate SSE server config", () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "sse",
				enabled: true,
				url: "https://example.com/mcp",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			const result = service.validateServerConfig(config)

			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it("should return errors for invalid config", () => {
			const config: McpServerConfig = {
				id: "",
				name: "",
				type: "stdio",
				enabled: true,
				command: "",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			const result = service.validateServerConfig(config)

			expect(result.valid).toBe(false)
			expect(result.errors).toContain("Server ID is required")
			expect(result.errors).toContain("Server name is required")
			expect(result.errors).toContain("Command is required for stdio servers")
		})

		it("should validate URL for SSE servers", () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "sse",
				enabled: true,
				url: "invalid-url",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			const result = service.validateServerConfig(config)

			expect(result.valid).toBe(false)
			expect(result.errors).toContain("Invalid URL format")
		})
	})

	describe("connectToServer", () => {
		it("should connect to stdio server", async () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "stdio",
				enabled: true,
				command: "test-command",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			MockStdioMcpConnection.mockImplementation(() => mockConnection as any)
			mockConnection.connect.mockResolvedValue(undefined)

			const connection = await service.connectToServer(config)

			expect(MockStdioMcpConnection).toHaveBeenCalledWith(config)
			expect(mockConnection.connect).toHaveBeenCalled()
			expect(connection).toBe(mockConnection)
		})

		it("should connect to SSE server", async () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "sse",
				enabled: true,
				url: "https://example.com/mcp",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			MockSseMcpConnection.mockImplementation(() => mockConnection as any)
			mockConnection.connect.mockResolvedValue(undefined)

			const connection = await service.connectToServer(config)

			expect(MockSseMcpConnection).toHaveBeenCalledWith(config)
			expect(mockConnection.connect).toHaveBeenCalled()
			expect(connection).toBe(mockConnection)
		})

		it("should throw McpConfigurationError for invalid config", async () => {
			const config: McpServerConfig = {
				id: "",
				name: "Test Server",
				type: "stdio",
				enabled: true,
				command: "test-command",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			await expect(service.connectToServer(config)).rejects.toThrow(McpConfigurationError)
		})

		it("should throw McpConnectionError on connection failure", async () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "stdio",
				enabled: true,
				command: "test-command",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			MockStdioMcpConnection.mockImplementation(() => mockConnection as any)
			mockConnection.connect.mockRejectedValue(new Error("Connection failed"))

			await expect(service.connectToServer(config)).rejects.toThrow(McpConnectionError)
		})
	})

	describe("disconnectFromServer", () => {
		it("should disconnect from server", async () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "stdio",
				enabled: true,
				command: "test-command",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			MockStdioMcpConnection.mockImplementation(() => mockConnection as any)
			mockConnection.connect.mockResolvedValue(undefined)
			mockConnection.disconnect.mockResolvedValue(undefined)

			await service.connectToServer(config)
			await service.disconnectFromServer("test-server")

			expect(mockConnection.disconnect).toHaveBeenCalled()
		})

		it("should handle disconnecting non-existent server", async () => {
			await expect(service.disconnectFromServer("non-existent")).resolves.toBeUndefined()
		})
	})

	describe("listAvailableTools", () => {
		it("should list tools from connected servers", async () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "stdio",
				enabled: true,
				command: "test-command",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			const mockTools = [
				{ name: "tool1", description: "Test tool 1" },
				{ name: "tool2", description: "Test tool 2" },
			]

			MockStdioMcpConnection.mockImplementation(() => mockConnection as any)
			mockConnection.connect.mockResolvedValue(undefined)
			mockConnection.client.listTools.mockResolvedValue({ tools: mockTools })

			await service.connectToServer(config)
			const tools = await service.listAvailableTools()

			expect(tools).toHaveLength(2)
			expect(tools[0].name).toBe("tool1")
			expect(tools[0].serverId).toBe("test-server")
			expect(tools[1].name).toBe("tool2")
			expect(tools[1].serverId).toBe("test-server")
		})

		it("should handle errors when listing tools", async () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "stdio",
				enabled: true,
				command: "test-command",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			MockStdioMcpConnection.mockImplementation(() => mockConnection as any)
			mockConnection.connect.mockResolvedValue(undefined)
			mockConnection.client.listTools.mockRejectedValue(new Error("List tools failed"))

			await service.connectToServer(config)
			const tools = await service.listAvailableTools()

			expect(tools).toEqual([])
		})
	})

	describe("executeTool", () => {
		it("should execute tool successfully", async () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "stdio",
				enabled: true,
				command: "test-command",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			const mockResult = {
				content: [{ type: "text", text: "Tool executed successfully" }],
				isError: false,
			}

			MockStdioMcpConnection.mockImplementation(() => mockConnection as any)
			mockConnection.connect.mockResolvedValue(undefined)
			mockConnection.client.callTool.mockResolvedValue(mockResult)

			await service.connectToServer(config)
			const result = await service.executeTool("test-server", "test-tool", { arg1: "value1" })

			expect(result.success).toBe(true)
			expect(result.result).toBe(mockResult.content)
			expect(mockConnection.client.callTool).toHaveBeenCalledWith({
				name: "test-tool",
				arguments: { arg1: "value1" },
			})
		})

		it("should handle tool execution error", async () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "stdio",
				enabled: true,
				command: "test-command",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			MockStdioMcpConnection.mockImplementation(() => mockConnection as any)
			mockConnection.connect.mockResolvedValue(undefined)
			mockConnection.client.callTool.mockRejectedValue(new Error("Tool execution failed"))

			await service.connectToServer(config)

			await expect(service.executeTool("test-server", "test-tool", {})).rejects.toThrow("Tool execution failed")
		})

		it("should throw error for non-connected server", async () => {
			await expect(service.executeTool("non-existent", "test-tool", {})).rejects.toThrow(
				"Server non-existent is not connected",
			)
		})
	})

	describe("discoverServers", () => {
		it("should discover servers and their capabilities", async () => {
			const mockConfig = {
				version: "1.0.0",
				servers: [
					{
						id: "test-server",
						name: "Test Server",
						type: "stdio" as const,
						enabled: true,
						command: "test-command",
						timeout: 30000,
						retryAttempts: 3,
						retryDelay: 1000,
						healthCheckInterval: 60000,
					},
				],
				defaults: DEFAULT_MCP_CONFIG,
			}

			const mockTools = [{ name: "tool1", description: "Test tool" }]
			const mockResources = [{ uri: "test://resource", name: "Test Resource" }]

			mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig))
			MockStdioMcpConnection.mockImplementation(() => mockConnection as any)
			mockConnection.connect.mockResolvedValue(undefined)
			mockConnection.client.listTools.mockResolvedValue({ tools: mockTools })
			mockConnection.client.listResources.mockResolvedValue({ resources: mockResources })

			await service.connectToServer(mockConfig.servers[0])
			const servers = await service.discoverServers()

			expect(servers).toHaveLength(1)
			expect(servers[0].id).toBe("test-server")
			expect(servers[0].tools).toHaveLength(1)
			expect(servers[0].resources).toHaveLength(1)
			expect(servers[0].status).toBe("connected")
		})
	})

	describe("dispose", () => {
		it("should disconnect all servers and cleanup", async () => {
			const config: McpServerConfig = {
				id: "test-server",
				name: "Test Server",
				type: "stdio",
				enabled: true,
				command: "test-command",
				timeout: 30000,
				retryAttempts: 3,
				retryDelay: 1000,
				healthCheckInterval: 60000,
			}

			MockStdioMcpConnection.mockImplementation(() => mockConnection as any)
			mockConnection.connect.mockResolvedValue(undefined)
			mockConnection.disconnect.mockResolvedValue(undefined)

			await service.connectToServer(config)
			await service.dispose()

			expect(mockConnection.disconnect).toHaveBeenCalled()
		})
	})
})
