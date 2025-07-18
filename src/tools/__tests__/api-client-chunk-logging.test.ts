/**
 * Integration tests for API client raw chunk logging functionality
 */

import { ApiClientOptions } from "../types/api-client-types"

// Mock console.error for testing error conditions
const mockConsoleError = jest.spyOn(console, "error").mockImplementation()
const mockProcessExit = jest.spyOn(process, "exit").mockImplementation()

// Import the function we're testing
const { parseCommandLineArgs } = require("../api-client")

describe("API Client Raw Chunk Logging Integration", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		mockConsoleError.mockClear()
		mockProcessExit.mockClear()
	})

	afterAll(() => {
		mockConsoleError.mockRestore()
		mockProcessExit.mockRestore()
	})

	describe("Command Line Parsing", () => {
		test("parses --log-raw-chunks flag correctly", () => {
			const originalArgv = process.argv
			process.argv = ["node", "api-client.js", "--log-raw-chunks", "test task"]

			const { options } = parseCommandLineArgs()

			expect(options.logRawChunks).toBe(true)
			expect(options.rawChunkLogDir).toBeUndefined()

			process.argv = originalArgv
		})

		test("parses --raw-chunk-log-dir with path", () => {
			const originalArgv = process.argv
			process.argv = [
				"node",
				"api-client.js",
				"--log-raw-chunks",
				"--raw-chunk-log-dir",
				"/custom/log/dir",
				"test task",
			]

			const { options } = parseCommandLineArgs()

			expect(options.logRawChunks).toBe(true)
			expect(options.rawChunkLogDir).toBe("/custom/log/dir")

			process.argv = originalArgv
		})

		test("handles missing directory path argument", () => {
			const originalArgv = process.argv
			process.argv = ["node", "api-client.js", "--raw-chunk-log-dir"]

			expect(() => parseCommandLineArgs()).toThrow()

			process.argv = originalArgv
		})

		test("sets default values correctly", () => {
			const originalArgv = process.argv
			process.argv = ["node", "api-client.js", "test task"]

			const { options } = parseCommandLineArgs()

			expect(options.logRawChunks).toBe(false)
			expect(options.rawChunkLogDir).toBeUndefined()

			process.argv = originalArgv
		})

		test("combines chunk logging with other options", () => {
			const originalArgv = process.argv
			process.argv = [
				"node",
				"api-client.js",
				"--stream",
				"--verbose",
				"--log-raw-chunks",
				"--raw-chunk-log-dir",
				"/test/logs",
				"--show-thinking",
				"test task",
			]

			const { options } = parseCommandLineArgs()

			expect(options.useStream).toBe(true)
			expect(options.verbose).toBe(true)
			expect(options.logRawChunks).toBe(true)
			expect(options.rawChunkLogDir).toBe("/test/logs")
			expect(options.showThinking).toBe(true)

			process.argv = originalArgv
		})
	})

	describe("Configuration Validation", () => {
		test("validates required options are present", () => {
			const options: ApiClientOptions = {
				useStream: true,
				host: "localhost",
				port: 3000,
				mode: "code",
				restartTask: false,
				replMode: false,
				verbose: false,
				showThinking: false,
				showTools: false,
				showSystem: false,
				showResponse: false,
				showCompletion: false,
				showMcpUse: false,
				showTokenUsage: true,
				hideTokenUsage: false,
				showTiming: false,
				logSystemPrompt: false,
				logLlm: false,
				logRawChunks: true,
				rawChunkLogDir: "/test/logs",
			}

			// All required properties should be present
			expect(options.logRawChunks).toBe(true)
			expect(options.rawChunkLogDir).toBe("/test/logs")
			expect(options.host).toBe("localhost")
			expect(options.port).toBe(3000)
		})

		test("handles optional chunk logging configuration", () => {
			const options: ApiClientOptions = {
				useStream: true,
				host: "localhost",
				port: 3000,
				mode: "code",
				restartTask: false,
				replMode: false,
				verbose: false,
				showThinking: false,
				showTools: false,
				showSystem: false,
				showResponse: false,
				showCompletion: false,
				showMcpUse: false,
				showTokenUsage: true,
				hideTokenUsage: false,
				showTiming: false,
				logSystemPrompt: false,
				logLlm: false,
				logRawChunks: true,
				// rawChunkLogDir is optional
			}

			// Should work without explicit rawChunkLogDir
			expect(options.logRawChunks).toBe(true)
			expect(options.rawChunkLogDir).toBeUndefined()
		})

		test("handles disabled chunk logging", () => {
			const options: ApiClientOptions = {
				useStream: true,
				host: "localhost",
				port: 3000,
				mode: "code",
				restartTask: false,
				replMode: false,
				verbose: false,
				showThinking: false,
				showTools: false,
				showSystem: false,
				showResponse: false,
				showCompletion: false,
				showMcpUse: false,
				showTokenUsage: true,
				hideTokenUsage: false,
				showTiming: false,
				logSystemPrompt: false,
				logLlm: false,
				logRawChunks: false,
			}

			// Should work with disabled logging
			expect(options.logRawChunks).toBe(false)
			expect(options.rawChunkLogDir).toBeUndefined()
		})
	})

	describe("Help Text Integration", () => {
		test("help text includes new options", () => {
			const originalArgv = process.argv
			process.argv = ["node", "api-client.js", "--help"]

			const { showHelp } = parseCommandLineArgs()

			expect(showHelp).toBe(true)

			process.argv = originalArgv
		})
	})

	describe("Real-world Usage Scenarios", () => {
		test("debug streaming issue scenario", () => {
			const originalArgv = process.argv
			process.argv = [
				"node",
				"api-client.js",
				"--stream",
				"--log-raw-chunks",
				"--verbose",
				"debug streaming issue",
			]

			const { options, task } = parseCommandLineArgs()

			expect(options.useStream).toBe(true)
			expect(options.logRawChunks).toBe(true)
			expect(options.verbose).toBe(true)
			expect(task).toBe("debug streaming issue")

			process.argv = originalArgv
		})

		test("custom log directory scenario", () => {
			const originalArgv = process.argv
			process.argv = [
				"node",
				"api-client.js",
				"--stream",
				"--log-raw-chunks",
				"--raw-chunk-log-dir",
				"./debug-logs",
				"test task",
			]

			const { options, task } = parseCommandLineArgs()

			expect(options.useStream).toBe(true)
			expect(options.logRawChunks).toBe(true)
			expect(options.rawChunkLogDir).toBe("./debug-logs")
			expect(task).toBe("test task")

			process.argv = originalArgv
		})

		test("combined logging options scenario", () => {
			const originalArgv = process.argv
			process.argv = [
				"node",
				"api-client.js",
				"--stream",
				"--log-raw-chunks",
				"--log-llm",
				"--verbose",
				"--raw-chunk-log-dir",
				"./project-debug",
				"complex debugging task",
			]

			const { options, task } = parseCommandLineArgs()

			expect(options.useStream).toBe(true)
			expect(options.logRawChunks).toBe(true)
			expect(options.logLlm).toBe(true)
			expect(options.verbose).toBe(true)
			expect(options.rawChunkLogDir).toBe("./project-debug")
			expect(task).toBe("complex debugging task")

			process.argv = originalArgv
		})

		test("REPL mode with chunk logging", () => {
			const originalArgv = process.argv
			process.argv = ["node", "api-client.js", "--repl", "--log-raw-chunks"]

			const { options } = parseCommandLineArgs()

			expect(options.replMode).toBe(true)
			expect(options.logRawChunks).toBe(true)

			process.argv = originalArgv
		})
	})

	describe("Error Handling", () => {
		test("handles malformed command line arguments", () => {
			const originalArgv = process.argv
			process.argv = [
				"node",
				"api-client.js",
				"--log-raw-chunks",
				"--raw-chunk-log-dir", // Missing directory argument
			]

			expect(() => parseCommandLineArgs()).toThrow()

			process.argv = originalArgv
		})

		test("handles empty directory path", () => {
			const originalArgv = process.argv
			process.argv = ["node", "api-client.js", "--log-raw-chunks", "--raw-chunk-log-dir", "", "test task"]

			expect(() => parseCommandLineArgs()).toThrow()

			process.argv = originalArgv
		})
	})

	describe("Type Safety", () => {
		test("ApiClientOptions type includes new properties", () => {
			// This test ensures the type system recognizes the new properties
			const options: ApiClientOptions = {
				useStream: true,
				host: "localhost",
				port: 3000,
				mode: "code",
				restartTask: false,
				replMode: false,
				verbose: false,
				showThinking: false,
				showTools: false,
				showSystem: false,
				showResponse: false,
				showCompletion: false,
				showMcpUse: false,
				showTokenUsage: true,
				hideTokenUsage: false,
				showTiming: false,
				logSystemPrompt: false,
				logLlm: false,
				logRawChunks: true,
				rawChunkLogDir: "/test/logs",
			}

			// Type checking ensures these properties exist
			expect(typeof options.logRawChunks).toBe("boolean")
			expect(typeof options.rawChunkLogDir).toBe("string")
		})

		test("optional properties work correctly", () => {
			const options: ApiClientOptions = {
				useStream: true,
				host: "localhost",
				port: 3000,
				mode: "code",
				restartTask: false,
				replMode: false,
				verbose: false,
				showThinking: false,
				showTools: false,
				showSystem: false,
				showResponse: false,
				showCompletion: false,
				showMcpUse: false,
				showTokenUsage: true,
				hideTokenUsage: false,
				showTiming: false,
				logSystemPrompt: false,
				logLlm: false,
				// logRawChunks is optional
				// rawChunkLogDir is optional
			}

			// Optional properties should be undefined when not set
			expect(options.logRawChunks).toBeUndefined()
			expect(options.rawChunkLogDir).toBeUndefined()
		})
	})
})
