import { describe, it, expect, beforeEach, afterEach } from "@jest/globals"
import { TestHelpers } from "../utils/TestHelpers"
import * as fs from "fs/promises"
import * as path from "path"

describe("Performance Tests", () => {
	let testWorkspace: string

	beforeEach(async () => {
		testWorkspace = await TestHelpers.createTempWorkspace()
		process.chdir(testWorkspace)
	})

	afterEach(async () => {
		await TestHelpers.cleanupTempWorkspace(testWorkspace)
	})

	describe("Startup Performance", () => {
		it("should start within acceptable time limits", async () => {
			const { duration } = await TestHelpers.measureExecutionTime(async () => {
				const result = await TestHelpers.runCLICommand(["--version"], { timeout: 5000 })
				return result
			})

			expect(duration).toBeLessThan(2000) // 2 seconds max for startup
		})

		it("should handle help command quickly", async () => {
			const { duration } = await TestHelpers.measureExecutionTime(async () => {
				const result = await TestHelpers.runCLICommand(["--help"], { timeout: 5000 })
				return result
			})

			expect(duration).toBeLessThan(1500) // 1.5 seconds max for help
		})

		it("should handle multiple rapid commands", async () => {
			const startTime = Date.now()

			const commands = [["--version"], ["--help"], ["--version"], ["--help"]]

			const results = await Promise.all(commands.map((cmd) => TestHelpers.runCLICommand(cmd, { timeout: 3000 })))

			const totalDuration = Date.now() - startTime
			expect(totalDuration).toBeLessThan(5000) // All commands should complete within 5 seconds

			// All commands should succeed
			results.forEach((result) => {
				expect(result.exitCode).toBe(0)
			})
		})
	})

	describe("Memory Usage", () => {
		it("should not exceed memory limits during operations", async () => {
			const initialMemory = TestHelpers.getMemoryUsage()

			// Perform memory-intensive operations
			await TestHelpers.createTestProject(testWorkspace, "react")
			const largeData = TestHelpers.generateTestData("large")
			await fs.writeFile(path.join(testWorkspace, "large-data.json"), JSON.stringify(largeData))

			const finalMemory = TestHelpers.getMemoryUsage()
			const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

			// Should not increase by more than 100MB for these operations
			expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)
		})

		it("should handle memory cleanup properly", async () => {
			const baselineMemory = TestHelpers.getMemoryUsage()

			// Create and destroy multiple large objects
			for (let i = 0; i < 5; i++) {
				const largeData = TestHelpers.generateTestData("large")
				const tempFile = path.join(testWorkspace, `temp-${i}.json`)
				await fs.writeFile(tempFile, JSON.stringify(largeData))
				await fs.unlink(tempFile)

				// Force garbage collection if available
				if (global.gc) {
					global.gc()
				}
			}

			const finalMemory = TestHelpers.getMemoryUsage()
			const memoryIncrease = finalMemory.heapUsed - baselineMemory.heapUsed

			// Memory should not grow significantly after cleanup
			expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 50MB tolerance
		})

		it("should handle concurrent operations without memory leaks", async () => {
			const initialMemory = TestHelpers.getMemoryUsage()

			// Create multiple concurrent operations
			const operations = Array.from({ length: 10 }, async (_, i) => {
				const data = TestHelpers.generateTestData("medium")
				const filePath = path.join(testWorkspace, `concurrent-${i}.json`)
				await fs.writeFile(filePath, JSON.stringify(data))
				const content = await fs.readFile(filePath, "utf8")
				await fs.unlink(filePath)
				return JSON.parse(content)
			})

			await Promise.all(operations)

			const finalMemory = TestHelpers.getMemoryUsage()
			const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

			// Concurrent operations shouldn't cause excessive memory growth
			expect(memoryIncrease).toBeLessThan(75 * 1024 * 1024) // 75MB tolerance
		})
	})

	describe("File Processing Performance", () => {
		it("should process large files efficiently", async () => {
			const largeFileSize = 10 * 1024 * 1024 // 10MB
			const largeFilePath = await TestHelpers.createLargeTestFile(largeFileSize)

			const { duration } = await TestHelpers.measureExecutionTime(async () => {
				const content = await fs.readFile(largeFilePath, "utf8")
				return content.length
			})

			expect(duration).toBeLessThan(5000) // 5 seconds max for 10MB file

			// Cleanup
			await fs.unlink(largeFilePath)
		})

		it("should handle multiple file operations concurrently", async () => {
			const fileCount = 50
			const fileSize = 1024 * 100 // 100KB each

			const { duration } = await TestHelpers.measureExecutionTime(async () => {
				// Create files concurrently
				const createOperations = Array.from({ length: fileCount }, async (_, i) => {
					const content = "x".repeat(fileSize)
					const filePath = path.join(testWorkspace, `file-${i}.txt`)
					await fs.writeFile(filePath, content)
					return filePath
				})

				const filePaths = await Promise.all(createOperations)

				// Read files concurrently
				const readOperations = filePaths.map(async (filePath) => {
					const content = await fs.readFile(filePath, "utf8")
					return content.length
				})

				const lengths = await Promise.all(readOperations)

				// Verify all files were processed correctly
				lengths.forEach((length) => {
					expect(length).toBe(fileSize)
				})

				return filePaths
			})

			expect(duration).toBeLessThan(10000) // 10 seconds max for 50 files
		})

		it("should handle directory traversal efficiently", async () => {
			// Create nested directory structure with files
			const depth = 5
			const filesPerLevel = 10

			await TestHelpers.createTestProject(testWorkspace, "node")

			// Create nested structure
			for (let level = 0; level < depth; level++) {
				const levelPath = path.join(testWorkspace, ...Array(level + 1).fill("level"))
				await fs.mkdir(levelPath, { recursive: true })

				for (let file = 0; file < filesPerLevel; file++) {
					const filePath = path.join(levelPath, `file-${file}.txt`)
					await fs.writeFile(filePath, `Content at level ${level}, file ${file}`)
				}
			}

			const { duration } = await TestHelpers.measureExecutionTime(async () => {
				// Recursively count all files
				const countFiles = async (dir: string): Promise<number> => {
					const entries = await fs.readdir(dir, { withFileTypes: true })
					let count = 0

					for (const entry of entries) {
						if (entry.isFile()) {
							count++
						} else if (entry.isDirectory()) {
							count += await countFiles(path.join(dir, entry.name))
						}
					}

					return count
				}

				return await countFiles(testWorkspace)
			})

			expect(duration).toBeLessThan(3000) // 3 seconds max for directory traversal
		})
	})

	describe("Data Processing Performance", () => {
		it("should handle JSON processing efficiently", async () => {
			const largeDataset = TestHelpers.generateTestData("large")

			const { duration } = await TestHelpers.measureExecutionTime(async () => {
				// Serialize to JSON
				const jsonString = JSON.stringify(largeDataset)

				// Write to file
				const filePath = path.join(testWorkspace, "large-dataset.json")
				await fs.writeFile(filePath, jsonString)

				// Read and parse
				const rawData = await fs.readFile(filePath, "utf8")
				const parsedData = JSON.parse(rawData)

				return parsedData.length
			})

			expect(duration).toBeLessThan(8000) // 8 seconds max for large JSON processing
		})

		it("should handle data transformation efficiently", async () => {
			const dataset = TestHelpers.generateTestData("medium")

			const { duration } = await TestHelpers.measureExecutionTime(async () => {
				// Perform data transformations
				const filtered = dataset.filter((item: any) => item.value > 500)
				const mapped = filtered.map((item: any) => ({
					...item,
					category: item.value > 750 ? "high" : "medium",
					processed: true,
				}))
				const sorted = mapped.sort((a: any, b: any) => b.value - a.value)

				return sorted.length
			})

			expect(duration).toBeLessThan(1000) // 1 second max for data transformation
		})

		it("should handle batch operations efficiently", async () => {
			const batchSize = 100
			const batches = 50

			const { duration } = await TestHelpers.measureExecutionTime(async () => {
				const allResults = []

				for (let batch = 0; batch < batches; batch++) {
					const batchData = Array.from({ length: batchSize }, (_, i) => ({
						id: batch * batchSize + i,
						value: Math.random() * 1000,
						batch: batch,
					}))

					// Process batch
					const processed = batchData.map((item) => ({
						...item,
						processed: true,
						category: item.value > 500 ? "high" : "low",
					}))

					allResults.push(...processed)
				}

				return allResults.length
			})

			expect(duration).toBeLessThan(5000) // 5 seconds max for batch processing
		})
	})

	describe("Concurrent Operation Performance", () => {
		it("should handle multiple user simulations", async () => {
			const userCount = 10
			const operationsPerUser = 5

			const { duration } = await TestHelpers.measureExecutionTime(async () => {
				// Simulate multiple users performing operations concurrently
				const userOperations = Array.from({ length: userCount }, async (_, userId) => {
					const userWorkspace = path.join(testWorkspace, `user-${userId}`)
					await fs.mkdir(userWorkspace, { recursive: true })

					const operations = []
					for (let op = 0; op < operationsPerUser; op++) {
						operations.push(
							fs.writeFile(path.join(userWorkspace, `file-${op}.txt`), `User ${userId} operation ${op}`),
						)
					}

					await Promise.all(operations)
					return userId
				})

				return await Promise.all(userOperations)
			})

			expect(duration).toBeLessThan(7000) // 7 seconds max for concurrent user operations
		})

		it("should maintain performance under load", async () => {
			const iterations = 20
			const durations: number[] = []

			// Perform multiple iterations to check for performance degradation
			for (let i = 0; i < iterations; i++) {
				const { duration } = await TestHelpers.measureExecutionTime(async () => {
					const data = TestHelpers.generateTestData("small")
					const filePath = path.join(testWorkspace, `iteration-${i}.json`)
					await fs.writeFile(filePath, JSON.stringify(data))
					const content = await fs.readFile(filePath, "utf8")
					JSON.parse(content)
					await fs.unlink(filePath)
				})

				durations.push(duration)
			}

			// Check that performance doesn't degrade significantly
			const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
			const maxDuration = Math.max(...durations)
			const minDuration = Math.min(...durations)

			expect(averageDuration).toBeLessThan(500) // Average should be under 500ms
			expect(maxDuration - minDuration).toBeLessThan(1000) // Variation should be under 1s
		})
	})

	describe("Resource Cleanup Performance", () => {
		it("should clean up resources efficiently", async () => {
			// Create many temporary resources
			const resourceCount = 100
			const resources: string[] = []

			// Create resources
			for (let i = 0; i < resourceCount; i++) {
				const resourcePath = path.join(testWorkspace, `resource-${i}.tmp`)
				await fs.writeFile(resourcePath, `Temporary resource ${i}`)
				resources.push(resourcePath)
			}

			// Measure cleanup time
			const { duration } = await TestHelpers.measureExecutionTime(async () => {
				const cleanupOperations = resources.map((resource) => fs.unlink(resource))
				await Promise.all(cleanupOperations)
			})

			expect(duration).toBeLessThan(3000) // 3 seconds max for cleanup

			// Verify all resources are cleaned up
			for (const resource of resources) {
				const exists = await fs
					.access(resource)
					.then(() => true)
					.catch(() => false)
				expect(exists).toBe(false)
			}
		})
	})

	describe("Memory Pressure Tests", () => {
		it("should handle memory pressure gracefully", async () => {
			const iterations = 10
			const dataSize = "large"

			for (let i = 0; i < iterations; i++) {
				const initialMemory = TestHelpers.getMemoryUsage()

				// Create large data structure
				const largeData = TestHelpers.generateTestData(dataSize)
				const tempFile = path.join(testWorkspace, `pressure-test-${i}.json`)

				await fs.writeFile(tempFile, JSON.stringify(largeData))
				const content = await fs.readFile(tempFile, "utf8")
				const parsed = JSON.parse(content)

				expect(parsed.length).toBe(10000)

				// Cleanup
				await fs.unlink(tempFile)

				const finalMemory = TestHelpers.getMemoryUsage()
				const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

				// Each iteration shouldn't cause excessive memory growth
				expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // 100MB per iteration
			}
		})
	})
})
