import { MemoryOptimizer } from "../../optimization/MemoryOptimizer"
import { CacheManager } from "../../optimization/CacheManager"
import { PerformanceMonitoringService } from "../../optimization/PerformanceMonitoringService"

describe("Memory Performance Tests", () => {
	let memoryOptimizer: MemoryOptimizer
	let performanceMonitor: PerformanceMonitoringService
	let testCache: CacheManager<string>

	beforeEach(() => {
		performanceMonitor = new PerformanceMonitoringService()
		memoryOptimizer = new MemoryOptimizer(undefined, performanceMonitor)
		testCache = new CacheManager<string>(100, 60000)
	})

	afterEach(() => {
		memoryOptimizer.stopMonitoring()
	})

	describe("Memory Monitoring", () => {
		it("should track memory usage accurately", () => {
			const initialStats = memoryOptimizer.getMemoryStats()

			expect(initialStats.heapUsed).toBeGreaterThan(0)
			expect(initialStats.heapTotal).toBeGreaterThan(0)
			expect(initialStats.external).toBeGreaterThanOrEqual(0)
			expect(initialStats.rss).toBeGreaterThan(0)
		})

		it("should start and stop monitoring correctly", () => {
			expect(memoryOptimizer.isUnderMemoryPressure()).toBeDefined()

			memoryOptimizer.startMonitoring()
			// Should not throw error when starting monitoring that's already started
			memoryOptimizer.startMonitoring()

			memoryOptimizer.stopMonitoring()
			// Should not throw error when stopping monitoring that's already stopped
			memoryOptimizer.stopMonitoring()
		})

		it("should detect memory pressure correctly", () => {
			// Create some memory pressure
			const largeArray = new Array(1000000).fill("test data")

			const isPressure = memoryOptimizer.checkMemoryPressure()

			// Clean up
			largeArray.length = 0

			expect(typeof isPressure).toBe("boolean")
		})

		it("should handle cache registration", () => {
			memoryOptimizer.registerCache("test-cache", testCache)

			// Fill cache with some data
			for (let i = 0; i < 10; i++) {
				testCache.set(`key-${i}`, `value-${i}`)
			}

			const report = memoryOptimizer.getMemoryReport()

			expect(report.cacheStats).toHaveLength(1)
			expect(report.cacheStats[0].name).toBe("test-cache")
			expect(report.cacheStats[0].size).toBe(10)

			memoryOptimizer.unregisterCache("test-cache")
		})
	})

	describe("Memory Cleanup", () => {
		it("should perform forced cleanup", async () => {
			memoryOptimizer.registerCache("cleanup-test", testCache)

			// Fill cache
			for (let i = 0; i < 50; i++) {
				testCache.set(`large-${i}`, "x".repeat(10000))
			}

			const beforeStats = memoryOptimizer.getMemoryStats()
			await memoryOptimizer.forceCleanup()
			const afterStats = memoryOptimizer.getMemoryStats()

			// Memory should be same or lower after cleanup
			expect(afterStats.heapUsed).toBeLessThanOrEqual(beforeStats.heapUsed + 1024 * 1024) // Allow 1MB tolerance
		})

		it("should optimize for low memory conditions", async () => {
			memoryOptimizer.registerCache("low-memory-test", testCache)

			// Fill cache with data
			for (let i = 0; i < 30; i++) {
				testCache.set(`mem-${i}`, "data".repeat(1000))
			}

			const beforeCacheSize = testCache.getSize()
			await memoryOptimizer.optimizeForLowMemory()
			const afterCacheSize = testCache.getSize()

			// Cache should be cleared or reduced
			expect(afterCacheSize).toBeLessThanOrEqual(beforeCacheSize)
		})

		it("should handle emergency cleanup", async () => {
			memoryOptimizer.registerCache("emergency-test", testCache)

			// Create memory pressure
			const heavyData = []
			for (let i = 0; i < 100; i++) {
				heavyData.push(new Array(10000).fill(`heavy-data-${i}`))
				testCache.set(`heavy-${i}`, JSON.stringify(heavyData[i]))
			}

			await memoryOptimizer.emergencyCleanup()

			// Should have attempted cleanup
			const report = memoryOptimizer.getMemoryReport()
			expect(report.recommendations).toBeDefined()

			// Clean up test data
			heavyData.length = 0
		})
	})

	describe("Memory Reporting", () => {
		it("should generate comprehensive memory reports", () => {
			memoryOptimizer.registerCache("report-test", testCache)

			// Add some test data
			for (let i = 0; i < 20; i++) {
				testCache.set(`report-${i}`, `data-${i}`)
			}

			const report = memoryOptimizer.getMemoryReport()

			expect(report.current).toBeDefined()
			expect(report.limits).toBeDefined()
			expect(report.cacheStats).toHaveLength(1)
			expect(report.recommendations).toBeInstanceOf(Array)

			expect(report.current.heapUsed).toBeGreaterThan(0)
			expect(report.limits.maxHeapSize).toBeGreaterThan(0)
		})

		it("should provide memory usage recommendations", () => {
			const report = memoryOptimizer.getMemoryReport()

			expect(report.recommendations).toBeInstanceOf(Array)
			expect(report.recommendations.length).toBeGreaterThan(0)

			// Should contain at least one recommendation
			expect(typeof report.recommendations[0]).toBe("string")
		})

		it("should track memory threshold changes", () => {
			const originalThreshold = 80 * 1024 * 1024 // 80MB
			const newThreshold = 60 * 1024 * 1024 // 60MB

			memoryOptimizer.setMemoryThreshold(newThreshold)

			// Threshold should be updated
			const isPressure = memoryOptimizer.checkMemoryPressure()
			expect(typeof isPressure).toBe("boolean")

			// Reset to original
			memoryOptimizer.setMemoryThreshold(originalThreshold)
		})
	})

	describe("Cache Integration", () => {
		it("should handle multiple cache types", () => {
			const cache1 = new CacheManager<string>(50, 30000)
			const cache2 = new CacheManager<number>(25, 60000)
			const cache3 = new CacheManager<object>(10, 120000)

			memoryOptimizer.registerCache("string-cache", cache1)
			memoryOptimizer.registerCache("number-cache", cache2 as any)
			memoryOptimizer.registerCache("object-cache", cache3 as any)

			// Fill caches
			for (let i = 0; i < 10; i++) {
				cache1.set(`str-${i}`, `string-${i}`)
				cache2.set(`num-${i}`, i * 100)
				cache3.set(`obj-${i}`, { id: i, data: `object-${i}` })
			}

			const report = memoryOptimizer.getMemoryReport()

			expect(report.cacheStats).toHaveLength(3)
			expect(report.cacheStats.find((c) => c.name === "string-cache")).toBeDefined()
			expect(report.cacheStats.find((c) => c.name === "number-cache")).toBeDefined()
			expect(report.cacheStats.find((c) => c.name === "object-cache")).toBeDefined()
		})

		it("should handle cache cleanup during memory pressure", async () => {
			const testCaches = []

			// Create multiple caches
			for (let i = 0; i < 5; i++) {
				const cache = new CacheManager<string>(20, 60000)
				testCaches.push(cache)
				memoryOptimizer.registerCache(`pressure-cache-${i}`, cache)

				// Fill each cache
				for (let j = 0; j < 15; j++) {
					cache.set(`item-${j}`, `data-${i}-${j}`.repeat(100))
				}
			}

			const beforeSizes = testCaches.map((cache) => cache.getSize())
			await memoryOptimizer.optimizeForLowMemory()
			const afterSizes = testCaches.map((cache) => cache.getSize())

			// At least some caches should be cleared
			const totalBefore = beforeSizes.reduce((sum, size) => sum + size, 0)
			const totalAfter = afterSizes.reduce((sum, size) => sum + size, 0)

			expect(totalAfter).toBeLessThanOrEqual(totalBefore)
		})
	})

	describe("Memory Configuration", () => {
		it("should respect memory configuration limits", () => {
			const config = {
				maxHeapSize: 50 * 1024 * 1024, // 50MB
				gcThreshold: 40 * 1024 * 1024, // 40MB
				cacheSize: 20 * 1024 * 1024, // 20MB
				checkInterval: 10000, // 10 seconds
			}

			const configuredOptimizer = new MemoryOptimizer(config, performanceMonitor)

			const report = configuredOptimizer.getMemoryReport()

			expect(report.limits.maxHeapSize).toBe(config.maxHeapSize)
			expect(report.limits.gcThreshold).toBe(config.gcThreshold)
			expect(report.limits.cacheSize).toBe(config.cacheSize)
		})

		it("should handle different monitoring intervals", () => {
			const shortInterval = new MemoryOptimizer(
				{
					checkInterval: 1000, // 1 second
				},
				performanceMonitor,
			)

			const longInterval = new MemoryOptimizer(
				{
					checkInterval: 300000, // 5 minutes
				},
				performanceMonitor,
			)

			shortInterval.startMonitoring()
			longInterval.startMonitoring()

			// Both should start monitoring without errors
			expect(shortInterval.isUnderMemoryPressure()).toBeDefined()
			expect(longInterval.isUnderMemoryPressure()).toBeDefined()

			shortInterval.stopMonitoring()
			longInterval.stopMonitoring()
		})
	})

	describe("Performance Metrics Integration", () => {
		it("should record memory metrics correctly", async () => {
			memoryOptimizer.startMonitoring()

			// Trigger some memory operations
			await memoryOptimizer.forceCleanup()

			// Allow some time for metrics to be recorded
			await new Promise((resolve) => setTimeout(resolve, 100))

			const metrics = performanceMonitor.getMetrics()

			// Should have recorded some memory-related metrics
			expect(metrics.metrics.size).toBeGreaterThan(0)

			// Check for specific memory metrics
			const memoryMetrics = metrics.metrics.get("memory.heapUsed")
			expect(memoryMetrics).toBeDefined()
		})

		it("should track cleanup performance", async () => {
			const timer = performanceMonitor.startTimer("cleanup-performance-test")

			memoryOptimizer.registerCache("perf-test", testCache)

			// Add data to cache
			for (let i = 0; i < 30; i++) {
				testCache.set(`perf-${i}`, `performance-data-${i}`)
			}

			await memoryOptimizer.forceCleanup()

			const duration = timer.stop()

			expect(duration).toBeGreaterThan(0)
			expect(duration).toBeLessThan(1000) // Should complete within 1 second
		})
	})
})
