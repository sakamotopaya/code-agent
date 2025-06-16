/**
 * Tests for LLMContentLogger
 */

import { promises as fs } from "fs"
import path from "path"
import { LLMContentLogger } from "../XMLTagLogger"

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
		expect(logPath).toMatch(/llm-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/)
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
})
