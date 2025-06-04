import { StdioMcpConnection } from "../StdioMcpConnection"
import { McpServerConfig, McpConnectionError } from "../../types/mcp-types"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

// Mock the MCP SDK
jest.mock("@modelcontextprotocol/sdk/client/index.js")
jest.mock("@modelcontextprotocol/sdk/client/stdio.js")

const MockClient = Client as jest.MockedClass<typeof Client>
const MockStdioClientTransport = StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>

describe("StdioMcpConnection", () => {
	let connection: StdioMcpConnection
	let config: McpServerConfig
	let mockClient: jest.Mocked<Client>
	let mockTransport: jest.Mocked<StdioClientTransport>

	beforeEach(() => {
		jest.clearAllMocks()

		config = {
			id: "test-server",
			name: "Test Server",
			type: "stdio",
			enabled: true,
			command: "test-command",
			args: ["arg1", "arg2"],
			env: { TEST_VAR: "test-value" },
			cwd: "/test/dir",
			timeout: 30000,
			retryAttempts: 3,
			retryDelay: 1000,
			healthCheckInterval: 60000,
		}

		// Create mock instances
		mockClient = {
			connect: jest.fn(),
			close: jest.fn(),
			listTools: jest.fn(),
			listResources: jest.fn(),
			callTool: jest.fn(),
			readResource: jest.fn(),
		} as any

		mockTransport = {
			start: jest.fn(),
			close: jest.fn(),
			onclose: undefined,
			onerror: undefined,
		} as any

		MockClient.mockImplementation(() => mockClient)
		MockStdioClientTransport.mockImplementation(() => mockTransport)

		connection = new StdioMcpConnection(config)
	})

	describe("constructor", () => {
		it("should initialize with correct config", () => {
			expect(connection.id).toBe("test-server")
			expect(connection.config).toBe(config)
			expect(connection.status).toBe("disconnected")
			expect(connection.errorCount).toBe(0)
		})
	})

	describe("connect", () => {
		it("should connect successfully", async () => {
			mockTransport.start.mockResolvedValue(undefined)
			mockClient.connect.mockResolvedValue(undefined)

			await connection.connect()

			expect(MockStdioClientTransport).toHaveBeenCalledWith({
				command: "test-command",
				args: ["arg1", "arg2"],
				cwd: "/test/dir",
				env: expect.objectContaining({
					TEST_VAR: "test-value",
				}),
				stderr: "pipe",
			})

			expect(MockClient).toHaveBeenCalledWith(
				{
					name: "cli-client-test-server",
					version: "1.0.0",
				},
				{
					capabilities: {
						tools: {},
						resources: {},
					},
				},
			)

			expect(mockTransport.start).toHaveBeenCalled()
			expect(mockClient.connect).toHaveBeenCalledWith(mockTransport)
			expect(connection.status).toBe("connected")
			expect(connection.errorCount).toBe(0)
		})

		it("should throw error if command is missing", async () => {
			const invalidConfig = { ...config, command: undefined }
			const invalidConnection = new StdioMcpConnection(invalidConfig)

			await expect(invalidConnection.connect()).rejects.toThrow(McpConnectionError)
		})

		it("should handle connection failure", async () => {
			const error = new Error("Connection failed")
			mockTransport.start.mockRejectedValue(error)

			await expect(connection.connect()).rejects.toThrow(McpConnectionError)

			expect(connection.status).toBe("error")
			expect(connection.errorCount).toBe(1)
		})

		it("should not connect if already connected", async () => {
			mockTransport.start.mockResolvedValue(undefined)
			mockClient.connect.mockResolvedValue(undefined)

			await connection.connect()
			expect(connection.status).toBe("connected")

			// Reset mocks
			mockTransport.start.mockClear()
			mockClient.connect.mockClear()

			// Try to connect again
			await connection.connect()

			expect(mockTransport.start).not.toHaveBeenCalled()
			expect(mockClient.connect).not.toHaveBeenCalled()
		})

		it("should not connect if already connecting", async () => {
			mockTransport.start.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))
			mockClient.connect.mockResolvedValue(undefined)

			// Start first connection
			const firstConnect = connection.connect()
			expect(connection.status).toBe("connecting")

			// Try to connect again immediately
			await connection.connect()

			// Complete first connection
			await firstConnect

			expect(MockStdioClientTransport).toHaveBeenCalledTimes(1)
		})
	})

	describe("disconnect", () => {
		beforeEach(async () => {
			mockTransport.start.mockResolvedValue(undefined)
			mockClient.connect.mockResolvedValue(undefined)
			mockClient.close.mockResolvedValue(undefined)
			mockTransport.close.mockResolvedValue(undefined)

			await connection.connect()
		})

		it("should disconnect successfully", async () => {
			await connection.disconnect()

			expect(mockClient.close).toHaveBeenCalled()
			expect(mockTransport.close).toHaveBeenCalled()
			expect(connection.status).toBe("disconnected")
		})

		it("should handle disconnect errors gracefully", async () => {
			const error = new Error("Disconnect failed")
			mockClient.close.mockRejectedValue(error)

			// Should not throw
			await connection.disconnect()

			expect(connection.status).toBe("disconnected")
		})

		it("should not disconnect if already disconnected", async () => {
			await connection.disconnect()
			expect(connection.status).toBe("disconnected")

			// Reset mocks
			mockClient.close.mockClear()
			mockTransport.close.mockClear()

			// Try to disconnect again
			await connection.disconnect()

			expect(mockClient.close).not.toHaveBeenCalled()
			expect(mockTransport.close).not.toHaveBeenCalled()
		})
	})

	describe("isHealthy", () => {
		it("should return true for healthy connection", async () => {
			mockTransport.start.mockResolvedValue(undefined)
			mockClient.connect.mockResolvedValue(undefined)
			mockClient.listTools.mockResolvedValue({ tools: [] })

			await connection.connect()
			const isHealthy = await connection.isHealthy()

			expect(isHealthy).toBe(true)
			expect(mockClient.listTools).toHaveBeenCalled()
		})

		it("should return false for disconnected connection", async () => {
			const isHealthy = await connection.isHealthy()

			expect(isHealthy).toBe(false)
		})

		it("should return false if health check fails", async () => {
			mockTransport.start.mockResolvedValue(undefined)
			mockClient.connect.mockResolvedValue(undefined)
			mockClient.listTools.mockRejectedValue(new Error("Health check failed"))

			await connection.connect()
			const isHealthy = await connection.isHealthy()

			expect(isHealthy).toBe(false)
			expect(connection.errorCount).toBe(1)
		})

		it("should return false if client is not available", async () => {
			mockTransport.start.mockResolvedValue(undefined)
			mockClient.connect.mockResolvedValue(undefined)

			await connection.connect()
			connection.client = undefined

			const isHealthy = await connection.isHealthy()

			expect(isHealthy).toBe(false)
		})
	})

	describe("error handling", () => {
		beforeEach(async () => {
			mockTransport.start.mockResolvedValue(undefined)
			mockClient.connect.mockResolvedValue(undefined)
			await connection.connect()
		})

		it("should handle transport close events", () => {
			expect(mockTransport.onclose).toBeDefined()

			// Simulate transport close
			if (mockTransport.onclose) {
				mockTransport.onclose()
			}

			expect(connection.status).toBe("disconnected")
		})

		it("should handle transport error events", () => {
			expect(mockTransport.onerror).toBeDefined()

			const error = new Error("Transport error")

			// Simulate transport error
			if (mockTransport.onerror) {
				mockTransport.onerror(error)
			}

			expect(connection.status).toBe("error")
			expect(connection.errorCount).toBe(1)
		})
	})

	describe("environment variables", () => {
		it("should filter undefined environment variables", async () => {
			// Set up process.env with undefined values
			const originalEnv = process.env
			process.env = {
				...originalEnv,
				DEFINED_VAR: "defined-value",
				UNDEFINED_VAR: undefined,
			}

			mockTransport.start.mockResolvedValue(undefined)
			mockClient.connect.mockResolvedValue(undefined)

			await connection.connect()

			expect(MockStdioClientTransport).toHaveBeenCalledWith({
				command: "test-command",
				args: ["arg1", "arg2"],
				cwd: "/test/dir",
				env: expect.not.objectContaining({
					UNDEFINED_VAR: undefined,
				}),
				stderr: "pipe",
			})

			// Restore original env
			process.env = originalEnv
		})
	})
})
