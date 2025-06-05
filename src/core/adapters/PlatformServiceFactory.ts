import { IPlatformServices, PlatformContext } from "../interfaces/platform"

// Re-export for convenience
export { PlatformContext } from "../interfaces/platform"

/**
 * Platform service factory
 */
export class PlatformServiceFactory {
	private static instance: IPlatformServices | null = null
	private static context: PlatformContext | null = null

	/**
	 * Initialize platform services for the given context
	 */
	static async initialize(
		context: PlatformContext,
		extensionName: string = "roo-cline",
		configPath?: string,
	): Promise<IPlatformServices> {
		this.context = context

		switch (context) {
			case PlatformContext.VSCode:
				const { VsCodePlatformServices } = await import("./vscode/VsCodePlatformServices")
				this.instance = new VsCodePlatformServices(extensionName)
				break
			case PlatformContext.CLI:
				const { CliPlatformServices } = await import("./cli/CliPlatformServices")
				this.instance = new CliPlatformServices(extensionName, configPath)
				break
			default:
				throw new Error(`Unsupported platform context: ${context}`)
		}

		return this.instance
	}

	/**
	 * Get the current platform services instance
	 */
	static async getInstance(): Promise<IPlatformServices> {
		if (!this.instance) {
			// Try to auto-detect context
			if (this.isVsCodeContext()) {
				return await this.initialize(PlatformContext.VSCode)
			} else {
				return await this.initialize(PlatformContext.CLI)
			}
		}
		return this.instance
	}

	/**
	 * Get the current platform services instance (synchronous)
	 * Throws if not initialized
	 */
	static getInstanceSync(): IPlatformServices {
		if (!this.instance) {
			throw new Error("Platform services not initialized. Call initialize() first.")
		}
		return this.instance
	}

	/**
	 * Get the current platform context
	 */
	static getContext(): PlatformContext | null {
		return this.context
	}

	/**
	 * Check if running in VSCode context
	 */
	static isVsCodeContext(): boolean {
		try {
			// Try to require vscode module
			require("vscode")
			return true
		} catch {
			return false
		}
	}

	/**
	 * Check if running in CLI context
	 */
	static isCliContext(): boolean {
		return !this.isVsCodeContext()
	}

	/**
	 * Reset the factory (for testing)
	 */
	static reset(): void {
		this.instance = null
		this.context = null
	}
}

/**
 * Convenience function to get platform services (async)
 */
export async function getPlatformServices(): Promise<IPlatformServices> {
	return await PlatformServiceFactory.getInstance()
}

/**
 * Convenience function to get platform services (sync)
 * Throws if not initialized
 */
export function getPlatformServicesSync(): IPlatformServices {
	return PlatformServiceFactory.getInstanceSync()
}

/**
 * Convenience function to check if running in VSCode
 */
export function isVsCodeContext(): boolean {
	return PlatformServiceFactory.isVsCodeContext()
}

/**
 * Convenience function to check if running in CLI
 */
export function isCliContext(): boolean {
	return PlatformServiceFactory.isCliContext()
}
