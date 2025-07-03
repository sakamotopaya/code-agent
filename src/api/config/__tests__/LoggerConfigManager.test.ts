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

		// Mock fs methods
		mockFs.existsSync.mockReturnValue(false)
		mockFs.mkdirSync.mockReturnValue(undefined as any)
		mockFs.accessSync = jest.fn().mockReturnValue(undefined)
		mockFs.createWriteStream = jest.fn()
	})

	describe("createLoggerConfig", () => {
		it("should create basic console-only config when file logging is disabled", () => {
			process.env.LOG_FILE_ENABLED = "false"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			expect(config).toHaveProperty("level", "info")
			expect(config).toHaveProperty("formatters")
			expect(config).toHaveProperty("serializers")
			expect(config.stream).toBeUndefined() // No custom stream for console-only
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

			expect(config).toHaveProperty("stream")
			expect(typeof config.stream.write).toBe("function")
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

		it("should handle custom logs path", () => {
			process.env.LOG_FILE_ENABLED = "true"
			process.env.LOGS_PATH = "/custom/logs"

			LoggerConfigManager.createLoggerConfig(mockApiConfig)

			expect(mockFs.mkdirSync).toHaveBeenCalledWith("/custom/logs", { recursive: true })
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

	describe("multiWriteStream error detection", () => {
		let mockApiStream: any
		let mockErrorStream: any
		let mockStdout: jest.SpyInstance

		beforeEach(() => {
			// Mock file streams
			mockApiStream = { write: jest.fn() }
			mockErrorStream = { write: jest.fn() }
			mockStdout = jest.spyOn(process.stdout, "write").mockImplementation(() => true)

			// Mock createWriteStream to return our mocks
			mockFs.createWriteStream.mockImplementation((path: any) => {
				if (path.toString().includes("api-error.log")) {
					return mockErrorStream
				}
				return mockApiStream
			})
		})

		afterEach(() => {
			mockStdout.mockRestore()
		})

		it("should route error logs to error stream using JSON parsing", () => {
			process.env.LOG_FILE_ENABLED = "true"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			// Simulate a Pino error log with numeric level
			const errorLogChunk = '{"level":50,"time":"2024-01-01T00:00:00.000Z","msg":"Test error"}\n'
			config.stream.write(errorLogChunk)

			expect(mockApiStream.write).toHaveBeenCalledWith(errorLogChunk)
			expect(mockErrorStream.write).toHaveBeenCalledWith(errorLogChunk)
			expect(mockStdout).toHaveBeenCalledWith(errorLogChunk)
		})

		it("should route fatal logs to error stream using JSON parsing", () => {
			process.env.LOG_FILE_ENABLED = "true"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			// Simulate a Pino fatal log (level 60)
			const fatalLogChunk = '{"level":60,"time":"2024-01-01T00:00:00.000Z","msg":"Fatal error"}\n'
			config.stream.write(fatalLogChunk)

			expect(mockApiStream.write).toHaveBeenCalledWith(fatalLogChunk)
			expect(mockErrorStream.write).toHaveBeenCalledWith(fatalLogChunk)
		})

		it("should route string-level error logs to error stream", () => {
			process.env.LOG_FILE_ENABLED = "true"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			// Simulate a log with string level
			const errorLogChunk = '{"level":"error","time":"2024-01-01T00:00:00.000Z","msg":"String level error"}\n'
			config.stream.write(errorLogChunk)

			expect(mockApiStream.write).toHaveBeenCalledWith(errorLogChunk)
			expect(mockErrorStream.write).toHaveBeenCalledWith(errorLogChunk)
		})

		it("should not route info logs to error stream", () => {
			process.env.LOG_FILE_ENABLED = "true"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			// Simulate an info log (level 30)
			const infoLogChunk = '{"level":30,"time":"2024-01-01T00:00:00.000Z","msg":"Info message"}\n'
			config.stream.write(infoLogChunk)

			expect(mockApiStream.write).toHaveBeenCalledWith(infoLogChunk)
			expect(mockErrorStream.write).not.toHaveBeenCalled()
		})

		it("should fallback to string matching when JSON parsing fails", () => {
			process.env.LOG_FILE_ENABLED = "true"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			// Simulate malformed JSON that contains error level as string
			const malformedLogChunk = 'invalid json but contains "level":"error" somewhere\n'
			config.stream.write(malformedLogChunk)

			expect(mockApiStream.write).toHaveBeenCalledWith(malformedLogChunk)
			expect(mockErrorStream.write).toHaveBeenCalledWith(malformedLogChunk)
		})

		it("should fallback to string matching for numeric level when JSON parsing fails", () => {
			process.env.LOG_FILE_ENABLED = "true"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			// Simulate malformed JSON that contains numeric error level
			const malformedLogChunk = 'invalid json but contains "level":50 somewhere\n'
			config.stream.write(malformedLogChunk)

			expect(mockApiStream.write).toHaveBeenCalledWith(malformedLogChunk)
			expect(mockErrorStream.write).toHaveBeenCalledWith(malformedLogChunk)
		})

		it("should not route non-error logs when JSON parsing fails and no error strings present", () => {
			process.env.LOG_FILE_ENABLED = "true"

			const config = LoggerConfigManager.createLoggerConfig(mockApiConfig)

			// Simulate malformed JSON without error indicators
			const malformedLogChunk = "invalid json with no error indicators\n"
			config.stream.write(malformedLogChunk)

			expect(mockApiStream.write).toHaveBeenCalledWith(malformedLogChunk)
			expect(mockErrorStream.write).not.toHaveBeenCalled()
		})
	})
})
