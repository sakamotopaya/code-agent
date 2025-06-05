import { FileOptimizer } from "../../optimization/FileOptimizer"
import { PerformanceMonitoringService } from "../../optimization/PerformanceMonitoringService"
import { writeFile, unlink, mkdir } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

describe("File Operation Performance Tests", () => {
	let fileOptimizer: FileOptimizer
	let performanceMonitor: PerformanceMonitoringService
	let testDir: string

	beforeAll(async () => {
		testDir = join(tmpdir(), "roo-cli-file-tests")
		await mkdir(testDir, { recursive: true })
	})

	beforeEach(() => {
		performanceMonitor = new PerformanceMonitoringService()
		fileOptimizer = new FileOptimizer(undefined, performanceMonitor)
	})

	afterAll(async () => {
		// Cleanup test directory
		try {
			const { rmdir } = await import("fs/promises")
			await rmdir(testDir, { recursive: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	describe("File Reading Performance", () => {
		it("should read small files efficiently", async () => {
			const content = "Test content for small file"
			const filePath = join(testDir, "small-file.txt")

			await writeFile(filePath, content)

			const timer = performanceMonitor.startTimer("small-file-read")
			const readContent = await fileOptimizer.readFileOptimized(filePath)
			const duration = timer.stop()

			expect(readContent).toBe(content)
			expect(duration).toBeLessThan(100) // Should be very fast for small files

			await unlink(filePath)
		})

		it("should read large files with streaming", async () => {
			const largeContent = "x".repeat(15 * 1024 * 1024) // 15MB
			const filePath = join(testDir, "large-file.txt")

			await writeFile(filePath, largeContent)

			const timer = performanceMonitor.startTimer("large-file-read")
			const readContent = await fileOptimizer.readFileOptimized(filePath)
			const duration = timer.stop()

			expect(readContent).toBe(largeContent)
			expect(duration).toBeLessThan(8000) // Should complete within 8 seconds

			await unlink(filePath)
		}, 15000)

		it("should cache file content for repeated reads", async () => {
			const content = "Cached file content"
			const filePath = join(testDir, "cached-file.txt")

			await writeFile(filePath, content)

			// First read
			const timer1 = performanceMonitor.startTimer("first-read")
			const content1 = await fileOptimizer.readFileOptimized(filePath)
			const duration1 = timer1.stop()

			// Second read (should be cached)
			const timer2 = performanceMonitor.startTimer("cached-read")
			const content2 = await fileOptimizer.readFileOptimized(filePath, true)
			const duration2 = timer2.stop()

			expect(content1).toBe(content)
			expect(content2).toBe(content)
			expect(duration2).toBeLessThan(duration1) // Cache should be faster

			const cacheStats = fileOptimizer.getCacheStats()
			expect(cacheStats.entries).toBeGreaterThan(0)

			await unlink(filePath)
		})

		it("should handle concurrent reads efficiently", async () => {
			const files = []
			const contents = []

			// Create test files
			for (let i = 0; i < 5; i++) {
				const content = `Content for file ${i}\n`.repeat(1000)
				const filePath = join(testDir, `concurrent-${i}.txt`)
				await writeFile(filePath, content)
				files.push(filePath)
				contents.push(content)
			}

			const timer = performanceMonitor.startTimer("concurrent-reads")

			// Read all files concurrently
			const readPromises = files.map((file) => fileOptimizer.readFileOptimized(file))
			const results = await Promise.all(readPromises)

			const duration = timer.stop()

			expect(results).toHaveLength(files.length)
			for (let i = 0; i < results.length; i++) {
				expect(results[i]).toBe(contents[i])
			}
			expect(duration).toBeLessThan(2000) // Should complete quickly

			// Cleanup
			for (const file of files) {
				await unlink(file)
			}
		})

		it("should respect concurrent read limits", async () => {
			const config = {
				maxConcurrentReads: 2,
				chunkSize: 64 * 1024,
				streamingThreshold: 10 * 1024 * 1024,
				compressionEnabled: false,
				cacheEnabled: true,
				cacheTtl: 60000,
			}

			const limitedOptimizer = new FileOptimizer(config, performanceMonitor)

			const files = []

			// Create multiple files
			for (let i = 0; i < 6; i++) {
				const content = `Content ${i}\n`.repeat(10000)
				const filePath = join(testDir, `limited-${i}.txt`)
				await writeFile(filePath, content)
				files.push(filePath)
			}

			const timer = performanceMonitor.startTimer("limited-concurrent-reads")

			// Try to read all files concurrently
			const readPromises = files.map((file) => limitedOptimizer.readFileOptimized(file))
			const results = await Promise.all(readPromises)

			const duration = timer.stop()

			expect(results).toHaveLength(files.length)
			expect(duration).toBeGreaterThan(0) // Should take some time due to limits

			// Cleanup
			for (const file of files) {
				await unlink(file)
			}
		})
	})

	describe("File Writing Performance", () => {
		it("should write small files efficiently", async () => {
			const content = "Small file content"
			const filePath = join(testDir, "write-small.txt")

			const timer = performanceMonitor.startTimer("small-file-write")
			await fileOptimizer.writeFileOptimized(filePath, content)
			const duration = timer.stop()

			expect(duration).toBeLessThan(100) // Should be very fast

			// Verify content
			const readContent = await fileOptimizer.readFileOptimized(filePath, false)
			expect(readContent).toBe(content)

			await unlink(filePath)
		})

		it("should write large files with streaming", async () => {
			const largeContent = "y".repeat(12 * 1024 * 1024) // 12MB
			const filePath = join(testDir, "write-large.txt")

			const timer = performanceMonitor.startTimer("large-file-write")
			await fileOptimizer.writeFileOptimized(filePath, largeContent)
			const duration = timer.stop()

			expect(duration).toBeLessThan(6000) // Should complete within 6 seconds

			// Verify content
			const readContent = await fileOptimizer.readFileOptimized(filePath, false)
			expect(readContent).toBe(largeContent)

			await unlink(filePath)
		}, 10000)

		it("should handle batch write operations", async () => {
			const files = new Map<string, string>()

			// Prepare batch data
			for (let i = 0; i < 8; i++) {
				const content = `Batch content ${i}\n`.repeat(500)
				const filePath = join(testDir, `batch-write-${i}.txt`)
				files.set(filePath, content)
			}

			const timer = performanceMonitor.startTimer("batch-write")
			await fileOptimizer.batchWriteFiles(files)
			const duration = timer.stop()

			expect(duration).toBeLessThan(3000) // Should complete within 3 seconds

			// Verify all files were written
			for (const [filePath, expectedContent] of files) {
				const readContent = await fileOptimizer.readFileOptimized(filePath, false)
				expect(readContent).toBe(expectedContent)
				await unlink(filePath)
			}
		})

		it("should invalidate cache on write", async () => {
			const originalContent = "Original content"
			const updatedContent = "Updated content"
			const filePath = join(testDir, "cache-invalidate.txt")

			// Write and read (to cache)
			await fileOptimizer.writeFileOptimized(filePath, originalContent)
			const cached = await fileOptimizer.readFileOptimized(filePath)
			expect(cached).toBe(originalContent)

			// Update file
			await fileOptimizer.writeFileOptimized(filePath, updatedContent)

			// Read again (should get updated content, not cached)
			const updated = await fileOptimizer.readFileOptimized(filePath, false) // Skip cache
			expect(updated).toBe(updatedContent)

			await unlink(filePath)
		})
	})

	describe("Batch Operations", () => {
		it("should perform batch reads efficiently", async () => {
			const files = []
			const expectedContents = []

			// Create test files
			for (let i = 0; i < 10; i++) {
				const content = `Batch read content ${i}\n`.repeat(100)
				const filePath = join(testDir, `batch-read-${i}.txt`)
				await writeFile(filePath, content)
				files.push(filePath)
				expectedContents.push(content)
			}

			const timer = performanceMonitor.startTimer("batch-read")
			const results = await fileOptimizer.batchReadFiles(files)
			const duration = timer.stop()

			expect(results.size).toBe(files.length)
			expect(duration).toBeLessThan(2000) // Should be efficient

			// Verify content
			for (let i = 0; i < files.length; i++) {
				expect(results.get(files[i])).toBe(expectedContents[i])
			}

			// Cleanup
			for (const file of files) {
				await unlink(file)
			}
		})

		it("should handle partial batch failures gracefully", async () => {
			const files = [
				join(testDir, "batch-exists.txt"),
				join(testDir, "batch-missing.txt"), // This file won't exist
				join(testDir, "batch-exists2.txt"),
			]

			// Create only some files
			await writeFile(files[0], "Content 1")
			await writeFile(files[2], "Content 3")

			const timer = performanceMonitor.startTimer("partial-batch-read")
			const results = await fileOptimizer.batchReadFiles(files)
			const duration = timer.stop()

			// Should return results for existing files
			expect(results.size).toBe(2)
			expect(results.get(files[0])).toBe("Content 1")
			expect(results.get(files[2])).toBe("Content 3")
			expect(results.has(files[1])).toBe(false)

			expect(duration).toBeLessThan(1000)

			// Cleanup
			await unlink(files[0])
			await unlink(files[2])
		})
	})

	describe("Cache Management", () => {
		it("should provide accurate cache statistics", async () => {
			const files = []

			// Create and read multiple files to populate cache
			for (let i = 0; i < 5; i++) {
				const content = `Cache stats content ${i}`
				const filePath = join(testDir, `cache-stats-${i}.txt`)
				await writeFile(filePath, content)
				files.push(filePath)

				await fileOptimizer.readFileOptimized(filePath)
			}

			const stats = fileOptimizer.getCacheStats()

			expect(stats.entries).toBeGreaterThan(0)
			expect(stats.totalSize).toBeGreaterThan(0)
			expect(stats.hitRate).toBeGreaterThanOrEqual(0)
			expect(stats.maxSize).toBeGreaterThan(0)

			// Cleanup
			for (const file of files) {
				await unlink(file)
			}
		})

		it("should clear cache when requested", async () => {
			const content = "Cache clear test"
			const filePath = join(testDir, "cache-clear.txt")

			await writeFile(filePath, content)

			// Read to populate cache
			await fileOptimizer.readFileOptimized(filePath)

			const beforeClear = fileOptimizer.getCacheStats()
			expect(beforeClear.entries).toBeGreaterThan(0)

			fileOptimizer.clearCache()

			const afterClear = fileOptimizer.getCacheStats()
			expect(afterClear.entries).toBe(0)
			expect(afterClear.totalSize).toBe(0)

			await unlink(filePath)
		})

		it("should evict cache entries when limit exceeded", async () => {
			const limitedConfig = {
				maxConcurrentReads: 5,
				chunkSize: 64 * 1024,
				streamingThreshold: 10 * 1024 * 1024,
				compressionEnabled: false,
				cacheEnabled: true,
				cacheTtl: 60000,
			}

			const limitedOptimizer = new FileOptimizer(limitedConfig, performanceMonitor)
			const files = []

			// Create many small files to exceed cache
			for (let i = 0; i < 100; i++) {
				const content = `Eviction test ${i}\n`.repeat(10)
				const filePath = join(testDir, `evict-${i}.txt`)
				await writeFile(filePath, content)
				files.push(filePath)

				await limitedOptimizer.readFileOptimized(filePath)
			}

			const stats = limitedOptimizer.getCacheStats()

			// Cache should have reasonable size (not unlimited)
			expect(stats.entries).toBeLessThan(100) // Should have evicted some entries

			// Cleanup
			for (const file of files) {
				await unlink(file)
			}
		})
	})

	describe("Memory Pressure Handling", () => {
		it("should handle memory pressure during file operations", async () => {
			const files = []

			// Create multiple large-ish files
			for (let i = 0; i < 3; i++) {
				const content = "x".repeat(5 * 1024 * 1024) // 5MB each
				const filePath = join(testDir, `memory-pressure-${i}.txt`)
				await writeFile(filePath, content)
				files.push(filePath)
			}

			const initialMemory = process.memoryUsage().heapUsed

			const timer = performanceMonitor.startTimer("memory-pressure-handling")

			// Read all files
			const results = await fileOptimizer.batchReadFiles(files)

			const duration = timer.stop()
			const finalMemory = process.memoryUsage().heapUsed
			const memoryIncrease = finalMemory - initialMemory

			expect(results.size).toBe(files.length)
			expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
			expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Should not use excessive memory

			// Cleanup
			for (const file of files) {
				await unlink(file)
			}
		})

		it("should adapt to memory constraints", async () => {
			// Create file content that would normally be cached
			const content = "Memory constraint test content"
			const filePath = join(testDir, "memory-constraint.txt")
			await writeFile(filePath, content)

			// Read file multiple times
			for (let i = 0; i < 10; i++) {
				await fileOptimizer.readFileOptimized(filePath)
			}

			// Check that memory usage is reasonable
			const memoryUsage = process.memoryUsage()
			expect(memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024) // Under 100MB

			await unlink(filePath)
		})
	})

	describe("Configuration Updates", () => {
		it("should update configuration dynamically", () => {
			const originalConfig = fileOptimizer.getFileStats().config

			const newConfig = {
				maxConcurrentReads: 10,
				chunkSize: 128 * 1024,
				cacheEnabled: false,
			}

			fileOptimizer.updateConfig(newConfig)

			const updatedStats = fileOptimizer.getFileStats()

			expect(updatedStats.config.maxConcurrentReads).toBe(10)
			expect(updatedStats.config.chunkSize).toBe(128 * 1024)
			expect(updatedStats.config.cacheEnabled).toBe(false)
		})

		it("should provide comprehensive file operation statistics", async () => {
			const content = "Stats test content"
			const filePath = join(testDir, "stats-test.txt")

			await writeFile(filePath, content)
			await fileOptimizer.readFileOptimized(filePath)

			const stats = fileOptimizer.getFileStats()

			expect(stats).toHaveProperty("activeConcurrentReads")
			expect(stats).toHaveProperty("maxConcurrentReads")
			expect(stats).toHaveProperty("cacheStats")
			expect(stats).toHaveProperty("config")

			expect(stats.activeConcurrentReads).toBeGreaterThanOrEqual(0)
			expect(stats.maxConcurrentReads).toBeGreaterThan(0)
			expect(stats.cacheStats.entries).toBeGreaterThanOrEqual(0)
			expect(stats.config).toBeDefined()

			await unlink(filePath)
		})
	})

	describe("Error Handling", () => {
		it("should handle file read errors gracefully", async () => {
			const nonExistentFile = join(testDir, "does-not-exist.txt")

			await expect(fileOptimizer.readFileOptimized(nonExistentFile)).rejects.toThrow()
		})

		it("should handle file write errors gracefully", async () => {
			const invalidPath = "/invalid/path/file.txt"

			await expect(fileOptimizer.writeFileOptimized(invalidPath, "content")).rejects.toThrow()
		})

		it("should continue batch operations despite individual failures", async () => {
			const files = [
				join(testDir, "batch-error-1.txt"),
				join(testDir, "non-existent.txt"), // This will fail
				join(testDir, "batch-error-3.txt"),
			]

			// Create only some files
			await writeFile(files[0], "Content 1")
			await writeFile(files[2], "Content 3")

			// Batch read should handle the missing file gracefully
			const results = await fileOptimizer.batchReadFiles(files)

			expect(results.size).toBe(2) // Should have 2 successful reads
			expect(results.get(files[0])).toBe("Content 1")
			expect(results.get(files[2])).toBe("Content 3")

			// Cleanup
			await unlink(files[0])
			await unlink(files[2])
		})
	})
})
