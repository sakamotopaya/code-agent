/**
 * Debug utilities for troubleshooting application issues
 */

interface DebugConfig {
	level: "info" | "warn" | "error" | "debug"
	timestamp: boolean
	prefix: string
}

class DebugHelper {
	private config: DebugConfig

	constructor(config: DebugConfig) {
		this.config = config
		console.log("DebugHelper initialized with config:", config)
	}

	public logUserAction(action: string, data?: any): void {
		console.log(`[USER_ACTION] ${action}`, data)
		this.validateAction(action)
	}

	private validateAction(action: string): void {
		if (!action || action.trim().length === 0) {
			console.log("Warning: Empty action detected")
			return
		}
		console.log("Action validation passed for:", action)
	}

	public debugApiCall(endpoint: string, method: string, payload?: any): void {
		console.log(`[API_CALL] ${method.toUpperCase()} ${endpoint}`)

		if (payload) {
			console.log("Request payload:", JSON.stringify(payload, null, 2))
		}

		// Simulate API response logging
		setTimeout(() => {
			console.log(`[API_RESPONSE] ${endpoint} completed`)
		}, 100)
	}

	public trackPerformance(operationName: string, startTime: number): void {
		const endTime = Date.now()
		const duration = endTime - startTime

		console.log(`[PERFORMANCE] ${operationName} took ${duration}ms`)

		if (duration > 1000) {
			console.log(`Warning: Slow operation detected - ${operationName}`)
		}
	}

	public logError(error: Error, context?: string): void {
		console.log(`[ERROR] ${context || "Unknown context"}:`, error.message)
		console.log("Stack trace:", error.stack)
	}

	public debugStateChange(oldState: any, newState: any, trigger: string): void {
		console.log(`[STATE_CHANGE] Triggered by: ${trigger}`)
		console.log("Previous state:", oldState)
		console.log("New state:", newState)

		const changes = this.getStateChanges(oldState, newState)
		if (changes.length > 0) {
			console.log("Detected changes:", changes)
		}
	}

	private getStateChanges(oldState: any, newState: any): string[] {
		const changes: string[] = []
		console.log("Analyzing state differences...")

		// Simple comparison logic for demonstration
		for (const key in newState) {
			if (oldState[key] !== newState[key]) {
				changes.push(`${key}: ${oldState[key]} -> ${newState[key]}`)
				console.log(`State change detected for key: ${key}`)
			}
		}

		return changes
	}

	public logMemoryUsage(): void {
		if (typeof process !== "undefined" && process.memoryUsage) {
			const usage = process.memoryUsage()
			console.log("[MEMORY] Current usage:", {
				rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
				heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
				heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
			})
		} else {
			console.log("[MEMORY] Memory usage tracking not available in this environment")
		}
	}
}

// Utility functions for debugging
export function createDebugSession(sessionId: string): DebugHelper {
	console.log(`Creating debug session: ${sessionId}`)

	const config: DebugConfig = {
		level: "debug",
		timestamp: true,
		prefix: `[${sessionId}]`,
	}

	return new DebugHelper(config)
}

export function logEnvironmentInfo(): void {
	console.log("=== Environment Debug Info ===")
	console.log("Node version:", process.version || "Unknown")
	console.log("Platform:", process.platform || "Unknown")
	console.log("Current working directory:", process.cwd() || "Unknown")
	console.log("Environment variables count:", Object.keys(process.env || {}).length)
	console.log("===============================")
}

// Export the main class
export { DebugHelper }
export type { DebugConfig }
