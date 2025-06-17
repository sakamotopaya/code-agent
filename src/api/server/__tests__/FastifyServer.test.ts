import { FastifyServer } from "../FastifyServer"
import { ApiConfigManager } from "../../config/ApiConfigManager"
import type { CoreInterfaces } from "../../../core/interfaces"

// Mock the dependencies
jest.mock("../../config/ApiConfigManager")
jest.mock("../../../core/adapters/api", () => ({
	createApiAdapters: jest.fn().mockReturnValue({
		fileSystem: {},
		terminal: {},
		browser: {},
		telemetry: {},
		userInterface: {},
	}),
}))

jest.mock("../../jobs/JobManager", () => ({
	JobManager: jest.fn().mockImplementation(() => ({
		createJob: jest.fn(),
		startJob: jest.fn(),
		cancelJob: jest.fn(),
	})),
}))

jest.mock("../../streaming/StreamManager", () => ({
	StreamManager: jest.fn().mockImplementation(() => ({
		createStream: jest.fn(),
		closeStream: jest.fn(),
	})),
}))

jest.mock("../../questions/ApiQuestionManager", () => ({
	ApiQuestionManager: jest.fn().mockImplementation(() => ({})),
}))

jest.mock("../../../core/task/execution", () => ({
	TaskExecutionOrchestrator: jest.fn().mockImplementation(() => ({
		executeTask: jest.fn(),
	})),
	ApiTaskExecutionHandler: jest.fn(),
}))

jest.mock("../../../shared/paths", () => ({
	getStoragePath: jest.fn().mockReturnValue("/tmp/test-storage"),
}))

describe("FastifyServer", () => {
	let server: FastifyServer
	let mockConfig: jest.Mocked<ApiConfigManager>
	let mockAdapters: CoreInterfaces
	let mockLogger: any

	beforeEach(() => {
		// Create mock logger
		mockLogger = {
			info: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
			debug: jest.fn(),
		}

		// Mock the config manager
		mockConfig = {
			getConfiguration: jest.fn().mockReturnValue({
				port: 3000,
				workspaceRoot: "/test/workspace",
				debug: false,
				verbose: false,
				cors: null,
				security: null,
				mcpConfigPath: undefined,
				mcpAutoConnect: true,
				mcpTimeout: 30000,
				mcpRetries: 3,
			}),
		} as any

		// Mock the adapters
		mockAdapters = {
			fileSystem: {} as any,
			terminal: {} as any,
			browser: {} as any,
			telemetry: {} as any,
			userInterface: {} as any,
			storage: {} as any,
		}

		// Create server instance
		server = new FastifyServer(mockConfig, mockAdapters)

		// Mock the fastify app logger
		;(server as any).app = {
			log: mockLogger,
			addHook: jest.fn(),
			setErrorHandler: jest.fn(),
			register: jest.fn(),
			get: jest.fn(),
			post: jest.fn(),
			put: jest.fn(),
			delete: jest.fn(),
			listen: jest.fn().mockResolvedValue("http://localhost:3000"),
			close: jest.fn(),
		}
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe("initialization", () => {
		it("should initialize with proper logger configuration", async () => {
			await server.initialize()

			// Verify that hooks are added (which would use the logger)
			expect((server as any).app.addHook).toHaveBeenCalled()
			expect((server as any).app.setErrorHandler).toHaveBeenCalled()
		})

		it("should use application logger in request hook when verbose is enabled", async () => {
			mockConfig.getConfiguration.mockReturnValue({
				...mockConfig.getConfiguration(),
				verbose: true,
			})

			await server.initialize()

			// Get the request hook callback
			const addHookCalls = ((server as any).app.addHook as jest.Mock).mock.calls
			const requestHook = addHookCalls.find((call) => call[0] === "onRequest")
			expect(requestHook).toBeDefined()

			// Simulate a request
			const mockRequest = {
				method: "GET",
				url: "/test",
			}

			await requestHook[1](mockRequest)

			// Verify logger was called instead of console
			expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("GET /test"))
		})

		it("should use application logger in error handler", async () => {
			await server.initialize()

			// Get the error handler callback
			const setErrorHandlerCalls = ((server as any).app.setErrorHandler as jest.Mock).mock.calls
			expect(setErrorHandlerCalls).toHaveLength(1)
			const errorHandler = setErrorHandlerCalls[0][0]

			// Simulate an error
			const mockError = new Error("Test error")
			const mockRequest = {}
			const mockReply = {
				status: jest.fn().mockReturnThis(),
				send: jest.fn().mockResolvedValue(undefined),
			}

			await errorHandler(mockError, mockRequest, mockReply)

			// Verify logger was called instead of console
			expect(mockLogger.error).toHaveBeenCalledWith("API Error:", mockError)
		})
	})

	describe("server lifecycle", () => {
		it("should use application logger when starting server", async () => {
			;((server as any).app.listen as jest.Mock).mockResolvedValue("http://localhost:3000")

			await server.start()

			// Verify logger was called for startup messages
			expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("🚀 API Server started at"))
			expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("📁 Workspace:"))
		})

		it("should use application logger when stopping server", async () => {
			// Set server as running
			;(server as any).isRunning = true

			await server.stop()

			// Verify logger was called for stop message
			expect(mockLogger.info).toHaveBeenCalledWith("🛑 API Server stopped")
		})

		it("should use application logger for startup errors", async () => {
			const startupError = new Error("Failed to bind to port")
			;((server as any).app.listen as jest.Mock).mockRejectedValue(startupError)

			await expect(server.start()).rejects.toThrow(startupError)

			// Verify logger was called for error
			expect(mockLogger.error).toHaveBeenCalledWith("Failed to start server:", startupError)
		})
	})

	describe("verbose logging", () => {
		it("should log additional startup information when verbose is enabled", async () => {
			mockConfig.getConfiguration.mockReturnValue({
				...mockConfig.getConfiguration(),
				verbose: true,
				debug: true,
				cors: { origin: "*" },
				security: { enableHelmet: true },
			})
			;((server as any).app.listen as jest.Mock).mockResolvedValue("http://localhost:3000")

			await server.start()

			// Verify verbose logging
			expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("🔧 Debug mode: enabled"))
			expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("🌐 CORS: enabled"))
			expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("🛡️  Security: enabled"))
		})
	})

	describe("logging consistency", () => {
		it("should never use console methods directly", () => {
			// This test ensures that all logging goes through the application logger
			const originalConsole = global.console
			const mockConsole = {
				log: jest.fn(),
				error: jest.fn(),
				warn: jest.fn(),
				debug: jest.fn(),
			}
			global.console = mockConsole as any

			try {
				// Test various server operations that previously used console
				server.initialize()

				// The server should not have called console methods directly
				expect(mockConsole.log).not.toHaveBeenCalled()
				expect(mockConsole.error).not.toHaveBeenCalled()
				expect(mockConsole.warn).not.toHaveBeenCalled()
				expect(mockConsole.debug).not.toHaveBeenCalled()
			} finally {
				global.console = originalConsole
			}
		})
	})
})
