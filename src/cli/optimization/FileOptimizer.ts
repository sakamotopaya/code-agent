import { createReadStream, createWriteStream } from "fs"
import { stat, readFile, writeFile } from "fs/promises"
import { pipeline } from "stream/promises"
import { Transform } from "stream"
import { PerformanceMonitoringService } from "./PerformanceMonitoringService"

export interface FileOptimizerConfig {
	chunkSize: number
	streamingThreshold: number
	compressionEnabled: boolean
	maxConcurrentReads: number
	cacheEnabled: boolean
	cacheTtl: number
}

export interface FileStats {
	size: number
	isLarge: boolean
	readTime: number
	writeTime: number
	compressionRatio?: number
}

export interface FileCacheEntry {
	content: string
	timestamp: number
	size: number
	hits: number
}

export class FileOptimizer {
	private static readonly DEFAULT_CHUNK_SIZE = 64 * 1024 // 64KB chunks
	private static readonly DEFAULT_STREAMING_THRESHOLD = 10 * 1024 * 1024 // 10MB
	private static readonly MAX_CACHE_SIZE = 50 * 1024 * 1024 // 50MB

	private config: FileOptimizerConfig
	private performanceMonitor: PerformanceMonitoringService
	private fileCache = new Map<string, FileCacheEntry>()
	private totalCacheSize = 0
	private activeConcurrentReads = 0

	constructor(config?: Partial<FileOptimizerConfig>, performanceMonitor?: PerformanceMonitoringService) {
		this.config = {
			chunkSize: FileOptimizer.DEFAULT_CHUNK_SIZE,
			streamingThreshold: FileOptimizer.DEFAULT_STREAMING_THRESHOLD,
			compressionEnabled: true,
			maxConcurrentReads: 5,
			cacheEnabled: true,
			cacheTtl: 5 * 60 * 1000, // 5 minutes
			...config,
		}

		this.performanceMonitor = performanceMonitor || new PerformanceMonitoringService()
	}

	async readFileOptimized(filePath: string, useCache = true): Promise<string> {
		const timer = this.performanceMonitor.startTimer(`file-read-${filePath}`)

		try {
			// Check cache first
			if (useCache && this.config.cacheEnabled) {
				const cached = this.getCachedFile(filePath)
				if (cached) {
					timer.stop()
					this.performanceMonitor.recordMetric("file.cache-hit", 1, "count")
					return cached.content
				}
			}

			// Check if we're at concurrent read limit
			if (this.activeConcurrentReads >= this.config.maxConcurrentReads) {
				await this.waitForReadSlot()
			}

			this.activeConcurrentReads++

			try {
				const stats = await stat(filePath)
				const isLarge = stats.size > this.config.streamingThreshold

				this.performanceMonitor.recordMetric("file.size", stats.size, "bytes")
				this.performanceMonitor.recordMetric("file.is-large", isLarge ? 1 : 0, "count")

				let content: string
				if (isLarge) {
					content = await this.readLargeFile(filePath)
				} else {
					content = await this.readSmallFile(filePath)
				}

				// Cache the result if enabled and file is small enough
				if (useCache && this.config.cacheEnabled && stats.size < 1024 * 1024) {
					// Cache files < 1MB
					this.cacheFile(filePath, content, stats.size)
				}

				const duration = timer.stop()
				this.performanceMonitor.recordMetric("file.read-success", 1, "count")
				this.performanceMonitor.recordMetric("file.read-duration", duration, "ms")

				return content
			} finally {
				this.activeConcurrentReads--
			}
		} catch (error) {
			timer.stop()
			this.performanceMonitor.recordMetric("file.read-error", 1, "count")
			throw error
		}
	}

	async writeFileOptimized(filePath: string, content: string): Promise<void> {
		const timer = this.performanceMonitor.startTimer(`file-write-${filePath}`)
		const contentSize = Buffer.byteLength(content, "utf8")

		try {
			this.performanceMonitor.recordMetric("file.write-size", contentSize, "bytes")

			if (contentSize > this.config.streamingThreshold) {
				await this.writeLargeFile(filePath, content)
			} else {
				await this.writeSmallFile(filePath, content)
			}

			// Invalidate cache entry if it exists
			this.invalidateCacheEntry(filePath)

			const duration = timer.stop()
			this.performanceMonitor.recordMetric("file.write-success", 1, "count")
			this.performanceMonitor.recordMetric("file.write-duration", duration, "ms")
		} catch (error) {
			timer.stop()
			this.performanceMonitor.recordMetric("file.write-error", 1, "count")
			throw error
		}
	}

	async batchReadFiles(filePaths: string[]): Promise<Map<string, string>> {
		const timer = this.performanceMonitor.startTimer("file-batch-read")
		const results = new Map<string, string>()

		try {
			// Process files in chunks to respect concurrency limits
			const chunkSize = this.config.maxConcurrentReads

			for (let i = 0; i < filePaths.length; i += chunkSize) {
				const chunk = filePaths.slice(i, i + chunkSize)

				const chunkPromises = chunk.map(async (filePath) => {
					try {
						const content = await this.readFileOptimized(filePath)
						results.set(filePath, content)
					} catch (error) {
						console.warn(`Failed to read file ${filePath}:`, error)
						// Continue with other files
					}
				})

				await Promise.all(chunkPromises)

				// Check memory pressure between chunks
				if (i + chunkSize < filePaths.length) {
					await this.checkMemoryPressure()
				}
			}

			const duration = timer.stop()
			this.performanceMonitor.recordMetric("file.batch-read-count", results.size, "count")
			this.performanceMonitor.recordMetric("file.batch-read-duration", duration, "ms")

			return results
		} catch (error) {
			timer.stop()
			throw error
		}
	}

	async batchWriteFiles(files: Map<string, string>): Promise<void> {
		const timer = this.performanceMonitor.startTimer("file-batch-write")

		try {
			const fileEntries = Array.from(files.entries())
			const chunkSize = this.config.maxConcurrentReads

			for (let i = 0; i < fileEntries.length; i += chunkSize) {
				const chunk = fileEntries.slice(i, i + chunkSize)

				const chunkPromises = chunk.map(async ([filePath, content]) => {
					try {
						await this.writeFileOptimized(filePath, content)
					} catch (error) {
						console.warn(`Failed to write file ${filePath}:`, error)
						throw error // Re-throw to fail the batch operation
					}
				})

				await Promise.all(chunkPromises)

				// Check memory pressure between chunks
				if (i + chunkSize < fileEntries.length) {
					await this.checkMemoryPressure()
				}
			}

			const duration = timer.stop()
			this.performanceMonitor.recordMetric("file.batch-write-count", files.size, "count")
			this.performanceMonitor.recordMetric("file.batch-write-duration", duration, "ms")
		} catch (error) {
			timer.stop()
			throw error
		}
	}

	private async readLargeFile(filePath: string): Promise<string> {
		const chunks: Buffer[] = []
		let totalSize = 0

		const stream = createReadStream(filePath, {
			highWaterMark: this.config.chunkSize,
		})

		const collectChunks = new Transform({
			transform(chunk: Buffer, encoding, callback) {
				chunks.push(chunk)
				totalSize += chunk.length

				// Check memory pressure periodically
				if (chunks.length % 100 === 0) {
					setImmediate(() => {
						this.push(chunk)
						callback()
					})
				} else {
					this.push(chunk)
					callback()
				}
			},
		})

		try {
			await pipeline(stream, collectChunks)

			this.performanceMonitor.recordMetric("file.large-read-chunks", chunks.length, "count")
			this.performanceMonitor.recordMetric("file.large-read-size", totalSize, "bytes")

			return Buffer.concat(chunks).toString("utf8")
		} catch (error) {
			this.performanceMonitor.recordMetric("file.large-read-error", 1, "count")
			throw error
		}
	}

	private async readSmallFile(filePath: string): Promise<string> {
		try {
			const content = await readFile(filePath, "utf8")
			this.performanceMonitor.recordMetric("file.small-read-success", 1, "count")
			return content
		} catch (error) {
			this.performanceMonitor.recordMetric("file.small-read-error", 1, "count")
			throw error
		}
	}

	private async writeLargeFile(filePath: string, content: string): Promise<void> {
		const stream = createWriteStream(filePath)
		const buffer = Buffer.from(content, "utf8")
		let bytesWritten = 0

		try {
			for (let i = 0; i < buffer.length; i += this.config.chunkSize) {
				const chunk = buffer.subarray(i, i + this.config.chunkSize)

				await new Promise<void>((resolve, reject) => {
					stream.write(chunk, (error) => {
						if (error) {
							reject(error)
						} else {
							bytesWritten += chunk.length
							resolve()
						}
					})
				})

				// Check memory pressure periodically
				if (i % (this.config.chunkSize * 10) === 0) {
					await this.checkMemoryPressure()
				}
			}

			await new Promise<void>((resolve, reject) => {
				stream.end((error?: Error | null) => {
					if (error) {
						reject(error)
					} else {
						resolve()
					}
				})
			})

			this.performanceMonitor.recordMetric("file.large-write-bytes", bytesWritten, "bytes")
		} catch (error) {
			this.performanceMonitor.recordMetric("file.large-write-error", 1, "count")
			throw error
		}
	}

	private async writeSmallFile(filePath: string, content: string): Promise<void> {
		try {
			await writeFile(filePath, content, "utf8")
			this.performanceMonitor.recordMetric("file.small-write-success", 1, "count")
		} catch (error) {
			this.performanceMonitor.recordMetric("file.small-write-error", 1, "count")
			throw error
		}
	}

	private getCachedFile(filePath: string): FileCacheEntry | null {
		const cached = this.fileCache.get(filePath)

		if (!cached) {
			return null
		}

		// Check if cache entry is still valid
		if (Date.now() - cached.timestamp > this.config.cacheTtl) {
			this.invalidateCacheEntry(filePath)
			return null
		}

		// Update hit count
		cached.hits++
		return cached
	}

	private cacheFile(filePath: string, content: string, size: number): void {
		// Check if adding this file would exceed cache size limit
		if (this.totalCacheSize + size > FileOptimizer.MAX_CACHE_SIZE) {
			this.evictLeastUsedCacheEntries(size)
		}

		const cacheEntry: FileCacheEntry = {
			content,
			timestamp: Date.now(),
			size,
			hits: 0,
		}

		this.fileCache.set(filePath, cacheEntry)
		this.totalCacheSize += size

		this.performanceMonitor.recordMetric("file.cache-add", 1, "count")
		this.performanceMonitor.recordMetric("file.cache-size", this.totalCacheSize, "bytes")
	}

	private invalidateCacheEntry(filePath: string): void {
		const cached = this.fileCache.get(filePath)
		if (cached) {
			this.fileCache.delete(filePath)
			this.totalCacheSize -= cached.size
			this.performanceMonitor.recordMetric("file.cache-invalidate", 1, "count")
		}
	}

	private evictLeastUsedCacheEntries(requiredSpace: number): void {
		// Sort cache entries by hit count (ascending) and timestamp (ascending for ties)
		const entries = Array.from(this.fileCache.entries()).sort(([, a], [, b]) => {
			if (a.hits !== b.hits) {
				return a.hits - b.hits
			}
			return a.timestamp - b.timestamp
		})

		let freedSpace = 0
		let evictedCount = 0

		for (const [filePath, entry] of entries) {
			if (freedSpace >= requiredSpace) {
				break
			}

			this.fileCache.delete(filePath)
			this.totalCacheSize -= entry.size
			freedSpace += entry.size
			evictedCount++
		}

		this.performanceMonitor.recordMetric("file.cache-evicted", evictedCount, "count")
		this.performanceMonitor.recordMetric("file.cache-freed-space", freedSpace, "bytes")
	}

	private async waitForReadSlot(): Promise<void> {
		return new Promise<void>((resolve) => {
			const checkSlot = () => {
				if (this.activeConcurrentReads < this.config.maxConcurrentReads) {
					resolve()
				} else {
					setTimeout(checkSlot, 10) // Check every 10ms
				}
			}
			checkSlot()
		})
	}

	private async checkMemoryPressure(): Promise<void> {
		// Simple memory pressure check
		const usage = process.memoryUsage()
		const memoryUsagePercent = (usage.heapUsed / usage.heapTotal) * 100

		if (memoryUsagePercent > 85) {
			// Clear some cache entries to free memory
			this.evictLeastUsedCacheEntries(this.totalCacheSize * 0.3) // Free 30% of cache

			// Force garbage collection if available
			if (global.gc) {
				global.gc()
			}

			this.performanceMonitor.recordMetric("file.memory-pressure-handled", 1, "count")
		}
	}

	getCacheStats(): {
		entries: number
		totalSize: number
		hitRate: number
		maxSize: number
	} {
		const totalHits = Array.from(this.fileCache.values()).reduce((sum, entry) => sum + entry.hits, 0)
		const totalRequests = totalHits + this.fileCache.size // Approximate
		const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0

		return {
			entries: this.fileCache.size,
			totalSize: this.totalCacheSize,
			hitRate,
			maxSize: FileOptimizer.MAX_CACHE_SIZE,
		}
	}

	clearCache(): void {
		const entriesCleared = this.fileCache.size
		const spaceFreed = this.totalCacheSize

		this.fileCache.clear()
		this.totalCacheSize = 0

		this.performanceMonitor.recordMetric("file.cache-cleared-entries", entriesCleared, "count")
		this.performanceMonitor.recordMetric("file.cache-cleared-space", spaceFreed, "bytes")
	}

	getFileStats(): {
		activeConcurrentReads: number
		maxConcurrentReads: number
		cacheStats: ReturnType<FileOptimizer["getCacheStats"]>
		config: FileOptimizerConfig
	} {
		return {
			activeConcurrentReads: this.activeConcurrentReads,
			maxConcurrentReads: this.config.maxConcurrentReads,
			cacheStats: this.getCacheStats(),
			config: this.config,
		}
	}

	updateConfig(newConfig: Partial<FileOptimizerConfig>): void {
		this.config = { ...this.config, ...newConfig }
		this.performanceMonitor.recordMetric("file.config-updated", 1, "count")
	}
}
