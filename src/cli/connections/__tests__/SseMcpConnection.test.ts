import { SseMcpConnection } from "../SseMcpConnection"
import { McpServerConfig, McpConnectionError } from "../../types/mcp-types"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

// Mock the MCP SDK
jest.mock("@modelcontextprotocol/sdk/client/index.js")
jest.mock("@modelcontextprotocol/sdk/client/sse.js")

const MockClient = Client as jest.MockedClass<typeof Client>
const MockSSEClientTransport = SSEClientTransport as jest.MockedClass<typeof SSEClientTransport>

describe("SseMcpConnection", () => {
	let connection: SseMcpConnection
	let config: McpServerConfig
	let mockClient: jest.Mocked<Client>
	let mockTransport: jest.Mocked<SSEClientTransport>

	beforeEach(() => {
		jest.clearAllMocks()

		config = {
			id: "test-sse-server",
			name: "Test SSE Server",
			type: "sse",
			enabled: true,
			url: "https://example.com/mcp",
			headers: {
				Authorization: "Bearer test-token",
				"Content-Type": "application/json",
			},
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
			close: jest.fn(),
			onclose: undefined,
			onerror: undefined,
		} as any

		MockClient.mockImplementation(() => mockClient)
		MockSSEClientTransport.mockImplementation(() => mockTransport)

		connection = new SseMcpConnection(config)
	})

	describe("constructor", () => {
		it("should initialize with correct config", () => {
			expect(connection.id).toBe("test-sse-server")
			expect(connection.config).toBe(config)
			expect(connection.status).toBe("disconnected")
			expect(connection.errorCount).toBe(0)
		})
	})

	describe("connect", () => {
		it("should connect successfully", async () => {
			mockClient.connect.mockResolvedValue(undefined)

			await connection.connect()

			expect(MockSSEClientTransport).toHaveBeenCalledWith(new URL("https://example.com/mcp"), {
				Authorization: "Bearer test-token",
				"Content-Type": "application/json",
			})

			expect(MockClient).toHaveBeenCalledWith(
				{
					name: "cli-client-test-sse-server",
					version: "1.0.0",
				},
				{
					capabilities: {
						tools: {},
						resources: {},
					},
				},
			)

			expect(mockClient.connect).toHaveBeenCalledWith(mockTransport)
			expect(connection.status).toBe("connected")
			expect(connection.errorCount).toBe(0)
		})

		it("should throw error if URL is missing", async () => {
			const invalidConfig = { ...config, url: undefined }
			const invalidConnection = new SseMcpConnection(invalidConfig)

			await expect(invalidConnection.connect()).rejects.toThrow(McpConnectionError)
		})

		it("should handle connection failure", async () => {
			const error = new Error("SSE Connection failed")
			mockClient.connect.mockRejectedValue(error)

			await expect(connection.connect()).rejects.toThrow(McpConnectionError)

			expect(connection.status).toBe("error")
			expect(connection.errorCount).toBe(1)
		})

		it("should not connect if already connected", async () => {
			mockClient.connect.mockResolvedValue(undefined)

			await connection.connect()
			expect(connection.status).toBe("connected")

			// Reset mocks
			mockClient.connect.mockClear()

			// Try to connect again
			await connection.connect()

			expect(mockClient.connect).not.toHaveBeenCalled()
		})

		it("should not connect if already connecting", async () => {
			mockClient.connect.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))

			// Start first connection
			const firstConnect = connection.connect()
			expect(connection.status).toBe("connecting")

			// Try to connect again immediately
			await connection.connect()

			// Complete first connection
			await firstConnect

			expect(MockSSEClientTransport).toHaveBeenCalledTimes(1)
		})

		it("should use empty headers if not provided", async () => {
			const configWithoutHeaders = { ...config, headers: undefined }
			const connectionWithoutHeaders = new SseMcpConnection(configWithoutHeaders)

			mockClient.connect.mockResolvedValue(undefined)

			await connectionWithoutHeaders.connect()

			expect(MockSSEClientTransport).toHaveBeenCalledWith(new URL("https://example.com/mcp"), {})
		})
	})

	describe("disconnect", () => {
		beforeEach(async () => {
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
			mockClient.connect.mockResolvedValue(undefined)
			mockClient.listTools.mockRejectedValue(new Error("Health check failed"))

			await connection.connect()
			const isHealthy = await connection.isHealthy()

			expect(isHealthy).toBe(false)
			expect(connection.errorCount).toBe(1)
		})

		it("should return false if client is not available", async () => {
			mockClient.connect.mockResolvedValue(undefined)

			await connection.connect()
			connection.client = undefined

			const isHealthy = await connection.isHealthy()

			expect(isHealthy).toBe(false)
		})
	})

	describe("error handling", () => {
		beforeEach(async () => {
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

			const error = new Error("SSE Transport error")

			// Simulate transport error
			if (mockTransport.onerror) {
				mockTransport.onerror(error)
			}

			expect(connection.status).toBe("error")
			expect(connection.errorCount).toBe(1)
		})
	})

	describe("URL validation", () => {
		it("should accept valid HTTPS URLs", async () => {
			const httpsConfig = { ...config, url: "https://secure.example.com/mcp" }
			const httpsConnection = new SseMcpConnection(httpsConfig)

			mockClient.connect.mockResolvedValue(undefined)

			await httpsConnection.connect()

			expect(MockSSEClientTransport).toHaveBeenCalledWith(
				new URL("https://secure.example.com/mcp"),
				expect.any(Object),
			)
		})

		it("should accept valid HTTP URLs", async () => {
			const httpConfig = { ...config, url: "http://localhost:8080/mcp" }
			const httpConnection = new SseMcpConnection(httpConfig)

			mockClient.connect.mockResolvedValue(undefined)

			await httpConnection.connect()

			expect(MockSSEClientTransport).toHaveBeenCalledWith(
				new URL("http://localhost:8080/mcp"),
				expect.any(Object),
			)
		})
	})
})
