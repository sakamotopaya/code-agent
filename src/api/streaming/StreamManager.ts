import { SSEStream, SSEEvent, StreamOptions, JobStatus } from "./types"
import { getCLILogger } from "../../cli/services/CLILogger"
import { ServerResponse } from "http"

/**
 * Manages multiple concurrent SSE streams and their lifecycle
 */
export class StreamManager {
	private streams = new Map<string, SSEStream>()
	private keepAliveIntervals = new Map<string, NodeJS.Timeout>()
	private options: Required<StreamOptions>
	private logger = getCLILogger()

	constructor(options: StreamOptions = {}) {
		this.options = {
			keepAliveInterval: options.keepAliveInterval ?? 30000, // 30 seconds
			connectionTimeout: options.connectionTimeout ?? 300000, // 5 minutes
			maxConcurrentStreams: options.maxConcurrentStreams ?? 10,
		}

		// Cleanup inactive streams every minute
		setInterval(() => this.cleanupInactiveStreams(), 60000)
	}

	/**
	 * Create a new SSE stream for a job
	 */
	createStream(response: ServerResponse, jobId: string): SSEStream {
		if (this.streams.size >= this.options.maxConcurrentStreams) {
			throw new Error(`Maximum concurrent streams limit reached (${this.options.maxConcurrentStreams})`)
		}

		if (this.streams.has(jobId)) {
			this.logger.warn(`Stream already exists for job ${jobId}, closing existing stream`)
			this.closeStream(jobId)
		}

		const stream: SSEStream = {
			jobId,
			response,
			isActive: true,
			lastActivity: new Date(),
		}

		this.streams.set(jobId, stream)
		this.setupKeepAlive(jobId)
		this.setupErrorHandling(response, jobId)

		this.logger.info(`Created SSE stream for job ${jobId}`)
		return stream
	}

	/**
	 * Get a stream by job ID
	 */
	getStream(jobId: string): SSEStream | undefined {
		return this.streams.get(jobId)
	}

	/**
	 * Check if a stream exists and is active
	 */
	hasActiveStream(jobId: string): boolean {
		const stream = this.streams.get(jobId)
		return stream?.isActive ?? false
	}

	/**
	 * Send an SSE event to a stream
	 */
	sendEvent(jobId: string, event: SSEEvent): boolean {
		const stream = this.streams.get(jobId)
		if (!stream || !stream.isActive) {
			this.logger.warn(`Attempted to send event to inactive stream ${jobId}`)
			return false
		}

		try {
			const eventData = `data: ${JSON.stringify(event)}\n\n`
			stream.response.write(eventData)
			stream.lastActivity = new Date()

			this.logger.debug(`Sent SSE event to job ${jobId}: ${event.type}`)
			return true
		} catch (error) {
			this.logger.error(`Failed to send SSE event to job ${jobId}:`, error)
			this.closeStream(jobId)
			return false
		}
	}

	/**
	 * Send a keep-alive ping to maintain connection
	 */
	sendKeepAlive(jobId: string): boolean {
		const stream = this.streams.get(jobId)
		if (!stream || !stream.isActive) {
			return false
		}

		try {
			stream.response.write(": keep-alive\n\n")
			stream.lastActivity = new Date()
			return true
		} catch (error) {
			this.logger.error(`Failed to send keep-alive to job ${jobId}:`, error)
			this.closeStream(jobId)
			return false
		}
	}

	/**
	 * Close a stream and cleanup resources
	 */
	closeStream(jobId: string): void {
		const stream = this.streams.get(jobId)
		if (!stream) {
			return
		}

		stream.isActive = false

		// Clear keep-alive interval
		const interval = this.keepAliveIntervals.get(jobId)
		if (interval) {
			clearInterval(interval)
			this.keepAliveIntervals.delete(jobId)
		}

		// End the response stream
		try {
			if (!(stream.response as any).destroyed && !stream.response.headersSent) {
				stream.response.end()
			}
		} catch (error) {
			this.logger.error(`Error closing stream for job ${jobId}:`, error)
		}

		this.streams.delete(jobId)
		this.logger.info(`Closed SSE stream for job ${jobId}`)
	}

	/**
	 * Get all active stream job IDs
	 */
	getActiveStreamIds(): string[] {
		return Array.from(this.streams.keys()).filter((jobId) => this.streams.get(jobId)?.isActive ?? false)
	}

	/**
	 * Close all streams and cleanup
	 */
	closeAllStreams(): void {
		const activeStreams = this.getActiveStreamIds()
		this.logger.info(`Closing ${activeStreams.length} active streams`)

		for (const jobId of activeStreams) {
			this.closeStream(jobId)
		}
	}

	/**
	 * Get stream statistics
	 */
	getStats(): { total: number; active: number; inactive: number } {
		const total = this.streams.size
		const active = this.getActiveStreamIds().length
		const inactive = total - active

		return { total, active, inactive }
	}

	/**
	 * Setup keep-alive mechanism for a stream
	 */
	private setupKeepAlive(jobId: string): void {
		const interval = setInterval(() => {
			if (!this.sendKeepAlive(jobId)) {
				clearInterval(interval)
				this.keepAliveIntervals.delete(jobId)
			}
		}, this.options.keepAliveInterval)

		this.keepAliveIntervals.set(jobId, interval)
	}

	/**
	 * Setup error handling for stream response
	 */
	private setupErrorHandling(response: ServerResponse, jobId: string): void {
		response.on("error", (error) => {
			this.logger.error(`Stream error for job ${jobId}:`, error)
			this.closeStream(jobId)
		})

		response.on("close", () => {
			this.logger.debug(`Stream closed for job ${jobId}`)
			this.closeStream(jobId)
		})
	}

	/**
	 * Cleanup inactive streams that have exceeded timeout
	 */
	private cleanupInactiveStreams(): void {
		const now = new Date()
		const streamsToClose: string[] = []

		for (const [jobId, stream] of this.streams) {
			const timeSinceActivity = now.getTime() - stream.lastActivity.getTime()

			if (timeSinceActivity > this.options.connectionTimeout) {
				streamsToClose.push(jobId)
			}
		}

		if (streamsToClose.length > 0) {
			this.logger.info(`Cleaning up ${streamsToClose.length} inactive streams`)
			for (const jobId of streamsToClose) {
				this.closeStream(jobId)
			}
		}
	}
}
