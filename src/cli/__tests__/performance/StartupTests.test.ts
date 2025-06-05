import { StartupOptimizer } from "../../optimization/StartupOptimizer"
import { PerformanceMonitoringService } from "../../optimization/PerformanceMonitoringService"
import { performance } from "perf_hooks"

describe("Startup Performance Tests", () => {
	let startupOptimizer: StartupOptimizer
	let performanceMonitor: PerformanceMonitoringService

	beforeEach(() => {
		performanceMonitor = new PerformanceMonitoringService()
		startupOptimizer = new StartupOptimizer(performanceMonitor)
	})

	describe("Module Loading", () => {
		it("should preload critical modules quickly", async () => {
			const startTime = performance.now()

			await startupOptimizer.optimizeStartup()

			const endTime = performance.now()
			const duration = endTime - startTime

			expect(duration).toBeLessThan(2000) // Should complete within 2 seconds

			const metrics = startupOptimizer.getStartupMetrics()
			expect(metrics.preloadedModules.length).toBeGreaterThan(0)
			expect(metrics.totalStartupTime).toBeLessThan(2000)
		})

		it("should cache module loading results", async () => {
			await startupOptimizer.optimizeStartup()

			// First load
			const timer1 = performance.now()
			await startupOptimizer.loadModule("./services/CLIUIService")
			const duration1 = performance.now() - timer1

			// Second load (should be cached)
			const timer2 = performance.now()
			await startupOptimizer.loadModule("./services/CLIUIService")
			const duration2 = performance.now() - timer2

			expect(duration2).toBeLessThan(duration1) // Cache should be faster
			expect(duration2).toBeLessThan(10) // Should be very fast from cache
		})

		it("should handle module loading failures gracefully", async () => {
			await expect(startupOptimizer.loadModule("./non-existent-module")).rejects.toThrow()

			// Should still be able to load valid modules
			await expect(startupOptimizer.loadModule("./services/CLIUIService")).resolves.toBeDefined()
		})

		it("should track module load times", async () => {
			await startupOptimizer.optimizeStartup()

			await startupOptimizer.loadModule("./services/CLIUIService")
			await startupOptimizer.loadModule("./config/CliConfigManager")

			const metrics = startupOptimizer.getStartupMetrics()

			expect(metrics.moduleLoadTimes.size).toBeGreaterThan(0)

			for (const [module, loadTime] of metrics.moduleLoadTimes) {
				expect(typeof module).toBe("string")
				expect(typeof loadTime).toBe("number")
				expect(loadTime).toBeGreaterThan(0)
				expect(loadTime).toBeLessThan(5000) // No module should take more than 5 seconds
			}
		})
	})

	describe("Lazy Loading", () => {
		it("should register lazy modules correctly", async () => {
			await startupOptimizer.optimizeStartup()

			const lazyModule = await startupOptimizer.getLazyModule("browser")
			expect(lazyModule).toBeDefined()
		})

		it("should load lazy modules on demand", async () => {
			await startupOptimizer.optimizeStartup()

			const modules = ["browser", "mcp", "session", "batch"]

			for (const moduleName of modules) {
				const timer = performance.now()
				const module = await startupOptimizer.getLazyModule(moduleName)
				const duration = performance.now() - timer

				expect(module).toBeDefined()
				expect(duration).toBeLessThan(1000) // Should load within 1 second
			}
		})

		it("should cache lazy module results", async () => {
			await startupOptimizer.optimizeStartup()

			// First load
			const timer1 = performance.now()
			const module1 = await startupOptimizer.getLazyModule("session")
			const duration1 = performance.now() - timer1

			// Second load (should be cached)
			const timer2 = performance.now()
			const module2 = await startupOptimizer.getLazyModule("session")
			const duration2 = performance.now() - timer2

			expect(module1).toBe(module2) // Should be the same cached instance
			expect(duration2).toBeLessThan(duration1) // Cache should be faster
			expect(duration2).toBeLessThan(5) // Should be very fast from cache
		})

		it("should handle lazy module errors", async () => {
			await startupOptimizer.optimizeStartup()

			await expect(startupOptimizer.getLazyModule("non-existent")).rejects.toThrow()
		})
	})

	describe("Cache Management", () => {
		it("should provide cache statistics", async () => {
			await startupOptimizer.optimizeStartup()

			// Load some modules
			await startupOptimizer.loadModule("./services/CLIUIService")
			await startupOptimizer.getLazyModule("browser")

			const cacheStats = startupOptimizer.getCacheStats()

			expect(cacheStats.size).toBeGreaterThan(0)
			expect(cacheStats.hitRate).toBeGreaterThanOrEqual(0)
			expect(cacheStats.modules).toBeInstanceOf(Array)
			expect(cacheStats.modules.length).toBeGreaterThan(0)
		})

		it("should clear caches when requested", async () => {
			await startupOptimizer.optimizeStartup()

			// Load some modules
			await startupOptimizer.loadModule("./services/CLIUIService")
			await startupOptimizer.getLazyModule("browser")

			const beforeClear = startupOptimizer.getCacheStats()
			expect(beforeClear.size).toBeGreaterThan(0)

			startupOptimizer.clearCaches()

			const afterClear = startupOptimizer.getCacheStats()
			expect(afterClear.size).toBe(0)
		})

		it("should warmup caches effectively", async () => {
			const timer = performance.now()

			await startupOptimizer.warmupCaches()

			const duration = performance.now() - timer

			expect(duration).toBeLessThan(3000) // Should complete within 3 seconds

			const cacheStats = startupOptimizer.getCacheStats()
			expect(cacheStats.size).toBeGreaterThan(0)
		})

		it("should track memory usage of caches", async () => {
			await startupOptimizer.optimizeStartup()

			// Load multiple modules
			await startupOptimizer.loadModule("./services/CLIUIService")
			await startupOptimizer.loadModule("./config/CliConfigManager")
			await startupOptimizer.getLazyModule("browser")
			await startupOptimizer.getLazyModule("session")

			const memoryUsage = startupOptimizer.getMemoryUsage()

			expect(memoryUsage.moduleCache).toBeGreaterThan(0)
			expect(memoryUsage.totalModules).toBeGreaterThan(0)
		})
	})

	describe("Mode-Specific Preloading", () => {
		it("should preload modules for specific modes", async () => {
			const modes = ["code", "debug", "architect", "batch", "session", "mcp"]

			for (const mode of modes) {
				const timer = performance.now()

				await startupOptimizer.preloadForMode(mode)

				const duration = performance.now() - timer

				expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
			}
		})

		it("should handle invalid modes gracefully", async () => {
			await expect(startupOptimizer.preloadForMode("invalid-mode")).resolves.toBeUndefined()
		})

		it("should cache mode-specific preloads", async () => {
			// First preload
			const timer1 = performance.now()
			await startupOptimizer.preloadForMode("code")
			const duration1 = performance.now() - timer1

			// Second preload (should be faster due to caching)
			const timer2 = performance.now()
			await startupOptimizer.preloadForMode("code")
			const duration2 = performance.now() - timer2

			expect(duration2).toBeLessThanOrEqual(duration1)
		})
	})

	describe("Memory Optimization", () => {
		it("should optimize memory usage when requested", async () => {
			await startupOptimizer.optimizeStartup()

			// Load many modules to create memory pressure
			const modules = ["browser", "mcp", "session", "batch", "automation", "docs"]
			for (const module of modules) {
				await startupOptimizer.getLazyModule(module)
			}

			const beforeOptimization = startupOptimizer.getMemoryUsage()

			await startupOptimizer.optimizeForMemory()

			const afterOptimization = startupOptimizer.getMemoryUsage()

			// Memory optimization should have been attempted
			expect(afterOptimization).toBeDefined()
		})

		it("should respect memory limits during module loading", async () => {
			await startupOptimizer.optimizeStartup()

			const initialMemory = process.memoryUsage().heapUsed

			// Load multiple modules
			const loadPromises = []
			for (let i = 0; i < 5; i++) {
				loadPromises.push(startupOptimizer.getLazyModule("browser"))
				loadPromises.push(startupOptimizer.getLazyModule("session"))
			}

			await Promise.all(loadPromises)

			const finalMemory = process.memoryUsage().heapUsed
			const memoryIncrease = finalMemory - initialMemory

			// Should not use excessive memory
			expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 50MB
		})
	})

	describe("Startup Metrics", () => {
		it("should provide comprehensive startup metrics", async () => {
			await startupOptimizer.optimizeStartup()

			const metrics = startupOptimizer.getStartupMetrics()

			expect(metrics).toHaveProperty("totalStartupTime")
			expect(metrics).toHaveProperty("moduleLoadTimes")
			expect(metrics).toHaveProperty("cacheHitRate")
			expect(metrics).toHaveProperty("preloadedModules")
			expect(metrics).toHaveProperty("lazyModules")

			expect(metrics.totalStartupTime).toBeGreaterThan(0)
			expect(metrics.moduleLoadTimes).toBeInstanceOf(Map)
			expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0)
			expect(metrics.preloadedModules).toBeInstanceOf(Array)
			expect(metrics.lazyModules).toBeInstanceOf(Array)
		})

		it("should track cache hit rates accurately", async () => {
			await startupOptimizer.optimizeStartup()

			// Load the same module multiple times
			await startupOptimizer.loadModule("./services/CLIUIService")
			await startupOptimizer.loadModule("./services/CLIUIService")
			await startupOptimizer.loadModule("./services/CLIUIService")

			const metrics = startupOptimizer.getStartupMetrics()

			// Should have some cache hits
			expect(metrics.cacheHitRate).toBeGreaterThan(0)
		})

		it("should measure startup performance consistently", async () => {
			const runs = []

			// Run startup optimization multiple times
			for (let i = 0; i < 3; i++) {
				const optimizer = new StartupOptimizer(performanceMonitor)
				const timer = performance.now()

				await optimizer.optimizeStartup()

				const duration = performance.now() - timer
				runs.push(duration)
			}

			// All runs should complete within reasonable time
			for (const duration of runs) {
				expect(duration).toBeLessThan(3000) // 3 seconds
				expect(duration).toBeGreaterThan(0)
			}

			// Performance should be relatively consistent
			const average = runs.reduce((sum, time) => sum + time, 0) / runs.length
			const variance = runs.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / runs.length
			const standardDeviation = Math.sqrt(variance)

			// Standard deviation should be reasonable (less than 50% of average)
			expect(standardDeviation).toBeLessThan(average * 0.5)
		})
	})

	describe("Error Handling", () => {
		it("should handle startup failures gracefully", async () => {
			// Mock a module loading failure
			const originalLoadModule = startupOptimizer.loadModule.bind(startupOptimizer)
			startupOptimizer.loadModule = jest.fn().mockRejectedValueOnce(new Error("Module load failed"))

			// Should still complete startup despite individual module failures
			await expect(startupOptimizer.optimizeStartup()).resolves.toBeDefined()

			// Restore original method
			startupOptimizer.loadModule = originalLoadModule
		})

		it("should continue working after cache clear errors", async () => {
			await startupOptimizer.optimizeStartup()

			// This should not throw even if there are no caches to clear
			expect(() => startupOptimizer.clearCaches()).not.toThrow()

			// Should still be able to load modules after clearing
			await expect(startupOptimizer.loadModule("./services/CLIUIService")).resolves.toBeDefined()
		})

		it("should handle concurrent module loading", async () => {
			await startupOptimizer.optimizeStartup()

			// Load the same module concurrently
			const promises = []
			for (let i = 0; i < 10; i++) {
				promises.push(startupOptimizer.loadModule("./services/CLIUIService"))
			}

			const results = await Promise.all(promises)

			// All should succeed and return the same module
			expect(results).toHaveLength(10)
			for (const result of results) {
				expect(result).toBeDefined()
				expect(result).toBe(results[0]) // Should be the same cached instance
			}
		})
	})
})
