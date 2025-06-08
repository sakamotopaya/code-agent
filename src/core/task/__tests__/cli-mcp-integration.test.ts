import { Task } from "../Task"
import { CLIMcpService } from "../../../cli/services/CLIMcpService"

// Mock the MCP service
jest.mock("../../../cli/services/CLIMcpService")

describe("CLI MCP Integration", () => {
	let mockCLIMcpService: jest.Mocked<CLIMcpService>
	let task: Task

	beforeEach(() => {
		// Create mock MCP service
		mockCLIMcpService = {
			loadServerConfigs: jest.fn().mockResolvedValue([
				{
					id: "test-server",
					name: "Test MCP Server",
					type: "stdio",
					command: "test-command",
				},
			]),
			connectToServer: jest.fn().mockResolvedValue(undefined),
			getConnectedServers: jest.fn().mockReturnValue([
				{
					config: {
						id: "test-server",
						name: "Test MCP Server",
						type: "stdio",
						command: "test-command",
					},
					status: "connected",
					client: {
						listTools: jest.fn().mockResolvedValue({
							tools: [
								{
									name: "test_tool",
									description: "A test tool",
									inputSchema: { type: "object" },
								},
							],
						}),
						listResources: jest.fn().mockResolvedValue({
							resources: [
								{
									uri: "test://resource",
									name: "Test Resource",
									description: "A test resource",
								},
							],
						}),
					},
				},
			]),
		} as any

		// Mock the CLIMcpService constructor
		;(CLIMcpService as jest.MockedClass<typeof CLIMcpService>).mockImplementation(() => mockCLIMcpService)

		// Create task instance
		task = new Task({
			provider: undefined, // CLI mode - no provider
			apiConfiguration: {} as any,
			task: "test task",
			workspacePath: "/test/workspace",
		} as any)
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	it("should include MCP servers section in CLI system prompt", async () => {
		// Call the private method to get system prompt
		const systemPrompt = await (task as any).getSystemPrompt()

		// Verify MCP servers section is included
		expect(systemPrompt).toContain("MCP SERVERS")
		expect(systemPrompt).toContain("Connected MCP Servers")
		expect(systemPrompt).toContain("Test MCP Server")
		expect(systemPrompt).toContain("test_tool")
		expect(systemPrompt).toContain("A test tool")
	})

	it("should initialize MCP service in CLI mode", async () => {
		// Call the private method to get system prompt (which initializes MCP)
		await (task as any).getSystemPrompt()

		// Verify MCP service was initialized
		expect(CLIMcpService).toHaveBeenCalledWith()
		expect(mockCLIMcpService.loadServerConfigs).toHaveBeenCalled()
		expect(mockCLIMcpService.connectToServer).toHaveBeenCalledWith({
			id: "test-server",
			name: "Test MCP Server",
			type: "stdio",
			command: "test-command",
		})
	})

	it("should handle MCP initialization errors gracefully", async () => {
		// Mock an error during server connection
		mockCLIMcpService.connectToServer.mockRejectedValue(new Error("Connection failed"))

		// Should not throw error
		const systemPrompt = await (task as any).getSystemPrompt()

		// Should still contain basic MCP section
		expect(systemPrompt).toContain("MCP SERVERS")
	})

	it("should include MCP tools and resources in server information", async () => {
		const systemPrompt = await (task as any).getSystemPrompt()

		// Verify tools are included
		expect(systemPrompt).toContain("Available Tools")
		expect(systemPrompt).toContain("test_tool: A test tool")
		expect(systemPrompt).toContain('"type": "object"')

		// Verify resources are included
		expect(systemPrompt).toContain("Direct Resources")
		expect(systemPrompt).toContain("test://resource (Test Resource): A test resource")
	})
})
