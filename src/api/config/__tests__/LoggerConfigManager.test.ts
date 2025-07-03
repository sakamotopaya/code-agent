import { LoggerConfigManager } from "../LoggerConfigManager"
import { ApiConfigManager } from "../ApiConfigManager"
import fs from "fs"
import path from "path"

// Mock fs module
jest.mock("fs")
const mockFs = fs as jest.Mocked<typeof fs>

describe("LoggerConfigManager", () => {
	let mockApiConfig: jest.Mocked<ApiConfigManager>

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Mock ApiConfigManager
		mockApiConfig = {
			getConfiguration: jest.fn().mockReturnValue({
				debug: false,
				verbose: false,
			}),
		} as any

		// Mock environment variables
		delete process.env.LOGS_PATH
		delete process.env.LOG_FILE_ENABLED
		delete process.env.LOG_ROTATION_ENABLED
		delete process.env.NODE_ENV
		delete process.env.LOG_LEVEL
		delete process.env.LOG_MAX_SIZE
		delete process.env.LOG_MAX_FILES

		// Mock fs.existsSync to return false by default (non-container environment)
		mockFs.existsSync.mockReturnValue(false)
		mockFs.mkdirSync.mockReturnValue(undefined as any)
		mockFs.accessSync.mockReturnValue(undefined)
	})

	describe("createLoggerConfig", () => {
		it("should create basic console-only config when file logging is disabled", () => {
			process.env.LOG_FILE_ENABLED = "false"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			expect(config).toHaveProperty("level", "info")
			expect(config).toHaveProperty("transport")
			expect(config.transport.targets).toHaveLength(1)
			expect(config.transport.targets[0].target).toBe("pino-pretty")
		})

		it("should enable debug level when debug is true", () => {
			mockApiConfig.getConfiguration.mockReturnValue({
				debug: true,
				verbose: false,
			})

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)
			expect(config.level).toBe("debug")
		})

		it("should create file logging config when LOG_FILE_ENABLED is true", () => {
			process.env.LOG_FILE_ENABLED = "true"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			// Should have console + file + error file targets
			expect(config.transport.targets.length).toBeGreaterThan(1)

			// Check that file targets are present
			const fileTargets = config.transport.targets.filter(
				(t: any) => t.target === "pino/file" && t.options.destination !== 1,
			)
			expect(fileTargets.length).toBeGreaterThanOrEqual(2) // main + error logs
		})

		it("should use development pretty printing for development environment", () => {
			process.env.NODE_ENV = "development"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			const consoleTarget = config.transport.targets.find((t: any) => t.target === "pino-pretty")
			expect(consoleTarget).toBeDefined()
			expect(consoleTarget.options.colorize).toBe(true)
		})

		it("should use JSON logging for production environment", () => {
			process.env.NODE_ENV = "production"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			// Should have JSON console target (not pino-pretty)
			const jsonTarget = config.transport.targets.find(
				(t: any) => t.target === "pino/file" && t.options.destination === 1,
			)
			expect(jsonTarget).toBeDefined()
		})

		it("should add rotation target for production with rotation enabled", () => {
			process.env.NODE_ENV = "production"
			process.env.LOG_FILE_ENABLED = "true"
			process.env.LOG_ROTATION_ENABLED = "true"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			// Should include rotation target
			expect(config.transport.targets.length).toBeGreaterThan(2)
		})

		it("should handle custom logs path", () => {
			process.env.LOG_FILE_ENABLED = "true"
			process.env.LOGS_PATH = "/custom/logs"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			const fileTarget = config.transport.targets.find(
				(t: any) =>
					t.target === "pino/file" && t.options.destination && t.options.destination.includes("/custom/logs"),
			)
			expect(fileTarget).toBeDefined()
		})

		it("should create logs directory if it does not exist", () => {
			process.env.LOG_FILE_ENABLED = "true"
			process.env.LOGS_PATH = "./test-logs"

			LoggerConfigManager.createLoggerConfig(mockApiConfig)

			expect(mockFs.mkdirSync).toHaveBeenCalledWith("./test-logs", { recursive: true })
		})

		it("should handle directory creation failure gracefully", () => {
			mockFs.mkdirSync.mockImplementation(() => {
				throw new Error("Permission denied")
			})
			process.env.LOG_FILE_ENABLED = "true"

			// Should not throw error
			expect(() => {
				LoggerConfigManager.createLoggerConfig(mockApiConfig)
			}).not.toThrow()
		})
	})

	describe("getLoggingInfo", () => {
		it("should return current logging configuration", () => {
			process.env.LOGS_PATH = "/test/logs"
			process.env.LOG_FILE_ENABLED = "true"
			process.env.LOG_ROTATION_ENABLED = "false"
			process.env.LOG_LEVEL = "debug"

			const info = LoggerConfigManager.getLoggingInfo()

			expect(info).toEqual({
				logsDir: "/test/logs",
				fileLoggingEnabled: true,
				rotationEnabled: false,
				logLevel: "debug",
			})
		})

		it("should return defaults when environment variables are not set", () => {
			const info = LoggerConfigManager.getLoggingInfo()

			expect(info).toEqual({
				logsDir: "/app/logs",
				fileLoggingEnabled: false,
				rotationEnabled: false,
				logLevel: "info",
			})
		})
	})

	describe("validateLoggingSetup", () => {
		it("should validate successful setup", () => {
			mockFs.accessSync.mockReturnValue(undefined)
			process.env.LOG_FILE_ENABLED = "true"
			mockFs.existsSync.mockImplementation((path) => path === "/app")

			const result = LoggerConfigManager.validateLoggingSetup()

			expect(result.valid).toBe(true)
			expect(result.warnings).toHaveLength(0)
		})

		it("should warn about invalid log level", () => {
			process.env.LOG_LEVEL = "invalid-level"

			const result = LoggerConfigManager.validateLoggingSetup()

			expect(result.valid).toBe(false)
			expect(result.warnings).toContain(
				"Invalid LOG_LEVEL: invalid-level. Valid levels: trace, debug, info, warn, error, fatal",
			)
		})

		it("should warn about invalid log max size format", () => {
			process.env.LOG_MAX_SIZE = "invalid-size"

			const result = LoggerConfigManager.validateLoggingSetup()

			expect(result.valid).toBe(false)
			expect(result.warnings).toContain(
				'Invalid LOG_MAX_SIZE format: invalid-size. Use format like "10MB", "1GB"',
			)
		})

		it("should warn about invalid max files value", () => {
			process.env.LOG_MAX_FILES = "-1"

			const result = LoggerConfigManager.validateLoggingSetup()

			expect(result.valid).toBe(false)
			expect(result.warnings).toContain("Invalid LOG_MAX_FILES: -1. Must be a positive integer")
		})

		it("should warn about non-writable logs directory", () => {
			mockFs.accessSync.mockImplementation(() => {
				throw new Error("Permission denied")
			})
			mockFs.mkdirSync.mockImplementation(() => {
				throw new Error("Cannot create directory")
			})
			process.env.LOG_FILE_ENABLED = "true"
			process.env.LOGS_PATH = "./test-logs"

			const result = LoggerConfigManager.validateLoggingSetup()

			expect(result.valid).toBe(false)
			expect(result.warnings).toContain("Logs directory ./test-logs is not writable and cannot be created")
		})
	})

	describe("serializers", () => {
		it("should create config with proper serializers", () => {
			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			expect(config.serializers).toHaveProperty("req")
			expect(config.serializers).toHaveProperty("res")
			expect(config.serializers).toHaveProperty("err")
		})

		it("should redact authorization headers in request serializer", () => {
			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			const mockReq = {
				method: "GET",
				url: "/test",
				headers: {
					authorization: "Bearer secret-token",
					"user-agent": "test-agent",
				},
				ip: "127.0.0.1",
				socket: { remotePort: 12345 },
			}

			const serialized = config.serializers.req(mockReq)

			expect(serialized.headers.authorization).toBe("[REDACTED]")
			expect(serialized.headers["user-agent"]).toBe("test-agent")
			expect(serialized.method).toBe("GET")
			expect(serialized.url).toBe("/test")
		})

		it("should handle error serialization with stack trace", () => {
			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			const error = new Error("Test error")
			error.stack = "Error: Test error\n    at test.js:1:1"

			const serialized = config.serializers.err(error)

			expect(serialized.type).toBe("Error")
			expect(serialized.message).toBe("Test error")
			expect(serialized.stack).toBe("Error: Test error\n    at test.js:1:1")
		})

		it("should handle error serialization without stack trace", () => {
			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			const error = new Error("Test error")
			delete error.stack

			const serialized = config.serializers.err(error)

			expect(serialized.stack).toBe("")
		})
	})
})
