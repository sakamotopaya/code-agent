/**
 * Tests for LLMContentLogger
 */

import fs from "fs/promises"
import path from "path"
import {
	LLMContentLogger,
	getGlobalLLMContentLogger,
	initializeGlobalLLMContentLogger,
	closeGlobalLLMContentLogger,
} from "../XMLTagLogger"

describe("LLMContentLogger", () => {
	let tempDir: string
	let logger: LLMContentLogger

	beforeEach(async () => {
		// Create a temporary directory for test logs
		tempDir = await fs.mkdtemp(path.join(process.cwd(), "test-llm-logs-"))
	})

	afterEach(async () => {
		// Clean up
		if (logger) {
			await logger.close()
		}

		// Remove temp directory
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	it("should create a log file with timestamped name", async () => {
		logger = new LLMContentLogger(true, tempDir)
		await logger.initialize()

		const logPath = logger.getLogFilePath()
		expect(logPath).toMatch(/raw-llm-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/)
		expect(path.dirname(logPath)).toBe(tempDir)

		// Check file exists
		const stats = await fs.stat(logPath)
		expect(stats.isFile()).toBe(true)
	})

	it("should log content chunks with bullet separators", async () => {
		logger = new LLMContentLogger(true, tempDir)
		await logger.initialize()

		await logger.logContent("First chunk")
		await logger.logContent(" second chunk")
		await logger.logContent(" third chunk")

		await logger.close()

		// Read the log file
		const logContent = await fs.readFile(logger.getLogFilePath(), "utf-8")

		// Should contain content with bullet separators between chunks
		expect(logContent).toContain("First chunk• second chunk• third chunk")
	})

	it("should handle disabled logging", async () => {
		logger = new LLMContentLogger(false, tempDir)
		await logger.initialize()

		await logger.logContent("test content")

		expect(logger.isLoggingEnabled()).toBe(false)

		// Log file should not be created or should be empty
		try {
			const stats = await fs.stat(logger.getLogFilePath())
			if (stats.isFile()) {
				const content = await fs.readFile(logger.getLogFilePath(), "utf-8")
				expect(content).toBe("")
			}
		} catch (error) {
			// File doesn't exist, which is also fine
			expect(error.code).toBe("ENOENT")
		}
	})

	it("should write header when initialized", async () => {
		logger = new LLMContentLogger(true, tempDir)
		await logger.initialize()
		await logger.close()

		const logContent = await fs.readFile(logger.getLogFilePath(), "utf-8")
		expect(logContent).toMatch(/=== LLM Content Log - \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z ===/)
	})

	it("should handle empty content gracefully", async () => {
		logger = new LLMContentLogger(true, tempDir)
		await logger.initialize()

		await logger.logContent("")
		await logger.logContent("actual content")

		await logger.close()

		const logContent = await fs.readFile(logger.getLogFilePath(), "utf-8")

		// Should only contain the actual content, empty content should be ignored
		expect(logContent).toContain("actual content")
		expect(logContent).not.toContain("••") // Should not have double separators
	})

	it("should log complete conversation flow", async () => {
		logger = new LLMContentLogger(true, tempDir)
		await logger.initialize()

		// Simulate LLM conversation chunks
		await logger.logContent("I need to")
		await logger.logContent(" read a file")
		await logger.logContent(" <read_file>")
		await logger.logContent("<path>test.txt</path>")
		await logger.logContent("</read_file>")
		await logger.logContent(" The file contains...")

		await logger.close()

		const logContent = await fs.readFile(logger.getLogFilePath(), "utf-8")

		// Should contain complete conversation with separators
		expect(logContent).toContain(
			"I need to• read a file• <read_file>•<path>test.txt</path>•</read_file>• The file contains...",
		)
	})

	describe("Default logs directory behavior", () => {
		let originalLogsPath: string | undefined

		beforeEach(() => {
			// Save original environment variable
			originalLogsPath = process.env.LOGS_PATH
		})

		afterEach(() => {
			// Restore original environment variable
			if (originalLogsPath !== undefined) {
				process.env.LOGS_PATH = originalLogsPath
			} else {
				delete process.env.LOGS_PATH
			}
		})

		it("should use ./logs as default directory when no logDir provided", async () => {
			delete process.env.LOGS_PATH
			logger = new LLMContentLogger(true)

			const logPath = logger.getLogFilePath()
			expect(logPath).toMatch(/logs\/raw-llm-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/)
		})

		it("should use LOGS_PATH environment variable when set", async () => {
			const customLogsPath = path.join(tempDir, "custom-logs")
			process.env.LOGS_PATH = customLogsPath

			logger = new LLMContentLogger(true)

			const logPath = logger.getLogFilePath()
			expect(logPath).toMatch(
				new RegExp(
					`^${customLogsPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/raw-llm-\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}\\.log$`,
				),
			)
		})

		it("should prioritize explicit logDir over environment variable", async () => {
			process.env.LOGS_PATH = "/some/other/path"
			logger = new LLMContentLogger(true, tempDir)

			const logPath = logger.getLogFilePath()
			expect(path.dirname(logPath)).toBe(tempDir)
		})

		describe("Global Logger Functions", () => {
			let originalLogsPath: string | undefined
			let tempLogsDir: string

			beforeEach(async () => {
				// Save original environment variable
				originalLogsPath = process.env.LOGS_PATH

				// Create a temporary logs directory
				tempLogsDir = await fs.mkdtemp(path.join(process.cwd(), "test-global-logs-"))
				process.env.LOGS_PATH = tempLogsDir
			})

			afterEach(async () => {
				// Clean up global logger
				await closeGlobalLLMContentLogger()

				// Restore original environment variable
				if (originalLogsPath !== undefined) {
					process.env.LOGS_PATH = originalLogsPath
				} else {
					delete process.env.LOGS_PATH
				}

				// Remove temp directory
				try {
					await fs.rm(tempLogsDir, { recursive: true, force: true })
				} catch (error) {
					// Ignore cleanup errors
				}
			})

			it("should create new log file for each initialization", async () => {
				// First initialization
				await initializeGlobalLLMContentLogger()
				const firstLogger = getGlobalLLMContentLogger()
				const firstLogPath = firstLogger.getLogFilePath()

				await firstLogger.logContent("First interaction content")
				await closeGlobalLLMContentLogger()

				// Wait a moment to ensure different timestamps
				await new Promise((resolve) => setTimeout(resolve, 1100))

				// Second initialization should create a new log file
				await initializeGlobalLLMContentLogger()
				const secondLogger = getGlobalLLMContentLogger()
				const secondLogPath = secondLogger.getLogFilePath()

				await secondLogger.logContent("Second interaction content")
				await closeGlobalLLMContentLogger()

				// Log paths should be different (different timestamps)
				expect(firstLogPath).not.toBe(secondLogPath)

				// Both files should exist
				const firstStats = await fs.stat(firstLogPath)
				const secondStats = await fs.stat(secondLogPath)
				expect(firstStats.isFile()).toBe(true)
				expect(secondStats.isFile()).toBe(true)

				// Files should contain different content
				const firstContent = await fs.readFile(firstLogPath, "utf-8")
				const secondContent = await fs.readFile(secondLogPath, "utf-8")
				expect(firstContent).toContain("First interaction content")
				expect(secondContent).toContain("Second interaction content")
				expect(firstContent).not.toContain("Second interaction content")
				expect(secondContent).not.toContain("First interaction content")
			})

			it("should handle multiple initializations without closing", async () => {
				// First initialization
				await initializeGlobalLLMContentLogger()
				const firstLogger = getGlobalLLMContentLogger()
				const firstLogPath = firstLogger.getLogFilePath()

				await firstLogger.logContent("First content")

				// Wait a moment to ensure different timestamps
				await new Promise((resolve) => setTimeout(resolve, 1100))

				// Second initialization without explicit close should still create new logger
				await initializeGlobalLLMContentLogger()
				const secondLogger = getGlobalLLMContentLogger()
				const secondLogPath = secondLogger.getLogFilePath()

				await secondLogger.logContent("Second content")

				// Log paths should be different
				expect(firstLogPath).not.toBe(secondLogPath)

				// Both files should exist
				const firstStats = await fs.stat(firstLogPath)
				const secondStats = await fs.stat(secondLogPath)
				expect(firstStats.isFile()).toBe(true)
				expect(secondStats.isFile()).toBe(true)
			})

			it("should create timestamped log file names", async () => {
				await initializeGlobalLLMContentLogger()
				const logger = getGlobalLLMContentLogger()
				const logPath = logger.getLogFilePath()

				// Should match the expected timestamp format
				expect(logPath).toMatch(/raw-llm-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/)
				expect(path.dirname(logPath)).toBe(tempLogsDir)
			})
		})
	})
})
