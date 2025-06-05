import { PerformanceMonitoringService } from "./PerformanceMonitoringService"

export interface MemoryConfig {
	maxHeapSize: number
	gcThreshold: number
	cacheSize: number
	checkInterval: number
}

export interface MemoryStats {
	heapUsed: number
	heapTotal: number
	external: number
	rss: number
	gc?: number
}

export interface CacheInterface {
	clearExpired(): void
	getSize(): number
	clear(): void
}

export class MemoryOptimizer {
	private memoryThreshold: number
	private gcInterval: NodeJS.Timeout | null = null
	private performanceMonitor: PerformanceMonitoringService
	private config: MemoryConfig
	private registeredCaches: Map<string, CacheInterface> = new Map()
	private isMonitoring = false

	constructor(config?: Partial<MemoryConfig>, performanceMonitor?: PerformanceMonitoringService) {
		this.config = {
			maxHeapSize: 100 * 1024 * 1024, // 100MB
			gcThreshold: 80 * 1024 * 1024, // 80MB
			cacheSize: 50 * 1024 * 1024, // 50MB
			checkInterval: 30000, // 30 seconds
			...config,
		}

		this.memoryThreshold = this.config.gcThreshold
		this.performanceMonitor = performanceMonitor || new PerformanceMonitoringService()
	}

	startMonitoring(): void {
		if (this.isMonitoring) {
			return
		}

		this.isMonitoring = true
		this.gcInterval = setInterval(() => {
			this.checkMemoryUsage()
		}, this.config.checkInterval)

		this.performanceMonitor.recordMetric("memory.monitoring-started", 1, "count")
	}

	stopMonitoring(): void {
		if (this.gcInterval) {
			clearInterval(this.gcInterval)
			this.gcInterval = null
			this.isMonitoring = false
			this.performanceMonitor.recordMetric("memory.monitoring-stopped", 1, "count")
		}
	}

	registerCache(name: string, cache: CacheInterface): void {
		this.registeredCaches.set(name, cache)
	}

	unregisterCache(name: string): void {
		this.registeredCaches.delete(name)
	}

	getMemoryStats(): MemoryStats {
		const usage = process.memoryUsage()
		const stats: MemoryStats = {
			heapUsed: usage.heapUsed,
			heapTotal: usage.heapTotal,
			external: usage.external,
			rss: usage.rss,
		}

		// Add GC count if available (Node.js with --expose-gc)
		if (global.gc && (process as any).getHeapStatistics) {
			try {
				const heapStats = (process as any).getHeapStatistics()
				stats.gc = heapStats.number_of_native_contexts
			} catch (error) {
				// GC stats not available
			}
		}

		return stats
	}

	async forceCleanup(): Promise<MemoryStats> {
		const timer = this.performanceMonitor.startTimer("memory-cleanup")
		const beforeStats = this.getMemoryStats()

		try {
			await this.performCleanup()

			const afterStats = this.getMemoryStats()
			const duration = timer.stop()

			this.performanceMonitor.recordMetric("memory.cleanup-duration", duration, "ms")
			this.performanceMonitor.recordMetric("memory.freed", beforeStats.heapUsed - afterStats.heapUsed, "bytes")

			return afterStats
		} catch (error) {
			timer.stop()
			throw error
		}
	}

	checkMemoryPressure(): boolean {
		const usage = this.getMemoryStats()
		const pressureThreshold = this.config.maxHeapSize * 0.9 // 90% of max

		const underPressure = usage.heapUsed > pressureThreshold

		if (underPressure) {
			this.performanceMonitor.recordMetric("memory.pressure-detected", 1, "count")
		}

		return underPressure
	}

	async optimizeForLowMemory(): Promise<void> {
		const timer = this.performanceMonitor.startTimer("memory-low-optimization")

		try {
			// Clear all non-essential caches
			await this.clearAllCaches()

			// Force garbage collection multiple times
			if (global.gc) {
				for (let i = 0; i < 3; i++) {
					global.gc()
					// Small delay between GC calls
					await new Promise((resolve) => setTimeout(resolve, 10))
				}
			}

			// Reduce cache sizes
			this.reduceCacheSizes()

			timer.stop()
			this.performanceMonitor.recordMetric("memory.low-optimization-complete", 1, "count")
		} catch (error) {
			timer.stop()
			throw error
		}
	}

	getMemoryReport(): {
		current: MemoryStats
		limits: MemoryConfig
		cacheStats: Array<{ name: string; size: number }>
		recommendations: string[]
	} {
		const current = this.getMemoryStats()
		const cacheStats = Array.from(this.registeredCaches.entries()).map(([name, cache]) => ({
			name,
			size: cache.getSize(),
		}))

		const recommendations = this.generateMemoryRecommendations(current, cacheStats)

		return {
			current,
			limits: this.config,
			cacheStats,
			recommendations,
		}
	}

	private checkMemoryUsage(): void {
		const usage = this.getMemoryStats()

		// Record current memory metrics
		this.performanceMonitor.recordMetric("memory.heapUsed", usage.heapUsed, "bytes")
		this.performanceMonitor.recordMetric("memory.heapTotal", usage.heapTotal, "bytes")
		this.performanceMonitor.recordMetric("memory.external", usage.external, "bytes")
		this.performanceMonitor.recordMetric("memory.rss", usage.rss, "bytes")

		// Calculate memory usage percentage
		const heapUsagePercent = (usage.heapUsed / this.config.maxHeapSize) * 100
		this.performanceMonitor.recordMetric("memory.heap-usage-percent", heapUsagePercent, "percent")

		// Check if we need cleanup
		if (usage.heapUsed > this.memoryThreshold) {
			this.performCleanup().catch((error) => {
				console.warn("Automatic memory cleanup failed:", error)
			})
		}

		// Check for memory pressure
		if (this.checkMemoryPressure()) {
			console.warn(`Memory pressure detected: ${Math.round(heapUsagePercent)}% of limit used`)
		}
	}

	private async performCleanup(): Promise<void> {
		const timer = this.performanceMonitor.startTimer("memory-cleanup-internal")

		try {
			// Clear expired caches
			this.clearExpiredCaches()

			// Force garbage collection if available
			if (global.gc) {
				global.gc()
			}

			// Clean up temporary files (if any cleanup handlers are registered)
			await this.cleanupTempFiles()

			timer.stop()
			this.performanceMonitor.recordMetric("memory.cleanup-completed", 1, "count")
		} catch (error) {
			timer.stop()
			throw error
		}
	}

	private clearExpiredCaches(): void {
		let clearedCount = 0

		for (const [name, cache] of this.registeredCaches.entries()) {
			try {
				const sizeBefore = cache.getSize()
				cache.clearExpired()
				const sizeAfter = cache.getSize()

				if (sizeBefore > sizeAfter) {
					clearedCount++
					this.performanceMonitor.recordMetric(
						`cache.${name}.cleared-expired`,
						sizeBefore - sizeAfter,
						"count",
					)
				}
			} catch (error) {
				console.warn(`Failed to clear expired items from cache ${name}:`, error)
			}
		}

		if (clearedCount > 0) {
			this.performanceMonitor.recordMetric("memory.caches-cleared", clearedCount, "count")
		}
	}

	private async clearAllCaches(): Promise<void> {
		let clearedCount = 0

		for (const [name, cache] of this.registeredCaches.entries()) {
			try {
				const sizeBefore = cache.getSize()
				cache.clear()

				if (sizeBefore > 0) {
					clearedCount++
					this.performanceMonitor.recordMetric(`cache.${name}.full-clear`, sizeBefore, "count")
				}
			} catch (error) {
				console.warn(`Failed to clear cache ${name}:`, error)
			}
		}

		if (clearedCount > 0) {
			this.performanceMonitor.recordMetric("memory.all-caches-cleared", clearedCount, "count")
		}
	}

	private reduceCacheSizes(): void {
		// This would reduce the maximum size of registered caches
		// Implementation depends on cache interfaces supporting size limits
		this.performanceMonitor.recordMetric("memory.cache-sizes-reduced", 1, "count")
	}

	private async cleanupTempFiles(): Promise<void> {
		// Placeholder for temporary file cleanup
		// In a real implementation, this would clean up any temporary files
		// created during CLI operations

		try {
			const fs = await import("fs/promises")
			const path = await import("path")
			const os = await import("os")

			const tempDir = path.join(os.tmpdir(), "roo-cli")

			try {
				const stats = await fs.stat(tempDir)
				if (stats.isDirectory()) {
					// Clean up old temp files (older than 1 hour)
					const files = await fs.readdir(tempDir)
					const oneHourAgo = Date.now() - 60 * 60 * 1000

					for (const file of files) {
						const filePath = path.join(tempDir, file)
						try {
							const fileStats = await fs.stat(filePath)
							if (fileStats.mtime.getTime() < oneHourAgo) {
								await fs.unlink(filePath)
							}
						} catch (error) {
							// Ignore errors for individual files
						}
					}
				}
			} catch (error) {
				// Temp directory doesn't exist or other error, ignore
			}
		} catch (error) {
			// Module loading failed, ignore
		}
	}

	private generateMemoryRecommendations(
		stats: MemoryStats,
		cacheStats: Array<{ name: string; size: number }>,
	): string[] {
		const recommendations: string[] = []
		const heapUsagePercent = (stats.heapUsed / this.config.maxHeapSize) * 100

		if (heapUsagePercent > 90) {
			recommendations.push(
				"Memory usage is critically high (>90%). Consider increasing memory limits or optimizing operations.",
			)
		} else if (heapUsagePercent > 75) {
			recommendations.push("Memory usage is high (>75%). Monitor for potential memory leaks.")
		}

		if (stats.heapUsed > stats.heapTotal * 0.9) {
			recommendations.push("Heap is nearly full. Garbage collection may be frequent.")
		}

		const totalCacheSize = cacheStats.reduce((sum, cache) => sum + cache.size, 0)
		if (totalCacheSize > this.config.cacheSize) {
			recommendations.push(
				`Cache usage (${totalCacheSize}) exceeds limit (${this.config.cacheSize}). Consider reducing cache sizes.`,
			)
		}

		if (stats.external > 50 * 1024 * 1024) {
			// 50MB
			recommendations.push(
				"High external memory usage detected. Check for large buffers or C++ addon memory leaks.",
			)
		}

		if (recommendations.length === 0) {
			recommendations.push("Memory usage is within normal limits.")
		}

		return recommendations
	}

	setMemoryThreshold(threshold: number): void {
		this.memoryThreshold = threshold
		this.performanceMonitor.recordMetric("memory.threshold-updated", threshold, "bytes")
	}

	isUnderMemoryPressure(): boolean {
		return this.checkMemoryPressure()
	}

	async emergencyCleanup(): Promise<void> {
		console.warn("Performing emergency memory cleanup")

		const timer = this.performanceMonitor.startTimer("memory-emergency-cleanup")

		try {
			// Clear all caches immediately
			await this.clearAllCaches()

			// Multiple aggressive GC cycles
			if (global.gc) {
				for (let i = 0; i < 5; i++) {
					global.gc()
					await new Promise((resolve) => setTimeout(resolve, 5))
				}
			}

			// Clean up temp files
			await this.cleanupTempFiles()

			// Lower memory thresholds temporarily
			this.memoryThreshold = this.config.maxHeapSize * 0.6 // 60% instead of 80%

			timer.stop()
			this.performanceMonitor.recordMetric("memory.emergency-cleanup-complete", 1, "count")
		} catch (error) {
			timer.stop()
			throw error
		}
	}
}
