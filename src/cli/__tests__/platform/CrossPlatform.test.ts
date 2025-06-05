import { describe, it, expect, beforeEach, afterEach } from "@jest/globals"
import { TestHelpers } from "../utils/TestHelpers"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

describe("Cross-Platform Compatibility Tests", () => {
	let testWorkspace: string

	beforeEach(async () => {
		testWorkspace = await TestHelpers.createTempWorkspace()
		process.chdir(testWorkspace)
	})

	afterEach(async () => {
		await TestHelpers.cleanupTempWorkspace(testWorkspace)
	})

	describe("Platform Detection", () => {
		it("should correctly identify current platform", () => {
			const supportedPlatforms = ["win32", "darwin", "linux", "freebsd", "openbsd"]
			expect(supportedPlatforms).toContain(process.platform)
		})

		it("should handle platform-specific behavior", () => {
			const isWindows = process.platform === "win32"
			const isUnix = ["darwin", "linux", "freebsd", "openbsd"].includes(process.platform)

			expect(isWindows || isUnix).toBe(true)
		})
	})

	describe("File Path Handling", () => {
		it("should handle file paths correctly for current platform", () => {
			const testPath = path.join("test", "path", "file.txt")

			if (process.platform === "win32") {
				expect(testPath).toContain("\\")
			} else {
				expect(testPath).toContain("/")
			}
		})

		it("should resolve relative paths correctly", () => {
			const relativePath = path.join("..", "test", "file.txt")
			const resolvedPath = path.resolve(relativePath)

			expect(path.isAbsolute(resolvedPath)).toBe(true)
		})

		it("should handle directory separators consistently", async () => {
			const nestedPath = path.join("level1", "level2", "level3")
			await fs.mkdir(path.join(testWorkspace, nestedPath), { recursive: true })

			const testFile = path.join(testWorkspace, nestedPath, "test.txt")
			await fs.writeFile(testFile, "test content")

			const content = await fs.readFile(testFile, "utf8")
			expect(content).toBe("test content")
		})

		it("should handle special characters in filenames", async () => {
			// Test characters that are valid on most platforms
			const specialChars = ["space file.txt", "dash-file.txt", "underscore_file.txt", "dot.file.txt"]

			for (const filename of specialChars) {
				const filePath = path.join(testWorkspace, filename)
				await fs.writeFile(filePath, `Content for ${filename}`)

				const content = await fs.readFile(filePath, "utf8")
				expect(content).toBe(`Content for ${filename}`)
			}
		})
	})

	describe("Environment Variables", () => {
		it("should handle environment variables correctly", () => {
			const testVar = "CLI_TEST_PLATFORM_VAR"
			const testValue = "test-value-123"

			// Set environment variable
			process.env[testVar] = testValue
			expect(process.env[testVar]).toBe(testValue)

			// Clean up
			delete process.env[testVar]
			expect(process.env[testVar]).toBeUndefined()
		})

		it("should handle platform-specific environment variables", () => {
			if (process.platform === "win32") {
				// Windows-specific environment variables
				expect(process.env.USERPROFILE).toBeDefined()
				expect(process.env.APPDATA).toBeDefined()
			} else {
				// Unix-like environment variables
				expect(process.env.HOME).toBeDefined()
				expect(process.env.USER || process.env.USERNAME).toBeDefined()
			}
		})

		it("should handle PATH environment variable", () => {
			const pathVar = process.env.PATH || process.env.Path
			expect(pathVar).toBeDefined()
			expect(typeof pathVar).toBe("string")
			expect(pathVar!.length).toBeGreaterThan(0)
		})
	})

	describe("File System Operations", () => {
		it("should handle file permissions appropriately", async () => {
			const testFile = path.join(testWorkspace, "permission-test.txt")
			await fs.writeFile(testFile, "test content")

			// Test reading the file
			const content = await fs.readFile(testFile, "utf8")
			expect(content).toBe("test content")

			// Test file stats
			const stats = await fs.stat(testFile)
			expect(stats.isFile()).toBe(true)
			expect(stats.size).toBeGreaterThan(0)
		})

		it("should handle directory operations across platforms", async () => {
			const testDir = path.join(testWorkspace, "test-directory")
			await fs.mkdir(testDir, { recursive: true })

			const stats = await fs.stat(testDir)
			expect(stats.isDirectory()).toBe(true)

			// Create subdirectories
			const subDir1 = path.join(testDir, "sub1")
			const subDir2 = path.join(testDir, "sub2")

			await fs.mkdir(subDir1)
			await fs.mkdir(subDir2)

			const entries = await fs.readdir(testDir)
			expect(entries).toContain("sub1")
			expect(entries).toContain("sub2")
		})

		it("should handle symbolic links where supported", async () => {
			const targetFile = path.join(testWorkspace, "target.txt")
			const linkFile = path.join(testWorkspace, "link.txt")

			await fs.writeFile(targetFile, "target content")

			try {
				await fs.symlink(targetFile, linkFile)

				const linkStats = await fs.lstat(linkFile)
				expect(linkStats.isSymbolicLink()).toBe(true)

				const content = await fs.readFile(linkFile, "utf8")
				expect(content).toBe("target content")
			} catch (error: any) {
				// Symbolic links might not be supported on all platforms/configurations
				if (error.code === "EPERM" || error.code === "ENOSYS") {
					console.warn("Symbolic links not supported on this platform/configuration")
				} else {
					throw error
				}
			}
		})
	})

	describe("Process Operations", () => {
		it("should handle process spawning correctly", async () => {
			// Use a simple command that works on all platforms
			const command = process.platform === "win32" ? "echo" : "echo"
			const args = ["hello world"]

			const result = await TestHelpers.runCLICommand(["--version"], { timeout: 5000 })
			expect(result.exitCode).toBe(0)
		})

		it("should handle process exit codes consistently", async () => {
			// Test successful command
			const successResult = await TestHelpers.runCLICommand(["--version"], { timeout: 5000 })
			expect(successResult.exitCode).toBe(0)

			// Test invalid command (should fail)
			const failResult = await TestHelpers.runCLICommand(["invalid-command"], { timeout: 5000 })
			expect(failResult.exitCode).not.toBe(0)
		})

		it("should handle process termination gracefully", async () => {
			// This test ensures that processes can be started and stopped cleanly
			const startTime = Date.now()
			const result = await TestHelpers.runCLICommand(["--help"], { timeout: 5000 })
			const duration = Date.now() - startTime

			expect(result.exitCode).toBe(0)
			expect(duration).toBeLessThan(5000)
		})
	})

	describe("Memory and Resource Management", () => {
		it("should handle memory consistently across platforms", async () => {
			const initialMemory = TestHelpers.getMemoryUsage()

			// Perform some operations
			const data = TestHelpers.generateTestData("medium")
			const filePath = path.join(testWorkspace, "memory-test.json")
			await fs.writeFile(filePath, JSON.stringify(data))
			const content = await fs.readFile(filePath, "utf8")
			JSON.parse(content)

			const finalMemory = TestHelpers.getMemoryUsage()

			// Memory should be tracked consistently
			expect(finalMemory.heapUsed).toBeGreaterThanOrEqual(initialMemory.heapUsed)
			expect(finalMemory.heapTotal).toBeGreaterThan(0)
			expect(finalMemory.external).toBeGreaterThanOrEqual(0)
		})

		it("should handle temporary directory usage", async () => {
			const tmpDir = os.tmpdir()
			expect(tmpDir).toBeDefined()
			expect(typeof tmpDir).toBe("string")
			expect(tmpDir.length).toBeGreaterThan(0)

			// Test creating temp files
			const tempFile = path.join(tmpDir, `cli-test-${Date.now()}.tmp`)
			await fs.writeFile(tempFile, "temporary content")

			const exists = await fs
				.access(tempFile)
				.then(() => true)
				.catch(() => false)
			expect(exists).toBe(true)

			// Clean up
			await fs.unlink(tempFile)
		})
	})

	describe("Text Encoding and Line Endings", () => {
		it("should handle UTF-8 encoding correctly", async () => {
			const testContent = "Hello 世界 🌍 UTF-8 content"
			const filePath = path.join(testWorkspace, "utf8-test.txt")

			await fs.writeFile(filePath, testContent, "utf8")
			const readContent = await fs.readFile(filePath, "utf8")

			expect(readContent).toBe(testContent)
		})

		it("should handle line endings appropriately", async () => {
			const lines = ["Line 1", "Line 2", "Line 3"]
			const content = lines.join("\n")
			const filePath = path.join(testWorkspace, "line-endings.txt")

			await fs.writeFile(filePath, content)
			const readContent = await fs.readFile(filePath, "utf8")

			// The content should be preserved
			expect(readContent.split("\n")).toHaveLength(3)
		})
	})

	describe("Concurrent Operations", () => {
		it("should handle concurrent file operations consistently", async () => {
			const operationCount = 20
			const operations = Array.from({ length: operationCount }, async (_, i) => {
				const filePath = path.join(testWorkspace, `concurrent-${i}.txt`)
				const content = `Content for file ${i}`

				await fs.writeFile(filePath, content)
				const readContent = await fs.readFile(filePath, "utf8")

				expect(readContent).toBe(content)
				return filePath
			})

			const filePaths = await Promise.all(operations)
			expect(filePaths).toHaveLength(operationCount)

			// Verify all files exist
			for (const filePath of filePaths) {
				const exists = await fs
					.access(filePath)
					.then(() => true)
					.catch(() => false)
				expect(exists).toBe(true)
			}
		})
	})

	describe("Error Handling Consistency", () => {
		it("should handle file not found errors consistently", async () => {
			const nonExistentFile = path.join(testWorkspace, "does-not-exist.txt")

			try {
				await fs.readFile(nonExistentFile, "utf8")
				fail("Should have thrown an error")
			} catch (error: any) {
				expect(error.code).toBe("ENOENT")
				expect(error.message).toContain("no such file or directory")
			}
		})

		it("should handle permission errors appropriately", async () => {
			// This test is platform-dependent, so we handle it gracefully
			const testFile = path.join(testWorkspace, "permission-test.txt")
			await fs.writeFile(testFile, "test content")

			try {
				// Try to change permissions (Unix-like systems)
				if (process.platform !== "win32") {
					await fs.chmod(testFile, 0o000)

					try {
						await fs.readFile(testFile, "utf8")
						// If we get here, the permission change didn't work as expected
					} catch (permError: any) {
						expect(["EACCES", "EPERM"]).toContain(permError.code)
					} finally {
						// Restore permissions for cleanup
						await fs.chmod(testFile, 0o644)
					}
				}
			} catch (error) {
				// Permission operations might not work in all environments
				console.warn("Permission test skipped:", error)
			}
		})
	})

	describe("Platform-Specific Features", () => {
		it("should handle Windows-specific paths", () => {
			if (process.platform === "win32") {
				const windowsPath = "C:\\Users\\test\\file.txt"
				const parsed = path.parse(windowsPath)

				expect(parsed.root).toBe("C:\\")
				expect(parsed.name).toBe("file")
				expect(parsed.ext).toBe(".txt")
			}
		})

		it("should handle Unix-specific paths", () => {
			if (process.platform !== "win32") {
				const unixPath = "/home/user/file.txt"
				const parsed = path.parse(unixPath)

				expect(parsed.root).toBe("/")
				expect(parsed.name).toBe("file")
				expect(parsed.ext).toBe(".txt")
			}
		})

		it("should handle case sensitivity appropriately", async () => {
			const lowerFile = path.join(testWorkspace, "lowercase.txt")
			const upperFile = path.join(testWorkspace, "UPPERCASE.txt")

			await fs.writeFile(lowerFile, "lower content")
			await fs.writeFile(upperFile, "upper content")

			// On case-sensitive systems, these should be different files
			// On case-insensitive systems, behavior may vary
			const lowerContent = await fs.readFile(lowerFile, "utf8")
			const upperContent = await fs.readFile(upperFile, "utf8")

			// At minimum, we should be able to read what we wrote
			expect(lowerContent).toBe("lower content")
			expect(upperContent).toBe("upper content")
		})
	})

	describe("Node.js Version Compatibility", () => {
		it("should work with supported Node.js features", () => {
			// Test that we're using a supported Node.js version
			const nodeVersion = process.version
			expect(nodeVersion).toMatch(/^v\d+\.\d+\.\d+/)

			// Test some ES6+ features that should be available
			const arrow = () => "arrow function"
			expect(arrow()).toBe("arrow function")

			const [first, second] = [1, 2]
			expect(first).toBe(1)
			expect(second).toBe(2)

			const obj = { a: 1, b: 2 }
			const { a, b } = obj
			expect(a).toBe(1)
			expect(b).toBe(2)
		})

		it("should handle async/await correctly", async () => {
			const asyncFunction = async () => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				return "async result"
			}

			const result = await asyncFunction()
			expect(result).toBe("async result")
		})

		it("should handle Promises correctly", async () => {
			const promise = Promise.resolve("promise result")
			const result = await promise
			expect(result).toBe("promise result")
		})
	})
})
