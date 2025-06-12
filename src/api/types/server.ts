/**
 * API Server Types
 *
 * Type definitions for the API server configuration and options.
 */

/**
 * Configuration options for the API server
 */
export interface ApiServerOptions {
	/** Port to listen on (default: 3000) */
	port?: number

	/** Host to bind to (default: localhost) */
	host?: string

	/** Working directory for file operations (default: process.cwd()) */
	workspaceRoot?: string

	/** Whether to enable verbose logging (default: false) */
	verbose?: boolean

	/** Whether to enable debug mode (default: false) */
	debug?: boolean

	/** CORS configuration */
	cors?: {
		origin?: string | string[] | boolean
		credentials?: boolean
		methods?: string[]
	}

	/** Security configuration */
	security?: {
		enableHelmet?: boolean
		rateLimit?: {
			max?: number
			timeWindow?: string
		}
	}

	/** Timeout configurations */
	timeouts?: {
		/** Request timeout in milliseconds */
		request?: number

		/** Keep-alive timeout in milliseconds */
		keepAlive?: number

		/** Task execution timeout in milliseconds */
		task?: number
	}

	/** SSL/TLS configuration */
	https?: {
		key?: string
		cert?: string
	}
}

/**
 * Server status information
 */
export interface ServerStatus {
	/** Whether the server is running */
	running: boolean

	/** Server start time */
	startTime?: Date

	/** Current configuration */
	config: ApiServerOptions

	/** Server statistics */
	stats: {
		/** Total requests processed */
		totalRequests: number

		/** Active connections */
		activeConnections: number

		/** Active jobs */
		activeJobs: number

		/** Memory usage */
		memoryUsage: NodeJS.MemoryUsage

		/** Uptime in milliseconds */
		uptime: number
	}
}

/**
 * Health check result
 */
export interface HealthCheck {
	/** Overall health status */
	status: "healthy" | "degraded" | "unhealthy"

	/** Timestamp of the check */
	timestamp: Date

	/** Individual component checks */
	checks: {
		/** File system access */
		filesystem: ComponentHealth

		/** MCP connection */
		mcp: ComponentHealth

		/** Memory usage */
		memory: ComponentHealth

		/** Job manager */
		jobManager: ComponentHealth
	}
}

/**
 * Individual component health status
 */
export interface ComponentHealth {
	/** Component status */
	status: "healthy" | "degraded" | "unhealthy"

	/** Optional message */
	message?: string

	/** Response time in milliseconds */
	responseTime?: number

	/** Last checked timestamp */
	lastChecked: Date
}
