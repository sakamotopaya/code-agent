import { performance } from "perf_hooks"

export interface PerformanceTimer {
	id: string
	operation: string
	startTime: number
	stop(): number
}

export interface MetricData {
	name: string
	value: number
	unit: MetricUnit
	timestamp: number
	operation?: string
}

export interface PerformanceMetrics {
	timers: Map<string, number>
	metrics: Map<string, MetricData[]>
	memory: MemoryMetrics
	uptime: number
}

export interface MemoryMetrics {
	heapUsed: number
	heapTotal: number
	external: number
	rss: number
}

export interface ProfileResult {
	operation: string
	duration: number
	memoryDelta: MemoryMetrics
	cpuUsage?: NodeJS.CpuUsage
}

export interface TimeRange {
	start: number
	end: number
}

export interface PerformanceReport {
	summary: {
		totalOperations: number
		averageExecutionTime: number
		peakMemoryUsage: number
		memoryLeaks: boolean
	}
	slowestOperations: Array<{ operation: string; duration: number }>
	memoryTrends: Array<{ timestamp: number; usage: number }>
	recommendations: string[]
}

export type MetricUnit = "ms" | "bytes" | "count" | "percent"
export type ExportFormat = "json" | "csv" | "markdown"

export interface Profiler {
	id: string
	operation: string
	startTime: number
	startMemory: MemoryMetrics
	startCpuUsage?: NodeJS.CpuUsage
}

export interface IPerformanceMonitoringService {
	// Metrics collection
	startTimer(operation: string): PerformanceTimer
	recordMetric(name: string, value: number, unit: MetricUnit): void
	recordMemoryUsage(operation: string): void

	// Profiling
	startProfiling(operation: string): Profiler
	stopProfiling(profileId: string): ProfileResult

	// Reporting
	getMetrics(timeRange?: TimeRange): PerformanceMetrics
	generateReport(): PerformanceReport
	exportMetrics(format: ExportFormat): string
}

class PerformanceTimerImpl implements PerformanceTimer {
	public readonly id: string
	public readonly operation: string
	public readonly startTime: number

	constructor(operation: string) {
		this.id = `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
		this.operation = operation
		this.startTime = performance.now()
	}

	stop(): number {
		const duration = performance.now() - this.startTime
		return duration
	}
}

export class PerformanceMonitoringService implements IPerformanceMonitoringService {
	private metrics = new Map<string, MetricData[]>()
	private activeTimers = new Map<string, PerformanceTimer>()
	private profilers = new Map<string, Profiler>()
	private readonly maxMetricsRetention = 1000 // Keep last 1000 metrics per type
	private readonly metricsRetentionTime = 24 * 60 * 60 * 1000 // 24 hours
	private currentOperation?: string

	startTimer(operation: string): PerformanceTimer {
		const timer = new PerformanceTimerImpl(operation)
		this.activeTimers.set(timer.id, timer)
		this.currentOperation = operation
		return timer
	}

	recordMetric(name: string, value: number, unit: MetricUnit): void {
		const metric: MetricData = {
			name,
			value,
			unit,
			timestamp: Date.now(),
			operation: this.currentOperation,
		}

		if (!this.metrics.has(name)) {
			this.metrics.set(name, [])
		}

		const metricArray = this.metrics.get(name)!
		metricArray.push(metric)
		this.pruneOldMetrics(name)
	}

	recordMemoryUsage(operation: string): void {
		const usage = process.memoryUsage()

		this.recordMetric("memory.heapUsed", usage.heapUsed, "bytes")
		this.recordMetric("memory.heapTotal", usage.heapTotal, "bytes")
		this.recordMetric("memory.external", usage.external, "bytes")
		this.recordMetric("memory.rss", usage.rss, "bytes")
	}

	startProfiling(operation: string): Profiler {
		const id = `prof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
		const profiler: Profiler = {
			id,
			operation,
			startTime: performance.now(),
			startMemory: this.getMemoryMetrics(),
			startCpuUsage: process.cpuUsage(),
		}

		this.profilers.set(id, profiler)
		return profiler
	}

	stopProfiling(profileId: string): ProfileResult {
		const profiler = this.profilers.get(profileId)
		if (!profiler) {
			throw new Error(`Profiler ${profileId} not found`)
		}

		const endTime = performance.now()
		const endMemory = this.getMemoryMetrics()
		const endCpuUsage = process.cpuUsage(profiler.startCpuUsage)

		const result: ProfileResult = {
			operation: profiler.operation,
			duration: endTime - profiler.startTime,
			memoryDelta: {
				heapUsed: endMemory.heapUsed - profiler.startMemory.heapUsed,
				heapTotal: endMemory.heapTotal - profiler.startMemory.heapTotal,
				external: endMemory.external - profiler.startMemory.external,
				rss: endMemory.rss - profiler.startMemory.rss,
			},
			cpuUsage: endCpuUsage,
		}

		this.profilers.delete(profileId)
		return result
	}

	getMetrics(timeRange?: TimeRange): PerformanceMetrics {
		const filteredMetrics = new Map<string, MetricData[]>()

		for (const [name, metrics] of this.metrics.entries()) {
			const filtered = timeRange
				? metrics.filter((m) => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end)
				: metrics
			filteredMetrics.set(name, filtered)
		}

		const timers = new Map<string, number>()
		for (const [id, timer] of this.activeTimers.entries()) {
			timers.set(id, performance.now() - timer.startTime)
		}

		return {
			timers,
			metrics: filteredMetrics,
			memory: this.getMemoryMetrics(),
			uptime: process.uptime() * 1000,
		}
	}

	generateReport(): PerformanceReport {
		const allMetrics = this.getMetrics()
		const timerMetrics = allMetrics.metrics.get("timer") || []
		const memoryMetrics = allMetrics.metrics.get("memory.heapUsed") || []

		// Calculate summary statistics
		const totalOperations = timerMetrics.length
		const averageExecutionTime =
			totalOperations > 0 ? timerMetrics.reduce((sum, m) => sum + m.value, 0) / totalOperations : 0

		const peakMemoryUsage = memoryMetrics.length > 0 ? Math.max(...memoryMetrics.map((m) => m.value)) : 0

		// Detect potential memory leaks (simplified heuristic)
		const memoryLeaks = this.detectMemoryLeaks(memoryMetrics)

		// Find slowest operations
		const slowestOperations = timerMetrics
			.sort((a, b) => b.value - a.value)
			.slice(0, 10)
			.map((m) => ({ operation: m.operation || "unknown", duration: m.value }))

		// Memory trends
		const memoryTrends = memoryMetrics
			.slice(-100) // Last 100 memory measurements
			.map((m) => ({ timestamp: m.timestamp, usage: m.value }))

		// Generate recommendations
		const recommendations = this.generateRecommendations(allMetrics)

		return {
			summary: {
				totalOperations,
				averageExecutionTime,
				peakMemoryUsage,
				memoryLeaks,
			},
			slowestOperations,
			memoryTrends,
			recommendations,
		}
	}

	exportMetrics(format: ExportFormat): string {
		const metrics = this.getMetrics()

		switch (format) {
			case "json":
				return JSON.stringify(metrics, this.mapReplacer, 2)

			case "csv":
				return this.exportAsCsv(metrics)

			case "markdown":
				return this.exportAsMarkdown(metrics)

			default:
				throw new Error(`Unsupported export format: ${format}`)
		}
	}

	private getCurrentOperation(): string | undefined {
		return this.currentOperation
	}

	private pruneOldMetrics(name: string): void {
		const metrics = this.metrics.get(name)!
		const now = Date.now()

		// Remove metrics older than retention time
		const filtered = metrics.filter((m) => now - m.timestamp < this.metricsRetentionTime)

		// Keep only the most recent metrics if we exceed the limit
		if (filtered.length > this.maxMetricsRetention) {
			filtered.splice(0, filtered.length - this.maxMetricsRetention)
		}

		this.metrics.set(name, filtered)
	}

	private getMemoryMetrics(): MemoryMetrics {
		const usage = process.memoryUsage()
		return {
			heapUsed: usage.heapUsed,
			heapTotal: usage.heapTotal,
			external: usage.external,
			rss: usage.rss,
		}
	}

	private detectMemoryLeaks(memoryMetrics: MetricData[]): boolean {
		if (memoryMetrics.length < 10) return false

		// Simple heuristic: check if memory usage is consistently increasing
		const recent = memoryMetrics.slice(-10)
		const oldest = recent[0].value
		const newest = recent[recent.length - 1].value

		// Consider it a leak if memory increased by more than 50% in recent measurements
		return (newest - oldest) / oldest > 0.5
	}

	private generateRecommendations(metrics: PerformanceMetrics): string[] {
		const recommendations: string[] = []

		// Check memory usage
		const memoryMetrics = metrics.metrics.get("memory.heapUsed") || []
		if (memoryMetrics.length > 0) {
			const avgMemory = memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length
			const maxMemory = Math.max(...memoryMetrics.map((m) => m.value))

			if (maxMemory > 100 * 1024 * 1024) {
				// 100MB
				recommendations.push(
					"Memory usage exceeds 100MB. Consider implementing memory optimization strategies.",
				)
			}

			if (this.detectMemoryLeaks(memoryMetrics)) {
				recommendations.push("Potential memory leak detected. Review resource cleanup in recent operations.")
			}
		}

		// Check slow operations
		const timerMetrics = metrics.metrics.get("timer") || []
		if (timerMetrics.length > 0) {
			const slowOperations = timerMetrics.filter((m) => m.value > 2000) // Slower than 2 seconds
			if (slowOperations.length > 0) {
				recommendations.push(
					`${slowOperations.length} operations took longer than 2 seconds. Consider optimization.`,
				)
			}
		}

		return recommendations
	}

	private mapReplacer(key: string, value: any): any {
		if (value instanceof Map) {
			return Object.fromEntries(value)
		}
		return value
	}

	private exportAsCsv(metrics: PerformanceMetrics): string {
		const rows: string[] = ["timestamp,metric,value,unit,operation"]

		for (const [name, metricArray] of metrics.metrics) {
			for (const metric of metricArray) {
				rows.push([metric.timestamp, metric.name, metric.value, metric.unit, metric.operation || ""].join(","))
			}
		}

		return rows.join("\n")
	}

	private exportAsMarkdown(metrics: PerformanceMetrics): string {
		const lines: string[] = []

		lines.push("# Performance Metrics Report")
		lines.push("")
		lines.push(`**Generated:** ${new Date().toISOString()}`)
		lines.push(`**Uptime:** ${Math.round(metrics.uptime / 1000)}s`)
		lines.push("")

		// Memory section
		lines.push("## Current Memory Usage")
		lines.push("| Metric | Value |")
		lines.push("|--------|-------|")
		lines.push(`| Heap Used | ${Math.round(metrics.memory.heapUsed / 1024 / 1024)}MB |`)
		lines.push(`| Heap Total | ${Math.round(metrics.memory.heapTotal / 1024 / 1024)}MB |`)
		lines.push(`| External | ${Math.round(metrics.memory.external / 1024 / 1024)}MB |`)
		lines.push(`| RSS | ${Math.round(metrics.memory.rss / 1024 / 1024)}MB |`)
		lines.push("")

		// Active timers
		if (metrics.timers.size > 0) {
			lines.push("## Active Operations")
			lines.push("| Timer ID | Duration |")
			lines.push("|----------|----------|")
			for (const [id, duration] of metrics.timers) {
				lines.push(`| ${id} | ${Math.round(duration)}ms |`)
			}
			lines.push("")
		}

		return lines.join("\n")
	}
}
