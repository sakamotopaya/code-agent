/**
 * Performance optimization components for the CLI
 */

export { PerformanceMonitoringService } from "./PerformanceMonitoringService"
export type {
	PerformanceTimer,
	MetricData,
	PerformanceMetrics,
	MemoryMetrics,
	ProfileResult,
	TimeRange,
	PerformanceReport,
	MetricUnit,
	ExportFormat,
	Profiler,
	IPerformanceMonitoringService,
} from "./PerformanceMonitoringService"

export { StartupOptimizer } from "./StartupOptimizer"
export type { ModuleLoader, StartupMetrics } from "./StartupOptimizer"

export { MemoryOptimizer } from "./MemoryOptimizer"
export type { MemoryConfig, MemoryStats, CacheInterface } from "./MemoryOptimizer"

export { FileOptimizer } from "./FileOptimizer"
export type { FileOptimizerConfig, FileStats, FileCacheEntry } from "./FileOptimizer"

export { CacheManager, FileCache, ToolCache, McpCache } from "./CacheManager"
export type { CacheEntry, CacheStats, CacheConfig } from "./CacheManager"
