import { performance } from "perf_hooks"
import { PerformanceMonitoringService } from "./PerformanceMonitoringService"

export interface ModuleLoader {
	(): Promise<any>
}

export interface StartupMetrics {
	totalStartupTime: number
	moduleLoadTimes: Map<string, number>
	cacheHitRate: number
	preloadedModules: string[]
	lazyModules: string[]
}

export class StartupOptimizer {
	private static instance: StartupOptimizer
	private loadedModules = new Set<string>()
	private moduleCache = new Map<string, any>()
	private lazyModules = new Map<string, ModuleLoader>()
	private moduleLoadTimes = new Map<string, number>()
	private performanceMonitor: PerformanceMonitoringService
	private startupTimer?: number

	constructor(performanceMonitor?: PerformanceMonitoringService) {
		this.performanceMonitor = performanceMonitor || new PerformanceMonitoringService()
	}

	static getInstance(performanceMonitor?: PerformanceMonitoringService): StartupOptimizer {
		if (!StartupOptimizer.instance) {
			StartupOptimizer.instance = new StartupOptimizer(performanceMonitor)
		}
		return StartupOptimizer.instance
	}

	async optimizeStartup(): Promise<StartupMetrics> {
		const timer = this.performanceMonitor.startTimer("startup-optimization")
		this.startupTimer = performance.now()

		try {
			// Preload critical modules
			await this.preloadCriticalModules()

			// Initialize caches
			await this.initializeCaches()

			// Setup lazy loading
			this.setupLazyLoading()

			const totalTime = timer.stop()
			this.performanceMonitor.recordMetric("startup.total", totalTime, "ms")

			return this.getStartupMetrics()
		} catch (error) {
			timer.stop()
			throw error
		}
	}

	private async preloadCriticalModules(): Promise<void> {
		const criticalModules = [
			"./services/CLIUIService",
			"./parsers/ArgumentParser",
			"./config/CliConfigManager",
			"./services/ErrorHandlingService",
		]

		const loadPromises = criticalModules.map(async (module) => {
			const loadTimer = performance.now()
			try {
				await this.loadModule(module)
				const loadTime = performance.now() - loadTimer
				this.moduleLoadTimes.set(module, loadTime)
				this.performanceMonitor.recordMetric(`module.load.${module}`, loadTime, "ms")
			} catch (error) {
				// Log error but don't fail startup
				console.warn(`Failed to preload module ${module}:`, error)
			}
		})

		await Promise.all(loadPromises)
	}

	private async initializeCaches(): Promise<void> {
		const cacheTimer = performance.now()

		// Initialize various caches
		await this.initializeConfigCache()
		await this.initializeFileCache()
		await this.initializeToolCache()

		const cacheTime = performance.now() - cacheTimer
		this.performanceMonitor.recordMetric("startup.cache-init", cacheTime, "ms")
	}

	private setupLazyLoading(): void {
		const lazyModules = {
			browser: () => import("../services/CLIBrowserService"),
			mcp: () => import("../services/CLIMcpService"),
			session: () => import("../services/SessionManager"),
			batch: () => import("../services/BatchProcessor"),
			automation: () => import("../services/AutomationLogger"),
			recovery: () => import("../services/RecoveryManager"),
			docs: () => import("../docs/ManPageGenerator"),
		}

		Object.entries(lazyModules).forEach(([name, loader]) => {
			this.registerLazyModule(name, loader)
		})
	}

	async loadModule(modulePath: string): Promise<any> {
		if (this.moduleCache.has(modulePath)) {
			return this.moduleCache.get(modulePath)
		}

		const loadTimer = performance.now()

		try {
			const module = await import(modulePath)
			this.moduleCache.set(modulePath, module)
			this.loadedModules.add(modulePath)

			const loadTime = performance.now() - loadTimer
			this.moduleLoadTimes.set(modulePath, loadTime)

			return module
		} catch (error) {
			const loadTime = performance.now() - loadTimer
			this.performanceMonitor.recordMetric(`module.load-error.${modulePath}`, loadTime, "ms")
			throw error
		}
	}

	registerLazyModule(name: string, loader: ModuleLoader): void {
		this.lazyModules.set(name, loader)
	}

	async getLazyModule(name: string): Promise<any> {
		const loader = this.lazyModules.get(name)
		if (!loader) {
			throw new Error(`Lazy module '${name}' not found`)
		}

		const cacheKey = `lazy:${name}`
		if (this.moduleCache.has(cacheKey)) {
			return this.moduleCache.get(cacheKey)
		}

		const loadTimer = performance.now()
		const timer = this.performanceMonitor.startTimer(`lazy-load-${name}`)

		try {
			const module = await loader()
			this.moduleCache.set(cacheKey, module)
			this.loadedModules.add(cacheKey)

			const loadTime = timer.stop()
			this.moduleLoadTimes.set(cacheKey, loadTime)
			this.performanceMonitor.recordMetric(`lazy-module.${name}`, loadTime, "ms")

			return module
		} catch (error) {
			timer.stop()
			throw error
		}
	}

	private async initializeConfigCache(): Promise<void> {
		try {
			// Pre-cache common configuration patterns
			const { CliConfigManager } = await import("../config/CliConfigManager")
			const configManager = new CliConfigManager({ verbose: false })

			// This will populate the internal cache
			await configManager.loadConfiguration().catch(() => {
				// Ignore errors during cache initialization
			})
		} catch (error) {
			// Config module not available, skip
		}
	}

	private async initializeFileCache(): Promise<void> {
		// Initialize file system cache if available
		try {
			const fs = await import("fs/promises")
			// Pre-cache current working directory stats
			await fs.stat(process.cwd()).catch(() => {})
		} catch (error) {
			// Skip if not available
		}
	}

	private async initializeToolCache(): Promise<void> {
		// Initialize commonly used tool caches
		try {
			// Pre-initialize command validation cache
			const validCommands = ["help", "version", "config", "session", "mcp", "examples"]
			// This would populate any command validation caches
		} catch (error) {
			// Skip if not available
		}
	}

	getStartupMetrics(): StartupMetrics {
		const totalStartupTime = this.startupTimer ? performance.now() - this.startupTimer : 0

		const totalModules = this.loadedModules.size + this.lazyModules.size
		const loadedCount = this.loadedModules.size
		const cacheHitRate = totalModules > 0 ? (loadedCount / totalModules) * 100 : 0

		return {
			totalStartupTime,
			moduleLoadTimes: new Map(this.moduleLoadTimes),
			cacheHitRate,
			preloadedModules: Array.from(this.loadedModules),
			lazyModules: Array.from(this.lazyModules.keys()),
		}
	}

	clearCaches(): void {
		this.moduleCache.clear()
		this.moduleLoadTimes.clear()
		this.performanceMonitor.recordMetric("cache.cleared", 1, "count")
	}

	getCacheStats(): { size: number; hitRate: number; modules: string[] } {
		const size = this.moduleCache.size
		const modules = Array.from(this.moduleCache.keys())

		// Calculate approximate hit rate based on loaded vs requested modules
		const totalRequests = this.loadedModules.size
		const hitRate = totalRequests > 0 ? (size / totalRequests) * 100 : 0

		return { size, hitRate, modules }
	}

	async warmupCaches(): Promise<void> {
		const timer = this.performanceMonitor.startTimer("cache-warmup")

		try {
			// Warmup commonly used modules
			const commonModules = [
				"./services/CLIUIService",
				"./services/ErrorHandlingService",
				"./utils/format-detection",
			]

			await Promise.all(
				commonModules.map((module) =>
					this.loadModule(module).catch(() => {
						// Ignore individual module load failures
					}),
				),
			)

			timer.stop()
			this.performanceMonitor.recordMetric("cache.warmup-complete", 1, "count")
		} catch (error) {
			timer.stop()
			throw error
		}
	}

	async preloadForMode(mode: string): Promise<void> {
		const timer = this.performanceMonitor.startTimer(`preload-${mode}`)

		const modeModules: Record<string, string[]> = {
			code: ["./services/CLIBrowserService", "./recovery/RecoveryManager"],
			debug: ["./services/ErrorHandlingService", "./services/AutomationLogger"],
			architect: ["./docs/ManPageGenerator"],
			batch: ["./services/BatchProcessor", "./parsers/JSONBatchParser"],
			session: ["./services/SessionManager", "./services/SessionStorage"],
			mcp: ["./services/CLIMcpService", "./connections/SseMcpConnection"],
		}

		const modules = modeModules[mode] || []

		try {
			await Promise.all(
				modules.map((module) =>
					this.loadModule(module).catch(() => {
						// Ignore individual failures but log them
						console.debug(`Failed to preload ${module} for mode ${mode}`)
					}),
				),
			)

			timer.stop()
			this.performanceMonitor.recordMetric(`preload.${mode}`, timer.stop(), "ms")
		} catch (error) {
			timer.stop()
			throw error
		}
	}

	getMemoryUsage(): { moduleCache: number; totalModules: number } {
		// Rough estimation of module cache memory usage
		const moduleCache = this.moduleCache.size * 1024 // Rough estimate: 1KB per cached module
		const totalModules = this.loadedModules.size

		return { moduleCache, totalModules }
	}

	async optimizeForMemory(): Promise<void> {
		const timer = this.performanceMonitor.startTimer("memory-optimization")

		try {
			// Clear least recently used modules from cache
			const currentTime = Date.now()
			const cacheTimeout = 30 * 60 * 1000 // 30 minutes

			// This is a simplified LRU - in a real implementation,
			// you'd track access times for each module
			if (this.moduleCache.size > 50) {
				// Arbitrary limit
				const entriesToRemove = Math.floor(this.moduleCache.size * 0.3) // Remove 30%
				const keys = Array.from(this.moduleCache.keys())

				for (let i = 0; i < entriesToRemove; i++) {
					this.moduleCache.delete(keys[i])
				}
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc()
			}

			timer.stop()
			this.performanceMonitor.recordMetric("memory.optimization-complete", 1, "count")
		} catch (error) {
			timer.stop()
			throw error
		}
	}
}
