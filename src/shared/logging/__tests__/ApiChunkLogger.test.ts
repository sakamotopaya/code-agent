/**
 * Unit tests for ApiChunkLogger
 */

import fs from "fs/promises"
import path from "path"
import {
	ApiChunkLogger,
	getGlobalApiChunkLogger,
	initializeGlobalApiChunkLogger,
	closeGlobalApiChunkLogger,
} from "../ApiChunkLogger"
import { ApiChunkLogContext } from "../types"

// Mock fs module
jest.mock("fs/promises")
const mockFs = fs as jest.Mocked<typeof fs>

// Mock path module for consistent testing
jest.mock("path", () => ({
	...jest.requireActual("path"),
	join: jest.fn((...args) => args.join("/")),
}))

// Mock getGlobalStoragePath
jest.mock("../../paths", () => ({
	getGlobalStoragePath: jest.fn(() => "/test/global/storage"),
}))

describe("ApiChunkLogger", () => {
	let mockContext: ApiChunkLogContext
	let tempDir: string

	beforeEach(() => {
		jest.clearAllMocks()
		tempDir = "/tmp/test-logs"
		mockContext = {
			taskId: "test-task-123",
			requestId: "req-456",
			host: "localhost",
			port: 3000,
			endpoint: "/api/v1/task/stream",
			timestamp: "2025-01-17T12:34:56.789Z",
			requestMetadata: {
				mode: "code",
				useStream: true,
			},
		}

		// Mock fs operations
		mockFs.mkdir.mockResolvedValue(undefined)
		mockFs.appendFile.mockResolvedValue(undefined)
	})

	afterEach(async () => {
		await closeGlobalApiChunkLogger()
	})

	describe("Constructor and Initialization", () => {
		test("creates logger with default configuration", () => {
			const logger = new ApiChunkLogger()

			expect(logger.isLoggingEnabled()).toBe(true)
			expect(logger.getLogFilePath()).toMatch(/raw-api-chunks-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/)
		})

		test("creates logger with custom directory", () => {
			const logger = new ApiChunkLogger(true, tempDir)

			expect(logger.isLoggingEnabled()).toBe(true)
			expect(logger.getLogFilePath()).toContain(tempDir)
		})

		test("handles disabled logging", () => {
			const logger = new ApiChunkLogger(false)

			expect(logger.isLoggingEnabled()).toBe(false)
		})

		test("initializes with request context", async () => {
			const logger = new ApiChunkLogger(true, tempDir)
			await logger.initialize(mockContext)

			expect(mockFs.mkdir).toHaveBeenCalledWith(tempDir, { recursive: true })
			expect(mockFs.appendFile).toHaveBeenCalledWith(
				expect.stringContaining("raw-api-chunks-"),
				expect.stringContaining("=== API Chunk Log - 2025-01-17T12:34:56.789Z ==="),
			)
			expect(logger.getContext()).toEqual(mockContext)
		})

		test("handles file creation errors gracefully", async () => {
			const consoleSpy = jest.spyOn(console, "error").mockImplementation()
			mockFs.mkdir.mockRejectedValue(new Error("Permission denied"))

			const logger = new ApiChunkLogger(true, tempDir)
			await logger.initialize(mockContext)

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to initialize log file"))
			expect(logger.isLoggingEnabled()).toBe(false)

			consoleSpy.mockRestore()
		})
	})

	describe("Chunk Logging", () => {
		let logger: ApiChunkLogger

		beforeEach(async () => {
			logger = new ApiChunkLogger(true, tempDir)
			await logger.initialize(mockContext)
		})

		test("logs first chunk without separator", async () => {
			const chunk = 'data: {"type":"start","taskId":"123"}'
			await logger.logChunk(chunk)

			expect(mockFs.appendFile).toHaveBeenLastCalledWith(expect.stringContaining("raw-api-chunks-"), chunk)
			expect(logger.getSequenceNumber()).toBe(1)
		})

		test("logs subsequent chunks with bullet separator", async () => {
			const chunk1 = 'data: {"type":"start"}'
			const chunk2 = 'data: {"type":"text","content":"hello"}'

			await logger.logChunk(chunk1)
			await logger.logChunk(chunk2)

			expect(mockFs.appendFile).toHaveBeenNthCalledWith(
				2, // Skip header call
				expect.stringContaining("raw-api-chunks-"),
				chunk1,
			)
			expect(mockFs.appendFile).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining("raw-api-chunks-"),
				`•${chunk2}`,
			)
			expect(logger.getSequenceNumber()).toBe(2)
		})

		test("handles empty chunks", async () => {
			await logger.logChunk("")

			// Should not call appendFile for empty chunks
			expect(mockFs.appendFile).toHaveBeenCalledTimes(1) // Only header
		})

		test("handles large chunks", async () => {
			const largeChunk = "data: " + "x".repeat(10000)
			await logger.logChunk(largeChunk)

			expect(mockFs.appendFile).toHaveBeenLastCalledWith(expect.stringContaining("raw-api-chunks-"), largeChunk)
		})

		test("maintains chunk order", async () => {
			const chunks = [
				'data: {"type":"start"}',
				'data: {"type":"text","content":"hello"}',
				'data: {"type":"text","content":" world"}',
				'data: {"type":"completion"}',
			]

			for (const chunk of chunks) {
				await logger.logChunk(chunk)
			}

			expect(logger.getSequenceNumber()).toBe(4)
			expect(mockFs.appendFile).toHaveBeenCalledTimes(5) // Header + 4 chunks
		})

		test("handles write errors gracefully", async () => {
			const consoleSpy = jest.spyOn(console, "error").mockImplementation()
			mockFs.appendFile.mockRejectedValue(new Error("Disk full"))

			await logger.logChunk('data: {"type":"test"}')

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to write to log"))

			consoleSpy.mockRestore()
		})
	})

	describe("Context Management", () => {
		let logger: ApiChunkLogger

		beforeEach(async () => {
			logger = new ApiChunkLogger(true, tempDir)
			await logger.initialize(mockContext)
		})

		test("updates context during logging", () => {
			const updates = { taskId: "updated-task-456" }
			logger.updateContext(updates)

			const context = logger.getContext()
			expect(context?.taskId).toBe("updated-task-456")
			expect(context?.requestId).toBe("req-456") // Original value preserved
		})

		test("handles missing context fields", async () => {
			const minimalContext: ApiChunkLogContext = {
				host: "localhost",
				port: 3000,
				endpoint: "/api/test",
				timestamp: "2025-01-17T12:34:56.789Z",
			}

			const logger = new ApiChunkLogger(true, tempDir)
			await logger.initialize(minimalContext)

			expect(mockFs.appendFile).toHaveBeenCalledWith(
				expect.stringContaining("raw-api-chunks-"),
				expect.not.stringContaining("Task ID:"),
			)
		})

		test("writes proper log header", async () => {
			const logger = new ApiChunkLogger(true, tempDir)
			await logger.initialize(mockContext)

			const expectedHeader = [
				"=== API Chunk Log - 2025-01-17T12:34:56.789Z ===",
				"Host: localhost:3000",
				"Endpoint: /api/v1/task/stream",
				"Task ID: test-task-123",
				"Request ID: req-456",
				expect.stringContaining("Request Metadata:"),
				"===",
				"",
			].join("\n")

			expect(mockFs.appendFile).toHaveBeenCalledWith(expect.stringContaining("raw-api-chunks-"), expectedHeader)
		})
	})

	describe("File Operations", () => {
		test("creates timestamped log files", () => {
			const logger = new ApiChunkLogger(true, tempDir)
			const logPath = logger.getLogFilePath()

			expect(logPath).toMatch(/raw-api-chunks-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/)
			expect(logPath).toContain(tempDir)
		})

		test("properly closes files", async () => {
			const logger = new ApiChunkLogger(true, tempDir)
			await logger.initialize(mockContext)
			await logger.close()

			expect(mockFs.appendFile).toHaveBeenLastCalledWith(
				expect.stringContaining("raw-api-chunks-"),
				expect.stringContaining("=== End of API Chunk Log -"),
			)
		})

		test("resets state after close", async () => {
			const logger = new ApiChunkLogger(true, tempDir)
			await logger.initialize(mockContext)
			await logger.logChunk("test chunk")
			await logger.close()

			expect(logger.getSequenceNumber()).toBe(0)
			expect(logger.getContext()).toBeNull()
		})

		test("handles close errors gracefully", async () => {
			const consoleSpy = jest.spyOn(console, "error").mockImplementation()
			mockFs.appendFile.mockRejectedValue(new Error("Write error"))

			const logger = new ApiChunkLogger(true, tempDir)
			await logger.initialize(mockContext)
			await logger.close()

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to write log footer"))

			consoleSpy.mockRestore()
		})
	})

	describe("Global Logger Functions", () => {
		test("gets global logger instance", () => {
			const logger = getGlobalApiChunkLogger()

			expect(logger).toBeInstanceOf(ApiChunkLogger)
			expect(logger.isLoggingEnabled()).toBe(true)
		})

		test("initializes global logger with context", async () => {
			await initializeGlobalApiChunkLogger(mockContext)
			const logger = getGlobalApiChunkLogger()

			expect(logger.getContext()).toEqual(mockContext)
		})

		test("closes existing logger before creating new one", async () => {
			await initializeGlobalApiChunkLogger(mockContext)
			const firstLogger = getGlobalApiChunkLogger()

			await initializeGlobalApiChunkLogger(mockContext)
			const secondLogger = getGlobalApiChunkLogger()

			expect(firstLogger).not.toBe(secondLogger)
		})

		test("handles global storage path errors", async () => {
			const consoleSpy = jest.spyOn(console, "warn").mockImplementation()
			const { getGlobalStoragePath } = require("../../paths")
			getGlobalStoragePath.mockImplementation(() => {
				throw new Error("Storage path error")
			})

			const logger = getGlobalApiChunkLogger()

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to get global storage path"))
			expect(logger.getLogFilePath()).toContain("logs")

			consoleSpy.mockRestore()
		})
	})

	describe("Edge Cases and Error Handling", () => {
		test("handles disabled logging gracefully", async () => {
			const logger = new ApiChunkLogger(false, tempDir)
			await logger.initialize(mockContext)
			await logger.logChunk("test chunk")
			await logger.close()

			expect(mockFs.mkdir).not.toHaveBeenCalled()
			expect(mockFs.appendFile).not.toHaveBeenCalled()
		})

		test("handles null context updates", () => {
			const logger = new ApiChunkLogger(true, tempDir)
			logger.updateContext({ taskId: "test" })

			expect(logger.getContext()).toBeNull()
		})

		test("handles multiple rapid chunk logging", async () => {
			const logger = new ApiChunkLogger(true, tempDir)
			await logger.initialize(mockContext)

			const promises = []
			for (let i = 0; i < 100; i++) {
				promises.push(logger.logChunk(`chunk-${i}`))
			}

			await Promise.all(promises)
			expect(logger.getSequenceNumber()).toBe(100)
		})
	})
})
