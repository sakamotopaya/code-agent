import { describe, it, expect, beforeEach, afterEach } from "@jest/globals"
import { TestHelpers } from "../utils/TestHelpers"
import * as fs from "fs/promises"
import * as path from "path"

describe("End-to-End User Journeys", () => {
	let testWorkspace: string

	beforeEach(async () => {
		testWorkspace = await TestHelpers.createTempWorkspace()
		process.chdir(testWorkspace)
	})

	afterEach(async () => {
		await TestHelpers.cleanupTempWorkspace(testWorkspace)
	})

	describe("New User Onboarding", () => {
		it("should guide user through first-time setup", async () => {
			// Test help command first
			const helpResult = await TestHelpers.runCLICommand(["--help"])
			expect(helpResult.exitCode).toBe(0)
			expect(helpResult.stdout).toMatch(/Usage:|Commands:|Options:/)

			// Test version command
			const versionResult = await TestHelpers.runCLICommand(["--version"])
			expect(versionResult.exitCode).toBe(0)
			expect(versionResult.stdout).toMatch(/\d+\.\d+\.\d+/)
		})

		it("should handle configuration initialization", async () => {
			// Create a basic config
			const config = {
				version: "1.0.0",
				settings: {
					theme: "dark",
					autoSave: true,
				},
			}

			await TestHelpers.createMockConfig(testWorkspace, config)

			// Verify config file exists and is readable
			const configPath = path.join(testWorkspace, ".roo-cli.json")
			const configExists = await fs
				.access(configPath)
				.then(() => true)
				.catch(() => false)
			expect(configExists).toBe(true)

			const loadedConfig = JSON.parse(await fs.readFile(configPath, "utf8"))
			expect(loadedConfig).toEqual(config)
		})
	})

	describe("Development Workflow", () => {
		it("should support complete project creation workflow", async () => {
			// Create a simple project
			await TestHelpers.createTestProject(testWorkspace, "simple")

			// Verify project structure
			const packageJsonExists = await fs
				.access(path.join(testWorkspace, "package.json"))
				.then(() => true)
				.catch(() => false)
			const indexJsExists = await fs
				.access(path.join(testWorkspace, "index.js"))
				.then(() => true)
				.catch(() => false)
			const readmeExists = await fs
				.access(path.join(testWorkspace, "README.md"))
				.then(() => true)
				.catch(() => false)

			expect(packageJsonExists).toBe(true)
			expect(indexJsExists).toBe(true)
			expect(readmeExists).toBe(true)

			// Verify package.json content
			const packageJson = JSON.parse(await fs.readFile(path.join(testWorkspace, "package.json"), "utf8"))
			expect(packageJson.name).toBe("test-project")
			expect(packageJson.version).toBe("1.0.0")
		})

		it("should support React project workflow", async () => {
			// Create a React project
			await TestHelpers.createTestProject(testWorkspace, "react")

			// Verify React-specific structure
			const srcExists = await fs
				.access(path.join(testWorkspace, "src"))
				.then(() => true)
				.catch(() => false)
			const publicExists = await fs
				.access(path.join(testWorkspace, "public"))
				.then(() => true)
				.catch(() => false)
			const appJsxExists = await fs
				.access(path.join(testWorkspace, "src", "App.jsx"))
				.then(() => true)
				.catch(() => false)

			expect(srcExists).toBe(true)
			expect(publicExists).toBe(true)
			expect(appJsxExists).toBe(true)

			// Verify package.json has React dependencies
			const packageJson = JSON.parse(await fs.readFile(path.join(testWorkspace, "package.json"), "utf8"))
			expect(packageJson.dependencies).toHaveProperty("react")
			expect(packageJson.dependencies).toHaveProperty("react-dom")
		})

		it("should support Node.js project workflow", async () => {
			// Create a Node.js project
			await TestHelpers.createTestProject(testWorkspace, "node")

			// Verify Node-specific structure
			const serverJsExists = await fs
				.access(path.join(testWorkspace, "server.js"))
				.then(() => true)
				.catch(() => false)
			const libExists = await fs
				.access(path.join(testWorkspace, "lib"))
				.then(() => true)
				.catch(() => false)
			const utilsExists = await fs
				.access(path.join(testWorkspace, "lib", "utils.js"))
				.then(() => true)
				.catch(() => false)

			expect(serverJsExists).toBe(true)
			expect(libExists).toBe(true)
			expect(utilsExists).toBe(true)

			// Verify package.json has correct scripts
			const packageJson = JSON.parse(await fs.readFile(path.join(testWorkspace, "package.json"), "utf8"))
			expect(packageJson.scripts).toHaveProperty("start")
			expect(packageJson.scripts).toHaveProperty("test")
		})
	})

	describe("File Management Workflows", () => {
		it("should handle file operations end-to-end", async () => {
			// Create test files
			const files = [
				{ name: "file1.txt", content: "Content 1" },
				{ name: "file2.md", content: "# Header\nContent 2" },
				{ name: "file3.json", content: '{"key": "value"}' },
			]

			for (const file of files) {
				await fs.writeFile(path.join(testWorkspace, file.name), file.content)
			}

			// Verify files exist and have correct content
			for (const file of files) {
				const filePath = path.join(testWorkspace, file.name)
				const content = await fs.readFile(filePath, "utf8")
				expect(content).toBe(file.content)
			}

			// Test file modification
			const modifiedContent = "Modified content"
			await fs.writeFile(path.join(testWorkspace, "file1.txt"), modifiedContent)

			const newContent = await fs.readFile(path.join(testWorkspace, "file1.txt"), "utf8")
			expect(newContent).toBe(modifiedContent)

			// Test file deletion
			await fs.unlink(path.join(testWorkspace, "file2.md"))

			const file2Exists = await fs
				.access(path.join(testWorkspace, "file2.md"))
				.then(() => true)
				.catch(() => false)
			expect(file2Exists).toBe(false)
		})

		it("should handle directory operations", async () => {
			// Create nested directory structure
			const dirs = ["level1", "level1/level2", "level1/level2/level3"]

			for (const dir of dirs) {
				await fs.mkdir(path.join(testWorkspace, dir), { recursive: true })
			}

			// Verify directory structure
			for (const dir of dirs) {
				const dirPath = path.join(testWorkspace, dir)
				const stats = await fs.stat(dirPath)
				expect(stats.isDirectory()).toBe(true)
			}

			// Add files to directories
			await fs.writeFile(path.join(testWorkspace, "level1", "file1.txt"), "Level 1 content")
			await fs.writeFile(path.join(testWorkspace, "level1", "level2", "file2.txt"), "Level 2 content")
			await fs.writeFile(path.join(testWorkspace, "level1", "level2", "level3", "file3.txt"), "Level 3 content")

			// Verify files in nested structure
			const level1File = await fs.readFile(path.join(testWorkspace, "level1", "file1.txt"), "utf8")
			const level2File = await fs.readFile(path.join(testWorkspace, "level1", "level2", "file2.txt"), "utf8")
			const level3File = await fs.readFile(
				path.join(testWorkspace, "level1", "level2", "level3", "file3.txt"),
				"utf8",
			)

			expect(level1File).toBe("Level 1 content")
			expect(level2File).toBe("Level 2 content")
			expect(level3File).toBe("Level 3 content")
		})
	})

	describe("Data Processing Workflows", () => {
		it("should handle JSON data processing", async () => {
			const testData = {
				users: [
					{ id: 1, name: "John Doe", email: "john@example.com" },
					{ id: 2, name: "Jane Smith", email: "jane@example.com" },
				],
				settings: {
					theme: "dark",
					notifications: true,
				},
			}

			// Write JSON data
			const jsonPath = path.join(testWorkspace, "data.json")
			await fs.writeFile(jsonPath, JSON.stringify(testData, null, 2))

			// Read and parse JSON data
			const rawData = await fs.readFile(jsonPath, "utf8")
			const parsedData = JSON.parse(rawData)

			expect(parsedData).toEqual(testData)
			expect(parsedData.users).toHaveLength(2)
			expect(parsedData.users[0].name).toBe("John Doe")
			expect(parsedData.settings.theme).toBe("dark")
		})

		it("should handle large data sets", async () => {
			const largeData = TestHelpers.generateTestData("large")
			expect(largeData).toHaveLength(10000)

			// Write large dataset to file
			const dataPath = path.join(testWorkspace, "large-data.json")
			await fs.writeFile(dataPath, JSON.stringify(largeData))

			// Read and verify
			const rawData = await fs.readFile(dataPath, "utf8")
			const parsedData = JSON.parse(rawData)

			expect(parsedData).toHaveLength(10000)
			expect(parsedData[0]).toHaveProperty("id")
			expect(parsedData[0]).toHaveProperty("name")
			expect(parsedData[0]).toHaveProperty("metadata")
		})
	})

	describe("Session Management Workflows", () => {
		it("should handle session lifecycle", async () => {
			const sessionData = {
				id: "test-session-" + Date.now(),
				created: new Date().toISOString(),
				data: {
					currentProject: testWorkspace,
					recentFiles: ["file1.txt", "file2.md"],
					preferences: {
						theme: "dark",
						autoSave: true,
					},
				},
			}

			// Create session
			const sessionPath = await TestHelpers.createTestSession(testWorkspace, sessionData)

			// Verify session was created
			const sessionExists = await fs
				.access(sessionPath)
				.then(() => true)
				.catch(() => false)
			expect(sessionExists).toBe(true)

			// Load session
			const loadedSession = JSON.parse(await fs.readFile(sessionPath, "utf8"))
			expect(loadedSession).toEqual(sessionData)

			// Update session
			loadedSession.data.recentFiles.push("file3.json")
			await fs.writeFile(sessionPath, JSON.stringify(loadedSession, null, 2))

			// Verify update
			const updatedSession = JSON.parse(await fs.readFile(sessionPath, "utf8"))
			expect(updatedSession.data.recentFiles).toHaveLength(3)
			expect(updatedSession.data.recentFiles).toContain("file3.json")
		})
	})

	describe("Error Recovery Workflows", () => {
		it("should handle file system errors gracefully", async () => {
			// Test reading non-existent file
			try {
				await fs.readFile(path.join(testWorkspace, "nonexistent.txt"), "utf8")
				fail("Should have thrown an error")
			} catch (error: any) {
				expect(error.code).toBe("ENOENT")
			}

			// Test writing to invalid path
			try {
				await fs.writeFile(path.join(testWorkspace, "invalid\0filename.txt"), "content")
				// Some systems might allow this, so we don't fail if it succeeds
			} catch (error: any) {
				expect(error.code).toMatch(/EINVAL|ENOENT/)
			}
		})

		it("should handle JSON parsing errors", () => {
			const invalidJson = '{"invalid": json content}'

			expect(() => JSON.parse(invalidJson)).toThrow()

			// Test with proper error handling
			try {
				JSON.parse(invalidJson)
			} catch (error) {
				expect(error).toBeInstanceOf(SyntaxError)
			}
		})
	})

	describe("Performance Workflows", () => {
		it("should handle operations within reasonable time limits", async () => {
			const startTime = Date.now()

			// Perform multiple operations
			await TestHelpers.createTestProject(testWorkspace, "simple")
			await fs.writeFile(path.join(testWorkspace, "large.txt"), "x".repeat(10000))
			await fs.readFile(path.join(testWorkspace, "package.json"), "utf8")

			const duration = Date.now() - startTime
			expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
		})

		it("should handle concurrent operations efficiently", async () => {
			const startTime = Date.now()

			// Perform concurrent file operations
			const operations = Array.from({ length: 10 }, (_, i) =>
				fs.writeFile(path.join(testWorkspace, `file-${i}.txt`), `Content ${i}`),
			)

			await Promise.all(operations)

			const duration = Date.now() - startTime
			expect(duration).toBeLessThan(3000) // Concurrent operations should be faster

			// Verify all files were created
			for (let i = 0; i < 10; i++) {
				const filePath = path.join(testWorkspace, `file-${i}.txt`)
				const content = await fs.readFile(filePath, "utf8")
				expect(content).toBe(`Content ${i}`)
			}
		})
	})

	describe("Configuration Workflows", () => {
		it("should handle configuration changes", async () => {
			// Create initial config
			const initialConfig = {
				version: "1.0.0",
				theme: "light",
				features: {
					autoSave: false,
					notifications: true,
				},
			}

			const configPath = await TestHelpers.createMockConfig(testWorkspace, initialConfig)

			// Modify config
			const updatedConfig = {
				...initialConfig,
				theme: "dark",
				features: {
					...initialConfig.features,
					autoSave: true,
				},
			}

			await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2))

			// Verify changes
			const loadedConfig = JSON.parse(await fs.readFile(configPath, "utf8"))
			expect(loadedConfig.theme).toBe("dark")
			expect(loadedConfig.features.autoSave).toBe(true)
			expect(loadedConfig.features.notifications).toBe(true)
		})
	})
})
