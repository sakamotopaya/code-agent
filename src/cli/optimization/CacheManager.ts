import { PerformanceMonitoringService } from "./PerformanceMonitoringService"

export interface CacheEntry<T> {
	data: T
	timestamp: number
	accessCount: number
	lastAccessed: number
	size: number
	ttl?: number
}

export interface CacheStats {
	size: number
	maxSize: number
	hitRate: number
	totalAccesses: number
	totalHits: number
	totalMisses: number
	totalEvictions: number
	averageAccessTime: number
	memoryUsage: number
}

export interface CacheConfig {
	maxSize: number
	ttl: number
	enableMetrics: boolean
	evictionStrategy: "lru" | "lfu" | "ttl"
}

export class CacheManager<T> {
	private cache = new Map<string, CacheEntry<T>>()
	private maxSize: number
	private ttl: number
	private performanceMonitor?: PerformanceMonitoringService
	private config: CacheConfig

	// Statistics
	private totalAccesses = 0
	private totalHits = 0
	private totalMisses = 0
	private totalEvictions = 0
	private accessTimes: number[] = []

	constructor(
		maxSize: number = 100,
		ttl: number = 300000, // 5 minutes
		config?: Partial<CacheConfig>,
		performanceMonitor?: PerformanceMonitoringService,
	) {
		this.maxSize = maxSize
		this.ttl = ttl
		this.performanceMonitor = performanceMonitor
		this.config = {
			maxSize,
			ttl,
			enableMetrics: true,
			evictionStrategy: "lru",
			...config,
		}
	}

	set(key: string, value: T, customTtl?: number): void {
		const startTime = Date.now()
		const size = this.calculateSize(value)
		const effectiveTtl = customTtl || this.ttl

		const entry: CacheEntry<T> = {
			data: value,
			timestamp: Date.now(),
			accessCount: 0,
			lastAccessed: Date.now(),
			size,
			ttl: effectiveTtl,
		}

		// Evict if necessary
		this.evictIfNecessary(size)

		// Remove existing entry if it exists to update size tracking
		if (this.cache.has(key)) {
			this.cache.delete(key)
		}

		this.cache.set(key, entry)

		if (this.config.enableMetrics && this.performanceMonitor) {
			const duration = Date.now() - startTime
			this.performanceMonitor.recordMetric("cache.set-duration", duration, "ms")
			this.performanceMonitor.recordMetric("cache.set-size", size, "bytes")
			this.performanceMonitor.recordMetric("cache.total-entries", this.cache.size, "count")
		}
	}

	get(key: string): T | undefined {
		const startTime = Date.now()
		this.totalAccesses++

		const entry = this.cache.get(key)

		if (!entry) {
			this.totalMisses++

			if (this.config.enableMetrics && this.performanceMonitor) {
				this.performanceMonitor.recordMetric("cache.miss", 1, "count")
			}

			return undefined
		}

		const now = Date.now()
		const entryTtl = entry.ttl || this.ttl

		// Check TTL
		if (now - entry.timestamp > entryTtl) {
			this.cache.delete(key)
			this.totalMisses++

			if (this.config.enableMetrics && this.performanceMonitor) {
				this.performanceMonitor.recordMetric("cache.expired", 1, "count")
			}

			return undefined
		}

		// Update access statistics
		entry.accessCount++
		entry.lastAccessed = now
		this.totalHits++

		const duration = Date.now() - startTime
		this.accessTimes.push(duration)

		// Keep only recent access times for averaging
		if (this.accessTimes.length > 1000) {
			this.accessTimes = this.accessTimes.slice(-500)
		}

		if (this.config.enableMetrics && this.performanceMonitor) {
			this.performanceMonitor.recordMetric("cache.hit", 1, "count")
			this.performanceMonitor.recordMetric("cache.access-duration", duration, "ms")
		}

		return entry.data
	}

	has(key: string): boolean {
		const entry = this.cache.get(key)

		if (!entry) {
			return false
		}

		const entryTtl = entry.ttl || this.ttl

		// Check TTL
		if (Date.now() - entry.timestamp > entryTtl) {
			this.cache.delete(key)
			return false
		}

		return true
	}

	delete(key: string): boolean {
		const result = this.cache.delete(key)

		if (result && this.config.enableMetrics && this.performanceMonitor) {
			this.performanceMonitor.recordMetric("cache.delete", 1, "count")
		}

		return result
	}

	clear(): void {
		const previousSize = this.cache.size
		this.cache.clear()
		this.resetStats()

		if (this.config.enableMetrics && this.performanceMonitor) {
			this.performanceMonitor.recordMetric("cache.clear", previousSize, "count")
		}
	}

	clearExpired(): void {
		const now = Date.now()
		let expiredCount = 0

		for (const [key, entry] of this.cache.entries()) {
			const entryTtl = entry.ttl || this.ttl

			if (now - entry.timestamp > entryTtl) {
				this.cache.delete(key)
				expiredCount++
			}
		}

		if (this.config.enableMetrics && this.performanceMonitor) {
			this.performanceMonitor.recordMetric("cache.expired-cleared", expiredCount, "count")
		}
	}

	size(): number {
		return this.cache.size
	}

	getSize(): number {
		return this.cache.size
	}

	keys(): IterableIterator<string> {
		return this.cache.keys()
	}

	values(): IterableIterator<T> {
		return Array.from(this.cache.values())
			.map((entry) => entry.data)
			[Symbol.iterator]()
	}

	entries(): IterableIterator<[string, T]> {
		const entries = Array.from(this.cache.entries()).map(([key, entry]) => [key, entry.data] as [string, T])
		return entries[Symbol.iterator]()
	}

	getStats(): CacheStats {
		const hitRate = this.totalAccesses > 0 ? (this.totalHits / this.totalAccesses) * 100 : 0
		const averageAccessTime =
			this.accessTimes.length > 0
				? this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length
				: 0

		let memoryUsage = 0
		for (const entry of this.cache.values()) {
			memoryUsage += entry.size
		}

		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			hitRate,
			totalAccesses: this.totalAccesses,
			totalHits: this.totalHits,
			totalMisses: this.totalMisses,
			totalEvictions: this.totalEvictions,
			averageAccessTime,
			memoryUsage,
		}
	}

	resetStats(): void {
		this.totalAccesses = 0
		this.totalHits = 0
		this.totalMisses = 0
		this.totalEvictions = 0
		this.accessTimes = []
	}

	setMaxSize(maxSize: number): void {
		this.maxSize = maxSize
		this.config.maxSize = maxSize

		// Evict if current size exceeds new limit
		this.evictIfNecessary(0)
	}

	setTtl(ttl: number): void {
		this.ttl = ttl
		this.config.ttl = ttl
	}

	getConfig(): CacheConfig {
		return { ...this.config }
	}

	updateConfig(newConfig: Partial<CacheConfig>): void {
		this.config = { ...this.config, ...newConfig }

		if (newConfig.maxSize !== undefined) {
			this.setMaxSize(newConfig.maxSize)
		}

		if (newConfig.ttl !== undefined) {
			this.setTtl(newConfig.ttl)
		}
	}

	getMemoryUsage(): number {
		let totalSize = 0
		for (const entry of this.cache.values()) {
			totalSize += entry.size
		}
		return totalSize
	}

	private evictIfNecessary(newEntrySize: number): void {
		const currentSize = this.cache.size
		const futureSize = currentSize + (newEntrySize > 0 ? 1 : 0)

		if (futureSize <= this.maxSize) {
			return
		}

		const entriesToEvict = futureSize - this.maxSize

		switch (this.config.evictionStrategy) {
			case "lru":
				this.evictLru(entriesToEvict)
				break
			case "lfu":
				this.evictLfu(entriesToEvict)
				break
			case "ttl":
				this.evictByTtl(entriesToEvict)
				break
			default:
				this.evictLru(entriesToEvict)
		}
	}

	private evictLru(count: number): void {
		const entries = Array.from(this.cache.entries()).sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)

		for (let i = 0; i < count && i < entries.length; i++) {
			const [key] = entries[i]
			this.cache.delete(key)
			this.totalEvictions++
		}

		if (this.config.enableMetrics && this.performanceMonitor) {
			this.performanceMonitor.recordMetric("cache.evict-lru", count, "count")
		}
	}

	private evictLfu(count: number): void {
		const entries = Array.from(this.cache.entries()).sort(([, a], [, b]) => a.accessCount - b.accessCount)

		for (let i = 0; i < count && i < entries.length; i++) {
			const [key] = entries[i]
			this.cache.delete(key)
			this.totalEvictions++
		}

		if (this.config.enableMetrics && this.performanceMonitor) {
			this.performanceMonitor.recordMetric("cache.evict-lfu", count, "count")
		}
	}

	private evictByTtl(count: number): void {
		const now = Date.now()
		const entries = Array.from(this.cache.entries())
			.map(([key, entry]) => {
				const entryTtl = entry.ttl || this.ttl
				const remainingTtl = entryTtl - (now - entry.timestamp)
				return { key, remainingTtl }
			})
			.sort((a, b) => a.remainingTtl - b.remainingTtl)

		for (let i = 0; i < count && i < entries.length; i++) {
			const { key } = entries[i]
			this.cache.delete(key)
			this.totalEvictions++
		}

		if (this.config.enableMetrics && this.performanceMonitor) {
			this.performanceMonitor.recordMetric("cache.evict-ttl", count, "count")
		}
	}

	private calculateSize(value: T): number {
		// Simple size estimation
		try {
			if (typeof value === "string") {
				return Buffer.byteLength(value, "utf8")
			} else if (typeof value === "object" && value !== null) {
				return Buffer.byteLength(JSON.stringify(value), "utf8")
			} else {
				return 8 // Default size for primitives
			}
		} catch (error) {
			return 100 // Default fallback size
		}
	}

	// Advanced methods for specific use cases

	mget(keys: string[]): Map<string, T> {
		const results = new Map<string, T>()

		for (const key of keys) {
			const value = this.get(key)
			if (value !== undefined) {
				results.set(key, value)
			}
		}

		return results
	}

	mset(entries: Map<string, T>, customTtl?: number): void {
		for (const [key, value] of entries) {
			this.set(key, value, customTtl)
		}
	}

	getOrSet(key: string, factory: () => T | Promise<T>, customTtl?: number): T | Promise<T> {
		const existing = this.get(key)

		if (existing !== undefined) {
			return existing
		}

		const result = factory()

		if (result instanceof Promise) {
			return result.then((value) => {
				this.set(key, value, customTtl)
				return value
			})
		} else {
			this.set(key, result, customTtl)
			return result
		}
	}

	refresh(key: string, factory: () => T | Promise<T>): T | Promise<T> | undefined {
		if (!this.has(key)) {
			return undefined
		}

		const result = factory()

		if (result instanceof Promise) {
			return result.then((value) => {
				this.set(key, value)
				return value
			})
		} else {
			this.set(key, result)
			return result
		}
	}

	peek(key: string): T | undefined {
		const entry = this.cache.get(key)

		if (!entry) {
			return undefined
		}

		const entryTtl = entry.ttl || this.ttl

		// Check TTL without updating access statistics
		if (Date.now() - entry.timestamp > entryTtl) {
			return undefined
		}

		return entry.data
	}

	export(): Array<{ key: string; value: T; metadata: Omit<CacheEntry<T>, "data"> }> {
		return Array.from(this.cache.entries()).map(([key, entry]) => ({
			key,
			value: entry.data,
			metadata: {
				timestamp: entry.timestamp,
				accessCount: entry.accessCount,
				lastAccessed: entry.lastAccessed,
				size: entry.size,
				ttl: entry.ttl,
			},
		}))
	}

	import(data: Array<{ key: string; value: T; metadata?: Partial<CacheEntry<T>> }>): void {
		for (const item of data) {
			const entry: CacheEntry<T> = {
				data: item.value,
				timestamp: item.metadata?.timestamp || Date.now(),
				accessCount: item.metadata?.accessCount || 0,
				lastAccessed: item.metadata?.lastAccessed || Date.now(),
				size: item.metadata?.size || this.calculateSize(item.value),
				ttl: item.metadata?.ttl,
			}

			this.cache.set(item.key, entry)
		}
	}
}

// Specialized cache managers for common use cases

export class FileCache extends CacheManager<string> {
	constructor(performanceMonitor?: PerformanceMonitoringService) {
		super(
			50, // Max 50 files
			10 * 60 * 1000, // 10 minute TTL
			{
				maxSize: 50,
				ttl: 10 * 60 * 1000,
				enableMetrics: true,
				evictionStrategy: "lru",
			},
			performanceMonitor,
		)
	}

	static getInstance(performanceMonitor?: PerformanceMonitoringService): FileCache {
		if (!FileCache.instance) {
			FileCache.instance = new FileCache(performanceMonitor)
		}
		return FileCache.instance
	}

	private static instance: FileCache
}

export class ToolCache extends CacheManager<any> {
	constructor(performanceMonitor?: PerformanceMonitoringService) {
		super(
			100, // Max 100 tool results
			5 * 60 * 1000, // 5 minute TTL
			{
				maxSize: 100,
				ttl: 5 * 60 * 1000,
				enableMetrics: true,
				evictionStrategy: "lfu",
			},
			performanceMonitor,
		)
	}

	static getInstance(performanceMonitor?: PerformanceMonitoringService): ToolCache {
		if (!ToolCache.instance) {
			ToolCache.instance = new ToolCache(performanceMonitor)
		}
		return ToolCache.instance
	}

	private static instance: ToolCache
}

export class McpCache extends CacheManager<any> {
	constructor(performanceMonitor?: PerformanceMonitoringService) {
		super(
			200, // Max 200 MCP responses
			2 * 60 * 1000, // 2 minute TTL
			{
				maxSize: 200,
				ttl: 2 * 60 * 1000,
				enableMetrics: true,
				evictionStrategy: "ttl",
			},
			performanceMonitor,
		)
	}

	static getInstance(performanceMonitor?: PerformanceMonitoringService): McpCache {
		if (!McpCache.instance) {
			McpCache.instance = new McpCache(performanceMonitor)
		}
		return McpCache.instance
	}

	private static instance: McpCache
}
