export interface PerformanceConfig {
	startup: {
		lazyLoadingEnabled: boolean
		preloadModules: string[]
		cacheEnabled: boolean
		optimizationLevel: "minimal" | "standard" | "aggressive"
		startupTimeTarget: number // milliseconds
	}
	memory: {
		maxHeapSize: number
		gcThreshold: number
		cacheSize: number
		monitoringEnabled: boolean
		checkInterval: number
		emergencyThreshold: number
	}
	fileOperations: {
		chunkSize: number
		streamingThreshold: number
		compressionEnabled: boolean
		maxConcurrentReads: number
		cacheEnabled: boolean
		cacheTtl: number
	}
	monitoring: {
		enabled: boolean
		metricsRetention: number
		profilingEnabled: boolean
		exportFormat: "json" | "csv" | "markdown"
		reportingInterval: number
	}
	caching: {
		fileCache: {
			maxEntries: number
			ttl: number
			maxSize: number
		}
		toolCache: {
			maxEntries: number
			ttl: number
			maxSize: number
		}
		mcpCache: {
			maxEntries: number
			ttl: number
			maxSize: number
		}
		globalStrategy: "lru" | "lfu" | "ttl"
	}
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
	startup: {
		lazyLoadingEnabled: true,
		preloadModules: ["ConfigurationService", "CLIUIService", "ArgumentParser", "ErrorHandlingService"],
		cacheEnabled: true,
		optimizationLevel: "standard",
		startupTimeTarget: 2000, // 2 seconds
	},
	memory: {
		maxHeapSize: 100 * 1024 * 1024, // 100MB
		gcThreshold: 80 * 1024 * 1024, // 80MB
		cacheSize: 50 * 1024 * 1024, // 50MB
		monitoringEnabled: true,
		checkInterval: 30000, // 30 seconds
		emergencyThreshold: 150 * 1024 * 1024, // 150MB
	},
	fileOperations: {
		chunkSize: 64 * 1024, // 64KB
		streamingThreshold: 10 * 1024 * 1024, // 10MB
		compressionEnabled: true,
		maxConcurrentReads: 5,
		cacheEnabled: true,
		cacheTtl: 5 * 60 * 1000, // 5 minutes
	},
	monitoring: {
		enabled: true,
		metricsRetention: 24 * 60 * 60 * 1000, // 24 hours
		profilingEnabled: false,
		exportFormat: "json",
		reportingInterval: 60000, // 1 minute
	},
	caching: {
		fileCache: {
			maxEntries: 50,
			ttl: 10 * 60 * 1000, // 10 minutes
			maxSize: 20 * 1024 * 1024, // 20MB
		},
		toolCache: {
			maxEntries: 100,
			ttl: 5 * 60 * 1000, // 5 minutes
			maxSize: 15 * 1024 * 1024, // 15MB
		},
		mcpCache: {
			maxEntries: 200,
			ttl: 2 * 60 * 1000, // 2 minutes
			maxSize: 10 * 1024 * 1024, // 10MB
		},
		globalStrategy: "lru",
	},
}

export const MINIMAL_PERFORMANCE_CONFIG: PerformanceConfig = {
	...DEFAULT_PERFORMANCE_CONFIG,
	startup: {
		...DEFAULT_PERFORMANCE_CONFIG.startup,
		lazyLoadingEnabled: false,
		preloadModules: ["CLIUIService"],
		optimizationLevel: "minimal",
	},
	memory: {
		...DEFAULT_PERFORMANCE_CONFIG.memory,
		maxHeapSize: 50 * 1024 * 1024, // 50MB
		gcThreshold: 40 * 1024 * 1024, // 40MB
		cacheSize: 20 * 1024 * 1024, // 20MB
		monitoringEnabled: false,
	},
	monitoring: {
		...DEFAULT_PERFORMANCE_CONFIG.monitoring,
		enabled: false,
		profilingEnabled: false,
	},
}

export const AGGRESSIVE_PERFORMANCE_CONFIG: PerformanceConfig = {
	...DEFAULT_PERFORMANCE_CONFIG,
	startup: {
		...DEFAULT_PERFORMANCE_CONFIG.startup,
		lazyLoadingEnabled: true,
		preloadModules: [
			"ConfigurationService",
			"CLIUIService",
			"ArgumentParser",
			"ErrorHandlingService",
			"CLIBrowserService",
			"SessionManager",
			"BatchProcessor",
		],
		optimizationLevel: "aggressive",
		startupTimeTarget: 1000, // 1 second
	},
	memory: {
		...DEFAULT_PERFORMANCE_CONFIG.memory,
		maxHeapSize: 200 * 1024 * 1024, // 200MB
		gcThreshold: 160 * 1024 * 1024, // 160MB
		cacheSize: 100 * 1024 * 1024, // 100MB
		checkInterval: 15000, // 15 seconds
		emergencyThreshold: 300 * 1024 * 1024, // 300MB
	},
	fileOperations: {
		...DEFAULT_PERFORMANCE_CONFIG.fileOperations,
		chunkSize: 128 * 1024, // 128KB
		maxConcurrentReads: 10,
		cacheTtl: 15 * 60 * 1000, // 15 minutes
	},
	monitoring: {
		...DEFAULT_PERFORMANCE_CONFIG.monitoring,
		profilingEnabled: true,
		reportingInterval: 30000, // 30 seconds
	},
	caching: {
		fileCache: {
			maxEntries: 100,
			ttl: 30 * 60 * 1000, // 30 minutes
			maxSize: 50 * 1024 * 1024, // 50MB
		},
		toolCache: {
			maxEntries: 500,
			ttl: 15 * 60 * 1000, // 15 minutes
			maxSize: 30 * 1024 * 1024, // 30MB
		},
		mcpCache: {
			maxEntries: 1000,
			ttl: 10 * 60 * 1000, // 10 minutes
			maxSize: 20 * 1024 * 1024, // 20MB
		},
		globalStrategy: "lfu",
	},
}

export const PERFORMANCE_PRESETS = {
	minimal: MINIMAL_PERFORMANCE_CONFIG,
	standard: DEFAULT_PERFORMANCE_CONFIG,
	aggressive: AGGRESSIVE_PERFORMANCE_CONFIG,
} as const

export type PerformancePreset = keyof typeof PERFORMANCE_PRESETS

export class PerformanceConfigManager {
	private config: PerformanceConfig

	constructor(preset: PerformancePreset = "standard") {
		this.config = this.cloneConfig(PERFORMANCE_PRESETS[preset])
	}

	getConfig(): PerformanceConfig {
		return this.cloneConfig(this.config)
	}

	updateConfig(updates: Partial<PerformanceConfig>): void {
		this.config = this.mergeConfigs(this.config, updates)
	}

	setPreset(preset: PerformancePreset): void {
		this.config = this.cloneConfig(PERFORMANCE_PRESETS[preset])
	}

	validateConfig(config: PerformanceConfig): { valid: boolean; errors: string[] } {
		const errors: string[] = []

		// Validate startup configuration
		if (config.startup.startupTimeTarget < 500) {
			errors.push("Startup time target must be at least 500ms")
		}

		// Validate memory configuration
		if (config.memory.maxHeapSize < 50 * 1024 * 1024) {
			errors.push("Maximum heap size must be at least 50MB")
		}

		if (config.memory.gcThreshold >= config.memory.maxHeapSize) {
			errors.push("GC threshold must be less than maximum heap size")
		}

		if (config.memory.cacheSize >= config.memory.maxHeapSize) {
			errors.push("Cache size must be less than maximum heap size")
		}

		// Validate file operations configuration
		if (config.fileOperations.chunkSize < 1024) {
			errors.push("Chunk size must be at least 1KB")
		}

		if (config.fileOperations.maxConcurrentReads < 1) {
			errors.push("Maximum concurrent reads must be at least 1")
		}

		if (config.fileOperations.streamingThreshold < config.fileOperations.chunkSize) {
			errors.push("Streaming threshold must be at least equal to chunk size")
		}

		// Validate caching configuration
		for (const [cacheType, cacheConfig] of Object.entries(config.caching)) {
			if (cacheType === "globalStrategy") continue

			const cache = cacheConfig as { maxEntries: number; ttl: number; maxSize: number }

			if (cache.maxEntries < 1) {
				errors.push(`${cacheType} max entries must be at least 1`)
			}

			if (cache.ttl < 1000) {
				errors.push(`${cacheType} TTL must be at least 1 second`)
			}

			if (cache.maxSize < 1024 * 1024) {
				errors.push(`${cacheType} max size must be at least 1MB`)
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		}
	}

	optimizeForEnvironment(environment: "development" | "production" | "testing"): void {
		switch (environment) {
			case "development":
				this.updateConfig({
					monitoring: {
						...this.config.monitoring,
						enabled: true,
						profilingEnabled: true,
					},
					memory: {
						...this.config.memory,
						monitoringEnabled: true,
						checkInterval: 15000,
					},
				})
				break

			case "production":
				this.updateConfig({
					monitoring: {
						...this.config.monitoring,
						enabled: true,
						profilingEnabled: false,
					},
					memory: {
						...this.config.memory,
						monitoringEnabled: true,
						checkInterval: 60000,
					},
				})
				break

			case "testing":
				this.updateConfig({
					monitoring: {
						...this.config.monitoring,
						enabled: false,
						profilingEnabled: false,
					},
					memory: {
						...this.config.memory,
						monitoringEnabled: false,
					},
				})
				break
		}
	}

	optimizeForMemoryConstraints(maxMemoryMB: number): void {
		const maxMemoryBytes = maxMemoryMB * 1024 * 1024
		const gcThreshold = Math.floor(maxMemoryBytes * 0.8)
		const cacheSize = Math.floor(maxMemoryBytes * 0.4)

		this.updateConfig({
			memory: {
				...this.config.memory,
				maxHeapSize: maxMemoryBytes,
				gcThreshold,
				cacheSize,
				emergencyThreshold: Math.floor(maxMemoryBytes * 1.2),
			},
			caching: {
				...this.config.caching,
				fileCache: {
					...this.config.caching.fileCache,
					maxSize: Math.floor(cacheSize * 0.4),
				},
				toolCache: {
					...this.config.caching.toolCache,
					maxSize: Math.floor(cacheSize * 0.3),
				},
				mcpCache: {
					...this.config.caching.mcpCache,
					maxSize: Math.floor(cacheSize * 0.3),
				},
			},
		})
	}

	generateReport(): {
		config: PerformanceConfig
		preset: PerformancePreset | "custom"
		recommendations: string[]
	} {
		const preset = this.detectPreset()
		const recommendations = this.generateRecommendations()

		return {
			config: this.getConfig(),
			preset,
			recommendations,
		}
	}

	private cloneConfig(config: PerformanceConfig): PerformanceConfig {
		return JSON.parse(JSON.stringify(config))
	}

	private mergeConfigs(base: PerformanceConfig, updates: Partial<PerformanceConfig>): PerformanceConfig {
		const result = this.cloneConfig(base)

		for (const [key, value] of Object.entries(updates)) {
			if (typeof value === "object" && value !== null && !Array.isArray(value)) {
				result[key as keyof PerformanceConfig] = {
					...result[key as keyof PerformanceConfig],
					...value,
				} as any
			} else {
				;(result as any)[key] = value
			}
		}

		return result
	}

	private detectPreset(): PerformancePreset | "custom" {
		for (const [presetName, presetConfig] of Object.entries(PERFORMANCE_PRESETS)) {
			if (this.configsEqual(this.config, presetConfig)) {
				return presetName as PerformancePreset
			}
		}
		return "custom"
	}

	private configsEqual(a: PerformanceConfig, b: PerformanceConfig): boolean {
		return JSON.stringify(a) === JSON.stringify(b)
	}

	private generateRecommendations(): string[] {
		const recommendations: string[] = []
		const validation = this.validateConfig(this.config)

		if (!validation.valid) {
			recommendations.push(...validation.errors.map((error) => `Configuration issue: ${error}`))
		}

		// Memory recommendations
		const memoryRatio = this.config.memory.cacheSize / this.config.memory.maxHeapSize
		if (memoryRatio > 0.7) {
			recommendations.push("Cache size is large relative to max heap size. Consider reducing cache limits.")
		}

		// File operation recommendations
		if (this.config.fileOperations.maxConcurrentReads > 10) {
			recommendations.push("High concurrent read limit may cause memory pressure with large files.")
		}

		// Monitoring recommendations
		if (!this.config.monitoring.enabled) {
			recommendations.push("Consider enabling monitoring for better performance insights.")
		}

		if (this.config.monitoring.profilingEnabled) {
			recommendations.push("Profiling is enabled - this may impact performance in production.")
		}

		if (recommendations.length === 0) {
			recommendations.push("Configuration appears optimal for current settings.")
		}

		return recommendations
	}

	exportConfig(): string {
		return JSON.stringify(this.config, null, 2)
	}

	importConfig(configJson: string): void {
		try {
			const config = JSON.parse(configJson) as PerformanceConfig
			const validation = this.validateConfig(config)

			if (!validation.valid) {
				throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`)
			}

			this.config = config
		} catch (error) {
			throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}

export function createPerformanceConfig(
	preset: PerformancePreset = "standard",
	overrides?: Partial<PerformanceConfig>,
): PerformanceConfig {
	const manager = new PerformanceConfigManager(preset)

	if (overrides) {
		manager.updateConfig(overrides)
	}

	return manager.getConfig()
}

export function detectOptimalPreset(systemInfo: {
	totalMemoryMB: number
	cpuCores: number
	isProduction: boolean
}): PerformancePreset {
	const { totalMemoryMB, cpuCores, isProduction } = systemInfo

	// Low resource systems
	if (totalMemoryMB < 512 || cpuCores < 2) {
		return "minimal"
	}

	// High resource systems in production
	if (totalMemoryMB > 2048 && cpuCores >= 4 && isProduction) {
		return "aggressive"
	}

	// Default for most systems
	return "standard"
}
