import { CLIOutputLogger } from "../CLIOutputLogger"
import { promises as fs } from "fs"
import path from "path"
import { mkdtemp } from "fs/promises"

describe("CLIOutputLogger", () => {
	let tempDir: string
	let logger: CLIOutputLogger

	beforeEach(async () => {
		// Create a temporary directory for test logs
		tempDir = await mkdtemp(path.join(process.cwd(), "test-cli-output-logs-"))
		logger = new CLIOutputLogger(true, tempDir)
	})

	afterEach(async () => {
		// Clean up
		await logger.close()
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it("should create a timestamped log file", () => {
		const logPath = logger.getLogFilePath()
		expect(logPath).toMatch(/cli-output-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/)
		expect(path.dirname(logPath)).toBe(tempDir)
	})

	it("should log method calls with timestamp and separator", async () => {
		await logger.initialize()
		await logger.logMethodCall("testMethod", "test message", { additionalData: "value" })
		await logger.logMethodCall("anotherMethod", "another message")
		await logger.close()

		// Read the log file
		const logContent = await fs.readFile(logger.getLogFilePath(), "utf-8")

		// Check that the log contains the expected content
		expect(logContent).toContain("=== CLI Output Adapter Log -")
		expect(logContent).toContain("testMethod | test message")
		expect(logContent).toContain("anotherMethod | another message")
		expect(logContent).toContain('Additional: {"additionalData":"value"}')
		expect(logContent).toContain("-----")
	})

	it("should handle disabled logging", async () => {
		const disabledLogger = new CLIOutputLogger(false, tempDir)
		await disabledLogger.logMethodCall("testMethod", "test message")

		expect(disabledLogger.isLoggingEnabled()).toBe(false)
		// Log file should not be created when disabled
		expect(() => fs.access(disabledLogger.getLogFilePath())).rejects.toThrow()
	})

	it("should truncate long messages", async () => {
		await logger.initialize()
		const longMessage = "x".repeat(600) // More than the 500 char limit
		await logger.logMethodCall("testMethod", longMessage)
		await logger.close()

		const logContent = await fs.readFile(logger.getLogFilePath(), "utf-8")

		// Should contain truncated message
		const logLines = logContent.split("\n")
		const methodLine = logLines.find((line) => line.includes("testMethod"))
		expect(methodLine).toBeDefined()
		expect(methodLine!.length).toBeLessThan(longMessage.length + 100) // Account for timestamp and method name
	})
})
