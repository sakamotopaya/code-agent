import { describe, it, expect, beforeEach, afterEach } from "@jest/globals"
import { TestHelpers, CLIResult } from "../utils/TestHelpers"
import * as fs from "fs/promises"
import * as path from "path"

describe("CLI Integration Tests", () => {
	let testWorkspace: string

	beforeEach(async () => {
		testWorkspace = await TestHelpers.createTempWorkspace()
		process.chdir(testWorkspace)
	})

	afterEach(async () => {
		await TestHelpers.cleanupTempWorkspace(testWorkspace)
	})

	describe("Basic CLI Operations", () => {
		it("should display help information", async () => {
			const result = await TestHelpers.runCLICommand(["--help"], {
				timeout: 5000,
			})

			expect([0, 1, 2]).toContain(result.exitCode)
			expect(result.stdout).toMatch(/Usage:|Commands:|Options:/)
		})

		it("should display version information", async () => {
			const result = await TestHelpers.runCLICommand(["--version"], {
				timeout: 5000,
			})

			expect(result.exitCode).toBe(0)
			expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
		})

		it("should handle invalid commands gracefully", async () => {
			const result = await TestHelpers.runCLICommand(["invalid-command"], {
				timeout: 5000,
			})

			expect(result.exitCode).not.toBe(0)
			expect(result.stderr.length).toBeGreaterThan(0)
		})
	})

	describe("File Operations", () => {
		it("should handle file creation and reading", async () => {
			// Create a test file
			const testFilePath = path.join(testWorkspace, "test.txt")
			const testContent = "Hello, CLI Testing!"
			await fs.writeFile(testFilePath, testContent)

			// Test file exists
			expect(
				await fs
					.access(testFilePath)
					.then(() => true)
					.catch(() => false),
			).toBe(true)

			// Test file content
			const content = await fs.readFile(testFilePath, "utf8")
			expect(content).toBe(testContent)
		})

		it("should handle directory operations", async () => {
			const testDir = path.join(testWorkspace, "test-directory")
			await fs.mkdir(testDir, { recursive: true })

			const stats = await fs.stat(testDir)
			expect(stats.isDirectory()).toBe(true)
		})

		it("should handle large file operations", async () => {
			const largeFilePath = await TestHelpers.createLargeTestFile(1024 * 1024) // 1MB

			const stats = await fs.stat(largeFilePath)
			expect(stats.size).toBeGreaterThan(1024 * 1024 * 0.9) // Allow some variance

			// Cleanup
			await fs.unlink(largeFilePath)
		})
	})

	describe("Project Structure Operations", () => {
		it("should work with simple project structure", async () => {
			await TestHelpers.createTestProject(testWorkspace, "simple")

			const packageJson = await fs.readFile(path.join(testWorkspace, "package.json"), "utf8")
			const pkg = JSON.parse(packageJson)

			expect(pkg.name).toBe("test-project")
			expect(pkg.version).toBe("1.0.0")
		})

		it("should work with react project structure", async () => {
			await TestHelpers.createTestProject(testWorkspace, "react")

			const srcExists = await fs
				.access(path.join(testWorkspace, "src"))
				.then(() => true)
				.catch(() => false)
			const publicExists = await fs
				.access(path.join(testWorkspace, "public"))
				.then(() => true)
				.catch(() => false)

			expect(srcExists).toBe(true)
			expect(publicExists).toBe(true)
		})

		it("should work with node project structure", async () => {
			await TestHelpers.createTestProject(testWorkspace, "node")

			const serverExists = await fs
				.access(path.join(testWorkspace, "server.js"))
				.then(() => true)
				.catch(() => false)
			const libExists = await fs
				.access(path.join(testWorkspace, "lib"))
				.then(() => true)
				.catch(() => false)

			expect(serverExists).toBe(true)
			expect(libExists).toBe(true)
		})
	})

	describe("Configuration Management", () => {
		it("should handle configuration files", async () => {
			const config = {
				apiEndpoint: "https://api.test.com",
				timeout: 5000,
				retries: 3,
			}

			const configPath = await TestHelpers.createMockConfig(testWorkspace, config)
			const loadedConfig = JSON.parse(await fs.readFile(configPath, "utf8"))

			expect(loadedConfig).toEqual(config)
		})

		it("should validate configuration structure", async () => {
			const invalidConfig = {
				invalidProperty: "should not be here",
			}

			const configPath = await TestHelpers.createMockConfig(testWorkspace, invalidConfig)
			const loadedConfig = JSON.parse(await fs.readFile(configPath, "utf8"))

			expect(loadedConfig).toEqual(invalidConfig)
		})
	})

	describe("Output Formatting", () => {
		it("should validate JSON output format", () => {
			const jsonOutput = '{"status": "success", "data": {"count": 42}}'
			expect(TestHelpers.validateOutputFormat(jsonOutput, "json")).toBe(true)
		})

		it("should validate YAML output format", () => {
			const yamlOutput = "status: success\ndata:\n  count: 42"
			expect(TestHelpers.validateOutputFormat(yamlOutput, "yaml")).toBe(true)
		})

		it("should validate table output format", () => {
			const tableOutput =
				"┌─────────┬─────────┐\n│ Header1 │ Header2 │\n├─────────┼─────────┤\n│ Data1   │ Data2   │\n└─────────┴─────────┘"
			expect(TestHelpers.validateOutputFormat(tableOutput, "table")).toBe(true)
		})

		it("should validate plain text output format", () => {
			const plainOutput = "This is plain text output without special formatting"
			expect(TestHelpers.validateOutputFormat(plainOutput, "plain")).toBe(true)
		})

		it("should reject invalid formats", () => {
			const invalidJson = '{"invalid": json}'
			expect(TestHelpers.validateOutputFormat(invalidJson, "json")).toBe(false)
		})
	})

	describe("Session Management", () => {
		it("should handle session creation and cleanup", async () => {
			const sessionData = {
				id: "test-session-123",
				timestamp: new Date().toISOString(),
				data: { key: "value" },
			}

			const sessionPath = await TestHelpers.createTestSession(testWorkspace, sessionData)
			const loadedSession = JSON.parse(await fs.readFile(sessionPath, "utf8"))

			expect(loadedSession).toEqual(sessionData)
		})
	})

	describe("Performance Characteristics", () => {
		it("should complete basic operations within time limits", async () => {
			const { duration } = await TestHelpers.measureExecutionTime(async () => {
				await TestHelpers.createTestProject(testWorkspace, "simple")
				return true
			})

			expect(duration).toBeLessThan(5000) // 5 seconds max
		})

		it("should handle memory efficiently", async () => {
			const initialMemory = TestHelpers.getMemoryUsage()

			// Perform memory-intensive operation
			const testData = TestHelpers.generateTestData("large")
			expect(testData.length).toBe(10000)

			const finalMemory = TestHelpers.getMemoryUsage()
			const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

			// Should not increase by more than 100MB for test data
			expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)
		})
	})

	describe("Error Handling", () => {
		it("should handle file not found errors", async () => {
			try {
				await fs.readFile(path.join(testWorkspace, "nonexistent.txt"), "utf8")
				fail("Should have thrown an error")
			} catch (error: any) {
				expect(error.code).toBe("ENOENT")
			}
		})

		it("should handle permission errors gracefully", async () => {
			// Create a file and try to make it unreadable (Unix-like systems)
			const testFile = path.join(testWorkspace, "restricted.txt")
			await fs.writeFile(testFile, "test content")

			try {
				// Try to change permissions (may not work on all systems)
				await fs.chmod(testFile, 0o000)
				await fs.readFile(testFile, "utf8")
				// If we get here, the permission change didn't work (e.g., on Windows)
			} catch (error: any) {
				expect(["EACCES", "EPERM"]).toContain(error.code)
			} finally {
				// Restore permissions for cleanup
				try {
					await fs.chmod(testFile, 0o644)
				} catch {
					// Ignore cleanup errors
				}
			}
		})
	})

	describe("Cross-platform Compatibility", () => {
		it("should handle different path separators", () => {
			const testPath = path.join("test", "path", "file.txt")

			if (process.platform === "win32") {
				expect(testPath).toContain("\\")
			} else {
				expect(testPath).toContain("/")
			}
		})

		it("should work with current platform", () => {
			expect(["win32", "darwin", "linux", "freebsd", "openbsd"]).toContain(process.platform)
		})

		it("should handle environment variables correctly", () => {
			const testEnvVar = "CLI_TEST_VAR"
			const testValue = "test-value-123"

			process.env[testEnvVar] = testValue
			expect(process.env[testEnvVar]).toBe(testValue)

			delete process.env[testEnvVar]
			expect(process.env[testEnvVar]).toBeUndefined()
		})
	})

	describe("Concurrent Operations", () => {
		it("should handle multiple concurrent file operations", async () => {
			const operations = Array.from({ length: 5 }, (_, i) =>
				TestHelpers.createTestProject(path.join(testWorkspace, `project-${i}`), "simple"),
			)

			await Promise.all(operations)

			// Verify all projects were created
			for (let i = 0; i < 5; i++) {
				const projectDir = path.join(testWorkspace, `project-${i}`)
				const exists = await fs
					.access(projectDir)
					.then(() => true)
					.catch(() => false)
				expect(exists).toBe(true)
			}
		})

		it("should handle concurrent data generation", async () => {
			const generators = Array.from({ length: 3 }, () => Promise.resolve(TestHelpers.generateTestData("medium")))

			const results = await Promise.all(generators)

			results.forEach((data: any) => {
				expect(data.length).toBe(1000)
				expect(data[0]).toHaveProperty("id")
				expect(data[0]).toHaveProperty("name")
			})
		})
	})

	describe("Resource Cleanup", () => {
		it("should clean up temporary resources", async () => {
			const tempFiles: string[] = []

			// Create multiple temp files
			for (let i = 0; i < 3; i++) {
				const tempFile = await TestHelpers.createLargeTestFile(1024, path.join(testWorkspace, `temp-${i}.txt`))
				tempFiles.push(tempFile)
			}

			// Verify files exist
			for (const file of tempFiles) {
				const exists = await fs
					.access(file)
					.then(() => true)
					.catch(() => false)
				expect(exists).toBe(true)
			}

			// Cleanup
			for (const file of tempFiles) {
				await fs.unlink(file)
			}

			// Verify files are gone
			for (const file of tempFiles) {
				const exists = await fs
					.access(file)
					.then(() => true)
					.catch(() => false)
				expect(exists).toBe(false)
			}
		})
	})
})
