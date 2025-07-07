/**
 * Configurable MCP Debug Logger
 *
 * Provides centralized, configurable debugging for MCP-related operations.
 * Can be controlled via environment variables, configuration, or runtime flags.
 */
export class McpDebugLogger {
	/**
	 * Check if MCP debugging is enabled
	 */
	private static isEnabled(): boolean {
		// Check multiple sources for debug flag
		return (
			process.env.MCP_DEBUG === "true" ||
			process.env.NODE_ENV === "development" ||
			(globalThis as any).mcpDebugEnabled === true
		)
	}

	/**
	 * Log a general MCP debug message
	 */
	static log(message: string, ...args: any[]): void {
		if (this.isEnabled()) {
			console.log(`[MCP-DEBUG] ${message}`, ...args)
		}
	}

	/**
	 * Log a debug message for a specific MCP section/component
	 */
	static section(sectionName: string, message: string, ...args: any[]): void {
		if (this.isEnabled()) {
			console.log(`[${sectionName}] ${message}`, ...args)
		}
	}

	/**
	 * Enable MCP debugging at runtime
	 */
	static enable(): void {
		;(globalThis as any).mcpDebugEnabled = true
	}

	/**
	 * Disable MCP debugging at runtime
	 */
	static disable(): void {
		;(globalThis as any).mcpDebugEnabled = false
	}

	/**
	 * Check if debugging is currently enabled
	 */
	static get enabled(): boolean {
		return this.isEnabled()
	}
}
