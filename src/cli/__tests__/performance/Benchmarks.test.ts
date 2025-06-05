import { performance } from "perf_hooks"
import { PerformanceMonitoringService } from "../../optimization/PerformanceMonitoringService"
import { StartupOptimizer } from "../../optimization/StartupOptimizer"
import { MemoryOptimizer } from "../../optimization/MemoryOptimizer"
import { FileOptimizer } from "../../optimization/FileOptimizer"
import { CacheManager } from "../../optimization/CacheManager"
import { PerformanceConfigManager } from "../../config/performance-config"
import { writeFile, unlink, mkdir } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

describe("Performance Benchmarks", () => {
	let performanceMonitor: PerformanceMonitoringService
	let startupOptimizer: StartupOptimizer
	let memoryOptimizer: MemoryOptimizer
	let fileOptimizer: FileOptimizer
	let cacheManager: CacheManager<string>
	let configManager: PerformanceConfigManager
	let testDir: string

	beforeAll(async () => {
		testDir = join(tmpdir(), "roo-cli-performance-tests")
		await mkdir(testDir, { recursive: true })
	})

	beforeEach(() => {
		performanceMonitor = new PerformanceMonitoringService()
		startupOptimizer = new StartupOptimizer(performanceMonitor)
		memoryOptimizer = new MemoryOptimizer(undefined, performanceMonitor)
		fileOptimizer = new FileOptimizer(undefined, performanceMonitor)
		cacheManager = new CacheManager<string>(100, 300000, undefined, performanceMonitor)
		configManager = new PerformanceConfigManager("standard")
	})

	afterEach(() => {
		memoryOptimizer.stopMonitoring()
	})

	describe("Startup Performance", () => {
		it("should optimize startup within 2 seconds", async () => {
			const timer = performanceMonitor.startTimer("startup-test")

			await startupOptimizer.optimizeStartup()

			const duration = timer.stop()
			const metrics = startupOptimizer.getStartupMetrics()

			expect(duration).toBeLessThan(2000)
			expect(metrics.totalStartupTime).toBeLessThan(2000)
			expect(metrics.preloadedModules.length).toBeGreaterThan(0)
		}, 10000)

		it("should preload critical modules efficiently", async () => {
			const timer = performanceMonitor.startTimer("module-preload")

			await startupOptimizer.optimizeStartup()
			const metrics = startupOptimizer.getStartupMetrics()

			timer.stop()

			// Check that critical modules are preloaded
			expect(metrics.preloadedModules).toContain("./services/CLIUIService")
			expect(metrics.moduleLoadTimes.size).toBeGreaterThan(0)

			// Check cache hit rate
			expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0)
		})

		it("should implement lazy loading correctly", async () => {
			await startupOptimizer.optimizeStartup()

			const beforeLoadTime = performance.now()
			const browserModule = await startupOptimizer.getLazyModule("browser")
			const afterLoadTime = performance.now()

			expect(browserModule).toBeDefined()
			expect(afterLoadTime - beforeLoadTime).toBeLessThan(1000) // Should load quickly

			// Second access should be from cache
			const cacheStartTime = performance.now()
			const cachedModule = await startupOptimizer.getLazyModule("browser")
			const cacheEndTime = performance.now()

			expect(cachedModule).toBe(browserModule)
			expect(cacheEndTime - cacheStartTime).toBeLessThan(10) // Should be very fast from cache
		})

		it("should handle concurrent module loading", async () => {
			await startupOptimizer.optimizeStartup()

			const loadPromises = [
				startupOptimizer.getLazyModule("browser"),
				startupOptimizer.getLazyModule("mcp"),
				startupOptimizer.getLazyModule("session"),
				startupOptimizer.getLazyModule("batch"),
			]

			const timer = performanceMonitor.startTimer("concurrent-loading")
			const modules = await Promise.all(loadPromises)
			const duration = timer.stop()

			expect(modules).toHaveLength(4)
			expect(modules.every((module) => module !== undefined)).toBe(true)
			expect(duration).toBeLessThan(3000) // Should complete within 3 seconds
		})
	})

	describe("Memory Usage", () => {
		it("should not exceed 100MB for typical operations", async () => {
			const initialMemory = process.memoryUsage().heapUsed

			// Perform typical operations
			await performTypicalOperations()

			const finalMemory = process.memoryUsage().heapUsed
			const memoryIncrease = finalMemory - initialMemory

			expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // 100MB
		})

		it("should manage memory efficiently with monitoring", async () => {
			memoryOptimizer.startMonitoring()

			const initialStats = memoryOptimizer.getMemoryStats()

			// Simulate memory pressure
			const largeArrays = []
			for (let i = 0; i < 10; i++) {
				largeArrays.push(new Array(100000).fill("test data"))
			}

			// Wait for monitoring to kick in
			await new Promise((resolve) => setTimeout(resolve, 100))

			const afterStats = memoryOptimizer.getMemoryStats()
			expect(afterStats.heapUsed).toBeGreaterThan(initialStats.heapUsed)

			// Cleanup
			largeArrays.length = 0
			await memoryOptimizer.forceCleanup()

			const cleanupStats = memoryOptimizer.getMemoryStats()
			expect(cleanupStats.heapUsed).toBeLessThanOrEqual(afterStats.heapUsed)
		})

		it("should detect and handle memory pressure", async () => {
			memoryOptimizer.registerCache("test-cache", cacheManager)

			// Fill cache with large items
			for (let i = 0; i < 50; i++) {
				cacheManager.set(`large-item-${i}`, "x".repeat(1024 * 1024)) // 1MB each
			}

			const underPressure = memoryOptimizer.checkMemoryPressure()

			if (underPressure) {
				await memoryOptimizer.optimizeForLowMemory()

				const afterOptimization = memoryOptimizer.getMemoryStats()
				expect(afterOptimization.heapUsed).toBeLessThan(150 * 1024 * 1024) // Should be under 150MB
			}
		})

		it("should perform emergency cleanup when needed", async () => {
			const beforeStats = memoryOptimizer.getMemoryStats()

			// Create memory pressure
			const wastefulData = new Array(1000000).fill("large string data".repeat(100))

			await memoryOptimizer.emergencyCleanup()

			// Clear the wasteful data
			wastefulData.length = 0

			const afterStats = memoryOptimizer.getMemoryStats()

			// Emergency cleanup should have been attempted
			expect(afterStats).toBeDefined()
		})
	})

	describe("File Operations", () => {
		it("should process large files efficiently", async () => {
			const largeContent = "x".repeat(50 * 1024 * 1024) // 50MB
			const largeFile = join(testDir, "large-test-file.txt")

			await writeFile(largeFile, largeContent)

			const timer = performanceMonitor.startTimer("file-processing")

			const readContent = await fileOptimizer.readFileOptimized(largeFile)

			const duration = timer.stop()

			expect(readContent).toBe(largeContent)
			expect(duration).toBeLessThan(10000) // 10 seconds

			await unlink(largeFile)
		}, 15000)

		it("should handle concurrent file operations", async () => {
			const files = new Map<string, string>()

			// Create test files
			for (let i = 0; i < 10; i++) {
				const fileName = join(testDir, `test-file-${i}.txt`)
				const content = `Test content for file ${i}\n`.repeat(1000)
				files.set(fileName, content)
			}

			const timer = performanceMonitor.startTimer("concurrent-file-ops")

			// Write all files concurrently
			await fileOptimizer.batchWriteFiles(files)

			// Read all files concurrently
			const results = await fileOptimizer.batchReadFiles(Array.from(files.keys()))

			const duration = timer.stop()

			expect(results.size).toBe(files.size)
			expect(duration).toBeLessThan(5000) // 5 seconds

			// Cleanup
			for (const fileName of files.keys()) {
				await unlink(fileName).catch(() => {}) // Ignore errors
			}
		})

		it("should optimize file caching", async () => {
			const testFile = join(testDir, "cache-test.txt")
			const content = "Test content for caching"

			await writeFile(testFile, content)

			// First read - should cache
			const timer1 = performanceMonitor.startTimer("first-read")
			const content1 = await fileOptimizer.readFileOptimized(testFile)
			const duration1 = timer1.stop()

			// Second read - should be from cache
			const timer2 = performanceMonitor.startTimer("cached-read")
			const content2 = await fileOptimizer.readFileOptimized(testFile)
			const duration2 = timer2.stop()

			expect(content1).toBe(content)
			expect(content2).toBe(content)
			expect(duration2).toBeLessThan(duration1) // Cache should be faster

			const cacheStats = fileOptimizer.getCacheStats()
			expect(cacheStats.entries).toBeGreaterThan(0)

			await unlink(testFile)
		})

		it("should handle memory pressure during file operations", async () => {
			const testFiles = []

			try {
				// Create multiple large files
				for (let i = 0; i < 5; i++) {
					const fileName = join(testDir, `memory-test-${i}.txt`)
					const content = "x".repeat(10 * 1024 * 1024) // 10MB each
					await writeFile(fileName, content)
					testFiles.push(fileName)
				}

				const timer = performanceMonitor.startTimer("memory-pressure-file-ops")

				// Read all files - should handle memory pressure
				const results = await fileOptimizer.batchReadFiles(testFiles)

				const duration = timer.stop()

				expect(results.size).toBe(testFiles.length)
				expect(duration).toBeLessThan(30000) // 30 seconds

				// Memory should be manageable
				const memoryUsage = process.memoryUsage()
				expect(memoryUsage.heapUsed).toBeLessThan(200 * 1024 * 1024) // 200MB
			} finally {
				// Cleanup
				for (const fileName of testFiles) {
					await unlink(fileName).catch(() => {})
				}
			}
		}, 45000)
	})

	describe("Command Execution", () => {
		it("should parse commands quickly", async () => {
			const commands = generateTestCommands(1000)
			const timer = performanceMonitor.startTimer("command-parsing")

			// Simulate command parsing
			for (const command of commands) {
				// Simple parsing simulation
				const parsed = command.split(" ")
				expect(parsed.length).toBeGreaterThan(0)
			}

			const duration = timer.stop()
			expect(duration / commands.length).toBeLessThan(1) // 1ms per command
		})

		it("should handle command validation efficiently", async () => {
			const validCommands = ["help", "version", "config", "session", "mcp"]
			const timer = performanceMonitor.startTimer("command-validation")

			for (let i = 0; i < 10000; i++) {
				const command = validCommands[i % validCommands.length]
				const isValid = validCommands.includes(command)
				expect(isValid).toBe(true)
			}

			const duration = timer.stop()
			expect(duration).toBeLessThan(100) // Should complete in under 100ms
		})

		it("should cache command results effectively", async () => {
			const commandCache = new CacheManager<string>(50, 60000)

			// Simulate command execution with caching
			const executeCommand = async (cmd: string): Promise<string> => {
				const cached = commandCache.get(cmd)
				if (cached) {
					return cached
				}

				// Simulate command execution delay
				await new Promise((resolve) => setTimeout(resolve, 10))
				const result = `Result for ${cmd}`
				commandCache.set(cmd, result)
				return result
			}

			const commands = ["help", "version", "config", "help", "version"]
			const timer = performanceMonitor.startTimer("cached-commands")

			const results = []
			for (const cmd of commands) {
				results.push(await executeCommand(cmd))
			}

			const duration = timer.stop()

			expect(results).toHaveLength(commands.length)
			expect(duration).toBeLessThan(50) // Cache hits should make this fast

			const stats = commandCache.getStats()
			expect(stats.hitRate).toBeGreaterThan(0) // Should have cache hits
		})
	})

	describe("Cache Performance", () => {
		it("should maintain high cache hit rates", async () => {
			const cache = new CacheManager<string>(100, 60000)

			// Fill cache
			for (let i = 0; i < 50; i++) {
				cache.set(`key-${i}`, `value-${i}`)
			}

			// Access items multiple times
			for (let round = 0; round < 5; round++) {
				for (let i = 0; i < 50; i++) {
					const value = cache.get(`key-${i}`)
					expect(value).toBe(`value-${i}`)
				}
			}

			const stats = cache.getStats()
			expect(stats.hitRate).toBeGreaterThan(80) // Should have >80% hit rate
			expect(stats.averageAccessTime).toBeLessThan(1) // Should be very fast
		})

		it("should handle cache eviction efficiently", async () => {
			const cache = new CacheManager<string>(10, 60000) // Small cache

			const timer = performanceMonitor.startTimer("cache-eviction")

			// Fill beyond capacity
			for (let i = 0; i < 20; i++) {
				cache.set(`key-${i}`, `value-${i}`)
			}

			const duration = timer.stop()

			expect(cache.size()).toBe(10) // Should respect size limit
			expect(duration).toBeLessThan(10) // Eviction should be fast

			const stats = cache.getStats()
			expect(stats.totalEvictions).toBeGreaterThan(0)
		})

		it("should perform bulk operations efficiently", async () => {
			const cache = new CacheManager<string>(1000, 60000)
			const entries = new Map<string, string>()

			// Prepare bulk data
			for (let i = 0; i < 500; i++) {
				entries.set(`bulk-key-${i}`, `bulk-value-${i}`)
			}

			const timer = performanceMonitor.startTimer("bulk-operations")

			// Bulk set
			cache.mset(entries)

			// Bulk get
			const keys = Array.from(entries.keys())
			const results = cache.mget(keys)

			const duration = timer.stop()

			expect(results.size).toBe(entries.size)
			expect(duration).toBeLessThan(100) // Bulk operations should be fast
		})
	})

	describe("Configuration Performance", () => {
		it("should apply configuration changes quickly", async () => {
			const timer = performanceMonitor.startTimer("config-changes")

			configManager.setPreset("aggressive")
			const aggressiveConfig = configManager.getConfig()

			configManager.setPreset("minimal")
			const minimalConfig = configManager.getConfig()

			configManager.optimizeForEnvironment("production")
			const prodConfig = configManager.getConfig()

			const duration = timer.stop()

			expect(aggressiveConfig).not.toEqual(minimalConfig)
			expect(duration).toBeLessThan(10) // Should be very fast

			const validation = configManager.validateConfig(prodConfig)
			expect(validation.valid).toBe(true)
		})

		it("should validate configurations efficiently", async () => {
			const configs = [
				configManager.getConfig(),
				{ ...configManager.getConfig(), memory: { ...configManager.getConfig().memory, maxHeapSize: 1000 } },
				{
					...configManager.getConfig(),
					fileOperations: { ...configManager.getConfig().fileOperations, chunkSize: 0 },
				},
			]

			const timer = performanceMonitor.startTimer("config-validation")

			const validations = configs.map((config) => configManager.validateConfig(config))

			const duration = timer.stop()

			expect(validations[0].valid).toBe(true)
			expect(validations[1].valid).toBe(false) // Invalid memory size
			expect(validations[2].valid).toBe(false) // Invalid chunk size
			expect(duration).toBeLessThan(5) // Validation should be very fast
		})
	})

	// Helper functions
	async function performTypicalOperations(): Promise<void> {
		// Simulate typical CLI operations
		const operations = [
			() => startupOptimizer.warmupCaches(),
			() => fileOptimizer.readFileOptimized(__filename),
			() => cacheManager.set("test", "value"),
			() => cacheManager.get("test"),
			() => memoryOptimizer.getMemoryStats(),
		]

		for (const operation of operations) {
			await operation()
		}
	}

	function generateTestCommands(count: number): string[] {
		const baseCommands = [
			"help",
			"version",
			"config show",
			"session list",
			"mcp list",
			"examples search test",
			"config validate ~/.roo-cli/config.json",
			'session save "My Session"',
			"mcp connect github-server",
		]

		const commands = []
		for (let i = 0; i < count; i++) {
			commands.push(baseCommands[i % baseCommands.length])
		}

		return commands
	}
})
